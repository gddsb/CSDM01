import React, { useState, useEffect, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Descriptions,
  Typography, message, Empty, Spin, Table, Card, Image,
} from 'antd'
import {
  CheckCircleOutlined, SearchOutlined, ReloadOutlined, ThunderboltOutlined,
  DashboardOutlined, HistoryOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { Text } = Typography

// ===== 状态映射 =====
const STATUS_COLOR: Record<string, string> = {
  '待执行': 'default',
  '执行中': 'processing',
  '已完成': 'success',
  '跳过': 'warning',
}
const MODE_LABEL: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  runtime: '运行时长',
}
const MODE_COLOR: Record<string, string> = {
  daily: 'green',
  weekly: 'blue',
  monthly: 'purple',
  runtime: 'orange',
}
const RESULT_COLOR: Record<string, string> = {
  '正常': 'success',
  '异常': 'error',
}

// 历史记录仅展示已完成/跳过
const HISTORY_STATUS_OPTIONS = [
  { label: '已完成', value: '已完成' },
  { label: '跳过', value: '跳过' },
]
const MODE_OPTIONS = [
  { label: '每日点检', value: 'daily' },
  { label: '每周保养', value: 'weekly' },
  { label: '每月保养', value: 'monthly' },
  { label: '运行时长', value: 'runtime' },
]

interface DeviceOption { device_id: number; device_code: string; device_name: string }

export default function DeviceMaintenanceHistory() {
  // ============ 历史记录列表 ============
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [filters, setFilters] = useState({
    device_id: undefined as number | undefined,
    trigger_mode: undefined as string | undefined,
    status: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    keyword: '',
  })

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  // ============ 设备下拉 ============
  const [devices, setDevices] = useState<DeviceOption[]>([])

  // ===== 加载设备列表 =====
  useEffect(() => {
    api.get('/basic/devices', { params: { page_size: 999 } }).then((res: any) => {
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      const opts = list.map((d: any) => ({
        device_id: d.device_id,
        device_code: d.device_code,
        device_name: d.device_name,
      }))
      setDevices(opts)
    }).catch(() => { /* silent */ })
  }, [])

  // ===== 加载历史记录 =====
  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize, extra: 'history', ...filters }
      if (!params.start_date) delete params.start_date
      if (!params.end_date) delete params.end_date
      if (!params.device_id) delete params.device_id
      if (!params.trigger_mode) delete params.trigger_mode
      if (!params.status) delete params.status
      const res = await api.get('/basic/device-records', { params })
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      setRecords(list)
      setTotal(res?.total || raw?.total || list.length)
    } catch (err: any) {
      message.error('加载历史保养记录失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ===== 详情 =====
  const handleDetail = async (id: number) => {
    try {
      const res = await api.get(`/basic/device-records/${id}`)
      setDetailData(res?.data || res)
      setDetailOpen(true)
    } catch {
      message.error('加载详情失败')
    }
  }

  // ===== 统计 =====
  const statItems: StatItem[] = [
    { label: '已完成', value: records.filter(r => r.status === '已完成').length, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '跳过', value: records.filter(r => r.status === '跳过').length, color: '#faad14', icon: <HistoryOutlined /> },
    { label: '异常项', value: records.filter(r => r.result === '异常').length, color: '#f5222d', icon: <ThunderboltOutlined /> },
    { label: '总记录数', value: total, color: '#722ed1', icon: <DashboardOutlined /> },
  ]

  // ===== 列定义 =====
  const columns = [
    { title: '记录编号', dataIndex: 'record_no', width: 160 },
    { title: '设备编号', dataIndex: 'device_code', width: 130, render: (v: string) => v || '-' },
    { title: '设备名称', dataIndex: 'device_name', width: 150, render: (v: string) => v || '-' },
    {
      title: '保养项', width: 200, render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.standard?.maintenance_content || '-'}</div>
          {r.standard?.mechanism && <Text type="secondary" style={{ fontSize: 12 }}>{r.standard.mechanism}</Text>}
        </div>
      ),
    },
    {
      title: '频率', width: 90, render: (_: any, r: any) => (
        <Tag color={MODE_COLOR[r.trigger_mode]}>{MODE_LABEL[r.trigger_mode] || r.trigger_mode}</Tag>
      ),
    },
    {
      title: '状态', width: 90, render: (_: any, r: any) => (
        <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>
      ),
    },
    {
      title: '结果', width: 90, render: (_: any, r: any) => r.result
        ? <Tag color={RESULT_COLOR[r.result]}>{r.result}</Tag>
        : <Text type="secondary">-</Text>,
    },
    { title: '执行人', dataIndex: 'executor_name', width: 100, render: (v: string) => v || '-' },
    {
      title: '执行日期', width: 130, render: (_: any, r: any) => {
        const d = r.end_time || r.start_time
        return d ? dayjs(d).format('YYYY-MM-DD') : <Text type="secondary">-</Text>
      },
    },
    {
      title: '操作', width: 100, fixed: 'right' as const, render: (_: any, r: any) => (
        <Button size="small" type="link" onClick={() => handleDetail(r.record_id)}>详情</Button>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="历史保养记录"
        breadcrumbs="设备管理 / 历史保养记录"
        stats={statItems}
        filter={
          <Space wrap>
            <Select
              placeholder="全部设备" allowClear
              style={{ width: 200 }}
              value={filters.device_id}
              onChange={(v) => { setFilters(f => ({ ...f, device_id: v })); setPage(1) }}
              options={[{ label: '全部设备', value: undefined, disabled: true }, ...devices.map(d => ({
                label: `${d.device_code} ${d.device_name}`,
                value: d.device_id,
              }))]}
            />
            <Select
              placeholder="全部频率" allowClear
              style={{ width: 140 }}
              value={filters.trigger_mode}
              onChange={(v) => { setFilters(f => ({ ...f, trigger_mode: v })); setPage(1) }}
              options={MODE_OPTIONS}
            />
            <Select
              placeholder="全部状态" allowClear
              style={{ width: 120 }}
              value={filters.status}
              onChange={(v) => { setFilters(f => ({ ...f, status: v })); setPage(1) }}
              options={HISTORY_STATUS_OPTIONS}
            />
            <RangePicker
              style={{ width: 240 }}
              onChange={(ds) => {
                setFilters(f => ({
                  ...f,
                  start_date: ds?.[0]?.format('YYYY-MM-DD'),
                  end_date: ds?.[1]?.format('YYYY-MM-DD'),
                }))
                setPage(1)
              }}
            />
            <Input
              placeholder="编号/设备名搜索" allowClear prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={filters.keyword}
              onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
              onPressEnter={() => { setPage(1); loadRecords() }}
            />
          </Space>
        }
        actions={
          <Space>
            <Button icon={<SearchOutlined />} type="primary" onClick={() => { setPage(1); loadRecords() }}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setFilters({
                device_id: undefined,
                trigger_mode: undefined,
                status: undefined,
                start_date: undefined,
                end_date: undefined,
                keyword: '',
              })
              setPage(1)
            }}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadRecords()}>刷新</Button>
          </Space>
        }
        table={
          <Spin spinning={loading}>
            <Table
              rowKey="record_id"
              columns={columns}
              dataSource={records}
              scroll={{ x: 1400 }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p, ps) => { setPage(p); setPageSize(ps) },
              }}
              locale={{ emptyText: <Empty description="暂无历史保养记录" /> }}
            />
          </Spin>
        }
      />

      {/* ===== 详情 Drawer ===== */}
      <Drawer
        title={`执行记录详情 ${detailData?.record_no || ''}`}
        open={detailOpen}
        width={640}
        onClose={() => setDetailOpen(false)}
      >
        {detailData && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="记录编号">{detailData.record_no}</Descriptions.Item>
              <Descriptions.Item label="设备">{detailData.device_name} ({detailData.device_code})</Descriptions.Item>
              <Descriptions.Item label="保养项">{detailData.standard?.maintenance_content || '-'}</Descriptions.Item>
              {detailData.standard?.mechanism && <Descriptions.Item label="机构">{detailData.standard.mechanism}</Descriptions.Item>}
              {detailData.standard?.component && <Descriptions.Item label="部件">{detailData.standard.component}</Descriptions.Item>}
              {detailData.standard?.location && <Descriptions.Item label="部位">{detailData.standard.location}</Descriptions.Item>}
              {detailData.standard?.standard_value && <Descriptions.Item label="判定基准">{detailData.standard.standard_value}</Descriptions.Item>}
              {detailData.standard?.maintenance_method && <Descriptions.Item label="保养方法">{detailData.standard.maintenance_method}</Descriptions.Item>}
              <Descriptions.Item label="频率">
                <Tag color={MODE_COLOR[detailData.trigger_mode]}>{MODE_LABEL[detailData.trigger_mode]}</Tag>
              </Descriptions.Item>
              {detailData.period_key && <Descriptions.Item label="周期">{detailData.period_key}</Descriptions.Item>}
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[detailData.status]}>{detailData.status}</Tag>
              </Descriptions.Item>
              {detailData.result && (
                <Descriptions.Item label="结果">
                  <Tag color={RESULT_COLOR[detailData.result]}>{detailData.result}</Tag>
                </Descriptions.Item>
              )}
              {detailData.actual_value && <Descriptions.Item label="实测值">{detailData.actual_value}</Descriptions.Item>}
              {detailData.abnormal_desc && <Descriptions.Item label="异常描述">{detailData.abnormal_desc}</Descriptions.Item>}
              {detailData.executor_name && <Descriptions.Item label="执行人">{detailData.executor_name}</Descriptions.Item>}
              {detailData.start_time && <Descriptions.Item label="开始时间">{dayjs(detailData.start_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>}
              {detailData.end_time && <Descriptions.Item label="结束时间">{dayjs(detailData.end_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>}
              {detailData.duration_min && <Descriptions.Item label="耗时">{detailData.duration_min} 分钟</Descriptions.Item>}
              {detailData.remarks && <Descriptions.Item label="备注">{detailData.remarks}</Descriptions.Item>}
            </Descriptions>

            {detailData.maintenance_images?.length > 0 && (
              <Card
                size="small"
                title="保养图片"
                style={{ marginTop: 12 }}
                bodyStyle={{ padding: 12 }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {detailData.maintenance_images.map((img: any) => (
                    <Image
                      key={img.image_id}
                      width={100}
                      height={100}
                      style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }}
                      src={img.file_path}
                      alt="保养图片"
                    />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
