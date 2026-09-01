import React, { useEffect, useMemo, useState } from 'react'
import {
  Button, Card, Col, DatePicker, Empty, Progress, Row, Select, Space, Spin, Statistic,
  Table, Tag, Typography, Alert, message, Tooltip, Divider, Badge, Popover
} from 'antd'
import {
  PrinterOutlined, ReloadOutlined, CalendarOutlined, ThunderboltOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, ToolOutlined,
  DashboardOutlined, ArrowLeftOutlined, FileDoneOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import api from '../../utils/api'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'

const { Title, Text } = Typography

type TriggerMode = 'daily' | 'weekly' | 'monthly'

interface MatrixRecord {
  record_id: number
  status: string
  result: string
  actual_value: string
  executor: string
  start_time: string
  end_time: string
  duration_min: number
  abnormal_desc: string
}

interface MatrixItem {
  standard_id: number
  maintenance_content: string
  mechanism: string | null
  component: string | null
  location: string | null
  maintenance_method: string | null
  judge_type: string | null
  standard_value: string | null
  unit: string | null
  point_count: number
  time_per_point: number
  sort_order: number
  records: Record<string, MatrixRecord | null>
}

interface MatrixResp {
  device_id: number
  device_code: string | null
  device_name: string | null
  year_month: string
  year: number
  month: number
  days_in_month: number
  week_keys: string[]
  daily: { items: MatrixItem[] }
  weekly: { items: MatrixItem[] }
  monthly: { items: MatrixItem[] }
  summary: {
    daily_total: number
    daily_completed: number
    daily_rate: number
    weekly_total: number
    weekly_completed: number
    weekly_rate: number
    monthly_total: number
    monthly_completed: number
    monthly_rate: number
    abnormal_count: number
  }
}

interface DeviceRow { device_id: number; device_code: string; device_name: string }

const STATUS_COLOR: Record<string, string> = {
  待执行: 'default',
  执行中: 'processing',
  已完成: 'success',
  已挂起: 'warning',
}

function CellBadge({ rec }: { rec: MatrixRecord | null }) {
  if (!rec) return <span style={{ color: '#ccc' }}>—</span>
  const tag = <Tag color={STATUS_COLOR[rec.status] || 'default'}>{rec.status}</Tag>
  const content = (
    <div style={{ minWidth: 180, fontSize: 12 }}>
      <div>
        状态：{tag}
        {rec.result && <> · 结果：<b style={rec.result === '异常' ? { color: '#cf1322' } : {}}>{rec.result}</b></>}
      </div>
      {rec.actual_value && <div>实测值：{rec.actual_value}</div>}
      {rec.executor && <div>执行人：{rec.executor}</div>}
      {rec.start_time && <div>开始：{dayjs(rec.start_time).format('YYYY-MM-DD HH:mm')}</div>}
      {rec.end_time && <div>结束：{dayjs(rec.end_time).format('YYYY-MM-DD HH:mm')}</div>}
      {rec.duration_min ? <div>耗时：{rec.duration_min} 分钟</div> : null}
      {rec.abnormal_desc && <div style={{ color: '#cf1322' }}>异常：{rec.abnormal_desc}</div>}
    </div>
  )
  return (
    <Popover content={content} title={`记录 #${rec.record_id}`}>
      <span style={{ cursor: 'help' }}>
        {rec.result === '异常'
          ? <Badge status="error" text={<span style={{ color: '#cf1322', fontWeight: 600 }}>异常</span>} />
          : rec.status === '已完成'
          ? <Badge status="success" text={<span style={{ color: '#19a11f' }}>✓ 完成</span>} />
          : rec.status === '执行中'
          ? <Badge status="processing" text="执行中" />
          : rec.status === '已挂起'
          ? <Badge status="warning" text="已挂起" />
          : <Badge status="default" text="待执行" />
        }
      </span>
    </Popover>
  )
}

export default function DeviceMaintenanceMatrix() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const initDevice = Number(params.get('device_id') || 0) || undefined
  const initYm: Dayjs | undefined = params.get('year_month')
    ? dayjs(params.get('year_month')!, 'YYYY-MM')
    : dayjs()

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [deviceId, setDeviceId] = useState<number | undefined>(initDevice)
  const [ym, setYm] = useState<Dayjs>(initYm!)
  const [tab, setTab] = useState<TriggerMode>('daily')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MatrixResp | null>(null)

  useEffect(() => {
    api.get('/basic/devices', { params: { page_size: 500 } })
      .then((res: any) => {
        const raw = res?.data
        const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
        setDevices(list)
      })
      .catch(() => {})
  }, [])

  const load = () => {
    if (!deviceId) { message.warning('请先选择设备'); return }
    setLoading(true)
    api.get('/basic/device-records/matrix', {
      params: { device_id: deviceId, year_month: ym.format('YYYY-MM') },
    }).then((res: any) => setData(res as MatrixResp))
      .catch(err => message.error(err?.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (deviceId) load() /* eslint-disable-line */ }, [deviceId])

  const dailyDates = useMemo<string[]>(() => {
    if (!data) return []
    return Array.from({ length: data.days_in_month }, (_, i) =>
      `${data.year}-${String(data.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
    )
  }, [data])

  const weekKeys = data?.week_keys || []

  // ==== 统计卡片 ====
  const statItems: StatItem[] = useMemo(() => {
    if (!data) return []
    const s = data.summary
    return [
      { label: '日点检完成率', value: `${s.daily_rate ?? 0}% (${s.daily_completed}/${s.daily_total})`, color: '#1677ff', icon: <CalendarOutlined /> },
      { label: '周保养完成率', value: `${s.weekly_rate ?? 0}% (${s.weekly_completed}/${s.weekly_total})`, color: '#52c41a', icon: <FileDoneOutlined /> },
      { label: '月保养完成率', value: `${s.monthly_rate ?? 0}% (${s.monthly_completed}/${s.monthly_total})`, color: '#722ed1', icon: <CheckCircleOutlined /> },
      { label: '异常项数', value: s.abnormal_count ?? 0, color: '#f5222d', icon: <ExclamationCircleOutlined /> },
    ]
  }, [data])

  // ==== 每日点检列 ====
  const dailyColumns = useMemo(() => {
    const base = [
      { title: '序号', dataIndex: '__idx', width: 60, fixed: 'left' as const, render: (_: any, __: any, i: number) => i + 1 },
      { title: '保养项目', dataIndex: 'maintenance_content', width: 180, fixed: 'left' as const, ellipsis: true, render: (v: string, r: any) =>
        <Tooltip title={`标准ID:${r.standard_id} · ${v}`}>{v}</Tooltip> },
      { title: '部位', dataIndex: 'mechanism', width: 90, ellipsis: true },
      { title: '组件', dataIndex: 'component', width: 100, ellipsis: true },
      { title: '位置', dataIndex: 'location', width: 90, ellipsis: true },
      { title: '保养方法', dataIndex: 'maintenance_method', width: 100, ellipsis: true },
      { title: '判定基准', dataIndex: 'standard_value', width: 200, ellipsis: true, render: (v: string, r: any) =>
        v ? <span>{v}{r.unit && <Text type="secondary"> ({r.unit})</Text>}</span> : '-' },
    ]
    const dateCols = dailyDates.map(d => ({
      title: Number(d.slice(8, 10)),
      dataIndex: `__d_${d}`,
      width: 72,
      align: 'center' as const,
      render: (_: any, r: any) => <CellBadge rec={r.records?.[d] || null} />,
    }))
    return [...base, ...dateCols]
  }, [dailyDates])

  const weeklyColumns = useMemo(() => {
    const base = [
      { title: '序号', dataIndex: '__idx', width: 60, fixed: 'left' as const, render: (_: any, __: any, i: number) => i + 1 },
      { title: '保养项目', dataIndex: 'maintenance_content', width: 200, fixed: 'left' as const, ellipsis: true },
      { title: '部位', dataIndex: 'mechanism', width: 100 },
      { title: '组件', dataIndex: 'component', width: 120 },
      { title: '判定基准', dataIndex: 'standard_value', width: 220, ellipsis: true },
      { title: '点位×单件时间', width: 130, render: (_: any, r: any) => `${r.point_count || 1} × ${r.time_per_point || 0}分` },
    ]
    const weekCols = weekKeys.map(wk => ({
      title: wk.replace(/^\d{4}-/, ''),
      dataIndex: `__w_${wk}`,
      width: 110,
      align: 'center' as const,
      render: (_: any, r: any) => <CellBadge rec={r.records?.[wk] || null} />,
    }))
    return [...base, ...weekCols]
  }, [weekKeys])

  const monthlyColumns = [
    { title: '序号', dataIndex: '__idx', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: '保养项目', dataIndex: 'maintenance_content', width: 220, ellipsis: true },
    { title: '部位/组件', width: 160, render: (_: any, r: any) =>
      [r.mechanism, r.component].filter(Boolean).join(' / ') || '-' },
    { title: '判定基准', dataIndex: 'standard_value', width: 240, ellipsis: true },
    { title: '本月执行结果', width: 280, render: (_: any, r: any) => {
      const rec = (r.records as Record<string, MatrixRecord | null>)?.[data?.year_month ?? '']
      if (!rec) return <Tag>未生成</Tag>
      return <CellBadge rec={rec} />
    }},
    { title: '执行人', width: 100, render: (_: any, r: any) => {
      const rec = (r.records as Record<string, MatrixRecord | null>)?.[data?.year_month ?? '']
      return rec?.executor || '-'
    }},
    { title: '执行时间', width: 180, render: (_: any, r: any) => {
      const rec = (r.records as Record<string, MatrixRecord | null>)?.[data?.year_month ?? '']
      if (!rec?.start_time) return '-'
      return `${dayjs(rec.start_time).format('MM-DD HH:mm')}${rec.duration_min ? `（${rec.duration_min}分）` : ''}`
    }},
  ]

  const tabItems = [
    { key: 'daily' as TriggerMode, label: `每日点检 (${data?.daily.items.length ?? 0})`, icon: <CalendarOutlined /> },
    { key: 'weekly' as TriggerMode, label: `每周保养 (${data?.weekly.items.length ?? 0})`, icon: <FileDoneOutlined /> },
    { key: 'monthly' as TriggerMode, label: `每月保养 (${data?.monthly.items.length ?? 0})`, icon: <CheckCircleOutlined /> },
  ]

  const currentColumns = tab === 'daily' ? dailyColumns : tab === 'weekly' ? weeklyColumns : monthlyColumns
  const currentData = tab === 'daily'
    ? data?.daily.items
    : tab === 'weekly' ? data?.weekly.items : data?.monthly.items

  return (
    <>
    <ThreeSectionPage
      title="设备保养矩阵视图"
      breadcrumbs="设备管理 / 设备保养 / 矩阵视图"
      stats={statItems}
      filter={
        <Space wrap>
          <Select
            placeholder="选择设备" allowClear showSearch
            style={{ width: 280 }}
            value={deviceId}
            onChange={setDeviceId}
            options={devices.map(d => ({
              label: `${d.device_code || ''} ${d.device_name || ''}`.trim(),
              value: d.device_id,
            }))}
            filterOption={(input, option) =>
              String(option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <DatePicker
            picker="month"
            value={ym}
            onChange={(d) => d && setYm(d)}
            style={{ width: 150 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/device/maintenance')}>返回列表</Button>
        </Space>
      }
      actions={
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => message.info('请在执行记录列表页批量生成本月记录')}
          >生成本月记录</Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!deviceId}
            onClick={() => {
              const url = `/device/maintenance/print?device_id=${deviceId}&year_month=${ym.format('YYYY-MM')}`
              window.open(url, '_blank', 'width=1280,height=800')
            }}
          >打印模板</Button>
        </Space>
      }
      table={
        <Spin spinning={loading}>
          {!data
            ? <Empty description="请选择设备后加载数据" style={{ padding: 60 }} />
            : <>
                {/* 进度卡片 */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small">
                      <Row gutter={8} align="middle">
                        <Col flex="auto">
                          <div style={{ fontWeight: 500, marginBottom: 6 }}>每日点检</div>
                          <Progress percent={data.summary.daily_rate} />
                        </Col>
                        <Col flex="80px" style={{ textAlign: 'right' }}>
                          <Statistic value={data.summary.daily_completed}
                                     suffix={`/ ${data.summary.daily_total}`} />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Row gutter={8} align="middle">
                        <Col flex="auto">
                          <div style={{ fontWeight: 500, marginBottom: 6 }}>每周保养</div>
                          <Progress percent={data.summary.weekly_rate} />
                        </Col>
                        <Col flex="80px" style={{ textAlign: 'right' }}>
                          <Statistic value={data.summary.weekly_completed}
                                     suffix={`/ ${data.summary.weekly_total}`} />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Row gutter={8} align="middle">
                        <Col flex="auto">
                          <div style={{ fontWeight: 500, marginBottom: 6 }}>每月保养</div>
                          <Progress percent={data.summary.monthly_rate}
                                    status={data.summary.monthly_rate === 100 ? 'success' : undefined} />
                        </Col>
                        <Col flex="80px" style={{ textAlign: 'right' }}>
                          <Statistic value={data.summary.monthly_completed}
                                     suffix={`/ ${data.summary.monthly_total}`} />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                <Card
                  size="small"
                  tabList={tabItems}
                  activeTabKey={tab}
                  onTabChange={(k) => setTab(k as TriggerMode)}
                  tabBarExtraContent={
                    <Space>
                      <Tooltip title="设备"><Text strong>
                        {data?.device_code || ''} {data?.device_name || ''}
                      </Text></Tooltip>
                      <Tooltip title="年月"><Badge status="processing" text={data?.year_month} /></Tooltip>
                    </Space>
                  }
                >
                  {(currentData?.length ?? 0) === 0
                    ? <Empty description={`${tab === 'daily' ? '每日点检' : tab === 'weekly' ? '每周保养' : '每月保养'}暂无标准记录`} />
                    : <Table
                        size="middle"
                        columns={currentColumns}
                        dataSource={currentData}
                        rowKey="standard_id"
                        scroll={{ x: tab === 'daily' ? (dailyDates.length * 72) + 1000
                                                  : tab === 'weekly' ? (weekKeys.length * 110) + 800
                                                  : 1400 }}
                        pagination={false}
                        bordered
                      />
                  }
                </Card>

                {data.summary.abnormal_count > 0 && (
                  <Alert
                    style={{ marginTop: 16 }}
                    type="error"
                    showIcon
                    message={`共存在 ${data.summary.abnormal_count} 项异常记录，请关注并闭环处理`}
                  />
                )}
              </>
          }
        </Spin>
      }
    />
    </>
  )
}
