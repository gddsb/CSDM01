import axios from 'axios';
import Tesseract from 'tesseract.js';
import EnergyMeterData from '../models/EnergyMeterData.js';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const LOGIN_PATH = '/api/Account/Login';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const TOTAL_ENERGY_PATH = '/api/Monitor/PageForTotalEnergy';
const SUMMARY_PATH = '/api/Monitor/SummaryTotalEnergy';

interface EnergyConfig {
  loginName: string;
  password: string;
}

interface CaptchaResult {
  keyStr: string;
  code: string;
}

interface TotalEnergyRecord {
  时间: string;
  电表名称: string;
  通讯地址: string;
  正向有功总电能: number;
  反向有功总电能: number;
  正向无功总电能: number;
  反向无功总电能: number;
}

export class EnergyMeterCollector {
  private token: string | null = null;
  private config: EnergyConfig;

  constructor(config: EnergyConfig) {
    this.config = config;
  }

  private generateKeyStr(length = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private decodeCaptchaImage(rawData: string): Buffer | null {
    try {
      let parsed = JSON.parse(rawData);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      if (!parsed.Data) return null;

      let b64 = parsed.Data;
      if (b64.startsWith('"') && b64.endsWith('"')) {
        b64 = b64.slice(1, -1);
      }
      b64 = b64.replace(/\\"/g, '"');
      return Buffer.from(b64, 'base64');
    } catch (e) {
      console.error('[EnergyMeterCollector] decodeCaptchaImage error:', e);
      return null;
    }
  }

  async fetchCaptcha(): Promise<CaptchaResult | null> {
    const keyStr = this.generateKeyStr(12);
    try {
      const res = await axios.post(`${API_BASE}${CAPTCHA_PATH}?keyStr=${keyStr}`, null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: { keyStr },
        responseType: 'text',
      });

      const imgBuffer = this.decodeCaptchaImage(res.data);
      if (!imgBuffer) {
        console.error('[EnergyMeterCollector] Failed to decode captcha image');
        return null;
      }

      const { data } = await Tesseract.recognize(imgBuffer, 'eng', {
        options: {
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          tessedit_pageseg_mode: '7',
        },
      });

      const code = (data.text || '').trim().replace(/\s+/g, '');
      console.log('[EnergyMeterCollector] Captcha OCR result:', code, 'keyStr:', keyStr);

      if (!code || code.length < 4) {
        console.error('[EnergyMeterCollector] Captcha OCR result too short:', code);
        return null;
      }

      return { keyStr, code };
    } catch (e) {
      console.error('[EnergyMeterCollector] fetchCaptcha error:', e);
      return null;
    }
  }

  async login(maxRetries = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[EnergyMeterCollector] Login attempt ${attempt}/${maxRetries}`);

      const captcha = await this.fetchCaptcha();
      if (!captcha) {
        console.error('[EnergyMeterCollector] Failed to get captcha');
        continue;
      }

      try {
        const res = await axios.post(
          `${API_BASE}${LOGIN_PATH}`,
          {
            UserID: this.config.loginName,
            Password: this.config.password,
            client: 0,
            KeyStr: captcha.keyStr,
            Code: captcha.code,
            Language: 'cn',
          },
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: 'text',
          },
        );

        let body = res.data;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            // If not valid JSON, try to parse as the double-encoded format
            try {
              body = JSON.parse(body);
            } catch {
              console.error('[EnergyMeterCollector] Login response parse error');
              continue;
            }
          }
        }

        // Handle double-encoded response
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            console.error('[EnergyMeterCollector] Login response double parse error');
            continue;
          }
        }

        if (body.IsSuccess && body.Token) {
          this.token = body.Token;
          console.log('[EnergyMeterCollector] Login successful');
          return this.token;
        } else {
          console.error('[EnergyMeterCollector] Login failed:', body.ErrorMsg || 'Unknown error');
          if (body.ErrorMsg === '请输验证码！' || body.ErrorCode === '408') {
            continue;
          }
          if (body.ErrorMsg === '没有获取到要登录的用户' || body.ErrorCode === '402') {
            console.error('[EnergyMeterCollector] Invalid credentials, skipping retries');
            return null;
          }
        }
      } catch (e: any) {
        console.error('[EnergyMeterCollector] Login request error:', e.message);
      }
    }

    console.error('[EnergyMeterCollector] Login failed after all retries');
    return null;
  }

  async ensureToken(): Promise<string | null> {
    if (this.token) return this.token;
    return this.login();
  }

  async fetchTotalEnergy(): Promise<TotalEnergyRecord[]> {
    const token = await this.ensureToken();
    if (!token) return [];

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')} ${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}:00`;
      const toStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      const res = await axios.post(
        `${API_BASE}${TOTAL_ENERGY_PATH}`,
        {
          From: fromStr,
          To: toStr,
          pageIndex: 1,
          pageSize: 200,
        },
        {
          headers: { Token: token, 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      );

      let body = res.data;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          try {
            body = JSON.parse(body);
          } catch {
            console.error('[EnergyMeterCollector] Total energy response parse error');
            return [];
          }
        }
      }

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return [];
        }
      }

      if (!body.IsSuccess) {
        console.error('[EnergyMeterCollector] Total energy API failed:', body.ErrorMsg);
        return [];
      }

      const records: TotalEnergyRecord[] = [];
      const dataList = body.Data || body.data || body.Result || [];
      const list = Array.isArray(dataList) ? dataList : (dataList?.List || dataList?.list || []);

      for (const item of list) {
        records.push({
          时间: item.Time || item.time || item.DateTime || '',
          电表名称: item.Name || item.name || item.AmmeterName || '',
          通讯地址: item.Addr || item.addr || item.DeviceAddr || item.Address || '',
          正向有功总电能: Number(item.ForwardActiveEnergy ?? item.PositiveActiveEnergy ?? item.ActiveEnergy ?? 0),
          反向有功总电能: Number(item.ReverseActiveEnergy ?? item.NegativeActiveEnergy ?? 0),
          正向无功总电能: Number(item.ForwardReactiveEnergy ?? item.PositiveReactiveEnergy ?? item.ReactiveEnergy ?? 0),
          反向无功总电能: Number(item.ReverseReactiveEnergy ?? item.NegativeReactiveEnergy ?? 0),
        });
      }

      console.log(`[EnergyMeterCollector] Fetched ${records.length} total energy records`);
      return records;
    } catch (e) {
      console.error('[EnergyMeterCollector] fetchTotalEnergy error:', e);
      return [];
    }
  }

  async collectAndSave(taskSettingId: number): Promise<{ saved: number }> {
    const records = await this.fetchTotalEnergy();
    if (records.length === 0) return { saved: 0 };

    let saved = 0;
    for (const r of records) {
      try {
        await EnergyMeterData.upsert({
          taskSettingId,
          deviceAddr: r.通讯地址,
          deviceName: r.电表名称,
          forwardActiveEnergy: r.正向有功总电能,
          forwardReactiveEnergy: r.正向无功总电能,
          reverseActiveEnergy: r.反向有功总电能,
          reverseReactiveEnergy: r.反向无功总电能,
          recordTime: new Date(r.时间),
        });
        saved++;
      } catch (e) {
        console.error('[EnergyMeterCollector] Save record error:', e);
      }
    }

    console.log(`[EnergyMeterCollector] Saved ${saved} energy meter records`);
    return { saved };
  }
}
