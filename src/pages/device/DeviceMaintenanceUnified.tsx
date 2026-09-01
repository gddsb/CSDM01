import React, { useState, useEffect, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, message, Modal, Popconfirm, Empty, Spin, Radio, Table, Checkbox, InputNumber, Upload, Image,
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
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    keyword: '',
  })

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

  // ===== 加载执行记录 =====
  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize, ...filters }
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
  }, [page, pageSize, filters])

  useEffect(() => { loadRecords() }, [loadRecords])

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

  // ===== 上传保养图片 =====
  const uploadCompleteImages = async (recordId: number, files: File[]) => {
    if (files.length === 0) return
    const fd = new FormData()
    files.forEach(f => fd.append('images', f))
    try {
      // 注意：不要手动设置 Content-Type，浏览器会自动带 multipart/form-data + boundary
      await api.post(`/basic/device-records/${recordId}/images`, fd)
    } catch (err: any) {
      message.warning('保养结果已提交，但图片上传失败：' + (err?.message || '请稍后重试'))
    }
  }

  // ===== 完成保养（提交执行结果） =====
  const handleComplete = async () => {
    const values = await form.validateFields()
    setCompleteLoading(true)
    try {
      const res = await api.put(`/basic/device-records/${completeRecord.record_id}/submit`, values)
      if (res?.success !== false) {
        // 收集待上传的文件（仅本地文件，已上传的跳过）
        const pendingFiles = completeFileList
          .filter(f => f.originFileObj)
          .map(f => f.originFileObj as File)
        if (pendingFiles.length > 0) {
          await uploadCompleteImages(completeRecord.record_id, pendingFiles)
        }
        message.success(res?.message || '完成保养成功')
        setCompleteOpen(false)
        loadRecords()
      } else {
        message.error(res?.message || '提交失败')
      }
    } catch (err: any) {
      message.error(err?.message || '提交失败')
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

  // ===== 列定义 =====
  const columns = [
    { title: '记录编号', dataIndex: 'record_no', width: 160 },
    {
      title: '设备', width: 180, render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.device_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.device_code}</Text>
        </div>
      ),
    },
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
      title: '操作', width: 200, fixed: 'right' as const, render: (_: any, r: any) => (
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
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="记录编号">{detailData.record_no}</Descriptions.Item>
            <Descriptions.Item label="设备">{detailData.device_name} ({detailData.device_code})</Descriptions.Item>
            <Descriptions.Item label="保养项">{detailData.standard?.maintenance_content || '-'}</Descriptions.Item>
            <Descriptions.Item label="机构">{detailData.standard?.mechanism || '-'}</Descriptions.Item>
            <Descriptions.Item label="部件">{detailData.standard?.component || '-'}</Descriptions.Item>
            <Descriptions.Item label="部位">{detailData.standard?.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="判定基准">{detailData.standard?.standard_value || '-'}</Descriptions.Item>
            <Descriptions.Item label="保养图片">
              {detailData.maintenance_images?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detailData.maintenance_images.map((img: any) => (
                    <Image
                      key={img.image_id}
                      width={80}
                      height={80}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                      src={img.file_path}
                      alt="保养图片"
                    />
                  ))}
                </div>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="频率">
              <Tag color={MODE_COLOR[detailData.trigger_mode]}>{MODE_LABEL[detailData.trigger_mode]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="周期">{detailData.period_key}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR[detailData.status]}>{detailData.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="结果">
              {detailData.result ? <Tag color={RESULT_COLOR[detailData.result]}>{detailData.result}</Tag> : '-'}
            </Descriptions.Item>
            {detailData.actual_value && <Descriptions.Item label="实测值">{detailData.actual_value}</Descriptions.Item>}
            {detailData.abnormal_desc && <Descriptions.Item label="异常描述">{detailData.abnormal_desc}</Descriptions.Item>}
            <Descriptions.Item label="执行人">{detailData.executor_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{detailData.start_time ? dayjs(detailData.start_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{detailData.end_time ? dayjs(detailData.end_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            {detailData.duration_min && <Descriptions.Item label="耗时">{detailData.duration_min} 分钟</Descriptions.Item>}
            {detailData.remarks && <Descriptions.Item label="备注">{detailData.remarks}</Descriptions.Item>}
          </Descriptions>
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
