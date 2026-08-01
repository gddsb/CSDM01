import axios from 'axios';
import { createWorker } from 'tesseract.js';
import EnergyMeterData from '../models/EnergyMeterData.js';

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const LOGIN_PATH = '/api/Account/Login';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const YGDL_SUMMARY_PATH = '/api/Monitor/SummaryYGDL';
const YGDL_PAGE_PATH = '/api/Monitor/PageForYGDL';
const GET_AMMETER_ALL_PATH = '/api/SetMeter/GetAmmeterAll';

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

// 平台返回的电表列表项
interface AmmeterItem {
  AmmeterID?: number | string;
  ID?: number | string;
  AreaID?: number | string;
  Address?: string;
  Name?: string;
  AmmeterName?: string;
  [k: string]: any;
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

  private async preprocessCaptchaImage(imgBuffer: Buffer): Promise<Buffer> {
    try {
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
            // 登录接口真实也是 urlencoded
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

  // ========== 新：获取电表列表（含 areaID / ammeterID） ==========
  async fetchAmmeterList(): Promise<AmmeterItem[]> {
    const token = await this.ensureToken();
    try {
      // SetMeter/GetAmmeterAll，参数体参考实际页面
      const body = JSON.stringify({ pageIndex: 1, pageSize: 1000, search: '' });
      const res = await axios.post(`${API_BASE}${GET_AMMETER_ALL_PATH}`, body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Token: token,
          Authorization: `Bearer ${token}`,
        },
        responseType: 'text',
        timeout: 30000,
        validateStatus: () => true,
      });

      if (res.status >= 400) {
        console.warn('[EnergyMeterCollector] GetAmmeterAll HTTP', res.status, String(res.data).substring(0, 300));
        return [];
      }
      const data = parseJsonTwice(res.data);
      if (!data || !data.IsSuccess) {
        console.warn('[EnergyMeterCollector] GetAmmeterAll IsSuccess=false, ErrorMsg=', data?.ErrorMsg || '未知');
        return [];
      }
      // 兼容多种响应结构
      const payload = data.Data || data.data || data.Result || [];
      const arr = Array.isArray(payload) ? payload : (payload?.list || payload?.List || payload?.Records || []);
      const list: AmmeterItem[] = [];
      const seen = new Set<string>();
      for (const it of arr) {
        const id = String(it?.AmmeterID ?? it?.ID ?? '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push(it);
      }
      console.log(`[EnergyMeterCollector] 拉取电表列表成功：${list.length} 台`);
      return list;
    } catch (e: any) {
      console.warn('[EnergyMeterCollector] fetchAmmeterList 异常，将使用默认策略：', e?.message || e);
      return [];
    }
  }

  async fetchTotalEnergy(): Promise<TotalEnergyRecord[]> {
    const token = await this.ensureToken();

    // 构造时间范围：最近 3 天（与平台一致，默认 dateType=mi15）
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    // 注意：真实平台 startTime/endTime 精度是 "YYYY-MM-DD HH:mm"
    const startTime = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())} ${pad(from.getHours())}:${pad(from.getMinutes())}`;
    const endTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    console.log(`[EnergyMeterCollector] 查询范围: ${startTime} ~ ${endTime}`);

    // 先获取所有电表（含 areaID / ammeterID）
    const ammeters = await this.fetchAmmeterList();
    const targets: Array<{ areaID: string; ammeterID: string; name?: string }> = [];

    if (ammeters.length > 0) {
      for (const a of ammeters) {
        targets.push({
          areaID: String(a.AreaID ?? -1),
          ammeterID: String(a.AmmeterID ?? a.ID ?? ''),
          name: a.Name ?? a.AmmeterName ?? undefined,
        });
      }
    } else {
      // 兜底：调用者自己在 params 里指定了默认值就用；否则返回空
      console.warn('[EnergyMeterCollector] 未能拉取到电表列表，请确认账号下有电表/权限');
    }

    // 如果完全没有设备，尝试用空字符串的 areaID/ammeterID 兼容（返回全局汇总的历史记录）
    const queryList = targets.length > 0 ? targets : [{ areaID: '', ammeterID: '' }];

    const out: TotalEnergyRecord[] = [];
    const errors: string[] = [];
    // 并发控制：最多 4 个并发
    const CONCURRENCY = 4;
    for (let i = 0; i < queryList.length; i += CONCURRENCY) {
      const chunk = queryList.slice(i, i + CONCURRENCY);
      const promises = chunk.map(async ({ areaID, ammeterID }) => {
        try {
          // 取 count：先查第一页以获取 pageCount，再逐页拉取
          const firstBody = JSON.stringify({
            listType: 'device',
            pageIndex: 1,
            pageSize: 500,
            dateType: 'mi15',
            areaID: String(areaID),
            ammeterID: String(ammeterID),
            startTime,
            endTime,
            valueType: 'SJZ',
            PrivAddr: '',
          });
          const first = await axios.post(`${API_BASE}${YGDL_PAGE_PATH}`, firstBody, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              Token: token,
              Authorization: `Bearer ${token}`,
            },
            responseType: 'text',
            timeout: 45000,
            validateStatus: () => true,
          });

          if (first.status >= 400) {
            throw new Error(`PageForYGDL HTTP ${first.status}: ${String(first.data).substring(0, 200)}`);
          }
          const data = parseJsonTwice(first.data);
          if (!data?.IsSuccess) {
            throw new Error(`PageForYGDL 失败：${data?.ErrorMsg || 'IsSuccess=false'}`);
          }

          const payload = data?.Data;
          const firstItems = Array.isArray(payload?.list) ? payload.list : [];
          const total = Number(payload?.count || firstItems.length || 0);
          const pageSize = 500;
          const pageCount = Math.max(1, Math.ceil(total / pageSize));

          const items: any[] = firstItems;
          if (pageCount > 1) {
            const rest: Promise<void>[] = [];
            for (let p = 2; p <= pageCount; p++) {
              const pb = JSON.stringify({
                listType: 'device',
                pageIndex: p,
                pageSize,
                dateType: 'mi15',
                areaID: String(areaID),
                ammeterID: String(ammeterID),
                startTime,
                endTime,
                valueType: 'SJZ',
                PrivAddr: '',
              });
              rest.push(
                axios.post(`${API_BASE}${YGDL_PAGE_PATH}`, pb, {
                  headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    Token: token,
                    Authorization: `Bearer ${token}`,
                  },
                  responseType: 'text',
                  timeout: 45000,
                  validateStatus: () => true,
                }).then(res => {
                  if (res.status >= 400) return;
                  const d = parseJsonTwice(res.data);
                  const more = Array.isArray(d?.Data?.list) ? d.Data.list : [];
                  for (const it of more) items.push(it);
                }).catch(() => { /* ignore per-page errors */ })
              );
            }
            await Promise.all(rest);
          }

          for (const it of items) {
            out.push({
              时间: String(it.ReadingDate ?? it.Time ?? it.readDate ?? ''),
              电表名称: String(it.AmmeterName ?? it.Name ?? it.ammeterName ?? ''),
              通讯地址: String(it.Address ?? it.Addr ?? it.address ?? ''),
              // ZValueSum 正向有功总量，FValueSum 反向有功总量；无功用 0 占位
              正向有功总电能: Number(it.ZValueSum ?? it.ForwardActiveEnergy ?? it.zx_yg ?? 0),
              反向有功总电能: Number(it.FValueSum ?? it.ReverseActiveEnergy ?? it.fx_yg ?? 0),
              正向无功总电能: Number(it.ForwardReactiveEnergy ?? it.ZXWG ?? it.zx_wg ?? 0),
              反向无功总电能: Number(it.ReverseReactiveEnergy ?? it.FXWG ?? it.fx_wg ?? 0),
            });
          }
        } catch (e: any) {
          const msg = `电表 ammeterID=${ammeterID}: ${e?.message || e}`;
          console.error('[EnergyMeterCollector]', msg);
          errors.push(msg);
        }
      });
      await Promise.all(promises);
    }

    if (out.length === 0 && errors.length > 0) {
      const head = errors.slice(0, 3).join('；');
      throw new Error(`采集失败：${head}`);
    }

    console.log(`[EnergyMeterCollector] YGDL 采集完成：${out.length} 条历史记录，失败设备数=${errors.length}`);
    return out;
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
          recordTime: (r.时间 && !isNaN(new Date(r.时间).getTime())) ? new Date(r.时间) : new Date(),
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

// 工具：尝试把字符串（或已是对象）解析成对象，最多两次 JSON.parse 以防双重编码
function parseJsonTwice(raw: any): any {
  if (raw == null) return raw;
  if (typeof raw !== 'string') return raw;
  let out: any = raw;
  try { out = JSON.parse(raw); } catch { return raw; }
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch { /* keep */ } }
  return out;
}
