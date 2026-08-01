// 批量获取能源平台验证码（15张）-> 放大3倍 -> 灰度 -> Otsu二值化 -> 灰度图/二值化图分别 OCR 计时对比
import axios from 'axios';
import { Jimp } from 'jimp';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const COUNT = 15;
const OUT_DIR = '/workspace/server/scripts/captcha_batch_out';
const SCALE = 3;

function genKeyStr(n = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < n; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
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

// Otsu 自适应阈值
function otsuThreshold(hist, total) {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, max = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}

// 处理单张图片：返回 { grayImg, binImg, thr, w, h }
async function processImage(imgBuffer) {
  const img = await Jimp.read(imgBuffer);
  img.scale(SCALE, Jimp.RESIZE_NEAREST_NEIGHBOR);
  img.greyscale();

  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // 灰度图副本（在二值化前 clone）
  const grayImg = img.clone();

  // 直方图
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
  const thr = otsuThreshold(hist, w * h);

  // 二值化（在原图上操作）
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] < thr ? 0 : 255;
    data[i] = v; data[i + 1] = v; data[i + 2] = v;
  }

  return { grayImg, binImg: img, thr, w, h };
}

// OCR 单张图：返回 { text, ms }
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

  // 预先创建两个 worker（避免每张图都初始化）
  console.log('初始化 OCR workers...');
  const wGray = await createWorker('eng');
  await wGray.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    tessedit_pageseg_mode: '7',
  });
  const wBin = await createWorker('eng');
  await wBin.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    tessedit_pageseg_mode: '7',
  });
  console.log('workers 就绪\n');

  const results = [];

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
      if (!imgBuffer) {
        console.log(`[${i}/${COUNT}] 解码失败，跳过`);
        continue;
      }

      const { grayImg, binImg, thr, w, h } = await processImage(imgBuffer);

      // 保存原图、灰度图、二值化图
      const origPath = path.join(OUT_DIR, `${String(i).padStart(2, '0')}_original.png`);
      const grayPath = path.join(OUT_DIR, `${String(i).padStart(2, '0')}_gray.png`);
      const binPath = path.join(OUT_DIR, `${String(i).padStart(2, '0')}_bin.png`);
      fs.writeFileSync(origPath, imgBuffer);
      await grayImg.write(grayPath);
      await binImg.write(binPath);

      // 灰度图 OCR
      const g = await ocrOnce(wGray, grayImg, path.join(OUT_DIR, '_tmp_gray.png'));
      // 二值化图 OCR
      const b = await ocrOnce(wBin, binImg, path.join(OUT_DIR, '_tmp_bin.png'));

      console.log(`[${i}/${COUNT}] keyStr=${keyStr} thr=${thr} gray="${g.text}"(${g.ms.toFixed(0)}ms) bin="${b.text}"(${b.ms.toFixed(0)}ms)`);

      results.push({
        idx: i, keyStr, thr,
        w, h,
        grayText: g.text, grayMs: g.ms,
        binText: b.text, binMs: b.ms,
      });
    } catch (e) {
      console.error(`[${i}/${COUNT}] 异常:`, e?.message || e);
    }
  }

  await wGray.terminate();
  await wBin.terminate();

  // 统计
  const valid = results.filter(r => r.grayMs && r.binMs);
  const grayTotal = valid.reduce((s, r) => s + r.grayMs, 0);
  const binTotal = valid.reduce((s, r) => s + r.binMs, 0);
  const grayAvg = valid.length ? grayTotal / valid.length : 0;
  const binAvg = valid.length ? binTotal / valid.length : 0;
  const grayMin = valid.length ? Math.min(...valid.map(r => r.grayMs)) : 0;
  const grayMax = valid.length ? Math.max(...valid.map(r => r.grayMs)) : 0;
  const binMin = valid.length ? Math.min(...valid.map(r => r.binMs)) : 0;
  const binMax = valid.length ? Math.max(...valid.map(r => r.binMs)) : 0;

  const summary = {
    count: valid.length,
    gray: { totalMs: grayTotal, avgMs: grayAvg, minMs: grayMin, maxMs: grayMax },
    bin:  { totalMs: binTotal, avgMs: binAvg, minMs: binMin, maxMs: binMax },
    binFaster: binAvg < grayAvg,
    diffPct: grayAvg > 0 ? ((grayAvg - binAvg) / grayAvg * 100) : 0,
  };

  console.log('\n=== OCR 耗时对比统计 ===');
  console.log(`样本数: ${summary.count}`);
  console.log(`灰度图: 总=${grayTotal.toFixed(0)}ms 平均=${grayAvg.toFixed(0)}ms min=${grayMin.toFixed(0)}ms max=${grayMax.toFixed(0)}ms`);
  console.log(`二值化: 总=${binTotal.toFixed(0)}ms 平均=${binAvg.toFixed(0)}ms min=${binMin.toFixed(0)}ms max=${binMax.toFixed(0)}ms`);
  console.log(`更快: ${summary.binFaster ? '二值化图' : '灰度图'}，差异 ${Math.abs(summary.diffPct).toFixed(1)}%`);

  // 写出 JSON 供页面使用
  fs.writeFileSync(
    path.join(OUT_DIR, 'results.json'),
    JSON.stringify({ results, summary }, null, 2)
  );
  console.log('\n结果已写入', path.join(OUT_DIR, 'results.json'));
}

main().catch(e => { console.error(e); process.exit(1); });
