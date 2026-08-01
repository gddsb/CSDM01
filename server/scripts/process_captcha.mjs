// 获取能源平台登录验证码 -> 放大 -> 灰度 -> Otsu 二值化 -> 保存原图与处理后图
import axios from 'axios';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';

function generateKeyStr(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
}

// 解析接口返回的 base64 图片
function decodeCaptchaImage(rawData) {
  let parsed = JSON.parse(rawData);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  if (!parsed.Data) return null;
  let b64 = parsed.Data;
  if (typeof b64 === 'string' && b64.startsWith('"') && b64.endsWith('"')) b64 = b64.slice(1, -1);
  b64 = b64.replace(/\\"/g, '"');
  return Buffer.from(b64, 'base64');
}

// Otsu 自适应阈值算法
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

async function main() {
  const outDir = '/workspace/server/scripts/captcha_out';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const keyStr = generateKeyStr(12);
  console.log('keyStr:', keyStr);

  // 1. 拉取验证码
  const res = await axios.post(`${API_BASE}${CAPTCHA_PATH}?keyStr=${keyStr}`, null, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    params: { keyStr },
    responseType: 'text',
    timeout: 15000,
  });

  const imgBuffer = decodeCaptchaImage(res.data);
  if (!imgBuffer) {
    console.error('解码失败，raw:', String(res.data).substring(0, 300));
    process.exit(1);
  }
  console.log('图片字节:', imgBuffer.length, '前8字节:', imgBuffer.slice(0, 8).toString('hex'));

  // 保存原图
  const origPath = path.join(outDir, 'captcha_original.png');
  fs.writeFileSync(origPath, imgBuffer);
  console.log('原图已保存:', origPath);

  // 2. jimp 加载
  const img = await Jimp.read(imgBuffer);
  const w0 = img.bitmap.width;
  const h0 = img.bitmap.height;
  console.log('原图尺寸:', w0, 'x', h0);

  // 3. 放大 3 倍（nearest neighbor 保留锐利边缘）
  const SCALE = 3;
  img.scale(SCALE, Jimp.RESIZE_NEAREST_NEIGHBOR);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  console.log('放大后尺寸:', w, 'x', h);

  // 4. 灰度化
  img.greyscale();

  // 5. 保存灰度图（在二值化之前）
  const grayPath = path.join(outDir, 'captcha_grayscale.png');
  const grayImg = img.clone();
  await grayImg.write(grayPath);
  console.log('灰度图已保存:', grayPath);

  // 6. 统计灰度直方图
  const hist = new Array(256).fill(0);
  const data = img.bitmap.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    hist[gray]++;
  }

  // 7. Otsu 阈值
  const total = w * h;
  const thr = otsuThreshold(hist, total);
  console.log('Otsu 阈值:', thr);

  // 8. 二值化：低于阈值 -> 黑，高于 -> 白
  //    背景通常较亮，字符较暗 -> 字符变黑
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const v = gray < thr ? 0 : 255;
    data[i] = v; data[i + 1] = v; data[i + 2] = v;
  }

  // 9. 保存二值化图
  const binPath = path.join(outDir, 'captcha_binarized.png');
  await img.write(binPath);
  console.log('二值化图已保存:', binPath);

  console.log('\n=== 处理完成 ===');
  console.log('原图:        ', origPath);
  console.log('灰度图:      ', grayPath);
  console.log('二值化图:    ', binPath);
}

main().catch(e => { console.error(e); process.exit(1); });
