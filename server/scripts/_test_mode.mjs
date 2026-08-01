import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';

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

const w = await createWorker('eng');
await w.setParameters({
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  tessedit_pageseg_mode: '7',
});

const genKey = () => Array.from({length:12},()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');

let okDefault = 0, okNearest = 0;
for (let i = 1; i <= 8; i++) {
  const keyStr = genKey();
  const res = await axios.post(`https://nh2api.yunjichaobiao.com/api/Account/GetCaptcha?keyStr=${keyStr}`, null, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, params: { keyStr }, responseType: 'text', timeout: 15000,
  });
  const imgBuffer = decodeCaptchaImage(res.data);
  if (!imgBuffer) continue;

  // 方式1：默认 mode（实验脚本实际行为，scale 第二参数被忽略）
  const img1 = await Jimp.read(imgBuffer);
  img1.scale(3);  // 不指定 mode
  img1.greyscale();
  const d1 = img1.bitmap.data;
  const hist1 = new Array(256).fill(0);
  for (let j = 0; j < d1.length; j += 4) hist1[d1[j]]++;
  const otsu1 = otsuThreshold(hist1, img1.bitmap.width * img1.bitmap.height);
  const thr1 = otsu1 - 20;
  for (let j = 0; j < d1.length; j += 4) { const v = d1[j] < thr1 ? 0 : 255; d1[j]=v; d1[j+1]=v; d1[j+2]=v; }
  const out1 = await img1.getBuffer('image/png');
  const r1 = await w.recognize(out1);
  const c1 = (r1.data.text||'').trim().replace(/[^A-Za-z0-9]/g,'');

  // 方式2：显式 NEAREST
  const img2 = await Jimp.read(imgBuffer);
  img2.scale({ f: 3, mode: ResizeStrategy.NEAREST_NEIGHBOR });
  img2.greyscale();
  const d2 = img2.bitmap.data;
  const hist2 = new Array(256).fill(0);
  for (let j = 0; j < d2.length; j += 4) hist2[d2[j]]++;
  const otsu2 = otsuThreshold(hist2, img2.bitmap.width * img2.bitmap.height);
  const thr2 = otsu2 - 20;
  for (let j = 0; j < d2.length; j += 4) { const v = d2[j] < thr2 ? 0 : 255; d2[j]=v; d2[j+1]=v; d2[j+2]=v; }
  const out2 = await img2.getBuffer('image/png');
  const r2 = await w.recognize(out2);
  const c2 = (r2.data.text||'').trim().replace(/[^A-Za-z0-9]/g,'');

  if (c1.length >= 4) okDefault++;
  if (c2.length >= 4) okNearest++;
  console.log(`#${i} 默认mode="${c1}"(len=${c1.length} ${c1.length>=4?'OK':'--'})  NEAREST="${c2}"(len=${c2.length} ${c2.length>=4?'OK':'--'})`);
}
console.log(`\n汇总: 默认mode OK=${okDefault}/8  NEAREST OK=${okNearest}/8`);
await w.terminate();
