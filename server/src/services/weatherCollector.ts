import WeatherInfo from '../models/WeatherInfo.js'

/** 气象抓取结果结构 */
export interface WeatherData {
  city: string;           // 城市/区县名
  temperature: number;    // 温度（℃）
  humidity: number;       // 相对湿度（%）
  pressure: number;       // 大气压（hPa）
  weatherTime: Date;      // 气象发布/观测时间
  source: string;         // 来源站点URL
}

/** 主站点：中国天气网 望城 JSON 接口（P5600），备用为原 HTML 页面 */
const PRIMARY_SITE = 'https://weather.cma.cn/api/weather/view?stationid=P5600';
const PRIMARY_SITE_LABEL = 'https://weather.cma.cn/web/weather/P5600.html';
/** 备用站点1：tianqic 望城 */
const BACKUP_SITE_1 = 'https://www.tianqic.com/changsha/wangcheng/';
/** 备用站点2：tianqi24 望城 */
const BACKUP_SITE_2 = 'https://www.tianqi24.com/wangcheng/';

/** User-Agent 避免被站点拦截 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** 数字正则工具：从字符串中提取第一个浮点/整数 */
function parseNumber(text: string): number | null {
  const m = text.replace(/[\s,]/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** 从"2026/07/29 21:45"或"2026-07-30 12:00"解析时间 */
function parseDateTime(s: string): Date | null {
  if (!s) return null;
  // 支持 YYYY/MM/DD HH:MM 和 YYYY-MM-DD HH:MM
  const m = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  }
  return null;
}

/** ============ 站点1·主站：中国天气网 JSON API ============ */
export function parseCmaResponse(resp: { code: number; data?: any }): WeatherData | null {
  if (resp.code !== 0 || !resp.data) return null;
  const d = resp.data;
  const city = d.location?.name;
  const temp = d.now?.temperature;
  const hum = d.now?.humidity;
  const pres = d.now?.pressure;
  const lastUpdate = d.lastUpdate;
  if (!city || typeof temp !== 'number' || typeof hum !== 'number' || typeof pres !== 'number') {
    return null;
  }
  const t = parseDateTime(lastUpdate) || new Date();
  return {
    city,
    temperature: Number(temp.toFixed(1)),
    humidity: Math.round(hum),
    pressure: Math.round(pres),
    weatherTime: t,
    source: PRIMARY_SITE_LABEL,
  };
}

/** ============ 备用站点1：tianqic ============ */
export function parseTianqic(html: string): WeatherData | null {
  const cityMatch = html.match(/望城区/);
  if (!cityMatch) return null;

  const dtMatch = html.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}:\d{2})\s*更新/);
  const weatherTime = dtMatch
    ? parseDateTime(`${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]} ${dtMatch[4]}`) || new Date()
    : new Date();

  // 温度：页面顶部大数字（后面会出现"湿度"）
  const tempMatch = html.match(/(\d{2})\s*[°℃度]?[\s\S]{0,250}湿度/i);
  let temperature: number | null = tempMatch ? Number(tempMatch[1]) : null;
  if (temperature == null) {
    const alt = html.match(/(\d{2})\s*[°℃度]/);
    if (alt) temperature = Number(alt[1]);
  }
  // 湿度："湿度 63%"
  const humMatch = html.match(/湿度[^\d]{0,10}(\d{1,3})\s*%/i);
  const humidity = humMatch ? Number(humMatch[1]) : null;
  // 气压："气压 1003"（无单位 hPa 时默认为 hPa；若 kPa 则×10）
  const presMatch = html.match(/气压[^\d]{0,10}(\d{3,4}\.?\d*)\s*(hPa|kPa)?/i);
  let pressure: number | null = null;
  if (presMatch) {
    let p = Number(presMatch[1]);
    if (presMatch[2]?.toLowerCase() === 'kpa' || (p > 90 && p < 105)) p = p * 10;
    if (p >= 950 && p <= 1050) pressure = Math.round(p);
  }

  if (temperature == null || humidity == null || pressure == null) return null;
  return { city: '望城区', temperature, humidity, pressure, weatherTime, source: BACKUP_SITE_1 };
}

/** ============ 备用站点2：tianqi24 ============ */
export function parseTianqi24(html: string): WeatherData | null {
  if (!html.match(/望城/)) return null;

  // 顶部温度："27*°C*" 或 "27°C"
  const tempMatch = html.match(/(\d{2})\s*[°*]*\s*C/i);
  let temperature: number | null = tempMatch ? Number(tempMatch[1]) : null;
  if (temperature == null) {
    const alt = html.match(/(\d{2})[~到-]\d{1,2}\s*°C/);
    if (alt) temperature = Number(alt[1]);
  }
  // 湿度："湿度 85%"
  const humMatch = html.match(/湿度[^\d]{0,10}(\d{1,3})\s*%/i);
  const humidity = humMatch ? Number(humMatch[1]) : null;
  // 气压："气压：100.4 kPa"（×10转 hPa）或 "气压 1004 hPa"
  const presMatch = html.match(/气压[^\d]{0,10}(\d{3,4}\.?\d*)\s*(hPa|kPa)?/i);
  let pressure: number | null = null;
  if (presMatch) {
    let p = Number(presMatch[1]);
    if (presMatch[2]?.toLowerCase() === 'kpa' || (p > 90 && p < 105)) p = p * 10;
    if (p >= 950 && p <= 1050) pressure = Math.round(p);
  }

  if (temperature == null || humidity == null || pressure == null) return null;

  // 时间：页面顶部 "2026-07-30 05:54" 或 "2026年07月30日 ... 05:54"
  let weatherTime = new Date();
  const m = html.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})[日]?\s+(\d{1,2}):(\d{2})/);
  if (m) weatherTime = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));

  return { city: '望城区', temperature, humidity, pressure, weatherTime, source: BACKUP_SITE_2 };
}

/** 抓取 URL 文本 */
async function fetchText(url: string, accept: string, timeoutMs = 15_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': accept,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 单个抓取测试结果 */
export interface CollectResult {
  data: WeatherData;
  source: string;
}

/** 三站点按顺序抓取，第一个成功返回；否则依次尝试备用 */
export async function collectWeather(): Promise<CollectResult> {
  // 站点1：CMA JSON API（优先）
  try {
    console.log('[WeatherCollector] trying cma JSON API');
    const text = await fetchText(PRIMARY_SITE, 'application/json, text/plain, */*');
    const json = JSON.parse(text);
    const data = parseCmaResponse(json);
    if (data) {
      console.log('[WeatherCollector] cma OK:', {
        city: data.city, temp: data.temperature, hum: data.humidity,
        pres: data.pressure, time: formatDateTime(data.weatherTime),
      });
      return { data, source: data.source };
    }
    console.warn('[WeatherCollector] cma JSON parse null');
  } catch (e) {
    console.warn('[WeatherCollector] cma JSON failed:', e instanceof Error ? e.message : e);
  }

  // 站点2：备用1 tianqic
  try {
    console.log('[WeatherCollector] trying tianqic');
    const html = await fetchText(BACKUP_SITE_1, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    const data = parseTianqic(html);
    if (data) {
      console.log('[WeatherCollector] tianqic OK:', {
        city: data.city, temp: data.temperature, hum: data.humidity,
        pres: data.pressure, time: formatDateTime(data.weatherTime),
      });
      return { data, source: data.source };
    }
    console.warn('[WeatherCollector] tianqic parse null');
  } catch (e) {
    console.warn('[WeatherCollector] tianqic failed:', e instanceof Error ? e.message : e);
  }

  // 站点3：备用2 tianqi24
  try {
    console.log('[WeatherCollector] trying tianqi24');
    const html = await fetchText(BACKUP_SITE_2, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    const data = parseTianqi24(html);
    if (data) {
      console.log('[WeatherCollector] tianqi24 OK:', {
        city: data.city, temp: data.temperature, hum: data.humidity,
        pres: data.pressure, time: formatDateTime(data.weatherTime),
      });
      return { data, source: data.source };
    }
    console.warn('[WeatherCollector] tianqi24 parse null');
  } catch (e) {
    console.warn('[WeatherCollector] tianqi24 failed:', e instanceof Error ? e.message : e);
  }

  throw new Error('所有气象站点抓取失败');
}

/** 执行一次抓取并保存数据库 */
export async function collectAndSaveWeather(): Promise<WeatherData> {
  const { data } = await collectWeather();
  if (WeatherInfo) {
    await WeatherInfo.create({
      city: data.city,
      temperature: data.temperature,
      humidity: data.humidity,
      pressure: data.pressure,
      weather_time: data.weatherTime,
      source: data.source,
    });
  }
  return data;
}

/** 启动定时抓取（默认每小时） */
export function startWeatherInterval(minutes = 60): ReturnType<typeof setInterval> {
  console.log(`[WeatherCollector] Auto weather collect started (every ${minutes} min)`);
  collectAndSaveWeather().catch(e => console.error('[WeatherCollector] initial err:', e));
  return setInterval(() => {
    collectAndSaveWeather().catch(e => console.error('[WeatherCollector] interval err:', e));
  }, minutes * 60_000);
}
