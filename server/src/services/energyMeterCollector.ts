import axios from 'axios';
import { chromium, type Browser } from 'playwright';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import EnergyMeterData from '../models/EnergyMeterData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = 'https://nh2api.yunjichaobiao.com';
const YGDL_SUMMARY_PATH = '/api/Monitor/SummaryYGDL';
const YGDL_PAGE_PATH = '/api/Monitor/PageForYGDL';
const GET_AMMETER_ALL_PATH = '/api/SetMeter/GetAmmeterAll';

const LOGIN_PAGE_URL = 'https://nh2.yunjichaobiao.com/login.html';
const DDDDOCR_SCRIPT = join(__dirname, 'ocr', 'ddddocr_ocr.py');

const SELECTORS = {
  tab_password: 'text=密码登录',
  input_account: "input[placeholder='账号']",
  input_password: "input[placeholder='密码']",
  input_captcha: "input[placeholder='验证码']",
  captcha_img: "img[id='captchaImg']",
  btn_login: "button:has-text('登录')",
};

interface EnergyConfig {
  loginName: string;
  password: string;
  onProgress?: (message: string, percent: number) => void;
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

interface AmmeterItem {
  AmmeterID?: number | string;
  ID?: number | string;
  AreaID?: number | string;
  Address?: string;
  Name?: string;
  AmmeterName?: string;
  [k: string]: any;
}

function callDdddOcr(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('python3', [DDDDOCR_SCRIPT, base64Image], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[ddddocr] 调用失败:', error.message, stderr ? `stderr: ${stderr}` : '');
        resolve('');
        return;
      }
      const result = (stdout || '').trim();
      console.log(`[ddddocr] 识别结果: "${result}"`);
      resolve(result);
    });
  });
}

export class EnergyMeterCollector {
  private token: string | null = null;
  private config: EnergyConfig;

  constructor(config: EnergyConfig) {
    this.config = config;
    if (!config.loginName || !config.password) {
      throw new Error('请配置能源平台的用户名和密码');
    }
    console.log(`[EnergyMeterCollector] 初始化完成，用户: ${config.loginName}`);
  }

  private reportProgress(message: string, percent: number) {
    if (this.config.onProgress) {
      try { this.config.onProgress(message, percent); } catch (_) { /* noop */ }
    }
  }

  async login(maxRetries = 15): Promise<string> {
    this.reportProgress('正在识别验证码', 20);
    let browser: Browser | null = null;
    let lastError = '浏览器启动失败或重试次数耗尽';

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[EnergyMeterCollector] Playwright 登录尝试 ${attempt}/${maxRetries}`);
        try {
          await page.goto(LOGIN_PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);

          try {
            const passwordTab = page.locator(SELECTORS.tab_password);
            if (await passwordTab.count() > 0) {
              await passwordTab.click();
              await page.waitForTimeout(1000);
            }
          } catch (_) { /* 可能已在密码登录标签 */ }

          await page.fill(SELECTORS.input_account, this.config.loginName);
          await page.fill(SELECTORS.input_password, this.config.password);

          const captchaLocator = page.locator(SELECTORS.captcha_img);
          if (await captchaLocator.count() === 0) {
            lastError = '未找到验证码图片元素';
            continue;
          }

          this.reportProgress('正在识别验证码', 20);
          const captchaBase64 = await captchaLocator.screenshot({ type: 'png' });
          const b64Str = `data:image/png;base64,${captchaBase64.toString('base64')}`;
          const captchaCode = await callDdddOcr(b64Str);

          if (!captchaCode || captchaCode.length !== 4) {
            console.log(`[EnergyMeterCollector] 验证码识别失败: "${captchaCode}"，刷新重试`);
            try { await captchaLocator.click(); } catch (_) { /* noop */ }
            await page.waitForTimeout(1500);
            lastError = `验证码识别失败（${captchaCode || '空'}）`;
            continue;
          }

          this.reportProgress('验证码识别成功', 30);
          this.reportProgress('正在登录', 40);
          await page.fill(SELECTORS.input_captcha, captchaCode);
          await page.click(SELECTORS.btn_login);
          await page.waitForTimeout(3000);

          const currentUrl = page.url();
          if (!currentUrl.includes('login')) {
            console.log('[EnergyMeterCollector] 页面已跳转，登录成功');

            const localStorageData = await page.evaluate(() => {
              const data: Record<string, string> = {};
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) data[key] = localStorage.getItem(key) || '';
              }
              return data;
            });

            let foundToken: string | null = null;
            for (const [key, val] of Object.entries(localStorageData)) {
              if (key.toLowerCase().includes('token') && val && val.length > 10) {
                foundToken = val;
                break;
              }
            }

            if (!foundToken) {
              const cookies = await context.cookies();
              const tokenCookie = cookies.find(c => c.name.toLowerCase().includes('token'));
              if (tokenCookie) foundToken = tokenCookie.value;
            }

            if (!foundToken) {
              for (const [key, val] of Object.entries(localStorageData)) {
                if (val && val.length > 20 && /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(val)) {
                  foundToken = val;
                  break;
                }
              }
            }

            if (foundToken) {
              this.token = foundToken;
              this.reportProgress('登录成功', 50);
              console.log('[EnergyMeterCollector] 获取到 token，长度:', foundToken.length);
              await browser.close();
              return this.token;
            } else {
              lastError = '登录成功但未找到 token，请检查登录状态';
              console.warn('[EnergyMeterCollector] localStorage:', JSON.stringify(localStorageData).substring(0, 500));
            }
          } else {
            try {
              const errorText = await page.locator('.ant-message, .el-message, [class*="error"], [class*="Error"]').first().innerText({ timeout: 2000 });
              lastError = errorText || '登录失败，可能验证码错误';
            } catch (_) {
              lastError = '登录失败，可能验证码错误或账号密码不正确';
            }
            console.log(`[EnergyMeterCollector] 登录未跳转: ${lastError}`);

            if (lastError.includes('账号') || lastError.includes('密码') || lastError.includes('用户')) {
              break;
            }
          }
        } catch (e: any) {
          lastError = `登录过程异常: ${e?.message || e}`;
          console.error('[EnergyMeterCollector] Playwright 登录异常:', lastError);
        }
      }
    } catch (e: any) {
      lastError = `浏览器启动失败: ${e?.message || e}`;
      console.error('[EnergyMeterCollector] Playwright 启动失败:', lastError);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) { /* noop */ }
      }
    }

    throw new Error(`能源平台登录失败：${lastError}（已重试 ${maxRetries} 次）`);
  }

  async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    return this.login();
  }

  async fetchAmmeterList(): Promise<AmmeterItem[]> {
    const token = await this.ensureToken();
    try {
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

    const now = new Date();
    const beijingOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = beijingOffset + localOffset;
    const beijingNow = new Date(now.getTime() + offsetDiff * 60 * 1000);
    const beijingFrom = new Date(beijingNow.getTime() - 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startTime = `${beijingFrom.getFullYear()}-${pad(beijingFrom.getMonth() + 1)}-${pad(beijingFrom.getDate())} ${pad(beijingFrom.getHours())}:${pad(beijingFrom.getMinutes())}`;
    const endTime = `${beijingNow.getFullYear()}-${pad(beijingNow.getMonth() + 1)}-${pad(beijingNow.getDate())} ${pad(beijingNow.getHours())}:${pad(beijingNow.getMinutes())}`;
    console.log(`[EnergyMeterCollector] 查询范围(北京时间): ${startTime} ~ ${endTime}`);

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
      console.warn('[EnergyMeterCollector] 未能拉取到电表列表，请确认账号下有电表/权限');
    }

    const queryList = targets.length > 0 ? targets : [{ areaID: '', ammeterID: '' }];

    const out: TotalEnergyRecord[] = [];
    const errors: string[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < queryList.length; i += CONCURRENCY) {
      const chunk = queryList.slice(i, i + CONCURRENCY);
      const promises = chunk.map(async ({ areaID, ammeterID }) => {
        try {
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
    this.reportProgress('获取总表有功/无功总电能数据', 70);
    const records = await this.fetchTotalEnergy();
    if (records.length === 0) {
      return { saved: 0, fetched: 0, errors: ['返回记录数为 0'] };
    }
    this.reportProgress('数据获取成功', 85);

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

function parseJsonTwice(raw: any): any {
  if (raw == null) return raw;
  if (typeof raw !== 'string') return raw;
  let out: any = raw;
  try { out = JSON.parse(raw); } catch { return raw; }
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch { /* keep */ } }
  return out;
}
