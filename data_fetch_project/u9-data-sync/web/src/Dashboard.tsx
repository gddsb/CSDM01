import { useEffect, useState, useRef, useMemo } from 'react';
import { Row, Col, Spin, Typography, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  DashboardOutlined, ReloadOutlined, ClockCircleOutlined,
  ShopOutlined, HomeOutlined, FireOutlined, CloudOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { callApi, api } from './api';

const { Title, Text } = Typography;

interface FactorItem {
  factorName: string;
  deviceName: string;
  factorType: 'temperature' | 'humidity';
  value: number;
  unit: string;
  deviceStatus: string;
  collectTime: string;
}

interface AreaData {
  name: string;
  icon: string;
  factors: FactorItem[];
}

interface OverviewData {
  areas: AreaData[];
  alarms: { total: number; unhandled: number; today: number; recent: any[] };
  lastUpdate: string | null;
}

interface TrendData {
  hours: number;
  times: string[];
  series: { name: string; color: string; data: (number | null)[] }[];
}

function fmtTime(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** 温度仪表板 — 显示范围0~40，车间安全18~25，仓库安全18~35 */
function gaugeTempOption(value: number, area: 'workshop' | 'warehouse'): EChartsOption {
  const upper = area === 'workshop' ? 25 : 35;
  const color = value < 18 ? '#1890ff' : value > upper ? '#ff4d4f' : '#52c41a';
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '78%',
      min: 0,
      max: 40,
      splitNumber: 8,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [0.45, '#1890ff'],          // 0~18 蓝 (<18)
            [upper / 40, '#52c41a'],    // 18~upper 绿
            [1, '#ff4d4f'],             // upper~40 红 (>upper)
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '58%' },
      axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#aaa', distance: 16, fontSize: 9 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '78%'],
        formatter: '{value} °C',
        fontSize: 20,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  };
}

/** 湿度仪表板 — 安全≤65% */
function gaugeHumOption(value: number): EChartsOption {
  const color = value > 65 ? '#ff4d4f' : '#52c41a';
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '78%',
      min: 35,
      max: 100,
      splitNumber: 5,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [0.4615, '#52c41a'],  // ≤65 绿（(65-35)/(100-35)≈0.4615）
            [1, '#ff4d4f'],       // >65 红
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '58%' },
      axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#aaa', distance: 16, fontSize: 9 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '78%'],
        formatter: '{value} %',
        fontSize: 20,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  };
}

/** 趋势图配置 */
interface TrendConfig {
  leftName: string;   // 左Y轴名称
  rightName: string;  // 右Y轴名称
  rightMin?: number;
  rightMax?: number;
  isLeftAxis: (name: string) => boolean;
  markLines?: { yAxis: number; label: string; color: string }[];
}

/** 通用趋势折线图（按小时聚合，X轴按小时显示） */
function trendOption(
  series: { name: string; color: string; data: (number | null)[] }[],
  times: string[],
  cfg: TrendConfig,
): EChartsOption {
  const xData = times.map((t) => dayjs(t).format('HH:00'));

  // 根据实际数据计算各轴最小/最大值（留 10% 余量，上下取整为整数）
  const leftVals: number[] = [];
  const rightVals: number[] = [];
  for (const s of series) {
    const arr = cfg.isLeftAxis(s.name) ? leftVals : rightVals;
    for (const v of s.data) {
      if (v !== null && v !== undefined && !Number.isNaN(v)) arr.push(v);
    }
  }
  const axisRange = (vals: number[]) => {
    if (vals.length === 0) return { min: undefined as number | undefined, max: undefined as number | undefined };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo;
    const pad = span < 1 ? 1 : span * 0.1;
    return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) };
  };
  const leftRange = axisRange(leftVals);
  const rightRange = axisRange(rightVals);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const full = times[params[0].dataIndex]
          ? dayjs(times[params[0].dataIndex]).format('YYYY-MM-DD HH:00')
          : params[0].name;
        let html = full + '<br/>';
        for (const p of params) {
          html += `${p.marker} ${p.seriesName}: ${p.value ?? '-'}<br/>`;
        }
        return html;
      },
    },
    legend: { top: 0, icon: 'roundRect', textStyle: { color: '#ccc' } },
    grid: { left: 52, right: 58, top: 35, bottom: 32 },
    xAxis: {
      type: 'category', data: xData, boundaryGap: false,
      axisLabel: { color: '#888', fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: '#333' } },
    },
    yAxis: [
      {
        type: 'value', name: cfg.leftName, position: 'left',
        min: leftRange.min, max: leftRange.max,
        minInterval: 1,
        axisLabel: {
          color: '#888',
          formatter: (v: number | string) => typeof v === 'number' ? Math.round(v).toString() : v,
        },
        splitLine: { lineStyle: { color: '#1a1a2e' } },
        nameTextStyle: { color: '#888' },
      },
      {
        type: 'value', name: cfg.rightName, position: 'right',
        min: rightRange.min, max: rightRange.max,
        minInterval: 1,
        axisLabel: {
          color: '#888',
          formatter: (v: number | string) => typeof v === 'number' ? Math.round(v).toString() : v,
        },
        splitLine: { show: false },
        nameTextStyle: { color: '#888' },
      },
    ],
    series: series.map((s, idx) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      yAxisIndex: cfg.isLeftAxis(s.name) ? 0 : 1,
      itemStyle: { color: s.color },
      lineStyle: { width: 2.5, color: s.color },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: s.color + '50' },
            { offset: 1, color: s.color + '05' },
          ],
        },
      },
      markLine: idx === 0 && cfg.markLines && cfg.markLines.length > 0 ? {
        silent: true,
        symbol: 'none',
        data: cfg.markLines.map((ml) => ({
          yAxis: ml.yAxis,
          label: { formatter: ml.label, color: ml.color, fontSize: 9 },
          lineStyle: { type: 'dashed', color: ml.color, width: 1, opacity: 0.5 },
        })),
      } : undefined,
      data: s.data,
    })),
  };
}

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [o, t] = await Promise.all([
        callApi<OverviewData>(api.get('/dashboard/overview')),
        callApi<TrendData>(api.get('/dashboard/trend')),
      ]);
      if (o.success && o.data) setOverview(o.data);
      if (t.success && t.data) setTrend(t.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadAll();
    timerRef.current = setInterval(loadAll, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaAvg = useMemo(() => {
    const calc = (areaName: string, type: 'temperature' | 'humidity') => {
      const area = overview?.areas.find((a) => a.name === areaName);
      const factors = area?.factors.filter((f) => f.factorType === type) || [];
      if (factors.length === 0) return 0;
      return factors.reduce((s, f) => s + f.value, 0) / factors.length;
    };
    return {
      workshopTemp: calc('生产车间', 'temperature'),
      workshopHum: calc('生产车间', 'humidity'),
      warehouseTemp: calc('仓库', 'temperature'),
      warehouseHum: calc('仓库', 'humidity'),
    };
  }, [overview]);

  // 按区域拆分趋势series（仅温湿度）
  const isTH = (n: string) => n.includes('温度') || n.includes('湿度');
  const workshopTH = useMemo(() =>
    (trend?.series || []).filter((s) => s.name.includes('车间') && isTH(s.name)), [trend]);
  const warehouseTH = useMemo(() =>
    (trend?.series || []).filter((s) => s.name.includes('仓库') && isTH(s.name)), [trend]);

  // 车间温湿度趋势图配置（温度安全18~25，湿度安全≤65%）
  const workshopTHConfig: TrendConfig = {
    leftName: '温度(℃)',
    rightName: '湿度(%)',
    rightMin: 0, rightMax: 100,
    isLeftAxis: (n) => n.includes('温度'),
    markLines: [
      { yAxis: 18, label: '温度下限18', color: '#1890ff' },
      { yAxis: 25, label: '温度上限25', color: '#ff4d4f' },
      { yAxis: 65, label: '湿度限值65%', color: '#ff4d4f' },
    ],
  };

  // 仓库温湿度趋势图配置（温度安全18~35，湿度安全≤65%）
  const warehouseTHConfig: TrendConfig = {
    leftName: '温度(℃)',
    rightName: '湿度(%)',
    rightMin: 0, rightMax: 100,
    isLeftAxis: (n) => n.includes('温度'),
    markLines: [
      { yAxis: 18, label: '温度下限18', color: '#1890ff' },
      { yAxis: 35, label: '温度上限35', color: '#ff4d4f' },
      { yAxis: 65, label: '湿度限值65%', color: '#ff4d4f' },
    ],
  };

  const screenStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0d1117 0%, #161b28 50%, #0d1117 100%)',
    minHeight: '100vh',
    padding: '20px 24px',
    color: '#e0e0e0',
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(22,27,40,0.85)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

  const titleStyle: React.CSSProperties = {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
  };

  return (
    <div style={screenStyle}>
      {/* 大屏标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0, color: '#fff', letterSpacing: 2 }}>
          <DashboardOutlined style={{ marginRight: 8 }} />
          环境监测大屏
        </Title>
        <Space size="large">
          {overview?.lastUpdate && (
            <Text style={{ color: '#888', fontSize: 12 }}>
              <ClockCircleOutlined /> 最后更新: {fmtTime(overview.lastUpdate)}
            </Text>
          )}
          <a onClick={loadAll} style={{ color: '#1890ff', cursor: 'pointer', fontSize: 12 }}>
            <ReloadOutlined spin={loading} /> 刷新
          </a>
        </Space>
      </div>

      <Spin spinning={loading && !overview}>
        <Row gutter={[16, 16]}>
          {/* 生产车间仪表板 */}
          <Col xs={24} sm={12}>
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShopOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <span style={titleStyle}>生产车间</span>
                <span style={{ color: '#555', fontSize: 12 }}>
                  {overview?.areas.find((a) => a.name === '生产车间')?.factors.length ?? 0} 个监测点
                </span>
              </div>
              <Row>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <Text style={{ color: '#ff7875', fontSize: 13 }}>
                      <FireOutlined /> 温度
                    </Text>
                    <ReactECharts option={gaugeTempOption(areaAvg.workshopTemp, 'workshop')} style={{ height: 220 }} />
                  </div>
                </Col>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <Text style={{ color: '#69c0ff', fontSize: 13 }}>
                      <CloudOutlined /> 湿度
                    </Text>
                    <ReactECharts option={gaugeHumOption(areaAvg.workshopHum)} style={{ height: 220 }} />
                  </div>
                </Col>
              </Row>
            </div>
          </Col>

          {/* 仓库仪表板 */}
          <Col xs={24} sm={12}>
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <HomeOutlined style={{ color: '#13c2c2', fontSize: 18 }} />
                <span style={titleStyle}>仓库</span>
                <span style={{ color: '#555', fontSize: 12 }}>
                  {overview?.areas.find((a) => a.name === '仓库')?.factors.length ?? 0} 个监测点
                </span>
              </div>
              <Row>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <Text style={{ color: '#ff7875', fontSize: 13 }}>
                      <FireOutlined /> 温度
                    </Text>
                    <ReactECharts option={gaugeTempOption(areaAvg.warehouseTemp, 'warehouse')} style={{ height: 220 }} />
                  </div>
                </Col>
                <Col xs={12}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <Text style={{ color: '#69c0ff', fontSize: 13 }}>
                      <CloudOutlined /> 湿度
                    </Text>
                    <ReactECharts option={gaugeHumOption(areaAvg.warehouseHum)} style={{ height: 220 }} />
                  </div>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>

        {/* 温湿度趋势曲线 — 按区域分别显示（最近12小时，按整点取值） */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShopOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                <span style={titleStyle}>生产车间 · 温湿度趋势</span>
                <span style={{ color: '#555', fontSize: 11 }}>（最近12h）</span>
              </div>
              <ReactECharts
                option={trendOption(workshopTH, trend?.times || [], workshopTHConfig)}
                style={{ height: 280, padding: '0 8px 8px' }}
              />
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <HomeOutlined style={{ color: '#13c2c2', fontSize: 16 }} />
                <span style={titleStyle}>仓库 · 温湿度趋势</span>
                <span style={{ color: '#555', fontSize: 11 }}>（最近12h）</span>
              </div>
              <ReactECharts
                option={trendOption(warehouseTH, trend?.times || [], warehouseTHConfig)}
                style={{ height: 280, padding: '0 8px 8px' }}
              />
            </div>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
