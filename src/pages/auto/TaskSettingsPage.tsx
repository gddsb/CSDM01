import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Switch, Form, Input, Modal, Space, Tag, Card, Row, Col, Descriptions, Tooltip } from 'antd'
import { EditOutlined, ReloadOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'

interface TaskSetting {
  setting_id: number
  task_type: string
  name: string
  description: string
  source_url: string
  field_count: number
  is_active: number
  params: any
  created_at: string
  updated_at: string
}

const TYPE_LABELS: Record<string, string> = {
  items: '料品数据',
  customers: '客户数据',
  env_monitor: '环境监测',
  weather: '气象信息',
}

export default function TaskSettingsPage() {
  const message = useMessage()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaskSetting[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<TaskSetting | null>(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/auto/task-settings')
      setData(res.data || [])
    } catch (err: any) {
      message.error(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleEdit = (record: TaskSetting) => {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      source_url: record.source_url,
      field_count: record.field_count,
      is_active: record.is_active === 1,
      params: record.params ? JSON.stringify(record.params, null, 2) : '',
    })
    setEditOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values, is_active: values.is_active ? 1 : 0 }
      if (values.params) {
        try { payload.params = JSON.parse(values.params) } catch { payload.params = null }
      } else {
        payload.params = null
      }
      await api.put(`/auto/task-settings/${editing!.task_type}`, payload)
      message.success('保存成功')
      setEditOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.message || '保存失败')
    }
  }

  const columns = [
    { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 100, render: (t: string) => <Tag color="blue">{TYPE_LABELS[t] || t}</Tag> },
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '数据源', dataIndex: 'source_url', key: 'source_url', width: 200, ellipsis: true, render: (v: string) => v ? <Tooltip title={v}>{v}</Tooltip> : '-' },
    { title: '字段数', dataIndex: 'field_count', key: 'field_count', width: 80, align: 'center' as const },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 100, align: 'center' as const, render: (v: number) => v === 1 ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag> : <Tag icon={<CloseCircleOutlined />} color="default">停用</Tag> },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160, render: (v: string) => formatDateTime(v) },
    { title: '操作', key: 'action', width: 100, fixed: 'right' as const, render: (_: any, record: TaskSetting) => (
      <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
    )},
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <SettingOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>任务设置</span>
              <Tag color="blue">{data.length} 个任务</Tag>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          </Col>
        </Row>
      </Card>
      <Table
        rowKey="setting_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        scroll={{ x: 1000 }}
      />
      <Modal
        title={`编辑 - ${editing?.name || ''}`}
        open={editOpen}
        onOk={handleSave}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="任务名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="数据源URL" name="source_url">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="字段数量" name="field_count">
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="执行参数 (JSON)" name="params">
            <Input.TextArea rows={4} placeholder='{"username": "...", "password": "..."}' />
          </Form.Item>
          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
