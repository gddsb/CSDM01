import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Form, Input, InputNumber, Select, Switch, Modal, Space, Tag, Card, Row, Col, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined, CalendarOutlined } from '@ant-design/icons'
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
  periodic: '周期性',
  scheduled: '定时',
  once: '单次',
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
    form.setFieldsValue({ exec_mode: 'periodic', is_enabled: true })
    setModalOpen(true)
  }

  const handleEdit = (record: ScheduledTask) => {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      task_type: record.task_type,
      exec_mode: record.exec_mode,
      config: record.config,
      is_enabled: record.is_enabled === 1,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, is_enabled: values.is_enabled ? 1 : 0 }
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
    { title: '计划ID', dataIndex: 'schedule_biz_id', key: 'schedule_biz_id', width: 220, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 100, render: (t: string) => <Tag color="blue">{TYPE_LABELS[t] || t}</Tag> },
    { title: '执行方式', dataIndex: 'exec_mode', key: 'exec_mode', width: 100, render: (m: string) => <Tag>{MODE_LABELS[m] || m}</Tag> },
    { title: '配置', dataIndex: 'config', key: 'config', width: 180, render: (c: any) => c ? <span style={{ fontSize: 12, color: '#666' }}>{JSON.stringify(c)}</span> : '-' },
    { title: '下次执行', dataIndex: 'next_run_at', key: 'next_run_at', width: 160, render: (v: string) => v ? formatDateTime(v) : '-' },
    { title: '上次执行', dataIndex: 'last_run_at', key: 'last_run_at', width: 160, render: (v: string) => v ? formatDateTime(v) : '-' },
    { title: '状态', dataIndex: 'is_enabled', key: 'is_enabled', width: 80, align: 'center' as const, render: (v: number) => v === 1 ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag> },
    { title: '操作', key: 'action', width: 180, fixed: 'right' as const, render: (_: any, record: ScheduledTask) => (
      <Space>
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
        onCancel={() => setModalOpen(false)}
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
                <Select options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行方式" name="exec_mode" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'periodic', label: '周期性（每隔X小时/天）' },
                  { value: 'scheduled', label: '定时（每天固定时间）' },
                  { value: 'once', label: '单次（指定时间执行一次）' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="配置 (JSON)" name="config">
            <Input.TextArea rows={4} placeholder={`周期性: {"interval": 1, "intervalUnit": "hour"}\n定时: {"fixedTime": "08:00", "fixedDays": [1,2,3,4,5]}\n单次: {"onceAt": "2026-08-01T08:00:00"}`} />
          </Form.Item>
          <Form.Item label="启用" name="is_enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
