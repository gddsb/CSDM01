// v6: 基于 v5 发现 D5（Otsu+30 偏移）表现最好，本脚本重点测试不同阈值偏移
import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_v6_out';
const EXPECT_LEN = 4;

function genKeyStr(n = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = ''; for (let i = 0; i < n; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}
function decodeCaptchaImage(rawData) {
  let parsed = JSON.parse(rawData);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  if (!parsed.Data) return null;
  let b64 = parsed.Data;
  if (typeof b64 === 'string' && b64.startsWith('"') && b64.endsWith('"')) b64 = b64.slice(1, -1);
  b64 = b64.replace(/\\"/g, '"');
  return Buffer.from(b64, 'base64');
}
function otsuThreshold(hist, total) {
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, max = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}
function removeIsolatedPixels(img, minNeighbors) {
  const w = img.bitmap.width, h = img.bitmap.height, d = img.bitmap.data;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = (y * w + x) * 4;
    if (src[ci] !== 0) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (src[(ny * w + nx) * 4] === 0) n++;
    }
    if (n < minNeighbors) { d[ci] = 255; d[ci + 1] = 255; d[ci + 2] = 255; }
  }
  return img;
}

async function preprocess(imgBuffer, opts) {
  const O = await Jimp.read(imgBuffer);
  O.scale(opts.scale, ResizeStrategy.BICUBIC);
  const w = O.bitmap.width, h = O.bitmap.height;
  O.scan(0, 0, w, h, (x, y, idx) => {
    const r = O.bitmap.data[idx], g = O.bitmap.data[idx + 1], b = O.bitmap.data[idx + 2];
    if (b > r + 40 && b > g + 40) {
      O.bitmap.data[idx] = 255; O.bitmap.data[idx + 1] = 255; O.bitmap.data[idx + 2] = 255;
    }
  });
  O.greyscale();
  if (opts.contrast) await O.contrast(opts.contrast);

  // Otsu + 偏移
  const d = O.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const otsu = otsuThreshold(hist, w * h);
  const thr = Math.min(255, Math.max(0, otsu + (opts.thrOffset || 0)));
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < thr ? 0 : 255;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  if (opts.minN) removeIsolatedPixels(O, opts.minN);
  return { img: O, thrUsed: thr, otsuRaw: otsu };
}

async function ocrOnce(worker, img, tmpPath) {
  await img.write(tmpPath);
  const buf = fs.readFileSync(tmpPath);
  const t0 = process.hrtime.bigint();
  const { data } = await worker.recognize(buf);
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  const text = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
  return { text, ms };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 8 个变体：测试不同阈值偏移（20~80）和不同 PSM 组合
  const VARIANTS = [
    { key: 'E1', name: 'Otsu+20 PSM7',  opts: { scale: 5, useOtsu: true, thrOffset: 20, contrast: 0.25, minN: 1 }, psm: '7' },
    { key: 'E2', name: 'Otsu+30 PSM7',  opts: { scale: 5, useOtsu: true, thrOffset: 30, contrast: 0.25, minN: 1 }, psm: '7' },
    { key: 'E3', name: 'Otsu+40 PSM7',  opts: { scale: 5, useOtsu: true, thrOffset: 40, contrast: 0.25, minN: 1 }, psm: '7' },
    { key: 'E4', name: 'Otsu+50 PSM7',  opts: { scale: 5, useOtsu: true, thrOffset: 50, contrast: 0.25, minN: 1 }, psm: '7' },
    { key: 'E5', name: 'Otsu+60 PSM7',  opts: { scale: 5, useOtsu: true, thrOffset: 60, contrast: 0.25, minN: 1 }, psm: '7' },
    { key: 'E6', name: 'Otsu+50 PSM13', opts: { scale: 5, useOtsu: true, thrOffset: 50, contrast: 0.25, minN: 1 }, psm: '13' },
    { key: 'E7', name: 'Otsu+50 PSM8',  opts: { scale: 5, useOtsu: true, thrOffset: 50, contrast: 0.25, minN: 1 }, psm: '8' },
    { key: 'E8', name: 'Otsu+50 不降噪', opts: { scale: 5, useOtsu: true, thrOffset: 50, contrast: 0.25, minN: 0 }, psm: '7' },
  ];

  console.log('初始化 workers...');
  const workers = {};
  for (const v of VARIANTS) {
    const w = await createWorker('eng');
    await w.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      tessedit_pageseg_mode: v.psm,
    });
    workers[v.key] = w;
  }
  console.log('ready\n');

  const results = [];
  let failCnt = 0;

  for (let i = 1; i <= COUNT; i++) {
    const keyStr = genKeyStr(12);
    try {
      const res = await axios.post(`${API_BASE}${CAPTCHA_PATH}?keyStr=${keyStr}`, null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: { keyStr },
        responseType: 'text',
        timeout: 15000,
      });
      const imgBuffer = decodeCaptchaImage(res.data);
      if (!imgBuffer) { console.log(`[${i}/${COUNT}] 解码失败`); failCnt++; continue; }
      const pad = String(i).padStart(2, '0');

      const orig = await Jimp.read(imgBuffer);
      orig.scale(5, ResizeStrategy.BICUBIC);
      await orig.write(path.join(OUT_DIR, `${pad}_00_original_x5.png`));

      const row = { idx: i, pad, keyStr, variants: {} };
      const parts = [`[${i}/${COUNT}] #${pad}`];
      for (const v of VARIANTS) {
        const { img, thrUsed, otsuRaw } = await preprocess(imgBuffer, v.opts);
        await img.write(path.join(OUT_DIR, `${pad}_${v.key}.png`));
        const o = await ocrOnce(workers[v.key], img, path.join(OUT_DIR, `_tmp_${v.key}.png`));
        const complete = o.text.length === EXPECT_LEN;
        row.variants[v.key] = { text: o.text, ms: o.ms, len: o.text.length, complete, thr: thrUsed, otsu: otsuRaw };
        parts.push(`${v.key}="${o.text}"(thr=${thrUsed} ${o.ms.toFixed(0)}ms ${complete?'OK':'--'})`);
      }
      console.log(parts.join('  '));
      results.push(row);
    } catch (e) {
      console.error(`[${i}/${COUNT}] err:`, e?.message || e);
      failCnt++;
    }
  }
  for (const v of VARIANTS) await workers[v.key].terminate();

  const N = results.length;
  const summary = { count: N, failed: failCnt, expectLen: EXPECT_LEN, variants: {} };
  for (const v of VARIANTS) {
    const arr = results.map(r => r.variants[v.key]);
    const completeN = arr.filter(x => x.complete).length;
    const nonEmpty = arr.filter(x => x.len > 0).length;
    const totalMs = arr.reduce((s, x) => s + x.ms, 0);
    const avgMs = N ? totalMs / N : 0;
    const avgLenOfNonEmpty = (() => {
      const x = arr.filter(x => x.len > 0).map(x => x.len);
      return x.length ? x.reduce((s, a) => s + a, 0) / x.length : 0;
    })();
    const avgOtsu = arr.reduce((s, x) => s + (x.otsu || 0), 0) / N;
    summary.variants[v.key] = {
      name: v.name, completeN,
      completePct: N ? (completeN / N * 100) : 0,
      nonEmpty, avgLenOfNonEmpty, totalMs, avgMs, avgOtsu,
    };
  }

  console.log('\n=== 4 字符完整识别率对比 ===');
  for (const v of VARIANTS) {
    const s = summary.variants[v.key];
    console.log(`${v.key} ${s.name.padEnd(22)} 完整=${s.completeN}/${N} (${s.completePct.toFixed(0)}%) 非空=${s.nonEmpty}/${N} 非空平均长度=${s.avgLenOfNonEmpty.toFixed(1)} 平均Otsu=${s.avgOtsu.toFixed(0)} 平均=${s.avgMs.toFixed(0)}ms`);
  }
  const best = VARIANTS.map(v => ({ key: v.key, ...summary.variants[v.key] })).sort((a, b) => (b.completeN - a.completeN) || (a.avgMs - b.avgMs))[0];
  console.log(`\n最佳变体: ${best.key} ${best.name} 完整 ${best.completeN}/${N}，平均 ${best.avgMs.toFixed(0)}ms`);

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ results, summary, variants: VARIANTS }, null, 2));
  console.log('结果写入', path.join(OUT_DIR, 'results.json'));
}
main().catch(e => { console.error(e); process.exit(1); });
