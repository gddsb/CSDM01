import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { EnvMonitor, EnvAlarm } from '../models';

const router = Router();

/** 根据因子名称判断区域 */
function getArea(factorName: string): 'workshop' | 'warehouse' | 'other' {
  if (factorName.includes('车间')) return 'workshop';
  if (factorName.includes('仓库')) return 'warehouse';
  return 'other';
}

/** GET /api/dashboard/overview - 看板概览数据 */
router.get('/overview', async (req, res, next) => {
  try {
    // 获取最新一批监测数据
    const latestBatch = await EnvMonitor.findAll({
      order: [['collectTime', 'DESC'], ['id', 'DESC']],
      limit: 200,
      raw: true,
    });

    const factorLatest = new Map<string, any>();
    for (const r of latestBatch) {
      if (!factorLatest.has(r.factorName)) factorLatest.set(r.factorName, r);
    }

    const areas: Record<string, {
      name: string;
      icon: string;
      factors: any[];
    }> = {
      workshop: { name: '生产车间', icon: 'workshop', factors: [] },
      warehouse: { name: '仓库', icon: 'warehouse', factors: [] },
      other: { name: '其他区域', icon: 'other', factors: [] },
    };

    for (const [, r] of factorLatest) {
      const area = getArea(r.factorName);
      if (!r.factorName.includes('温度') && !r.factorName.includes('湿度')) continue;
      areas[area].factors.push({
        factorName: r.factorName,
        deviceName: r.deviceName,
        factorType: r.factorName.includes('温度') ? 'temperature' : 'humidity',
        value: r.value,
        unit: r.unit,
        deviceStatus: r.deviceStatus,
        collectTime: r.collectTime,
      });
    }

    // 报警统计
    const totalAlarms = await EnvAlarm.count();
    const unhandledAlarms = await EnvAlarm.count({ where: { isHandled: false } });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAlarms = await EnvAlarm.count({
      where: { alarmTime: { [Op.gte]: todayStart } as any },
    });

    // 报警按设备统计（用于柱状图）
    const alarmByDeviceRows = await EnvAlarm.findAll({
      attributes: ['deviceName', [literal('COUNT(*)'), 'count']],
      where: { alarmTime: { [Op.gte]: todayStart } as any },
      group: ['deviceName'],
      raw: true as any,
    });
    const alarmByDevice: Record<string, number> = {};
    for (const row of alarmByDeviceRows as any) {
      alarmByDevice[row.deviceName || '未知'] = Number(row.count);
    }

    // 报警按因子类型分类（用于饼图）：温度类/湿度类
    const allRecentAlarms = await EnvAlarm.findAll({
      where: { alarmTime: { [Op.gte]: todayStart } as any },
      raw: true,
    });
    const alarmByType: Record<string, number> = { 温度报警: 0, 湿度报警: 0, 其他报警: 0 };
    for (const a of allRecentAlarms as any) {
      const n = a.factorName || '';
      if (n.includes('温度')) alarmByType['温度报警']++;
      else if (n.includes('湿度')) alarmByType['湿度报警']++;
      else alarmByType['其他报警']++;
    }

    // 最近报警
    const recentAlarms = await EnvAlarm.findAll({
      order: [['alarmTime', 'DESC']],
      limit: 15,
      raw: true,
    });

    res.json({
      success: true,
      data: {
        areas: [
          areas.workshop,
          areas.warehouse,
          ...(areas.other.factors.length > 0 ? [areas.other] : []),
        ],
        alarms: {
          total: totalAlarms,
          unhandled: unhandledAlarms,
          today: todayAlarms,
          recent: (recentAlarms as any[]).map((a) => ({
            id: a.id,
            factorName: a.factorName,
            deviceName: a.deviceName,
            alarmInfo: a.alarmInfo,
            alarmRange: a.alarmRange,
            currentValue: a.currentValue,
            unit: a.unit,
            alarmTime: a.alarmTime,
          })),
          byDevice: alarmByDevice,
          byType: alarmByType,
        },
        lastUpdate: latestBatch.length > 0 ? latestBatch[0].collectTime : null,
      },
    });
  } catch (e) { next(e); }
});

/** 露点温度（Magnus公式，℃） */
function calcDewPoint(tempC: number, rh: number): number {
  if (rh <= 0) return NaN;
  const a = 17.27, b = 237.7;
  const alpha = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
}

/** 中国湖南长沙望城天气预报大气压（hPa） */
const WANGCHENG_PRESSURE_HPA = 1003;

/** 含湿量（g/kg 干空气）— 基于大气压 P */
function calcHumidityRatio(tempC: number, rh: number, p = WANGCHENG_PRESSURE_HPA): number {
  const pws = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5)); // 饱和水汽压 hPa
  const pw = (rh / 100) * pws; // 水汽分压 hPa
  if (p - pw <= 0) return NaN;
  const d = (0.622 * pw) / (p - pw); // kg/kg 干空气
  return d * 1000; // g/kg
}

/** GET /api/dashboard/trend - 趋势数据（最近12小时整点，每小时取最接近整点的记录） */
router.get('/trend', async (req, res, next) => {
  try {
    // 最近12小时：当前整点往前12个整点
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0); // 当前整点
    const startTime = new Date(currentHour);
    startTime.setHours(startTime.getHours() - 11); // 往前11小时，共12个点

    const rows = await EnvMonitor.findAll({
      where: { collectTime: { [Op.gte]: startTime, [Op.lte]: now } as any },
      order: [['collectTime', 'ASC']],
      raw: true,
    });

    // 生成 12 个整点时间标记（当前整点往前12个）
    const hourMarks: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentHour);
      d.setHours(d.getHours() - i);
      hourMarks.push(d);
    }
    const times = hourMarks.map((d) => d.toISOString());

    // 按 区域|因子类型 分组记录
    type Rec = { time: Date; value: number };
    const grouped = new Map<string, Rec[]>();
    for (const r of rows as any[]) {
      if (!r.factorName) continue;
      const area = getArea(r.factorName);
      const factorType = r.factorName.includes('温度') ? 'temperature'
        : r.factorName.includes('湿度') ? 'humidity' : null;
      if (!factorType) continue;
      const key = `${area}|${factorType}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ time: new Date(r.collectTime), value: r.value });
    }

    // 找最接近目标整点的记录值
    function closestValue(recs: Rec[], target: Date): number | null {
      if (recs.length === 0) return null;
      let best = recs[0];
      let bestDiff = Math.abs(best.time.getTime() - target.getTime());
      for (const r of recs) {
        const diff = Math.abs(r.time.getTime() - target.getTime());
        if (diff < bestDiff) { best = r; bestDiff = diff; }
      }
      return best.value;
    }

    // 计算每个区域每小时的温度、湿度（取最接近整点的记录）
    const areas = ['workshop', 'warehouse'] as const;
    const areaHourly: Record<string, { temp: (number | null)[]; hum: (number | null)[] }> = {};
    for (const area of areas) {
      const tempRecs = grouped.get(`${area}|temperature`) || [];
      const humRecs = grouped.get(`${area}|humidity`) || [];
      const temp: (number | null)[] = [];
      const hum: (number | null)[] = [];
      for (const mark of hourMarks) {
        const tv = closestValue(tempRecs, mark);
        const hv = closestValue(humRecs, mark);
        temp.push(tv !== null ? Number(tv.toFixed(2)) : null);
        hum.push(hv !== null ? Number(hv.toFixed(2)) : null);
      }
      areaHourly[area] = { temp, hum };
    }

    // series 定义：温度、湿度
    const seriesDefs = [
      { area: 'workshop', factor: 'temperature', label: '车间温度', color: '#ff4d4f' },
      { area: 'workshop', factor: 'humidity', label: '车间湿度', color: '#1890ff' },
      { area: 'warehouse', factor: 'temperature', label: '仓库温度', color: '#fa8c16' },
      { area: 'warehouse', factor: 'humidity', label: '仓库湿度', color: '#13c2c2' },
    ];

    const series: { name: string; color: string; data: (number | null)[] }[] = [];
    for (const s of seriesDefs) {
      const data: (number | null)[] = [];
      const hourly = areaHourly[s.area];
      for (let i = 0; i < 12; i++) {
        if (s.factor === 'temperature') {
          data.push(hourly.temp[i]);
        } else if (s.factor === 'humidity') {
          data.push(hourly.hum[i]);
        }
      }
      series.push({ name: s.label, color: s.color, data });
    }

    res.json({
      success: true,
      data: {
        hours: 12,
        times,
        series,
      },
    });
  } catch (e) { next(e); }
});

/** GET /api/dashboard/alarm-hour - 最近24小时报警分布（用于柱状图） */
router.get('/alarm-hour', async (req, res, next) => {
  try {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 24));
    const since = new Date(Date.now() - hours * 3600_000);

    const rows = await EnvAlarm.findAll({
      where: { alarmTime: { [Op.gte]: since } as any },
      order: [['alarmTime', 'ASC']],
      raw: true,
    });

    // 每小时分桶
    const buckets = new Map<string, number>();
    const start = new Date(since);
    start.setMinutes(0, 0, 0);
    const labelList: string[] = [];
    for (let i = 0; i < hours; i++) {
      const t = new Date(start.getTime() + i * 3600_000);
      const key = t.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH
      buckets.set(key, 0);
      labelList.push(key);
    }

    for (const a of rows as any[]) {
      const t = new Date(a.alarmTime);
      t.setMinutes(0, 0, 0);
      const key = t.toISOString().slice(0, 13) + ':00';
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const labels = labelList.map((k) => k.slice(11, 16)); // HH:mm
    const counts = labelList.map((k) => buckets.get(k) || 0);

    res.json({
      success: true,
      data: { hours, labels, counts },
    });
  } catch (e) { next(e); }
});

export default router;
