import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Row, Col, Card, Tag, List, Spin, Statistic, Empty, Typography, Space, Button,
} from 'antd'
import {
  ReloadOutlined, DashboardOutlined, ToolOutlined, WarningOutlined,
  ExperimentOutlined, FireOutlined, SafetyCertificateOutlined,
  HddOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import { formatDateTime, formatDate } from '../../utils'

const { Title, Text } = Typography

// ============ 颜色方案 ============
const deviceStatusColor: Record<string, string> = {
  '正常': '#52c41a',
  '维修': '#faad14',
  '停用': '#d9d9d9',
}
const faultLevelColor: Record<string, string> = {
  '一般': 'blue',
  '严重': 'orange',
  '紧急': 'red',
}
const maintenanceStatusColor: Record<string, string> = {
  '待执行': 'default',
  '执行中': 'processing',
  '已完成': 'success',
  '已挂起': 'error',
}
const faultStatusColor: Record<string, string> = {
  '待派工': 'default',
  '维修中': 'processing',
  '待审批': 'warning',
  '已关闭': 'success',
  '已挂起': 'error',
}
const calibrationStatusColor: Record<string, string> = {
  '待校准': 'default',
  '已校准': 'success',
  '已超期': 'error',
  '已锁定': 'warning',
}
const inspectionStatusColor: Record<string, string> = {
  '待检': 'default',
  '已完成': 'success',
  '漏检': 'error',
}

// ============ 类型定义 ============
interface DeviceItem {
  device_id: number
  device_code?: string
  device_name?: string
  status?: string
}
interface DeviceFaultItem {
  fault_id: number
  fault_no: string
  device_name?: string
  fault_level: string
  status: string
  fault_time?: string
}
interface MaintenanceItem {
  record_id: number
  record_no?: string
  device_name?: string
  maintenance_type?: string
  plan_date?: string
  status: string
}
interface InspectionItem {
  plan_id: number
  device_name?: string
  inspector_name?: string
  plan_date?: string
  status: string
}
interface SparePartItem {
  part_id: number
  part_code?: string
  part_name?: string
  current_stock?: number
  safety_stock_min?: number
  safety_stock_max?: number
  unit?: string
}
interface CalibrationItem {
  plan_id: number
  device_name?: string
  device_code?: string
  next_calibration_date?: string
  last_calibration_date?: string
  status: string
}

// ============ 工具函数 ============
function extractList(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  return []
}

// 建议采购量：补齐到安全上限
function suggestPurchaseQty(current: number, max: number): number {
  const c = Number(current) || 0
  const m = Number(max) || 0
  if (m <= c) return 0
  return m - c
}

// ============ 区块标题 ============
function SectionCard({
  title, icon, extra, children, loading, bodyStyle,
}: {
  title: string
  icon?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
  bodyStyle?: React.CSSProperties
}) {
  return (
    <Card
      size="small"
      style={{ height: '100%', borderRadius: 8 }}
      styles={{ body: { padding: 12, ...bodyStyle } }}
      title={
        <Space size={6}>
          {icon && <span style={{ color: 'var(--color-primary, #2196F3)' }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        </Space>
      }
      extra={extra}
    >
      <Spin spinning={!!loading}>
        {children}
      </Spin>
    </Card>
  )
}

export default function DeviceDashboard() {
  const message = useMessage()

  const [loading, setLoading] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')

  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [faults, setFaults] = useState<DeviceFaultItem[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([])
  const [inspections, setInspections] = useState<InspectionItem[]>([])
  const [spareParts, setSpareParts] = useState<SparePartItem[]>([])
  const [calibrationsExpiring, setCalibrationsExpiring] = useState<CalibrationItem[]>([])
  const [calibrationsOverdue, setCalibrationsOverdue] = useState<CalibrationItem[]>([])

  const cancelledRef = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        devicesRes, faultsRes, maintenanceRes,
        sparePartsRes, calibExpiringRes, calibOverdueRes,
      ] = await Promise.all([
        api.get('/basic/devices', { params: { page_size: 999 } }),
        api.get('/basic/device-faults', { params: { status: '待派工,维修中,待审批', page_size: 999 } }),
        api.get('/basic/device-records', { params: { status: '待执行,执行中', page_size: 999 } }),
        api.get('/basic/device-spare-parts/low-stock/list'),
        api.get('/basic/device-calibration-plans/expiring/list'),
        api.get('/basic/device-calibration-plans/overdue/list'),
      ])

      if (cancelledRef.current) return

      // 按触发模式拆分：每日(daily) → 点检，其余(weekly/monthly/runtime) → 维护
      const allRecords = extractList(maintenanceRes.data)
      const dailyRecords = allRecords.filter((r: any) => r.trigger_mode === 'daily')
      const otherRecords = allRecords.filter((r: any) => r.trigger_mode !== 'daily')

      setDevices(extractList(devicesRes.data))
      setFaults(extractList(faultsRes.data))
      setMaintenance(otherRecords)
      setInspections(dailyRecords)
      setSpareParts(extractList(sparePartsRes.data))
      setCalibrationsExpiring(extractList(calibExpiringRes.data))
      setCalibrationsOverdue(extractList(calibOverdueRes.data))
      setLastUpdateTime(dayjs().format('YYYY-MM-DD HH:mm:ss'))
    } catch (e: any) {
      if (cancelledRef.current) return
      const msg = e?.message || '加载看板数据失败'
      if (!/timeout|network/i.test(msg)) {
        message.error(msg)
      }
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [message])

  useEffect(() => {
    cancelledRef.current = false
    fetchData()
    const timer = setInterval(fetchData, 60 * 1000)
    return () => {
      cancelledRef.current = true
      clearInterval(timer)
    }
  }, [fetchData])

  // ============ 顶部统计计算 ============
  const deviceTotal = devices.length
  const runningCount = devices.filter(d => d.status === '正常').length
  const repairingCount = devices.filter(d => d.status === '维修').length
  const stoppedCount = devices.filter(d => d.status === '停用').length

  const todayInspectionCount = inspections.length
  const urgentFaultCount = faults.filter(f => f.fault_level === '紧急').length
  const severeFaultCount = faults.filter(f => f.fault_level === '严重').length
  const normalFaultCount = faults.filter(f => f.fault_level === '一般').length
  const pendingMaintenanceCount = maintenance.length

  // ============ 校准到期合并（先超期，再临近） ============
  const calibrationList: CalibrationItem[] = [
    ...calibrationsOverdue,
    ...calibrationsExpiring,
  ]

  // ============ 渲染 ============
  return (
    <div style={{ paddingBottom: 12 }}>
      {/* ============ 头部标题栏 ============ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <DashboardOutlined style={{ fontSize: 20, color: 'var(--color-primary, #2196F3)' }} />
          <Title level={4} style={{ margin: 0 }}>设备综合看板</Title>
        </Space>
        <Space size="small">
          {lastUpdateTime && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              最后更新：{lastUpdateTime}
            </Text>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && deviceTotal === 0}>
        {/* ============ 1.1 顶部统计卡片区 ============ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {/* 设备总数 */}
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
              <Statistic
                title={<Space><HddOutlined />设备总数</Space>}
                value={deviceTotal}
                valueStyle={{ color: '#2196F3', fontWeight: 700 }}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: deviceStatusColor['正常'], marginRight: 4 }} />
                  <Text style={{ fontSize: 12 }}>运行 {runningCount}</Text>
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: deviceStatusColor['维修'], marginRight: 4 }} />
                  <Text style={{ fontSize: 12 }}>维修 {repairingCount}</Text>
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: deviceStatusColor['停用'], marginRight: 4 }} />
                  <Text style={{ fontSize: 12 }}>停用 {stoppedCount}</Text>
                </span>
              </div>
            </Card>
          </Col>

          {/* 今日待点检数 */}
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
              <Statistic
                title={<Space><ExperimentOutlined />今日待点检</Space>}
                value={todayInspectionCount}
                valueStyle={{ color: '#FF9800', fontWeight: 700 }}
                suffix="项"
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {todayInspectionCount > 0 ? '存在待检任务，请及时处理' : '今日无待检任务'}
                </Text>
              </div>
            </Card>
          </Col>

          {/* 当前故障数 */}
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
              <Statistic
                title={<Space><WarningOutlined />当前故障</Space>}
                value={faults.length}
                valueStyle={{ color: faults.length > 0 ? '#F44336' : '#52c41a', fontWeight: 700 }}
                suffix="个"
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Tag color="red">紧急 {urgentFaultCount}</Tag>
                <Tag color="orange">严重 {severeFaultCount}</Tag>
                <Tag color="blue">一般 {normalFaultCount}</Tag>
              </div>
            </Card>
          </Col>

          {/* 待维护工单数 */}
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ height: '100%', borderRadius: 8 }} styles={{ body: { padding: 16 } }}>
              <Statistic
                title={<Space><ToolOutlined />待维护工单</Space>}
                value={pendingMaintenanceCount}
                valueStyle={{ color: '#9C27B0', fontWeight: 700 }}
                suffix="单"
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  待执行 {maintenance.filter(m => m.status === '待执行').length} · 执行中 {maintenance.filter(m => m.status === '执行中').length}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ============ 1.2 + 1.3 维护到期 + 点检待办 ============ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} lg={12}>
            <SectionCard
              title={`维护到期看板（${maintenance.length}）`}
              icon={<ToolOutlined />}
              loading={loading}
              bodyStyle={{ height: 200, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={maintenance}
                locale={{ emptyText: <Empty description="暂无待维护工单" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => {
                  const modeLabel = ({ weekly: '每周保养', monthly: '每月保养', runtime: '运行时长' } as Record<string, string>)[item.trigger_mode] || item.trigger_mode
                  return (
                    <List.Item style={{ padding: '6px 4px' }}>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                          {item.device_name || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.device_code || '-'}
                        </Text>
                        <Tag style={{ margin: 0, flexShrink: 0 }}>{modeLabel}</Tag>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>周期 {item.period_key || '-'}</Text>
                        <div style={{ flex: 1 }} />
                        <Tag color={maintenanceStatusColor[item.status] || 'default'} style={{ margin: 0, flexShrink: 0 }}>{item.status}</Tag>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </SectionCard>
          </Col>

          <Col xs={24} lg={12}>
            <SectionCard
              title={`点检待办看板（${inspections.length}）`}
              icon={<ExperimentOutlined />}
              loading={loading}
              bodyStyle={{ height: 200, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={inspections}
                locale={{ emptyText: <Empty description="暂无待点检任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => (
                  <List.Item style={{ padding: '6px 4px' }}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                        {item.device_name || '-'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {item.device_code || '-'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {item.executor_name || '-'} · {item.period_key || '-'}
                      </Text>
                      <div style={{ flex: 1 }} />
                      <Tag color={inspectionStatusColor[item.status] || 'default'} style={{ margin: 0, flexShrink: 0 }}>{item.status}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            </SectionCard>
          </Col>
        </Row>

        {/* ============ 1.5 故障工单看板 ============ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col span={24}>
            <SectionCard
              title={`故障工单看板（${faults.length}）`}
              icon={<FireOutlined />}
              loading={loading}
              bodyStyle={{ maxHeight: 320, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={faults}
                locale={{ emptyText: <Empty description="暂无未关闭故障" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => {
                  const isUrgent = item.fault_level === '紧急'
                  return (
                    <List.Item style={{ padding: '6px 4px' }}>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 13, color: isUrgent ? '#ff4d4f' : undefined, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.fault_no || '-'}
                        </Text>
                        <Tag color={faultLevelColor[item.fault_level] || 'default'} style={{ margin: 0, flexShrink: 0 }}>{item.fault_level}</Tag>
                        <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                          {item.device_name || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.device_code || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {item.fault_desc || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {formatDateTime(item.fault_time)}
                        </Text>
                        <Tag color={faultStatusColor[item.status] || 'default'} style={{ margin: 0, flexShrink: 0 }}>{item.status}</Tag>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </SectionCard>
          </Col>
        </Row>

        {/* ============ 1.6 + 1.7 备件预警 + 校准到期 ============ */}
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <SectionCard
              title={`备件预警看板（${spareParts.length}）`}
              icon={<WarningOutlined />}
              loading={loading}
              bodyStyle={{ maxHeight: 360, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={spareParts}
                locale={{ emptyText: <Empty description="暂无低库存备件" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => {
                  const suggest = suggestPurchaseQty(item.current_stock, item.safety_stock_max)
                  return (
                    <List.Item style={{ padding: '6px 4px' }}>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                          {item.part_name || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.part_code || ''}
                        </Text>
                        <Tag color="error" style={{ margin: 0, flexShrink: 0 }}>
                          库存 {item.current_stock ?? 0} / 下限 {item.safety_stock_min ?? 0}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          建议采购
                          <Text strong style={{ color: suggest > 0 ? '#FF9800' : undefined, marginLeft: 2 }}>
                            {suggest}
                          </Text>
                          {item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </SectionCard>
          </Col>

          <Col xs={24} lg={12}>
            <SectionCard
              title={`校准到期看板（${calibrationList.length}）`}
              icon={<SafetyCertificateOutlined />}
              loading={loading}
              bodyStyle={{ maxHeight: 360, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={calibrationList}
                locale={{ emptyText: <Empty description="暂无校准到期/超期计划" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => {
                  const isOverdue = item.status === '已超期'
                  return (
                    <List.Item style={{ padding: '6px 4px' }}>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 13, color: isOverdue ? '#ff4d4f' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                          {item.device_name || item.device_code || '-'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          下次 {formatDate(item.next_calibration_date)}
                        </Text>
                        <div style={{ flex: 1 }} />
                        <Tag color={calibrationStatusColor[item.status] || 'default'} style={{ margin: 0, flexShrink: 0 }}>{item.status}</Tag>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </SectionCard>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
