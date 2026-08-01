import axios from 'axios';
import { createWorker } from 'tesseract.js';
import { Jimp } from 'jimp';
import EnergyMeterData from '../models/EnergyMeterData.js';

// 验证码预处理参数（最优方案：3x + CT0.2 + Otsu-30 + PSM7 + 不反色 + 无蓝滤）
// 测试服务器 100 样本严格4字符识别率 92% (上一版本5x+反色+蓝滤仅10%)
// 流水线：3x放大 → 灰度化 → 对比度0.2 → Otsu二值化(offset-30) → PSM7识别
let CAPTCHA_SCALE = 3;
let CAPTCHA_OTSU_OFFSET = -30;
let CAPTCHA_PSM = '7';
let CAPTCHA_INVERT = false; // 不反色（白底黑字直接识别，反色会严重降低识别率）
let CAPTCHA_BLUE_FILTER = 0; // 无蓝色过滤（加蓝滤会破坏文字像素，严重降低识别率）
let CAPTCHA_CONTRAST = 0.2; // 对比度增强（0.2最优，可提升约20%识别率）
const CAPTCHA_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// ========== 验证码识别预设方案 ==========
export interface CaptchaScheme {
  id: string;
  name: string;
  description: string;
  params: {
    scale: number;
    otsuOffset: number;
    psm: string;
    invert: boolean;
    blueFilter: number;
    contrast: number;
  };
}

export const CAPTCHA_SCHEMES: CaptchaScheme[] = [
  {
    id: 'optimal',
    name: '最优方案（推荐）',
    description: '3x放大 + 对比度0.2 + Otsu-30 + PSM7，100样本识别率92%',
    params: { scale: 3, otsuOffset: -30, psm: '7', invert: false, blueFilter: 0, contrast: 0.2 },
  },
  {
    id: 'balanced',
    name: '均衡方案',
    description: '3x放大 + 对比度0.2 + Otsu-20 + PSM7，80样本识别率67%',
    params: { scale: 3, otsuOffset: -20, psm: '7', invert: false, blueFilter: 0, contrast: 0.2 },
  },
  {
    id: 'high_contrast',
    name: '高对比方案',
    description: '3x放大 + 对比度0.25 + Otsu-20 + PSM7，100样本识别率89%',
    params: { scale: 3, otsuOffset: -20, psm: '7', invert: false, blueFilter: 0, contrast: 0.25 },
  },
  {
    id: 'psm8',
    name: 'PSM8方案',
    description: '3x放大 + Otsu-20 + PSM8，80样本识别率79%',
    params: { scale: 3, otsuOffset: -20, psm: '8', invert: false, blueFilter: 0, contrast: 0 },
  },
  {
    id: 'aggressive',
    name: '激进方案',
    description: '4x放大 + 反色 + 蓝滤 + Otsu-25 + PSM10，100样本识别率约14%（不推荐）',
    params: { scale: 4, otsuOffset: -25, psm: '10', invert: true, blueFilter: 45, contrast: 0.25 },
  },
];

// 应用方案参数（覆盖全局默认值）
export function applyCaptchaScheme(schemeId: string) {
  const scheme = CAPTCHA_SCHEMES.find(s => s.id === schemeId);
  if (scheme) {
    CAPTCHA_SCALE = scheme.params.scale;
    CAPTCHA_OTSU_OFFSET = scheme.params.otsuOffset;
    CAPTCHA_PSM = scheme.params.psm;
    CAPTCHA_INVERT = scheme.params.invert;
    CAPTCHA_BLUE_FILTER = scheme.params.blueFilter;
    CAPTCHA_CONTRAST = scheme.params.contrast;
  }
}

// 应用自定义参数
export function applyCaptchaCustomParams(p: Partial<CaptchaScheme['params']>) {
  if (p.scale !== undefined) CAPTCHA_SCALE = p.scale;
  if (p.otsuOffset !== undefined) CAPTCHA_OTSU_OFFSET = p.otsuOffset;
  if (p.psm !== undefined) CAPTCHA_PSM = p.psm;
  if (p.invert !== undefined) CAPTCHA_INVERT = p.invert;
  if (p.blueFilter !== undefined) CAPTCHA_BLUE_FILTER = p.blueFilter;
  if (p.contrast !== undefined) CAPTCHA_CONTRAST = p.contrast;
}

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const LOGIN_PATH = '/api/Account/Login';
const CAPTCHA_PATH = '/api/Account/GetCaptcha';
const YGDL_SUMMARY_PATH = '/api/Monitor/SummaryYGDL';
const YGDL_PAGE_PATH = '/api/Monitor/PageForYGDL';
const GET_AMMETER_ALL_PATH = '/api/SetMeter/GetAmmeterAll';

interface EnergyConfig {
  loginName: string;
  password: string;
  token?: string; // 直接传入已有 token，跳过登录+验证码
  captchaSchemeId?: string; // 验证码识别方案ID
  captchaParams?: Partial<CaptchaScheme['params']>; // 自定义验证码参数（优先级高于 schemeId）
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
    // 应用验证码识别方案
    if (config.captchaSchemeId) {
      applyCaptchaScheme(config.captchaSchemeId);
      console.log(`[EnergyMeterCollector] 使用验证码方案: ${config.captchaSchemeId}`);
    }
    if (config.captchaParams) {
      applyCaptchaCustomParams(config.captchaParams);
      console.log(`[EnergyMeterCollector] 应用自定义验证码参数:`, JSON.stringify(config.captchaParams));
    }
    // 如果直接传入了 token，跳过登录
    if (config.token) {
      this.token = config.token;
      console.log('[EnergyMeterCollector] 使用预置 token 模式（跳过登录+验证码），token preview:', String(config.token).substring(0, 50));
    }
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

  // 验证码预处理：放大 → 蓝色干扰线过滤 → 灰度化 → 对比度增强 → Otsu二值化 → 反色
  private async preprocessCaptchaImage(imgBuffer: Buffer): Promise<Buffer> {
    try {
      const img = await Jimp.read(imgBuffer);
      // Step 1: 放大（优先放大，避免二值化后锯齿）
      img.scale(CAPTCHA_SCALE);
      const w = img.bitmap.width, h = img.bitmap.height, d = img.bitmap.data;
      
      // Step 2: 蓝色干扰线过滤（灰度化前做，保留颜色信息）
      if (CAPTCHA_BLUE_FILTER > 0) {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (b > r + CAPTCHA_BLUE_FILTER && b > g + CAPTCHA_BLUE_FILTER) {
            d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
          }
        }
      }
      
      // Step 3: 灰度化
      img.greyscale();
      
      // Step 4: 对比度增强（拉开文字和背景差距）
      if (CAPTCHA_CONTRAST !== 0) {
        img.contrast(CAPTCHA_CONTRAST);
      }
      
      // Step 5: Otsu 自适应阈值二值化
      const d2 = img.bitmap.data;
      const hist = new Array(256).fill(0);
      for (let i = 0; i < d2.length; i += 4) hist[d2[i]]++;
      const otsu = this.otsuThreshold(hist, w * h);
      const thr = Math.min(255, Math.max(0, otsu + CAPTCHA_OTSU_OFFSET));
      for (let i = 0; i < d2.length; i += 4) {
        let val = d2[i] < thr ? 0 : 255;
        if (CAPTCHA_INVERT) val = 255 - val; // 反色
        d2[i] = val; d2[i + 1] = val; d2[i + 2] = val;
      }
      const out = await img.getBuffer('image/png');
      console.log(`[EnergyMeterCollector] 预处理完成: ${w}x${h}, Otsu=${otsu}, thr=${thr}(offset ${CAPTCHA_OTSU_OFFSET}), invert=${CAPTCHA_INVERT}, blueFilter=${CAPTCHA_BLUE_FILTER}, contrast=${CAPTCHA_CONTRAST}`);
      return out;
    } catch (e) {
      console.error('[EnergyMeterCollector] 预处理失败，回退原图:', e);
      return imgBuffer;
    }
  }

  // Otsu 自适应阈值算法
  private otsuThreshold(hist: number[], total: number): number {
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

      // A7 方案：固定 PSM=7（单行文本），实测优于 PSM 6/8/13
      const worker = await createWorker('eng');
      try {
        await worker.setParameters({
          tessedit_char_whitelist: CAPTCHA_WHITELIST,
          tessedit_pageseg_mode: CAPTCHA_PSM as any,
        });
        const { data } = await worker.recognize(processedBuffer);
        const code = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
        console.log(`[EnergyMeterCollector] Captcha OCR (PSM=${CAPTCHA_PSM}):`, code, 'keyStr:', keyStr);
        if (code.length === 4) {
          return { keyStr, code };
        }
        console.error('[EnergyMeterCollector] Captcha OCR 识别长度不是4（少于或多于），识别结果:', code);
        return null;
      } finally {
        await worker.terminate();
      }
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
    throw new Error(`能源平台登录失败：${lastError}（已重试 ${maxRetries} 次）。建议在任务设置中配置「访问令牌(Token)」直连模式以跳过验证码识别（验证码 OCR 识别率较低，账号密码登录易失败）`);
  }

  async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    // 如果没有登录凭据，直接报错
    if (!this.config.loginName || !this.config.password) {
      throw new Error('未提供 token 且缺少登录凭据（loginName/password），无法获取能源平台访问令牌');
    }
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
          'Content-Type': 'application/json',
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
    // 使用北京时间（东八区）
    const now = new Date();
    const beijingOffset = 8 * 60; // UTC+8
    const localOffset = now.getTimezoneOffset(); // 本地时区偏移（分钟，注意符号）
    const offsetDiff = beijingOffset + localOffset; // 转换为北京时间需要加的分钟数
    const beijingNow = new Date(now.getTime() + offsetDiff * 60 * 1000);
    const beijingFrom = new Date(beijingNow.getTime() - 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    // 注意：真实平台 startTime/endTime 精度是 "YYYY-MM-DD HH:mm"
    const startTime = `${beijingFrom.getFullYear()}-${pad(beijingFrom.getMonth() + 1)}-${pad(beijingFrom.getDate())} ${pad(beijingFrom.getHours())}:${pad(beijingFrom.getMinutes())}`;
    const endTime = `${beijingNow.getFullYear()}-${pad(beijingNow.getMonth() + 1)}-${pad(beijingNow.getDate())} ${pad(beijingNow.getHours())}:${pad(beijingNow.getMinutes())}`;
    console.log(`[EnergyMeterCollector] 查询范围(北京时间): ${startTime} ~ ${endTime}`);

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
              'Content-Type': 'application/json',
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
                    'Content-Type': 'application/json',
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

// ========== 验证码方案测试 ==========
export interface CaptchaTestResult {
  schemeId: string;
  schemeName: string;
  total: number;
  ok4: number;      // 恰好4字符的数量
  under4: number;   // 少于4字符
  over4: number;    // 多于4字符
  rate: number;     // 识别率(%)
  samples: { index: number; code: string; length: number; ok: boolean }[];
  error?: string;
}

/**
 * 测试指定验证码识别方案的识别率
 * @param schemeIdOrParams 方案ID或自定义参数
 * @param numSamples 测试样本数（默认15）
 */
export async function testCaptchaScheme(
  schemeIdOrParams: string | Partial<CaptchaScheme['params']>,
  numSamples = 15
): Promise<CaptchaTestResult> {
  // 保存原参数，测试完恢复
  const origParams = {
    scale: CAPTCHA_SCALE,
    otsuOffset: CAPTCHA_OTSU_OFFSET,
    psm: CAPTCHA_PSM,
    invert: CAPTCHA_INVERT,
    blueFilter: CAPTCHA_BLUE_FILTER,
    contrast: CAPTCHA_CONTRAST,
  };

  let schemeId = 'custom';
  let schemeName = '自定义参数';

  try {
    // 应用测试方案
    if (typeof schemeIdOrParams === 'string') {
      const scheme = CAPTCHA_SCHEMES.find(s => s.id === schemeIdOrParams);
      if (!scheme) {
        throw new Error(`方案不存在: ${schemeIdOrParams}`);
      }
      schemeId = scheme.id;
      schemeName = scheme.name;
      applyCaptchaScheme(scheme.id);
    } else {
      applyCaptchaCustomParams(schemeIdOrParams);
      schemeName = `自定义(${JSON.stringify(schemeIdOrParams)})`;
    }

    // 创建临时 collector 用于获取验证码
    const tempCollector = new EnergyMeterCollector({ loginName: '', password: '' });

    // 初始化 OCR worker
    const worker = await createWorker('eng');
    try {
      await worker.setParameters({
        tessedit_char_whitelist: CAPTCHA_WHITELIST,
        tessedit_pageseg_mode: CAPTCHA_PSM as any,
      });

      const samples: CaptchaTestResult['samples'] = [];
      let ok4 = 0, under4 = 0, over4 = 0;

      for (let i = 1; i <= numSamples; i++) {
        try {
          // 获取验证码图片
          const keyStr = tempCollector['generateKeyStr'](12);
          const res = await axios.post(`${API_BASE}${CAPTCHA_PATH}?keyStr=${keyStr}`, null, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            params: { keyStr },
            responseType: 'text',
            timeout: 15000,
          });

          const imgBuffer = tempCollector['decodeCaptchaImage'](res.data);
          if (!imgBuffer) {
            samples.push({ index: i, code: '', length: 0, ok: false });
            under4++;
            continue;
          }

          // 预处理
          const processedBuffer = await tempCollector['preprocessCaptchaImage'](imgBuffer);

          // OCR识别
          const { data } = await worker.recognize(processedBuffer);
          const code = (data.text || '').trim().replace(/[^A-Za-z0-9]/g, '');
          const len = code.length;
          const ok = len === 4;

          samples.push({ index: i, code, length: len, ok });
          if (ok) ok4++;
          else if (len < 4) under4++;
          else over4++;
        } catch (e: any) {
          console.error(`[CaptchaTest] 样本 ${i} 失败:`, e?.message || e);
          samples.push({ index: i, code: `ERROR:${e?.message || 'unknown'}`, length: 0, ok: false });
          under4++;
        }
      }

      const rate = numSamples > 0 ? (ok4 / numSamples) * 100 : 0;
      return {
        schemeId,
        schemeName,
        total: numSamples,
        ok4,
        under4,
        over4,
        rate: Math.round(rate * 10) / 10,
        samples,
      };
    } finally {
      await worker.terminate();
    }
  } catch (e: any) {
    return {
      schemeId,
      schemeName,
      total: 0,
      ok4: 0,
      under4: 0,
      over4: 0,
      rate: 0,
      samples: [],
      error: e?.message || '测试失败',
    };
  } finally {
    // 恢复原参数
    CAPTCHA_SCALE = origParams.scale;
    CAPTCHA_OTSU_OFFSET = origParams.otsuOffset;
    CAPTCHA_PSM = origParams.psm;
    CAPTCHA_INVERT = origParams.invert;
    CAPTCHA_BLUE_FILTER = origParams.blueFilter;
    CAPTCHA_CONTRAST = origParams.contrast;
  }
}
