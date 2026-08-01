// 方案 A 专项测试：NEAREST 放大 + 灰度 + Otsu 二值化，多组参数变体
// 判定：完整识别 4 字符为成功
import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_planA_out';
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

// 方案 A 通用处理：NEAREST 放大 → 灰度 → Otsu（可选偏移）
async function preprocessPlanA(imgBuffer, opts) {
  const O = await Jimp.read(imgBuffer);
  O.scale(opts.scale, ResizeStrategy.NEAREST_NEIGHBOR);
  O.greyscale();
  // 灰度副本
  const gray = O.clone();
  // Otsu 二值化
  const w = O.bitmap.width, h = O.bitmap.height, d = O.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const otsu = otsuThreshold(hist, w * h);
  const thr = Math.min(255, Math.max(0, otsu + (opts.thrOffset || 0)));
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < thr ? 0 : 255;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  return { gray, bin: O, otsu, thr };
}

async function ocrOnce(worker, img, tmpPath) {
  await img.write(tmpPath);
  const buf = fs.readFileSync(tmpPath);
  const t0 = process.hrtime.bigint();
  const { data } = await worker.recognize(buf);
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  const text = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
  const conf = data.confidence;
  return { text, ms, conf };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 8 个变体：NEAREST 放大 × {放大倍数 3/4/5} × {PSM 6/7/8/13} × {Otsu偏移 0/-20/+20}
  const VARIANTS = [
    { key: 'A1', name: '3x PSM7  Otsu',       opts: { scale: 3, thrOffset: 0 }, psm: '7'  },
    { key: 'A2', name: '4x PSM7  Otsu',       opts: { scale: 4, thrOffset: 0 }, psm: '7'  },
    { key: 'A3', name: '5x PSM7  Otsu',       opts: { scale: 5, thrOffset: 0 }, psm: '7'  },
    { key: 'A4', name: '3x PSM6  Otsu',       opts: { scale: 3, thrOffset: 0 }, psm: '6'  },
    { key: 'A5', name: '3x PSM8  Otsu',       opts: { scale: 3, thrOffset: 0 }, psm: '8'  },
    { key: 'A6', name: '3x PSM13 Otsu',       opts: { scale: 3, thrOffset: 0 }, psm: '13' },
    { key: 'A7', name: '3x PSM7  Otsu-20',    opts: { scale: 3, thrOffset: -20 }, psm: '7' },
    { key: 'A8', name: '3x PSM7  Otsu+20',    opts: { scale: 3, thrOffset: 20 }, psm: '7' },
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

      // 原图（5倍放大用于展示）
      const orig = await Jimp.read(imgBuffer);
      orig.scale(5, ResizeStrategy.BICUBIC);
      await orig.write(path.join(OUT_DIR, `${pad}_00_original_x5.png`));

      const row = { idx: i, pad, keyStr, variants: {} };
      const parts = [`[${i}/${COUNT}] #${pad}`];
      for (const v of VARIANTS) {
        const { gray, bin, otsu, thr } = await preprocessPlanA(imgBuffer, v.opts);
        await gray.write(path.join(OUT_DIR, `${pad}_${v.key}_gray.png`));
        await bin.write(path.join(OUT_DIR, `${pad}_${v.key}_bin.png`));
        const o = await ocrOnce(workers[v.key], bin, path.join(OUT_DIR, `_tmp_${v.key}.png`));
        const complete = o.text.length === EXPECT_LEN;
        row.variants[v.key] = { text: o.text, ms: o.ms, conf: o.conf, len: o.text.length, complete, otsu, thr };
        parts.push(`${v.key}="${o.text}"(thr=${thr} ${o.ms.toFixed(0)}ms ${complete?'OK':'--'})`);
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
    const avgConf = arr.reduce((s, x) => s + (x.conf || 0), 0) / N;
    summary.variants[v.key] = {
      name: v.name, completeN,
      completePct: N ? (completeN / N * 100) : 0,
      nonEmpty, avgLenOfNonEmpty, totalMs, avgMs, avgConf,
    };
  }

  console.log('\n=== 方案 A 4 字符完整识别率对比 ===');
  for (const v of VARIANTS) {
    const s = summary.variants[v.key];
    console.log(`${v.key} ${s.name.padEnd(22)} 完整=${s.completeN}/${N} (${s.completePct.toFixed(0)}%) 非空=${s.nonEmpty}/${N} 非空平均长度=${s.avgLenOfNonEmpty.toFixed(1)} 平均置信度=${s.avgConf.toFixed(0)} 平均=${s.avgMs.toFixed(0)}ms`);
  }
  const best = VARIANTS.map(v => ({ key: v.key, ...summary.variants[v.key] })).sort((a, b) => (b.completeN - a.completeN) || (a.avgMs - b.avgMs))[0];
  console.log(`\n最佳变体: ${best.key} ${best.name} 完整 ${best.completeN}/${N}，平均 ${best.avgMs.toFixed(0)}ms`);

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ results, summary, variants: VARIANTS }, null, 2));
  console.log('结果写入', path.join(OUT_DIR, 'results.json'));
}
main().catch(e => { console.error(e); process.exit(1); });
