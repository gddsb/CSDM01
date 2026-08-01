// 15 张验证码，三种处理对比：
//   基线A: 上次的流程（放大3x NEAREST -> 灰度 -> Otsu二值化）
//   优化B: 新流程（放大3x BICUBIC -> 蓝像素过滤 -> 灰度 -> 对比度 -> threshold(130) -> blur(1) -> 去孤立像素）
// 同时做 A 灰度、A 二值化、B 二值化 三者 OCR 耗时对比
import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_v2_out';
const SCALE = 3;

// ==== 工具函数 ====
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

// Otsu 阈值（用于基线A）
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

// 去除孤立黑像素：3x3 邻域内若少于 threshold 个黑像素就把中心变白
function removeIsolatedPixels(img, minNeighbors = 2) {
  const w = img.bitmap.width, h = img.bitmap.height, d = img.bitmap.data;
  // 复制一份作读，原写入原修改
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ci = (y * w + x) * 4;
      if (src[ci] !== 0) continue; // 白跳过
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          if (src[ni] === 0) n++;
        }
      }
      if (n < minNeighbors) {
        d[ci] = 255; d[ci + 1] = 255; d[ci + 2] = 255;
      }
    }
  }
  return img;
}

// ===== 基线 A：NEAREST 放大 → 灰度 → Otsu二值化
async function processBaselineA(imgBuffer) {
  const T = await Jimp.read(imgBuffer);
  T.scale(SCALE, ResizeStrategy.NEAREST_NEIGHBOR);
  T.greyscale();
  // 灰度副本（OCR用）
  const gray = T.clone();
  // Otsu 二值化
  const w = T.bitmap.width, h = T.bitmap.height, d = T.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const thr = otsuThreshold(hist, w * h);
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < thr ? 0 : 255;
    d[i] = v; d[i+1] = v; d[i+2] = v;
  }
  return { grayImg: gray, binImg: T, otsuThr: thr };
}

// ===== 优化 B：BICUBIC 放大 → 蓝像素过滤 → 灰度 → 对比度 → threshold → blur → 去孤立像素
async function processOptimizedB(imgBuffer) {
  const O = await Jimp.read(imgBuffer);
  // 1. 放大（BICUBIC 双三次）
  O.scale(SCALE, ResizeStrategy.BICUBIC);
  const w = O.bitmap.width, h = O.bitmap.height;

  // 2. 蓝像素过滤：B 通道显著高于R、G则置白
  O.scan(0, 0, w, h, (x, y, idx) => {
    const r = O.bitmap.data[idx], g = O.bitmap.data[idx + 1], b = O.bitmap.data[idx + 2];
    if (b > r + 40 && b > g + 40) {
      O.bitmap.data[idx] = 255;     // R
      O.bitmap.data[idx + 1] = 255; // G
      O.bitmap.data[idx + 2] = 255; // B
    }
  });

  // 3. 灰度化
  O.greyscale();

  // 4. 对比度增强
  await O.contrast(0.25);

  // 5. 二值化（阈值 130）
  await O.threshold({ max: 130, autoGreyscale: false });

  // 6. 轻微高斯模糊打散单点噪点
  await O.blur(1);

  // 7. 去孤立黑像素
  removeIsolatedPixels(O, 2);

  return { binImg: O, thr: 130 };
}

// OCR 单张
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

  console.log('初始化 Tesseract workers...');
  // 3 个 worker 分别对应：A 灰度、A 二值化、B 二值化
  const wAgray = await createWorker('eng'); await wAgray.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
  const wAbin  = await createWorker('eng'); await wAbin.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
  const wBbin  = await createWorker('eng'); await wBbin.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', tessedit_pageseg_mode: '7' });
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
      const origPath = path.join(OUT_DIR, `${pad}_00_original.png`);
      fs.writeFileSync(origPath, imgBuffer);

      // 保存原图（用于展示）
      const orig = await Jimp.read(imgBuffer);
      await orig.write(path.join(OUT_DIR, `${pad}_00_original_x3.png`));

      // 基线 A
      const a = await processBaselineA(imgBuffer);
      await a.grayImg.write(path.join(OUT_DIR, `${pad}_01_grayA.png`));
      await a.binImg.write(path.join(OUT_DIR, `${pad}_02_binA.png`));

      // 优化 B
      const b = await processOptimizedB(imgBuffer);
      await b.binImg.write(path.join(OUT_DIR, `${pad}_03_binB.png`));

      // OCR
      const aGray = await ocrOnce(wAgray, a.grayImg, path.join(OUT_DIR, '_tmp_agray.png'));
      const aBin  = await ocrOnce(wAbin,  a.binImg,  path.join(OUT_DIR, '_tmp_abin.png'));
      const bBin  = await ocrOnce(wBbin,  b.binImg,  path.join(OUT_DIR, '_tmp_bbin.png'));

      console.log(`[${i}/${COUNT}] #${pad} otsu=${a.otsuThr} A灰="${aGray.text}"(${aGray.ms.toFixed(0)}ms) A二值="${aBin.text}"(${aBin.ms.toFixed(0)}ms) B二值="${bBin.text}"(${bBin.ms.toFixed(0)}ms)`);

      results.push({
        idx: i, pad, keyStr,
        otsuThr: a.otsuThr,
        aGrayText: aGray.text, aGrayMs: aGray.ms,
        aBinText: aBin.text,   aBinMs: aBin.ms,
        bBinText: bBin.text,   bBinMs: bBin.ms,
      });
    } catch (e) {
      console.error(`[${i}/${COUNT}] err:`, e?.message || e);
      failCnt++;
    }
  }

  await wAgray.terminate(); await wAbin.terminate(); await wBbin.terminate();

  const valid = results;
  const N = valid.length;
  const avg = (arr) => N ? arr.reduce((s, r) => s + r, 0) / N : 0;
  const nonEmpty = (k) => valid.filter(r => r[k] && r[k].length > 0).length;
  const lenAvg = (k) => { const x = valid.filter(r => r[k] && r[k].length > 0).map(r => r[k].length); return x.length ? x.reduce((s, a) => s + a, 0) / x.length : 0 };

  const summary = {
    count: N, failed: failCnt,
    aGray: { totalMs: valid.reduce((s, r) => s + r.aGrayMs, 0), avgMs: avg(valid.map(r => r.aGrayMs)), nonEmpty: nonEmpty('aGrayText'), avgLen: lenAvg('aGrayText') },
    aBin:  { totalMs: valid.reduce((s, r) => s + r.aBinMs, 0),  avgMs: avg(valid.map(r => r.aBinMs)),  nonEmpty: nonEmpty('aBinText'),  avgLen: lenAvg('aBinText') },
    bBin:  { totalMs: valid.reduce((s, r) => s + r.bBinMs, 0),  avgMs: avg(valid.map(r => r.bBinMs)),  nonEmpty: nonEmpty('bBinText'),  avgLen: lenAvg('bBinText') },
  };

  console.log('\n=== OCR 对比统计 ===');
  console.log(`有效样本: ${N} (解码失败: ${failCnt})`);
  console.log('A-基线 灰度图   : 总=%dms 平均=%dms 非空=%d/%d 非空平均长度=%.1f',
    summary.aGray.totalMs.toFixed(0), summary.aGray.avgMs.toFixed(0), summary.aGray.nonEmpty, N, summary.aGray.avgLen);
  console.log('A-基线 二值化   : 总=%dms 平均=%dms 非空=%d/%d 非空平均长度=%.1f',
    summary.aBin.totalMs.toFixed(0), summary.aBin.avgMs.toFixed(0), summary.aBin.nonEmpty, N, summary.aBin.avgLen);
  console.log('B-优化 二值化   : 总=%dms 平均=%dms 非空=%d/%d 非空平均长度=%.1f',
    summary.bBin.totalMs.toFixed(0), summary.bBin.avgMs.toFixed(0), summary.bBin.nonEmpty, N, summary.bBin.avgLen);

  const better = [
    { name: 'A灰度', score: summary.aGray.nonEmpty * 2 + summary.aGray.avgLen },
    { name: 'A二值化', score: summary.aBin.nonEmpty * 2 + summary.aBin.avgLen },
    { name: 'B二值化', score: summary.bBin.nonEmpty * 2 + summary.bBin.avgLen },
  ].sort((x, y) => y.score - x.score);
  console.log('\n识别有效内容综合排名 (2×非空数+平均长度): 1st=', better[0].name, better[0].score.toFixed(1), ' 2nd=', better[1].name, better[1].score.toFixed(1), ' 3rd=', better[2].name, better[2].score.toFixed(1));

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ results, summary }, null, 2));
  console.log('\n结果写入', path.join(OUT_DIR, 'results.json'));
}

main().catch(e => { console.error(e); process.exit(1); });
