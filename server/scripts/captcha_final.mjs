// v7-final: 最终确认 - 用最佳参数（Otsu+25, PSM7）+ 与基线对比，15 张
import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_final_out';
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

// 基线 A：原 NEAREST 放大 + 灰度 + Otsu
async function baselineA(imgBuffer) {
  const O = await Jimp.read(imgBuffer);
  O.scale(3, ResizeStrategy.NEAREST_NEIGHBOR);
  O.greyscale();
  const gray = O.clone();
  const w = O.bitmap.width, h = O.bitmap.height, d = O.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const thr = otsuThreshold(hist, w * h);
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < thr ? 0 : 255;
    d[i] = v; d[i+1] = v; d[i+2] = v;
  }
  return { gray, bin: O, thr };
}

// 最终最优 F：5x BICUBIC + 蓝过滤 + 灰度 + contrast0.25 + Otsu+25 + minN=1, PSM7
async function finalF(imgBuffer) {
  const O = await Jimp.read(imgBuffer);
  O.scale(5, ResizeStrategy.BICUBIC);
  const w = O.bitmap.width, h = O.bitmap.height;
  O.scan(0, 0, w, h, (x, y, idx) => {
    const r = O.bitmap.data[idx], g = O.bitmap.data[idx + 1], b = O.bitmap.data[idx + 2];
    if (b > r + 40 && b > g + 40) {
      O.bitmap.data[idx] = 255; O.bitmap.data[idx + 1] = 255; O.bitmap.data[idx + 2] = 255;
    }
  });
  O.greyscale();
  await O.contrast(0.25);
  const d = O.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const otsu = otsuThreshold(hist, w * h);
  const thr = otsu + 25;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < thr ? 0 : 255;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  removeIsolatedPixels(O, 1);
  return { bin: O, thr, otsu };
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

  console.log('初始化 workers...');
  const wAgray = await createWorker('eng'); await wAgray.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
  const wAbin  = await createWorker('eng'); await wAbin.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
  const wF     = await createWorker('eng'); await wF.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
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

      const a = await baselineA(imgBuffer);
      await a.gray.write(path.join(OUT_DIR, `${pad}_01_A_gray.png`));
      await a.bin.write(path.join(OUT_DIR, `${pad}_02_A_bin.png`));

      const f = await finalF(imgBuffer);
      await f.bin.write(path.join(OUT_DIR, `${pad}_03_F_bin.png`));

      const aG = await ocrOnce(wAgray, a.gray, path.join(OUT_DIR, '_tmp_ag.png'));
      const aB = await ocrOnce(wAbin,  a.bin,  path.join(OUT_DIR, '_tmp_ab.png'));
      const fB = await ocrOnce(wF,    f.bin,  path.join(OUT_DIR, '_tmp_f.png'));

      console.log(`[${i}/${COUNT}] #${pad} otsu=${f.otsu}+25=${f.thr} | A灰="${aG.text}"(${aG.ms.toFixed(0)}ms, len=${aG.text.length}) | A二值="${aB.text}"(${aB.ms.toFixed(0)}ms, len=${aB.text.length}) | F最优="${fB.text}"(${fB.ms.toFixed(0)}ms, len=${fB.text.length} ${fB.text.length===4?'OK':'--'})`);

      results.push({
        idx: i, pad, keyStr,
        otsu: f.otsu, thr: f.thr,
        aGrayText: aG.text, aGrayMs: aG.ms, aGrayComplete: aG.text.length === EXPECT_LEN,
        aBinText: aB.text,  aBinMs: aB.ms,  aBinComplete: aB.text.length === EXPECT_LEN,
        fBinText: fB.text,  fBinMs: fB.ms,  fBinComplete: fB.text.length === EXPECT_LEN,
      });
    } catch (e) {
      console.error(`[${i}/${COUNT}] err:`, e?.message || e);
      failCnt++;
    }
  }
  await wAgray.terminate(); await wAbin.terminate(); await wF.terminate();

  const N = results.length;
  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  const avg = (arr) => N ? sum(arr) / N : 0;
  const summary = {
    count: N, failed: failCnt, expectLen: EXPECT_LEN,
    aGray: {
      completeN: results.filter(r => r.aGrayComplete).length,
      completePct: N ? results.filter(r => r.aGrayComplete).length / N * 100 : 0,
      nonEmpty: results.filter(r => r.aGrayText.length > 0).length,
      totalMs: sum(results.map(r => r.aGrayMs)),
      avgMs: avg(results.map(r => r.aGrayMs)),
    },
    aBin: {
      completeN: results.filter(r => r.aBinComplete).length,
      completePct: N ? results.filter(r => r.aBinComplete).length / N * 100 : 0,
      nonEmpty: results.filter(r => r.aBinText.length > 0).length,
      totalMs: sum(results.map(r => r.aBinMs)),
      avgMs: avg(results.map(r => r.aBinMs)),
    },
    fBin: {
      completeN: results.filter(r => r.fBinComplete).length,
      completePct: N ? results.filter(r => r.fBinComplete).length / N * 100 : 0,
      nonEmpty: results.filter(r => r.fBinText.length > 0).length,
      totalMs: sum(results.map(r => r.fBinMs)),
      avgMs: avg(results.map(r => r.fBinMs)),
    },
  };

  console.log('\n=== 最终对比统计（以 4 字符完整识别为判定）===');
  console.log(`有效样本: ${N}, 失败: ${failCnt}`);
  console.log(`A-基线 灰度图 : 完整=${summary.aGray.completeN}/${N} (${summary.aGray.completePct.toFixed(0)}%) 非空=${summary.aGray.nonEmpty}/${N} 总耗时=${summary.aGray.totalMs.toFixed(0)}ms 平均=${summary.aGray.avgMs.toFixed(0)}ms`);
  console.log(`A-基线 二值化 : 完整=${summary.aBin.completeN}/${N} (${summary.aBin.completePct.toFixed(0)}%) 非空=${summary.aBin.nonEmpty}/${N} 总耗时=${summary.aBin.totalMs.toFixed(0)}ms 平均=${summary.aBin.avgMs.toFixed(0)}ms`);
  console.log(`F-最优 二值化 : 完整=${summary.fBin.completeN}/${N} (${summary.fBin.completePct.toFixed(0)}%) 非空=${summary.fBin.nonEmpty}/${N} 总耗时=${summary.fBin.totalMs.toFixed(0)}ms 平均=${summary.fBin.avgMs.toFixed(0)}ms`);

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ results, summary }, null, 2));
  console.log('\n结果写入', path.join(OUT_DIR, 'results.json'));
}
main().catch(e => { console.error(e); process.exit(1); });
