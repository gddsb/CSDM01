import axios from 'axios';
import { Jimp, ResizeStrategy } from 'jimp';
import { createWorker } from 'tesseract.js';

const CAPTCHA_SCALE = 3;
const CAPTCHA_OTSU_OFFSET = -20;

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

// 用 A7 方案处理 3 张验证码
const w = await createWorker('eng');
await w.setParameters({
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  tessedit_pageseg_mode: '7',
});

for (let i = 1; i <= 10; i++) {
  const keyStr = Array.from({length: 12}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');
  const res = await axios.post(`https://nh2api.yunjichaobiao.com/api/Account/GetCaptcha?keyStr=${keyStr}`, null, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    params: { keyStr },
    responseType: 'text',
    timeout: 15000,
  });
  const imgBuffer = decodeCaptchaImage(res.data);
  if (!imgBuffer) { console.log(`#${i} 解码失败`); continue; }

  const img = await Jimp.read(imgBuffer);
  img.scale({ f: CAPTCHA_SCALE, mode: ResizeStrategy.NEAREST_NEIGHBOR });
  img.greyscale();
  const ww = img.bitmap.width, h = img.bitmap.height, d = img.bitmap.data;
  const hist = new Array(256).fill(0);
  for (let j = 0; j < d.length; j += 4) hist[d[j]]++;
  const otsu = otsuThreshold(hist, ww * h);
  const thr = Math.min(255, Math.max(0, otsu + CAPTCHA_OTSU_OFFSET));
  for (let j = 0; j < d.length; j += 4) {
    const v = d[j] < thr ? 0 : 255;
    d[j] = v; d[j+1] = v; d[j+2] = v;
  }
  const out = await img.getBuffer('image/png');
  const { data } = await w.recognize(out);
  const code = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
  console.log(`#${i} keyStr=${keyStr} Otsu=${otsu} thr=${thr} 识别="${code}" len=${code.length} ${code.length>=4?'OK':'--'}`);
}
await w.terminate();
