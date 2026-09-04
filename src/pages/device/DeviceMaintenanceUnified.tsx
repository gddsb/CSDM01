import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, message, Modal, Popconfirm, Empty, Spin, Radio, Table, Checkbox, InputNumber, Upload, Image, Card,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import {
  ToolOutlined, ClockCircleOutlined, CheckCircleOutlined, SearchOutlined,
  ReloadOutlined, PlusOutlined, SettingOutlined, EditOutlined, EyeOutlined,
  DeleteOutlined, ThunderboltOutlined, DashboardOutlined, PrinterOutlined, AppstoreOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title, Text } = Typography

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

const STATUS_OPTIONS = [
  { label: '待执行', value: '待执行' },
  { label: '执行中', value: '执行中' },
  { label: '已完成', value: '已完成' },
  { label: '跳过', value: '跳过' },
]
const MODE_OPTIONS = [
  { label: '每日点检', value: 'daily' },
  { label: '每周保养', value: 'weekly' },
  { label: '每月保养', value: 'monthly' },
  { label: '运行时长', value: 'runtime' },
]
const JUDGE_OPTIONS = [
  { label: '定性（正常/异常）', value: '定性' },
  { label: '定量（数值范围）', value: '定量' },
]

interface DeviceOption { device_id: number; device_code: string; device_name: string }

export default function DeviceMaintenanceUnified() {
  const navigate = useNavigate()
  // ============ 执行记录列表 ============
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [filters, setFilters] = useState({
    device_id: undefined as number | undefined,
    trigger_mode: undefined as string | undefined,
    status: undefined as string | undefined,
    start_date: dayjs().startOf('month').format('YYYY-MM-DD') as string | undefined,
    end_date: dayjs().endOf('month').format('YYYY-MM-DD') as string | undefined,
    keyword: '',
  })

  // ============ 展开行控制 ============
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  // ============ 完成保养 Modal ============
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeLoading, setCompleteLoading] = useState(false)
  const [completeRecord, setCompleteRecord] = useState<any>(null)
  const [form] = Form.useForm()
  const [resultType, setResultType] = useState<'正常' | '异常'>('正常')
  const [completeFileList, setCompleteFileList] = useState<UploadFile[]>([])

  // ============ 设备下拉 ============
  const [devices, setDevices] = useState<DeviceOption[]>([])

  // ============ 生成弹窗 ============
  const [genOpen, setGenOpen] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [genModes, setGenModes] = useState<string[]>(['daily', 'weekly', 'monthly', 'runtime'])
  const [genDeviceId, setGenDeviceId] = useState<number | undefined>(undefined)
  const [genDate, setGenDate] = useState<string>(dayjs().format('YYYY-MM-DD'))

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

  // ===== 加载执行记录（按设备聚合需要拉取全部本月记录，分页改为前端按设备分页） =====
  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: 1, page_size: 9999, ...filters }
      if (!filters.start_date) delete params.start_date
      if (!filters.end_date) delete params.end_date
      if (!filters.device_id) delete params.device_id
      if (!filters.trigger_mode) delete params.trigger_mode
      if (!filters.status) delete params.status
      const res = await api.get('/basic/device-records', { params })
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      setRecords(list)
      setTotal(res?.total || raw?.total || list.length)
    } catch (err: any) {
      message.error('加载执行记录失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ===== 按设备分组 =====
  const deviceGroups = useMemo(() => {
    const map = new Map<number, { device_id: number; device_code: string; device_name: string; records: any[] }>()
    records.forEach(r => {
      if (!map.has(r.device_id)) {
        map.set(r.device_id, {
          device_id: r.device_id,
          device_code: r.device_code,
          device_name: r.device_name,
          records: [],
        })
      }
      map.get(r.device_id)!.records.push(r)
    })
    return Array.from(map.values())
  }, [records])

  // ===== 生成执行记录 =====
  const handleGenerate = async () => {
    setGenLoading(true)
    try {
      const payload: any = { mode: genModes, target_date: genDate }
      if (genDeviceId) payload.device_id = genDeviceId
      const res = await api.post('/basic/device-records/generate', payload)
      message.success(res?.message || `成功生成 ${res?.data?.created || 0} 条`)
      setGenOpen(false)
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '生成失败')
    } finally {
      setGenLoading(false)
    }
  }

  // ===== 开始执行 =====
  const handleStart = async (id: number) => {
    try {
      const res = await api.put(`/basic/device-records/${id}/start`, {})
      message.success(res?.message || '已开始执行')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    }
  }

  // ===== 跳过 =====
  const handleSkip = async (id: number) => {
    try {
      const res = await api.put(`/basic/device-records/${id}/skip`, {})
      message.success(res?.message || '已标记为跳过')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    }
  }

  // ===== 打开完成保养弹窗 =====
  const openComplete = (record: any) => {
    setCompleteRecord(record)
    setResultType('正常')
    setCompleteFileList([])
    form.resetFields()
    form.setFieldsValue({ result: '正常' })
    setCompleteOpen(true)
  }

  // ===== 上传保养图片（返回全部成功才通过，否则抛错让上层处理） =====
  const uploadCompleteImages = async (recordId: number, files: File[]): Promise<number> => {
    if (files.length === 0) return 0
    const fd = new FormData()
    files.forEach(f => fd.append('images', f))
    const res = await api.post(`/basic/device-records/${recordId}/images`, fd)
    const saved = res?.data?.saved ?? res?.saved ?? 0
    const failed = res?.data?.failed ?? res?.failed ?? 0
    const total = res?.data?.total ?? res?.total ?? files.length
    if (saved === 0) {
      throw new Error(res?.message || '所有图片上传失败')
    }
    if (saved < total) {
      throw new Error(`${saved}/${total} 张图片上传成功，${failed} 张失败`)
    }
    return saved
  }

  // ===== 完成保养（先上传图片，全部成功后再提交执行结果） =====
  const handleComplete = async () => {
    const values = await form.validateFields()
    // 收集待上传的本地文件
    const pendingFiles = completeFileList
      .filter(f => f.originFileObj)
      .map(f => f.originFileObj as File)

    setCompleteLoading(true)
    try {
      // Step 1: 先上传图片，任何失败都不会提交完成（回滚）
      if (pendingFiles.length > 0) {
        await uploadCompleteImages(completeRecord.record_id, pendingFiles)
      }

      // Step 2: 图片全部成功（或无图片），再提交完成
      const res = await api.put(`/basic/device-records/${completeRecord.record_id}/submit`, values)
      if (res?.success !== false) {
        message.success(res?.message || '完成保养成功')
        setCompleteOpen(false)
        loadRecords()
      } else {
        message.error(res?.message || '提交失败')
      }
    } catch (err: any) {
      // 图片上传或提交失败均提示用户，Modal 保持打开可重试
      const msg = err?.message || '未知错误'
      if (msg.includes('图片') || msg.includes('上传')) {
        message.error(`图片上传失败：${msg}。保养结果尚未提交，请检查网络后重试`)
      } else {
        message.error(`提交失败：${msg}`)
      }
    } finally {
      setCompleteLoading(false)
    }
  }

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

  // ===== 删除 =====
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/basic/device-records/${id}`)
      message.success('删除成功')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  // ===== 统计 =====
  const statItems: StatItem[] = [
    { label: '待执行', value: records.filter(r => r.status === '待执行').length, color: '#faad14', icon: <ClockCircleOutlined /> },
    { label: '执行中', value: records.filter(r => r.status === '执行中').length, color: '#1890ff', icon: <ToolOutlined /> },
    { label: '已完成', value: records.filter(r => r.status === '已完成').length, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '异常项', value: records.filter(r => r.result === '异常').length, color: '#f5222d', icon: <ThunderboltOutlined /> },
    { label: '总记录数', value: total, color: '#722ed1', icon: <DashboardOutlined /> },
  ]

  // ===== 子表列定义（执行记录，去掉设备列，操作列宽 250）=====
  const recordColumns = [
    { title: '记录编号', dataIndex: 'record_no', width: 160 },
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
      title: '操作', width: 250, fixed: 'right' as const, render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => handleDetail(r.record_id)}>详情</Button>
          {r.status === '待执行' && (
            <Button size="small" type="link" onClick={() => handleStart(r.record_id)}>开始</Button>
          )}
          {r.status === '执行中' && (
            <Button size="small" type="link" onClick={() => openComplete(r)}>完成</Button>
          )}
          {r.status === '待执行' && (
            <Button size="small" type="link" onClick={() => handleSkip(r.record_id)}>跳过</Button>
          )}
        </Space>
      ),
    },
  ]

  // ===== 外层设备分组列定义 =====
  const deviceColumns = [
    { title: '设备编号', dataIndex: 'device_code', width: 160 },
    { title: '设备名称', dataIndex: 'device_name', width: 200 },
    {
      title: '待执行', width: 90, render: (_: any, r: any) => {
        const c = r.records.filter((x: any) => x.status === '待执行').length
        return <Tag color={STATUS_COLOR['待执行']}>{c}</Tag>
      },
    },
    {
      title: '执行中', width: 90, render: (_: any, r: any) => {
        const c = r.records.filter((x: any) => x.status === '执行中').length
        return <Tag color={STATUS_COLOR['执行中']}>{c}</Tag>
      },
    },
    {
      title: '已完成', width: 90, render: (_: any, r: any) => {
        const c = r.records.filter((x: any) => x.status === '已完成').length
        return <Tag color={STATUS_COLOR['已完成']}>{c}</Tag>
      },
    },
    {
      title: '操作', width: 120, render: (_: any, r: any) => {
        const expanded = expandedRowKeys.includes(r.device_id)
        return (
          <Button
            size="small"
            type="link"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedRowKeys(expanded
                ? expandedRowKeys.filter(k => k !== r.device_id)
                : [...expandedRowKeys, r.device_id])
            }}
          >
            {expanded ? '收起' : '查看'}
          </Button>
        )
      },
    },
  ]

  return (
    <>
    <ThreeSectionPage
      title="设备保养（点检+维护）"
      breadcrumbs="设备管理 / 设备保养"
      stats={statItems}
      filter={
        <Space wrap>
          <Select
            placeholder="全部设备" allowClear
            style={{ width: 200 }}
            value={filters.device_id}
            onChange={(v) => setFilters(f => ({ ...f, device_id: v, page: 1 }))}
            options={[{ label: '全部设备', value: undefined, disabled: true }, ...devices.map(d => ({
              label: `${d.device_code} ${d.device_name}`,
              value: d.device_id,
            }))]}
          />
          <Select
            placeholder="全部频率" allowClear
            style={{ width: 140 }}
            value={filters.trigger_mode}
            onChange={(v) => setFilters(f => ({ ...f, trigger_mode: v, page: 1 }))}
            options={MODE_OPTIONS}
          />
          <Select
            placeholder="全部状态" allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(v) => setFilters(f => ({ ...f, status: v, page: 1 }))}
            options={STATUS_OPTIONS}
          />
          <RangePicker
            style={{ width: 240 }}
            value={filters.start_date && filters.end_date
              ? [dayjs(filters.start_date), dayjs(filters.end_date)]
              : undefined}
            onChange={(ds) => {
              setFilters(f => ({
                ...f,
                start_date: ds?.[0]?.format('YYYY-MM-DD'),
                end_date: ds?.[1]?.format('YYYY-MM-DD'),
                page: 1,
              }))
            }}
          />
          <Input
            placeholder="编号/设备名搜索" allowClear prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.keyword}
            onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
          />
        </Space>
      }
      actions={
        <Space>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
            setGenModes(['daily', 'weekly', 'monthly', 'runtime'])
            setGenDeviceId(filters.device_id)
            setGenDate(dayjs().format('YYYY-MM-DD'))
            setGenOpen(true)
          }}>生成执行记录</Button>
          <Button
            icon={<AppstoreOutlined />}
            disabled={!filters.device_id}
            onClick={() => navigate(
              `/device/maintenance/matrix?device_id=${filters.device_id}&year_month=${dayjs().format('YYYY-MM')}`
            )}
          >矩阵视图</Button>
          <Button
            icon={<PrinterOutlined />}
            disabled={!filters.device_id}
            onClick={() => window.open(
              `/device/maintenance/print?device_id=${filters.device_id}&year_month=${dayjs().format('YYYY-MM')}`,
              '_blank', 'width=1280,height=800'
            )}
          >打印</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadRecords() }}>刷新</Button>
        </Space>
      }
      table={
        <Spin spinning={loading}>
          <Table
            rowKey="device_id"
            columns={deviceColumns}
            dataSource={deviceGroups}
            scroll={{ x: 800 }}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
              expandedRowRender: (record: any) => (
                <Table
                  rowKey="record_id"
                  columns={recordColumns}
                  dataSource={record.records}
                  pagination={false}
                  size="small"
                  scroll={{ x: 1200 }}
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total: deviceGroups.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 台设备 / ${total} 条记录`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            }}
            locale={{ emptyText: <Empty description="暂无执行记录" /> }}
          />
        </Spin>
      }
    />

    {/* ===== 生成执行记录弹窗 ===== */}
      <Modal
        title="生成保养执行记录"
        open={genOpen}
        confirmLoading={genLoading}
        onOk={handleGenerate}
        onCancel={() => setGenOpen(false)}
        okText="生成"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Text>触发频率：</Text>
          <Checkbox.Group
            value={genModes}
            onChange={(v) => setGenModes(v as string[])}
            options={MODE_OPTIONS}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text>目标日期：</Text>
          <DatePicker
            value={dayjs(genDate)}
            onChange={(d) => setGenDate(d?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'))}
            format="YYYY-MM-DD"
          />
        </div>
        <div>
          <Text>限定设备（可选，不选则为全部设备）：</Text>
          <Select
            placeholder="全部设备" allowClear
            style={{ width: 280 }}
            value={genDeviceId}
            onChange={setGenDeviceId}
            options={[{ label: '全部设备', value: undefined, disabled: true }, ...devices.map(d => ({
              label: `${d.device_code} ${d.device_name}`,
              value: d.device_id,
            }))]}
          />
        </div>
      </Modal>

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

      {/* ===== 完成保养 Modal ===== */}
      <Modal
        title={
          <span>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            完成保养执行 — {completeRecord?.record_no || ''}
          </span>
        }
        open={completeOpen}
        confirmLoading={completeLoading}
        onOk={handleComplete}
        onCancel={() => setCompleteOpen(false)}
        okText="提交完成"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        {completeRecord && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
            <div><Text type="secondary">设备：</Text>{completeRecord.device_name} ({completeRecord.device_code})</div>
            <div><Text type="secondary">保养项：</Text>{completeRecord.standard?.maintenance_content || '-'}</div>
            <div><Text type="secondary">周期：</Text>{completeRecord.period_key} <Tag color={MODE_COLOR[completeRecord.trigger_mode]} style={{ marginLeft: 4 }}>{MODE_LABEL[completeRecord.trigger_mode]}</Tag></div>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="result" label="执行结果" rules={[{ required: true, message: '请选择执行结果' }]}>
            <Radio.Group onChange={(e) => setResultType(e.target.value)}>
              <Radio value="正常"><Tag color="success">正常</Tag>（保养完成，无异常）</Radio>
              <Radio value="异常"><Tag color="error">异常</Tag>（发现问题，需创建故障）</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item shouldUpdate={(prev, cur) => prev.result !== cur.result} noStyle>
            {({ getFieldValue }) => {
              const isAbnormal = getFieldValue('result') === '异常'
              return (
                <>
                  {isAbnormal && (
                    <Form.Item name="abnormal_desc" label="异常描述" rules={[{ required: true, message: '请填写异常描述' }]}>
                      <TextArea rows={3} placeholder="描述发现的异常情况、位置、严重程度等" />
                    </Form.Item>
                  )}

                  <Form.Item name="actual_value" label="实测值（定量型保养填写）">
                    <Input placeholder={isAbnormal ? '如：温度偏高 75℃' : '如：温度 52℃，压力正常'} />
                  </Form.Item>

                  <Form.Item name="maintenance_content" label="保养内容记录">
                    <TextArea rows={2} placeholder="简要记录本次实际执行的保养动作" />
                  </Form.Item>

                  <Form.Item name="duration_min" label="耗时（分钟）">
                    <InputNumber min={0} style={{ width: 160 }} placeholder="自动计算" />
                  </Form.Item>

                  <Form.Item name="remarks" label="备注">
                    <TextArea rows={2} placeholder="其他需要说明的事项" />
                  </Form.Item>

                  <Form.Item label="保养图片（最多10张）">
                    <Upload
                      listType="picture-card"
                      multiple
                      accept="image/*"
                      fileList={completeFileList}
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setCompleteFileList(fileList)}
                      maxCount={10}
                    >
                      <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 4 }}>上传图片</div>
                      </div>
                    </Upload>
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
