// 15 张验证码：4 种 B 流水线参数变体对比，以「完整识别 4 字符」为判定标准
// 变体说明：
//   B1: 原参数 (blur1 + minN=2 + thr=130)
//   B2: 去 blur, minN=1, thr=130  （保笔画，弱降噪）
//   B3: 去 blur, 无去孤立, thr=140 （保所有黑像素，仅靠阈值）
//   B4: 去 blur, minN=1, thr=150  （高阈值保留更多字符像素）
import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_v3_out';
const SCALE = 3;
const EXPECT_LEN = 4; // 验证码固定 4 字符

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

// 去孤立黑像素
function removeIsolatedPixels(img, minNeighbors) {
  const w = img.bitmap.width, h = img.bitmap.height, d = img.bitmap.data;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x =  0; x < w; x++) {
      const ci = (y * w + x) * 4;
      if (src[ci] !== 0) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (src[(ny * w + nx) * 4] === 0) n++;
        }
      }
      if (n < minNeighbors) { d[ci] = 255; d[ci + 1] = 255; d[ci + 2] = 255; }
    }
  }
  return img;
}

// 通用预处理：放大 + 蓝像素过滤 + 灰度 + 对比度，然后按变体参数收尾
async function preprocess(imgBuffer, opts) {
  const O = await Jimp.read(imgBuffer);
  O.scale(SCALE, ResizeStrategy.BICUBIC);
  const w = O.bitmap.width, h = O.bitmap.height;
  // 蓝像素过滤
  O.scan(0, 0, w, h, (x, y, idx) => {
    const r = O.bitmap.data[idx], g = O.bitmap.data[idx + 1], b = O.bitmap.data[idx + 2];
    if (b > r + 40 && b > g + 40) {
      O.bitmap.data[idx] = 255; O.bitmap.data[idx + 1] = 255; O.bitmap.data[idx + 2] = 255;
    }
  });
  O.greyscale();
  await O.contrast(0.25);
  // 阈值二值化
  await O.threshold({ max: opts.thr, autoGreyscale: false });
  // 可选 blur
  if (opts.blur) await O.blur(opts.blur);
  // 可选去孤立
  if (opts.minN) removeIsolatedPixels(O, opts.minN);
  return O;
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

  const VARIANTS = [
    { key: 'B1', name: '原参数',          opts: { thr: 130, blur: 1, minN: 2 } },
    { key: 'B2', name: '去blur+minN1',    opts: { thr: 130, blur: 0, minN: 1 } },
    { key: 'B3', name: '去blur+无去孤立', opts: { thr: 140, blur: 0, minN: 0 } },
    { key: 'B4', name: '高阈值140+minN1', opts: { thr: 140, blur: 0, minN: 1 } },
  ];

  console.log('初始化 Tesseract workers...');
  const workers = {};
  for (const v of VARIANTS) {
    const w = await createWorker('eng');
    await w.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      tessedit_pageseg_mode: '7',
    });
    workers[v.key] = w;
  }
  console.log('workers ready\n');

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
      // 保存原图（放大3倍用于展示）
      const orig = await Jimp.read(imgBuffer);
      await orig.write(path.join(OUT_DIR, `${pad}_00_original_x3.png`));

      const row = { idx: i, pad, keyStr, variants: {} };
      const parts = [`[${i}/${COUNT}] #${pad}`];

      for (const v of VARIANTS) {
        const img = await preprocess(imgBuffer, v.opts);
        await img.write(path.join(OUT_DIR, `${pad}_${v.key}.png`));
        const o = await ocrOnce(workers[v.key], img, path.join(OUT_DIR, `_tmp_${v.key}.png`));
        const complete = o.text.length === EXPECT_LEN;
        row.variants[v.key] = { text: o.text, ms: o.ms, len: o.text.length, complete };
        parts.push(`${v.key}="${o.text}"(${o.ms.toFixed(0)}ms ${complete?'OK':'--'})`);
      }
      console.log(parts.join('  '));
      results.push(row);
    } catch (e) {
      console.error(`[${i}/${COUNT}] err:`, e?.message || e);
      failCnt++;
    }
  }

  for (const v of VARIANTS) await workers[v.key].terminate();

  // 统计：以 4 字符完整识别为判定
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
    summary.variants[v.key] = {
      name: v.name,
      completeN,            // 完整识别 4 字符数（核心指标）
      completePct: N ? (completeN / N * 100) : 0,
      nonEmpty,             // 非空识别数
      avgLenOfNonEmpty,
      totalMs, avgMs,
    };
  }

  console.log('\n=== 4 字符完整识别率对比（核心指标）===');
  for (const v of VARIANTS) {
    const s = summary.variants[v.key];
    console.log(`${v.key} ${s.name.padEnd(16)} 完整=${s.completeN}/${N} (${s.completePct.toFixed(0)}%) 非空=${s.nonEmpty}/${N} 非空平均长度=${s.avgLenOfNonEmpty.toFixed(1)} 总耗时=${s.totalMs.toFixed(0)}ms 平均=${s.avgMs.toFixed(0)}ms`);
  }
  const best = VARIANTS.map(v => ({ key: v.key, ...summary.variants[v.key] })).sort((a, b) => (b.completeN - a.completeN) || (a.avgMs - b.avgMs))[0];
  console.log(`\n最佳变体: ${best.key} ${best.name} 完整识别 ${best.completeN}/${N}，平均耗时 ${best.avgMs.toFixed(0)}ms`);

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ results, summary, variants: VARIANTS }, null, 2));
  console.log('\n结果写入', path.join(OUT_DIR, 'results.json'));
}

main().catch(e => { console.error(e); process.exit(1); });
