import axios from 'axios';
import { createWorker } from 'tesseract.js';
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

  // 图像预处理：放大、灰度化、提高对比度、二值化
  private async preprocessCaptchaImage(imgBuffer: Buffer): Promise<Buffer> {
    try {
      // 使用 Canvas API 进行图像预处理（Node.js 环境下 tesseract.js 内置支持）
      // 直接返回原图，通过 Tesseract 参数优化识别率
      return imgBuffer;
    } catch (e) {
      console.error('[EnergyMeterCollector] Image preprocessing failed, using original:', e);
      return imgBuffer;
    }
  }

  async fetchCaptcha(): Promise<CaptchaResult | null> {
    const keyStr = this.generateKeyStr(12);
    try {
      const res = await axios.post(`${API_BASE}${CAPTCHA_PATH}?keyStr=${keyStr}`, null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: { keyStr },
        responseType: 'text',
        timeout: 15000,
      });

      const imgBuffer = this.decodeCaptchaImage(res.data);
      if (!imgBuffer) {
        const raw = String(res.data).substring(0, 200);
        console.error('[EnergyMeterCollector] Failed to decode captcha image, raw:', raw);
        return null;
      }

      console.log(`[EnergyMeterCollector] Captcha image size: ${imgBuffer.length} bytes, first bytes: ${imgBuffer.slice(0, 8).toString('hex')}`);

      const processedBuffer = await this.preprocessCaptchaImage(imgBuffer);

      const psmModes = ['7', '8', '6', '10'] as const;
      for (const psm of psmModes) {
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
          tessedit_pageseg_mode: psm as any,
        });
        const { data } = await worker.recognize(processedBuffer);
        await worker.terminate();

        const code = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
        console.log(`[EnergyMeterCollector] Captcha OCR (PSM=${psm}):`, code, 'keyStr:', keyStr);

        if (code.length >= 4) {
          return { keyStr, code };
        }
      }

      console.error('[EnergyMeterCollector] All PSM modes failed for captcha');
      return null;
    } catch (e: any) {
      console.error('[EnergyMeterCollector] fetchCaptcha error:', e?.message || e);
      return null;
    }
  }

  async login(maxRetries = 15): Promise<string> {
    let lastError = '验证码获取失败或重试次数耗尽';
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[EnergyMeterCollector] Login attempt ${attempt}/${maxRetries}`);

      const captcha = await this.fetchCaptcha();
      if (!captcha) {
        lastError = '获取验证码失败（无法解码或OCR识别为空）';
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
            timeout: 20000,
          },
        );

        let body = res.data;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch {
            try { body = JSON.parse(body); } catch {
              lastError = '登录响应无法解析为 JSON';
              continue;
            }
          }
        }
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch {
            lastError = '登录响应双重 JSON 解析失败';
            continue;
          }
        }

        if (body.IsSuccess && body.Token) {
          this.token = body.Token;
          console.log('[EnergyMeterCollector] Login successful, token preview:', String(body.Token).substring(0, 50));
          return this.token;
        } else {
          lastError = body.ErrorMsg || `登录失败（ErrorCode=${body.ErrorCode || '未知'}）`;
          console.error('[EnergyMeterCollector] Login attempt failed:', lastError);
          if (body.ErrorMsg === '没有获取到要登录的用户' || body.ErrorCode === '402') {
            lastError = `用户名或密码错误（${lastError}）`;
            break;
          }
          continue;
        }
      } catch (e: any) {
        lastError = `登录请求异常：${e?.message || e}`;
        console.error('[EnergyMeterCollector] Login request error:', lastError);
      }
    }

    console.error('[EnergyMeterCollector] Login failed after all retries:', lastError);
    throw new Error(`能源平台登录失败：${lastError}（已重试 ${maxRetries} 次）`);
  }

  async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    return this.login();
  }

  async fetchTotalEnergy(): Promise<TotalEnergyRecord[]> {
    const token = await this.ensureToken();
    let lastError = '获取能源数据未知错误';

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')} ${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}:00`;
      const toStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      console.log(`[EnergyMeterCollector] 查询能源数据范围: ${fromStr} ~ ${toStr}`);

      const summaryParams = new URLSearchParams();
      summaryParams.append('From', fromStr);
      summaryParams.append('To', toStr);

      const res = await axios.post(
        `${API_BASE}${SUMMARY_PATH}`,
        summaryParams,
        {
          headers: { Token: token, Authorization: `Bearer ${token}` },
          responseType: 'text',
          timeout: 30000,
          validateStatus: () => true,
        },
      );

      if (res.status >= 400) {
        lastError = `Summary 接口 HTTP ${res.status}: ${String(res.data).substring(0, 300)}`;
        console.error('[EnergyMeterCollector] Summary API HTTP error, trying PageForTotalEnergy...', lastError);

        const pageParams = new URLSearchParams();
        pageParams.append('From', fromStr);
        pageParams.append('To', toStr);
        pageParams.append('PageIndex', '1');
        pageParams.append('PageSize', '500');

        const res2 = await axios.post(
          `${API_BASE}${TOTAL_ENERGY_PATH}`,
          pageParams,
          {
            headers: { Token: token, Authorization: `Bearer ${token}` },
            responseType: 'text',
            timeout: 30000,
            validateStatus: () => true,
          },
        );

        if (res2.status >= 400) {
          lastError = `PageForTotalEnergy 接口 HTTP ${res2.status}: ${String(res2.data).substring(0, 300)}`;
          console.error('[EnergyMeterCollector] PageForTotalEnergy API HTTP error:', lastError);
          throw new Error(`能源数据接口异常：${lastError}`);
        }

        const records = this.parseEnergyResponse(res2.data);
        if (records.length === 0 && !this._lastParseOk) {
          throw new Error('采集成功但解析结果为空（可能返回格式变化或查询范围无数据）');
        }
        return records;
      }

      const records = this.parseEnergyResponse(res.data);
      if (records.length === 0 && !this._lastParseOk) {
        throw new Error('采集成功但解析结果为空（可能返回格式变化或查询范围无数据）');
      }
      return records;
    } catch (e: any) {
      if (e instanceof Error) throw e;
      lastError = e?.message || String(e);
      console.error('[EnergyMeterCollector] fetchTotalEnergy error:', lastError);
      throw new Error(`获取能源数据失败：${lastError}`);
    }
  }

  private _lastParseOk = false;

  private parseEnergyResponse(rawData: any): TotalEnergyRecord[] {
    let body = rawData;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        try {
          body = JSON.parse(body);
        } catch {
          console.error('[EnergyMeterCollector] Total energy response parse error, raw:', String(rawData).substring(0, 400));
          this._lastParseOk = false;
          return [];
        }
      }
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { this._lastParseOk = false; return []; }
    }

    if (!body.IsSuccess) {
      const err = body.ErrorMsg || `接口返回失败 IsSuccess=false，ErrorCode=${body.ErrorCode || '未知'}`;
      console.error('[EnergyMeterCollector] Total energy API failed:', err);
      this._lastParseOk = false;
      return [];
    }

    const records: TotalEnergyRecord[] = [];
    const dataList = body.Data || body.data || body.Result || [];
    const list = Array.isArray(dataList) ? dataList : (dataList?.List || dataList?.list || []);

    for (const item of list) {
      records.push({
        时间: item.Time || item.time || item.DateTime || item.timeStr || '',
        电表名称: item.Name || item.name || item.AmmeterName || item.MeterName || '',
        通讯地址: item.Addr || item.addr || item.DeviceAddr || item.Address || item.CommAddr || '',
        正向有功总电能: Number(item.ForwardActiveEnergy ?? item.PositiveActiveEnergy ?? item.ActiveEnergy ?? item.ZxYg ?? 0),
        反向有功总电能: Number(item.ReverseActiveEnergy ?? item.NegativeActiveEnergy ?? item.FxYg ?? 0),
        正向无功总电能: Number(item.ForwardReactiveEnergy ?? item.PositiveReactiveEnergy ?? item.ReactiveEnergy ?? item.ZxWg ?? 0),
        反向无功总电能: Number(item.ReverseReactiveEnergy ?? item.NegativeReactiveEnergy ?? item.FxWg ?? 0),
      });
    }

    console.log(`[EnergyMeterCollector] Fetched ${records.length} total energy records`);
    this._lastParseOk = records.length > 0;
    return records;
  }

  async collectAndSave(taskSettingId: number): Promise<{ saved: number; fetched: number; errors: string[] }> {
    const errors: string[] = [];
    const records = await this.fetchTotalEnergy();
    if (records.length === 0) {
      return { saved: 0, fetched: 0, errors: ['返回记录数为 0'] };
    }

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
          recordTime: isNaN(new Date(r.时间).getTime()) ? new Date() : new Date(r.时间),
        });
        saved++;
      } catch (e: any) {
        const msg = `保存失败[${r.电表名称 || r.通讯地址}]: ${e?.message || e}`;
        console.error('[EnergyMeterCollector]', msg);
        errors.push(msg);
        if (errors.length >= 10) break;
      }
    }

    console.log(`[EnergyMeterCollector] Saved ${saved}/${records.length} energy meter records, errors=${errors.length}`);
    return { saved, fetched: records.length, errors };
  }
}
