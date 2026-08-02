import { EnergyMeterCollector, testCaptchaScheme, CAPTCHA_SCHEMES } from './src/services/energyMeterCollector';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const API_BASE = 'http://sddlsb.jnyunji.com:5000';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';

const saveDir = '/tmp/captcha_samples';
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

console.log('=== 下载并保存10组原始验证码图片 ===');
for (let i = 1; i <= 10; i++) {
  try {
    const keyStr = Math.random().toString(36).substring(2, 14);
    const res = await axios.post(API_BASE + CAPTCHA_PATH + '?keyStr=' + keyStr, null, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'text',
      timeout: 15000,
    });
    const base64 = res.data;
    const imgBuffer = Buffer.from(base64, 'base64');
    const filePath = path.join(saveDir, 'captcha_' + i + '.png');
    fs.writeFileSync(filePath, imgBuffer);
    console.log('  保存: ' + filePath + ' (' + imgBuffer.length + ' bytes)');
  } catch(e: any) {
    console.log('  [' + i + '] 下载失败: ' + e.message);
  }
}

console.log('\n=== 测试所有5种方案（各10组）===');
for (const scheme of CAPTCHA_SCHEMES) {
  console.log('\n--- ' + scheme.id + ': ' + scheme.name + ' ---');
  try {
    const r = await testCaptchaScheme(scheme.id, 10);
    console.log('  识别率: ' + r.rate + '% (' + r.ok4 + '/' + r.total + ')  under4=' + r.under4 + ' over4=' + r.over4);
    console.log('  样本: ' + r.samples.map(s => '"' + s.code + '"').join(', '));
  } catch(e: any) {
    console.log('  失败: ' + e.message);
  }
}

console.log('\n✅ 测试完成，验证码图片保存在 ' + saveDir);
