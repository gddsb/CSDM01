/**
 * 气象抓取三站点功能测试脚本
 * 分别测试 主站点（中国天气网JSON）、备用1（tianqic）、备用2（tianqi24）能否提取：
 *   城市、温度、湿度、大气压、时间
 * 用法：
 *   cd /workspace/u9-data-sync/server && npx tsx src/tests/weather.test.ts
 */
import {
  parseCmaResponse, parseTianqic, parseTianqi24, collectWeather, WeatherData,
} from '../services/weatherCollector';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

async function fetchHttp(url: string, accept: string, timeoutMs = 20_000): Promise<string> {
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

interface SiteTestCase {
  name: string;
  url: string;
  accept: string;
  parse: (raw: string) => WeatherData | null;
}

const PRIMARY_JSON = 'https://weather.cma.cn/api/weather/view?stationid=P5600';

const testCases: SiteTestCase[] = [
  {
    name: '站点1·主站·中国天气网 JSON API（P5600 望城）',
    url: PRIMARY_JSON,
    accept: 'application/json, text/plain, */*',
    parse: (raw) => parseCmaResponse(JSON.parse(raw)),
  },
  {
    name: '站点2·备用1·tianqic 望城',
    url: 'https://www.tianqic.com/changsha/wangcheng/',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    parse: parseTianqic,
  },
  {
    name: '站点3·备用2·tianqi24 望城',
    url: 'https://www.tianqi24.com/wangcheng/',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    parse: parseTianqi24,
  },
];

function printData(label: string, d: WeatherData | null): boolean {
  if (!d) {
    console.log(`  ❌ ${label}: 解析返回 null`);
    return false;
  }
  const ok =
    typeof d.city === 'string' && d.city.length > 0 &&
    typeof d.temperature === 'number' && Number.isFinite(d.temperature) && d.temperature > -40 && d.temperature < 60 &&
    typeof d.humidity === 'number' && Number.isFinite(d.humidity) && d.humidity >= 0 && d.humidity <= 100 &&
    typeof d.pressure === 'number' && Number.isFinite(d.pressure) && d.pressure >= 900 && d.pressure <= 1100 &&
    d.weatherTime instanceof Date && !Number.isNaN(d.weatherTime.getTime()) &&
    typeof d.source === 'string' && d.source.startsWith('http');
  console.log(`  ${ok ? '✅' : '❌'} ${label}:`);
  console.log(`      城市    : ${JSON.stringify(d.city)}`);
  console.log(`      温度    : ${d.temperature} ℃  (valid=${d.temperature > -40 && d.temperature < 60})`);
  console.log(`      湿度    : ${d.humidity} %   (valid=${d.humidity >= 0 && d.humidity <= 100})`);
  console.log(`      大气压  : ${d.pressure} hPa (valid=${d.pressure >= 900 && d.pressure <= 1100})`);
  console.log(`      气象时间: ${d.weatherTime.toISOString()} (valid=${!Number.isNaN(d.weatherTime.getTime())})`);
  console.log(`      来源URL : ${d.source}`);
  return ok;
}

async function run() {
  console.log('=========================================================');
  console.log('气象抓取三站点功能测试');
  console.log(`运行时间: ${new Date().toISOString()}`);
  console.log('=========================================================');

  const results: Array<{ name: string; ok: boolean; err?: string }> = [];

  for (const tc of testCases) {
    console.log(`\n▶ ${tc.name}`);
    console.log(`  URL: ${tc.url}`);
    try {
      const raw = await fetchHttp(tc.url, tc.accept);
      const isJson = tc.accept.includes('json');
      console.log(`  下载: ${raw.length} 字节 (${isJson ? 'JSON' : 'HTML'})`);
      const data = tc.parse(raw);
      const ok = printData(tc.name, data);
      results.push({ name: tc.name, ok });
    } catch (e: any) {
      console.log(`  ❌ 抓取失败: ${e?.message || e}`);
      results.push({ name: tc.name, ok: false, err: e?.message || String(e) });
    }
  }

  console.log('\n=========================================================');
  console.log('▶ 三站点容错顺序测试（collectWeather，自动降级）');
  try {
    const { data, source } = await collectWeather();
    const ok = printData('collectWeather 最终结果', data);
    console.log(`  实际使用来源: ${source}`);
    results.push({ name: 'collectWeather 容错顺序', ok });
  } catch (e: any) {
    console.log(`  ❌ collectWeather 失败: ${e?.message || e}`);
    results.push({ name: 'collectWeather 容错顺序', ok: false, err: e?.message || String(e) });
  }

  console.log('\n=========================================================');
  console.log('汇总结果');
  console.log('---------------------------------------------------------');
  let passed = 0;
  for (const r of results) {
    console.log(`  ${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.name}${r.err ? ' (' + r.err + ')' : ''}`);
    if (r.ok) passed++;
  }
  console.log('---------------------------------------------------------');
  console.log(`通过: ${passed} / ${results.length}`);
  console.log('=========================================================');
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(2);
});
