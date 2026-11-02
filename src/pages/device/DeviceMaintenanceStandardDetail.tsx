import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Tag, Button, Space, Input, Drawer, Form, Radio, InputNumber,
  Checkbox, Empty, Spin, Descriptions, Typography, Tooltip, message, Select, Modal,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined,
  CheckCircleOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { TextArea } = Input

const STATUS_COLOR: Record<string, string> = {
  '编制': 'default',
  '生效': 'success',
  '停用': 'warning',
}
const MODE_LABEL: Record<string, string> = {
  daily: '每日', weekly: '每周', monthly: '每月', runtime: '运行时长',
}
const MODE_COLOR: Record<string, string> = {
  daily: 'green', weekly: 'blue', monthly: 'purple', runtime: 'orange',
}
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

interface StdRow {
  standard_id: number
  device_id: number
  mechanism?: string
  component?: string
  location?: string
  maintenance_method?: string
  maintenance_content?: string
  judge_type: string
  standard_value?: string
  unit?: string
  point_count: number
  time_per_point: number
  trigger_mode: 'daily' | 'weekly' | 'monthly' | 'runtime'
  monthly_plan?: boolean[]
  runtime_threshold?: number | string
  sort_order: number
  status: number
  remarks?: string
  // 分配人员字段
  assigned_user_ids?: number[] | null
  assigned_user_names?: string | null
  inspector_user_ids?: number[] | null
  inspector_user_names?: string | null
}

interface UserOption {
  label: string
  value: number
}

export default function DeviceMaintenanceStandardDetail() {
  const message = useMessage()
  const navigate = useNavigate()
  const { deviceId } = useParams<{ deviceId: string }>()

  const [profile, setProfile] = useState<any>(null)
  const [standards, setStandards] = useState<StdRow[]>([])
  const [loading, setLoading] = useState(false)

  // 编辑 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<StdRow | null>(null)
  const [form] = Form.useForm()
  // 查看 Drawer（生效态只读）
  const [viewOpen, setViewOpen] = useState(false)
  const [viewRow, setViewRow] = useState<StdRow | null>(null)

  // 系统用户列表（用于分配人员）
  const [userOptions, setUserOptions] = useState<UserOption[]>([])

  // 分配人员 Modal state
  const [assignMode, setAssignMode] = useState<'single' | 'device'>('single')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTargetStandard, setAssignTargetStandard] = useState<StdRow | null>(null)
  const [assignTriggerMode, setAssignTriggerMode] = useState<string>('daily')
  const [assignAssigned, setAssignAssigned] = useState<number[]>([])
  const [assignInspectors, setAssignInspectors] = useState<number[]>([])
  const [assignSaving, setAssignSaving] = useState(false)

  // ===== 加载档案详情（含标准项） =====
  const loadDetail = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const res: any = await api.get(`/basic/device-maintenance-profiles/${deviceId}`)
      const data = res?.data
      setProfile(data)
      setStandards(Array.isArray(data?.standards) ? data.standards : [])
    } catch (err: any) {
      message.error(err?.message || '加载档案详情失败')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => { loadDetail() }, [loadDetail])

  // 加载系统用户列表（用于分配人员 Modal）
  useEffect(() => {
    api.get('/system/users', { params: { pageSize: 999 } }).then((res: any) => {
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      setUserOptions(list.map((u: any) => ({
        label: `${u.username || u.real_name || u.name || ''}${u.real_name && u.username && u.real_name !== u.username ? ` (${u.username})` : ''}`,
        value: Number(u.user_id ?? u.id),
      })).filter((u: any) => u.value))
    }).catch(() => { /* silent */ })
  }, [])

  // ===== 状态切换 =====
  const handleSwitchStatus = async (target: '编制' | '生效' | '停用') => {
    try {
      await api.put(`/basic/device-maintenance-profiles/${deviceId}/status`, { status: target })
      message.success(`已切换为「${target}」`)
      loadDetail()
    } catch (err: any) {
      message.error(err?.message || '状态切换失败')
    }
  }

  // ===== 新增/编辑标准项 =====
  const openAddDrawer = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      judge_type: '定性',
      trigger_mode: 'daily',
      status: 1,
      point_count: 1,
      time_per_point: 0,
    })
    setDrawerOpen(true)
  }

  const openEditDrawer = (row: StdRow) => {
    setEditing(row)
    const mpRaw = Array.isArray(row.monthly_plan) ? row.monthly_plan : []
    const mpIndices = mpRaw.map((v, i) => v ? i : -1).filter(v => v >= 0)
    form.setFieldsValue({
      ...row,
      monthly_plan: mpIndices,
      runtime_threshold: row.runtime_threshold ?? null,
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      const payload = { ...values }
      if (values.trigger_mode === 'monthly') {
        const mp = Array(12).fill(false)
        if (Array.isArray(values.monthly_plan)) {
          values.monthly_plan.forEach((idx: number) => {
            if (typeof idx === 'number' && idx >= 0 && idx < 12) mp[idx] = true
          })
        }
        payload.monthly_plan = mp
      } else {
        payload.monthly_plan = null
      }
      if (values.trigger_mode !== 'runtime') payload.runtime_threshold = null

      const res: any = editing
        ? await api.put(`/basic/device-standards/${editing.standard_id}`, payload)
        : await api.post('/basic/device-standards', { ...payload, device_id: Number(deviceId) })

      if (res?.success === false) {
        message.error(res?.message || '操作失败')
        return
      }
      message.success(editing ? '更新成功' : '创建成功')
      setDrawerOpen(false)
      loadDetail()
    } catch (err: any) {
      if (err?.message) message.error(err.message)
    }
  }

  // ===== 分配人员：打开单条分配 Modal =====
  const openSingleAssignModal = (row: StdRow) => {
    setAssignMode('single')
    setAssignTargetStandard(row)
    setAssignTriggerMode(row.trigger_mode)
    setAssignAssigned(Array.isArray(row.assigned_user_ids) ? row.assigned_user_ids : [])
    setAssignInspectors(Array.isArray(row.inspector_user_ids) ? row.inspector_user_ids : [])
    setAssignOpen(true)
  }

  // ===== 分配人员：打开设备级批量分配 Modal =====
  const openDeviceAssignModal = () => {
    setAssignMode('device')
    setAssignTargetStandard(null)
    setAssignTriggerMode('daily')
    setAssignAssigned([])
    setAssignInspectors([])
    setAssignOpen(true)
  }

  // ===== 保存分配 =====
  const handleSaveAssign = async () => {
    setAssignSaving(true)
    try {
      const assignedNames = userOptions.filter(u => assignAssigned.includes(u.value)).map(u => u.label).join('、') || null
      const inspectorNames = userOptions.filter(u => assignInspectors.includes(u.value)).map(u => u.label).join('、') || null

      let res: any
      if (assignMode === 'single' && assignTargetStandard) {
        res = await api.put('/basic/device-standards/batch-assign', {
          standard_ids: [assignTargetStandard.standard_id],
          assigned_user_ids: assignAssigned,
          assigned_user_names: assignedNames,
          inspector_user_ids: assignInspectors,
          inspector_user_names: inspectorNames,
        })
      } else {
        res = await api.put('/basic/device-standards/assign-daily-by-device', {
          device_id: Number(deviceId),
          trigger_mode: assignTriggerMode,
          assigned_user_ids: assignAssigned,
          assigned_user_names: assignedNames,
          inspector_user_ids: assignInspectors,
          inspector_user_names: inspectorNames,
        })
      }

      if (res?.success === false) {
        message.error(res?.message || '分配失败')
        return
      }
      message.success(`成功分配 ${res?.data?.updated ?? 0} 条标准`)
      setAssignOpen(false)
      loadDetail()
    } catch (err: any) {
      message.error(err?.message || '分配失败')
    } finally {
      setAssignSaving(false)
    }
  }

  const device = profile?.device || {}
  const currentStatus = profile?.status
  const isEffective = currentStatus === '生效'

  // ===== 列定义 =====
  const columns: ColumnsType<StdRow> = [
    {
      title: '频率', width: 80,
      render: (_, r) => <Tag color={MODE_COLOR[r.trigger_mode]}>{MODE_LABEL[r.trigger_mode] || r.trigger_mode}</Tag>,
    },
    { title: '保养/点检内容', dataIndex: 'maintenance_content', width: 180, render: (v) => v || '-' },
    {
      title: '责任人', width: 130, ellipsis: true,
      render: (_, r) => r.assigned_user_names ? <Tag color="blue">{r.assigned_user_names}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: '检查人', width: 130, ellipsis: true,
      render: (_, r) => r.inspector_user_names ? <Tag color="green">{r.inspector_user_names}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: '判定基准', dataIndex: 'standard_value', width: 150, ellipsis: true, render: (v) => v || '-' },
    { title: '保养方法', dataIndex: 'maintenance_method', width: 110, render: (v) => v || '-' },
    { title: '判定方式', dataIndex: 'judge_type', width: 80 },
    {
      title: '周期配置', width: 160,
      render: (_, r) => {
        if (r.trigger_mode === 'monthly') {
          const mp: boolean[] = r.monthly_plan || []
          const months = mp.map((v, i) => v ? i + 1 : 0).filter(v => v > 0)
          return months.length > 0 ? months.join('月 ') + '月' : '-'
        }
        if (r.trigger_mode === 'runtime') return `${r.runtime_threshold}h`
        return r.trigger_mode === 'daily' ? '每天' : r.trigger_mode === 'weekly' ? '每周' : '-'
      },
    },
    {
      title: '操作', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openSingleAssignModal(r) }}>分配人员</Button>
        </Space>
      ),
    },
  ]

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 16 }}>
        {/* ===== 顶部操作条 ===== */}
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/device/maintenance-standard')}>返回列表</Button>
          <Button icon={<ReloadOutlined />} onClick={loadDetail}>刷新</Button>
          {!isEffective && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddDrawer}
            >新增保养项</Button>
          )}
          <Tooltip title="将本设备所有同频率保养项统一分配责任人和检查人（任何档案状态都可操作）">
            <Button onClick={openDeviceAssignModal} title="按设备+频率批量分配人员">
              📋 批量分配人员
            </Button>
          </Tooltip>
          {isEffective && (
            <Tooltip title="档案已生效，如需修改标准内容请先停用">
              <span style={{ display: 'inline-block', width: 0 }} />
            </Tooltip>
          )}
          {/* 状态切换按钮 */}
          {currentStatus === '编制' && (
            <Button type="primary" icon={<CheckCircleOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => Modal.confirm({
                title: '确认生效？生效后将按计划生成维保计划',
                onOk: () => handleSwitchStatus('生效'),
              })}>生效档案</Button>
          )}
          {currentStatus === '生效' && (
            <Button icon={<PauseCircleOutlined />} style={{ background: '#faad14', borderColor: '#faad14', color: '#fff' }}
              onClick={() => Modal.confirm({
                title: '确认停用？停用后不再生成新维保计划',
                onOk: () => handleSwitchStatus('停用'),
              })}>停用档案</Button>
          )}
          {currentStatus === '停用' && (
            <Button type="primary" icon={<PlayCircleOutlined />}
              onClick={() => Modal.confirm({ title: '确认重新生效？', onOk: () => handleSwitchStatus('生效') })}>重新生效</Button>
          )}
        </Space>

        {/* ===== 设备信息 + 档案状态 ===== */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label="设备编码">{device.device_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{device.device_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="型号/序列号">{device.device_model || '-'} / {device.serial_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="安装位置">{device.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="档案状态">
              <Tag color={STATUS_COLOR[currentStatus] || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>
                {currentStatus || '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="版本/生效日期">v{profile?.version || 1} / {profile?.effective_date || '-'}</Descriptions.Item>
          </Descriptions>
          {standards.length === 0 && (
            <div style={{ marginTop: 8, color: '#faad14' }}>
              当前档案尚无保养项，请点击「新增保养项」配置点检/维护/保养标准
            </div>
          )}
        </Card>

        {/* ===== 标准项列表 ===== */}
        <Card size="small" title={<Title level={5} style={{ margin: 0 }}>保养标准项（{standards.length}）{isEffective && <Tag color="success" style={{ marginLeft: 8 }}>已生效 · 仅查看</Tag>}</Title>}>
          <Table
            rowKey="standard_id"
            columns={columns}
            dataSource={standards}
            scroll={{ x: 1250 }}
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty description="暂无保养标准项" /> }}
            onRow={(r) => ({
              onClick: () => {
                if (isEffective) {
                  setViewRow(r); setViewOpen(true)
                } else {
                  openEditDrawer(r)
                }
              },
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      </div>

      {/* ===== 只读查看 Drawer（生效态） ===== */}
      <Drawer
        title="保养项详情"
        open={viewOpen}
        width={560}
        onClose={() => setViewOpen(false)}
        extra={<Button onClick={() => setViewOpen(false)}>关闭</Button>}
      >
        {viewRow && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="触发频率">{MODE_LABEL[viewRow.trigger_mode]}</Descriptions.Item>
            <Descriptions.Item label="保养/点检内容">{viewRow.maintenance_content || '-'}</Descriptions.Item>
            <Descriptions.Item label="责任人">{viewRow.assigned_user_names || '-'}</Descriptions.Item>
            <Descriptions.Item label="检查人">{viewRow.inspector_user_names || '-'}</Descriptions.Item>
            <Descriptions.Item label="机构">{viewRow.mechanism || '-'}</Descriptions.Item>
            <Descriptions.Item label="部件">{viewRow.component || '-'}</Descriptions.Item>
            <Descriptions.Item label="部位">{viewRow.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="保养点数">{viewRow.point_count ?? 0}</Descriptions.Item>
            <Descriptions.Item label="单件保养时间">{viewRow.time_per_point ?? 0} 分钟</Descriptions.Item>
            <Descriptions.Item label="保养方法">{viewRow.maintenance_method || '-'}</Descriptions.Item>
            <Descriptions.Item label="判定方式">{viewRow.judge_type}</Descriptions.Item>
            <Descriptions.Item label="判定基准">{viewRow.standard_value || '-'}</Descriptions.Item>
            <Descriptions.Item label="单位">{viewRow.unit || '-'}</Descriptions.Item>
            {viewRow.trigger_mode === 'monthly' && (
              <Descriptions.Item label="月度计划">
                {(() => {
                  const mp: boolean[] = viewRow.monthly_plan || []
                  const months = mp.map((v, i) => v ? i + 1 : 0).filter(v => v > 0)
                  return months.length > 0 ? months.join('月 ') + '月' : '-'
                })()}
              </Descriptions.Item>
            )}
            {viewRow.trigger_mode === 'runtime' && (
              <Descriptions.Item label="运行时长阈值">{viewRow.runtime_threshold} 小时</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>

      {/* ===== 新增/编辑标准项 Drawer ===== */}
      <Drawer
        title={editing ? '编辑保养项' : '新增保养项'}
        open={drawerOpen}
        width={720}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        <style>{`
          .compact-std-form .ant-form-item { margin-bottom: 17px !important; }
          .compact-std-form .ant-form-item:last-child { margin-bottom: 0 !important; }
        `}</style>
        <Form form={form} layout="vertical" className="compact-std-form" initialValues={{
          judge_type: '定性',
          trigger_mode: 'daily',
          point_count: 1,
          time_per_point: 0,
        }}>
          {/* 触发频率 */}
          <Form.Item name="trigger_mode" label="触发频率" rules={[{ required: true, message: '请选择触发频率' }]}>
            <Radio.Group>
              <Radio value="daily">每日点检</Radio>
              <Radio value="weekly">每周保养</Radio>
              <Radio value="monthly">每月保养</Radio>
              <Radio value="runtime">运行时长</Radio>
            </Radio.Group>
          </Form.Item>

          {/* 保养/点检内容：所有频率统一显示，必填 */}
          <Form.Item
            name="maintenance_content"
            label="保养/点检内容"
            rules={[{ required: true, message: '请填写保养/点检内容' }]}
          >
            <TextArea rows={2} placeholder="描述具体的保养动作或点检项内容" />
          </Form.Item>

          {/* 根据触发频率动态显示字段（除保养内容外的条件字段） */}
          <Form.Item shouldUpdate={(prev, cur) => prev.trigger_mode !== cur.trigger_mode} noStyle>
            {({ getFieldValue }) => {
              const mode = getFieldValue('trigger_mode')
              const isDaily = mode === 'daily'

              return (
                <>
                  {/* 机构、部件、部位：非每日点检时显示，机构必填 */}
                  {!isDaily && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <Form.Item name="mechanism" label="机构" rules={[{ required: true, message: '请填写机构' }]}>
                        <Input placeholder="如：压缩机冷热机" />
                      </Form.Item>
                      <Form.Item name="component" label="部件"><Input placeholder="如：交换管" /></Form.Item>
                      <Form.Item name="location" label="部位"><Input placeholder="如：排风扇" /></Form.Item>
                    </div>
                  )}

                  {/* 保养点数、单件保养时间、保养方法：非每日点检时显示 */}
                  {!isDaily && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <Form.Item name="point_count" label="保养点数"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                      <Form.Item name="time_per_point" label="单件保养时间(分钟)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                      <Form.Item name="maintenance_method" label="保养方法"><Input placeholder="如：定期点检 / 定期清理" /></Form.Item>
                    </div>
                  )}
                </>
              )
            }}
          </Form.Item>

          {/* 判定方式 */}
          <Form.Item name="judge_type" label="判定方式"><Radio.Group options={JUDGE_OPTIONS} /></Form.Item>

          {/* 判定基准、单位 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="standard_value" label="判定基准"><Input placeholder="如：≤60℃" /></Form.Item>
            <Form.Item name="unit" label="单位"><Input placeholder="如：℃ / hPa" /></Form.Item>
          </div>

          {/* 触发频率相关参数：月度计划至少勾选一个月 */}
          <Form.Item shouldUpdate={(prev, cur) => prev.trigger_mode !== cur.trigger_mode} noStyle>
            {({ getFieldValue }) => {
              const mode = getFieldValue('trigger_mode')
              if (mode === 'monthly') {
                return (
                  <Form.Item
                    name="monthly_plan"
                    label="月度计划（勾选哪些月份执行）"
                    rules={[
                      { required: true, message: '至少勾选一个月份' },
                      {
                        validator: (_: any, value: any) => {
                          const arr = Array.isArray(value) ? value : []
                          if (arr.length === 0) return Promise.reject(new Error('至少勾选一个月份'))
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Checkbox.Group
                      style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}
                      options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ label: `${m}月`, value: m - 1 }))}
                    />
                  </Form.Item>
                )
              }
              if (mode === 'runtime') {
                return (
                  <Form.Item name="runtime_threshold" label="运行时长阈值（小时）" rules={[{ required: true, message: '请填写运行时长阈值' }]}>
                    <InputNumber min={1} step={100} style={{ width: '100%' }} placeholder="如：500" />
                  </Form.Item>
                )
              }
              return <Text type="secondary">{mode === 'daily' ? '每天自动生成一条维保记录' : '每周一自动生成一条维保记录'}</Text>
            }}
          </Form.Item>
        </Form>
      </Drawer>

      {/* ===== 分配人员 Modal ===== */}
      <Modal
        title={assignMode === 'single'
          ? `分配人员 — ${assignTargetStandard?.maintenance_content?.slice(0, 20) || ''}...`
          : `批量分配本设备 ${MODE_LABEL[assignTriggerMode as keyof typeof MODE_LABEL] || ''} 保养项人员`}
        open={assignOpen}
        width={560}
        onCancel={() => setAssignOpen(false)}
        onOk={handleSaveAssign}
        confirmLoading={assignSaving}
        okText="保存分配"
        cancelText="取消"
      >
        {assignMode === 'device' && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">选择要批量分配的触发频率：</Text>
            <Radio.Group
              value={assignTriggerMode}
              onChange={(e) => setAssignTriggerMode(e.target.value)}
              style={{ marginLeft: 12 }}
            >
              <Radio value="daily">每日点检</Radio>
              <Radio value="weekly">每周保养</Radio>
              <Radio value="monthly">每月保养</Radio>
            </Radio.Group>
          </div>
        )}

        <Form layout="vertical">
          <Form.Item label="责任人（可多选，留空则清除）">
            <Select
              mode="multiple"
              allowClear
              placeholder="请选择责任人"
              options={userOptions}
              value={assignAssigned}
              onChange={setAssignAssigned}
              maxTagCount={3}
              showSearch
              optionFilterProp="label"
              notFoundContent="暂无系统用户"
            />
          </Form.Item>
          <Form.Item label="检查人（可多选，留空则清除）">
            <Select
              mode="multiple"
              allowClear
              placeholder="请选择检查人"
              options={userOptions}
              value={assignInspectors}
              onChange={setAssignInspectors}
              maxTagCount={3}
              showSearch
              optionFilterProp="label"
              notFoundContent="暂无系统用户"
            />
          </Form.Item>
        </Form>
        <div style={{ color: '#999', fontSize: 12 }}>
          提示：分配仅改人员配置字段，不影响档案状态（编制/生效/停用三态均可操作）。
        </div>
      </Modal>
    </Spin>
  )
}
