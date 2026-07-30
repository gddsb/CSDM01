import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Form, Input, InputNumber, Select, Switch, Modal, Space, Tag, Card, Row, Col, Popconfirm, DatePicker, TimePicker } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'

interface ScheduledTask {
  schedule_id: number
  schedule_biz_id: string
  name: string
  task_type: string
  exec_mode: string
  config: any
  next_run_at: string
  last_run_at: string
  last_run_result: string
  is_enabled: number
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  items: '料品数据',
  customers: '客户数据',
  env_monitor: '环境监测',
  weather: '气象信息',
}

const MODE_LABELS: Record<string, string> = {
  periodic: '定期任务',
  scheduled: '定时任务',
  once: '单次任务',
}

const MODE_COLORS: Record<string, string> = {
  periodic: 'blue',
  scheduled: 'green',
  once: 'purple',
}

const WEEK_DAYS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

const formatConfig = (record: ScheduledTask) => {
  const cfg = record.config || {}
  if (record.exec_mode === 'periodic') {
    const unitLabel = cfg.intervalUnit === 'minute' ? '分钟' : cfg.intervalUnit === 'hour' ? '小时' : '天'
    return `每 ${cfg.interval} ${unitLabel}`
  }
  if (record.exec_mode === 'scheduled') {
    const days = (cfg.fixedDays || []).map((d: number) => WEEK_DAYS.find(w => w.value === d)?.label).filter(Boolean).join('、')
    return `${days || '-'} ${cfg.fixedTime || ''}`
  }
  if (record.exec_mode === 'once') {
    return cfg.onceAt ? dayjs(cfg.onceAt).format('YYYY-MM-DD HH:mm') : '-'
  }
  return '-'
}

export default function ScheduledTaskPage() {
  const message = useMessage()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ScheduledTask[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledTask | null>(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/auto/scheduled-tasks')
      setData(res.data || [])
    } catch (err: any) {
      message.error(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      exec_mode: 'periodic',
      task_type: 'items',
      is_enabled: true,
      interval: 4,
      intervalUnit: 'hour',
      fixedDays: [1, 2, 3, 4, 5],
    })
    setModalOpen(true)
  }

  const handleEdit = (record: ScheduledTask) => {
    setEditing(record)
    const vals: any = {
      name: record.name,
      task_type: record.task_type,
      exec_mode: record.exec_mode,
      is_enabled: record.is_enabled === 1,
    }
    const cfg = record.config || {}
    if (record.exec_mode === 'periodic') {
      vals.interval = cfg.interval
      vals.intervalUnit = cfg.intervalUnit
    } else if (record.exec_mode === 'scheduled') {
      vals.fixedTime = cfg.fixedTime ? dayjs(cfg.fixedTime, 'HH:mm') : null
      vals.fixedDays = cfg.fixedDays
    } else if (record.exec_mode === 'once') {
      vals.onceAt = cfg.onceAt ? dayjs(cfg.onceAt) : null
    }
    form.setFieldsValue(vals)
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload: any = {
        name: values.name,
        task_type: values.task_type,
        exec_mode: values.exec_mode,
        is_enabled: values.is_enabled ? 1 : 0,
        config: {},
      }

      if (values.exec_mode === 'periodic') {
        payload.config = {
          interval: values.interval,
          intervalUnit: values.intervalUnit,
        }
      } else if (values.exec_mode === 'scheduled') {
        payload.config = {
          fixedTime: values.fixedTime?.format('HH:mm'),
          fixedDays: values.fixedDays,
        }
      } else if (values.exec_mode === 'once') {
        payload.config = {
          onceAt: values.onceAt?.format('YYYY-MM-DD HH:mm:ss'),
        }
      }

      if (editing) {
        await api.put(`/auto/scheduled-tasks/${editing.schedule_biz_id || editing.schedule_id}`, payload)
        message.success('更新成功')
      } else {
        await api.post('/auto/scheduled-tasks', payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.message || '保存失败')
    }
  }

  const handleToggle = async (record: ScheduledTask) => {
    try {
      await api.put(`/auto/scheduled-tasks/${record.schedule_biz_id || record.schedule_id}`, {
        is_enabled: record.is_enabled === 1 ? 0 : 1,
      })
      message.success('操作成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const handleTrigger = async (record: ScheduledTask) => {
    try {
      await api.post(`/auto/scheduled-tasks/${record.schedule_biz_id || record.schedule_id}/trigger`)
      message.success('已手动触发执行')
      loadData()
    } catch (err: any) {
      message.error(err.message || '触发失败')
    }
  }

  const handleDelete = async (record: ScheduledTask) => {
    try {
      await api.delete(`/auto/scheduled-tasks/${record.schedule_biz_id || record.schedule_id}`)
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '计划ID', dataIndex: 'schedule_biz_id', key: 'schedule_biz_id', width: 200, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 100, render: (t: string) => <Tag color="blue">{TYPE_LABELS[t] || t}</Tag> },
    { title: '执行方式', dataIndex: 'exec_mode', key: 'exec_mode', width: 100, render: (m: string) => <Tag color={MODE_COLORS[m]}>{MODE_LABELS[m] || m}</Tag> },
    { title: '配置', key: 'config', width: 200, render: (_: any, r: ScheduledTask) => <span style={{ color: '#666' }}>{formatConfig(r)}</span> },
    { title: '下次执行', dataIndex: 'next_run_at', key: 'next_run_at', width: 150, render: (v: string, r: ScheduledTask) => {
      if (r.is_enabled !== 1) return <Tag>已停用</Tag>
      return v ? formatDateTime(v) : <Tag>无</Tag>
    }},
    { title: '上次执行', dataIndex: 'last_run_at', key: 'last_run_at', width: 150, render: (v: string, r: ScheduledTask) => {
      if (!v) return '-'
      return (
        <Space direction="vertical" size={0}>
          <span>{formatDateTime(v)}</span>
          {r.last_run_result && <span style={{ fontSize: 12, color: '#999' }}>{r.last_run_result}</span>}
        </Space>
      )
    }},
    { title: '状态', dataIndex: 'is_enabled', key: 'is_enabled', width: 80, align: 'center' as const, render: (v: number, r: ScheduledTask) => (
      <Switch checked={v === 1} onChange={() => handleToggle(r)} size="small" />
    )},
    { title: '操作', key: 'action', width: 200, fixed: 'right' as const, render: (_: any, record: ScheduledTask) => (
      <Space>
        <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleTrigger(record)}>执行</Button>
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)}>
          <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <CalendarOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>定时任务</span>
              <Tag color="blue">{data.length} 个计划</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建</Button>
              <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Table
        rowKey="schedule_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1300 }}
      />
      <Modal
        title={editing ? '编辑定时任务' : '新建定时任务'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null) }}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：每日料品同步" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="任务类型" name="task_type" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(TYPE_LABELS).map(([k, v]) => {
                    const used = !editing && data.some(d => d.task_type === k && d.is_enabled === 1)
                    return { value: k, label: v, disabled: used }
                  })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行方式" name="exec_mode" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'periodic', label: '定期任务（按间隔执行）' },
                  { value: 'scheduled', label: '定时任务（固定时间点）' },
                  { value: 'once', label: '单次任务（仅执行一次）' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.exec_mode !== curr.exec_mode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('exec_mode')
              if (mode === 'periodic') {
                return (
                  <Space>
                    <Form.Item name="interval" label="间隔" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <InputNumber min={1} max={999} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item name="intervalUnit" label="单位" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <Select style={{ width: 100 }} options={[
                        { value: 'minute', label: '分钟' },
                        { value: 'hour', label: '小时' },
                        { value: 'day', label: '天' },
                      ]} />
                    </Form.Item>
                  </Space>
                )
              }
              if (mode === 'scheduled') {
                return (
                  <>
                    <Form.Item name="fixedDays" label="执行日期" rules={[{ required: true }]}>
                      <Select mode="multiple" options={WEEK_DAYS} placeholder="选择周几执行" />
                    </Form.Item>
                    <Form.Item name="fixedTime" label="执行时间" rules={[{ required: true }]}>
                      <TimePicker format="HH:mm" placeholder="选择时间" />
                    </Form.Item>
                  </>
                )
              }
              if (mode === 'once') {
                return (
                  <Form.Item name="onceAt" label="执行时间" rules={[{ required: true }]}>
                    <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} placeholder="选择日期时间" />
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>

          <Form.Item label="状态" name="is_enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
