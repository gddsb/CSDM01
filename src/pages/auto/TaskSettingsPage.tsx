import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Switch, Form, Input, Modal, Space, Tag, Card, Row, Col, Select, Progress, Timeline, Tooltip, Radio } from 'antd'
import { EditOutlined, ReloadOutlined, SettingOutlined, DatabaseOutlined, TeamOutlined, DashboardOutlined, EnvironmentOutlined, PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons'
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

interface U9Org {
  ID: number
  Code: string
  Name: string
}

interface TaskStep {
  time: string
  message: string
  percent: number
}

interface TestProgress {
  task_biz_id: string
  task_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  current_step: string
  steps: TaskStep[]
  error_msg?: string
}

const TYPE_LABELS: Record<string, string> = {
  items: '料品数据',
  customers: '客户数据',
  production_orders: '生产订单',
  env_monitor: '环境监测',
  weather: '气象信息',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  items: <DatabaseOutlined style={{ color: '#1677ff', fontSize: 18 }} />,
  customers: <TeamOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
  production_orders: <FileTextOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
  env_monitor: <DashboardOutlined style={{ color: '#722ed1', fontSize: 18 }} />,
  weather: <EnvironmentOutlined style={{ color: '#13c2c2', fontSize: 18 }} />,
}

const PARAM_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'password' | 'select'; placeholder?: string; dependsOn?: string; noEcho?: boolean; optional?: boolean }[]> = {
  items: [
    { key: 'loginName', label: 'U9登录用户名', type: 'text', placeholder: 'U9 ERP登录账号', noEcho: true },
    { key: 'password', label: 'U9登录密码', type: 'password', placeholder: 'U9 ERP登录密码' },
    { key: 'orgCode', label: '组织', type: 'select', placeholder: '请先输入用户名并获取组织列表', dependsOn: 'loginName' },
  ],
  customers: [
    { key: 'loginName', label: 'U9登录用户名', type: 'text', placeholder: 'U9 ERP登录账号', noEcho: true },
    { key: 'password', label: 'U9登录密码', type: 'password', placeholder: 'U9 ERP登录密码' },
    { key: 'orgCode', label: '组织', type: 'select', placeholder: '请先输入用户名并获取组织列表', dependsOn: 'loginName' },
  ],
  production_orders: [
    { key: 'loginName', label: 'U9登录用户名', type: 'text', placeholder: 'U9 ERP登录账号', noEcho: true },
    { key: 'password', label: 'U9登录密码', type: 'password', placeholder: 'U9 ERP登录密码' },
    { key: 'orgCode', label: '组织', type: 'select', placeholder: '请先输入用户名并获取组织列表', dependsOn: 'loginName' },
  ],
  env_monitor: [
    { key: 'loginName', label: '平台登录用户名', type: 'text', placeholder: '0531yun登录账号', noEcho: true },
    { key: 'password', label: '平台登录密码', type: 'password', placeholder: '0531yun登录密码' },
  ],
  weather: [],
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#d9d9d9',
  running: '#1677ff',
  completed: '#52c41a',
  failed: '#ff4d4f',
}

const STATUS_TEXT: Record<string, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
}

export default function TaskSettingsPage() {
  const message = useMessage()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TaskSetting[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<TaskSetting | null>(null)
  const [form] = Form.useForm()
  const [orgLoading, setOrgLoading] = useState(false)
  const [orgOptions, setOrgOptions] = useState<U9Org[]>([])
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null)
  const [testingTaskType, setTestingTaskType] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  const fetchOrgs = useCallback(async (username: string) => {
    if (!username) {
      setOrgOptions([])
      return
    }
    try {
      setOrgLoading(true)
      const res = await api.get('/auto/u9-orgs', { params: { username } })
      setOrgOptions(res.data || [])
      if (res.data && res.data.length > 0) {
        message.success(`获取到 ${res.data.length} 个组织`)
      } else {
        message.warning('未获取到组织列表，请检查用户名')
      }
    } catch (err: any) {
      message.error(err.message || '获取组织列表失败')
      setOrgOptions([])
    } finally {
      setOrgLoading(false)
    }
  }, [message])

  const handleEdit = (record: TaskSetting) => {
    setEditing(record)
    setOrgOptions([])
    const vals: any = {
      name: record.name,
      description: record.description,
      source_url: record.source_url,
    }
    const paramFields = PARAM_FIELDS[record.task_type] || []
    for (const f of paramFields) {
      if (f.type === 'password' || f.noEcho) {
        vals[f.key] = ''
      } else {
        vals[f.key] = record.params?.[f.key] || ''
      }
    }
    form.setFieldsValue(vals)
    setEditOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload: any = {
        name: values.name,
        description: values.description,
        source_url: values.source_url,
        is_active: editing!.is_active,
      }
      const paramFields = PARAM_FIELDS[editing!.task_type] || []
      const params: Record<string, any> = {}

      for (const f of paramFields) {
        if (values[f.key] !== undefined && values[f.key] !== '') {
          params[f.key] = values[f.key]
        }
      }

      payload.params = Object.keys(params).length > 0 ? params : null
      await api.put(`/auto/task-settings/${editing!.task_type}`, payload)
      message.success('保存成功')
      setEditOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.message || '保存失败')
    }
  }

  const handleToggleActive = async (record: TaskSetting) => {
    try {
      await api.put(`/auto/task-settings/${record.task_type}`, { is_active: record.is_active === 1 ? 0 : 1 })
      message.success('操作成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const pollTaskProgress = useCallback(async (taskBizId: string) => {
    try {
      const res = await api.get(`/auto/sync-tasks/${taskBizId}`)
      const task = res.data
      if (task) {
        setTestProgress({
          task_biz_id: task.task_biz_id,
          task_type: task.task_type,
          status: task.status,
          progress: task.progress,
          current_step: task.current_step,
          steps: task.steps || [],
          error_msg: task.error_msg,
        })
        if (task.status === 'completed' || task.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setTestingTaskType(null)
          if (task.status === 'completed') {
            message.success('测试完成')
          } else {
            message.error(task.error_msg || '测试失败')
          }
        }
      }
    } catch (err) {
      console.error('轮询任务进度失败:', err)
    }
  }, [message])

  const handleTest = async (record: TaskSetting) => {
    try {
      if (testingTaskType) {
        message.warning('已有测试任务正在执行，请等待完成')
        return
      }
      const res = await api.post(`/auto/task-settings/${record.task_type}/test`)
      const taskBizId = res.data?.task_biz_id
      if (taskBizId) {
        setTestingTaskType(record.task_type)
        setTestProgress({
          task_biz_id: taskBizId,
          task_type: record.task_type,
          status: 'running',
          progress: 5,
          current_step: '测试任务已启动',
          steps: [{ time: new Date().toISOString(), message: '测试任务已启动', percent: 5 }],
        })
        message.info('测试任务已启动，正在执行...')
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = window.setInterval(() => pollTaskProgress(taskBizId), 1500)
      }
    } catch (err: any) {
      message.error(err.message || '测试失败')
    }
  }

  const paramFields = editing ? (PARAM_FIELDS[editing.task_type] || []) : []
  const isU9Task = editing && (editing.task_type === 'items' || editing.task_type === 'customers')

  const columns = [
    { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 110, render: (t: string) => (
      <Space>
        {TYPE_ICONS[t]}
        <Tag color="blue">{TYPE_LABELS[t] || t}</Tag>
      </Space>
    )},
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: '描述', dataIndex: 'description', key: 'description', width: 150, render: (v: string) => (
      <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.5 }}>{v || '-'}</div>
    )},
    { title: '数据源', dataIndex: 'source_url', key: 'source_url', width: 180, ellipsis: true, render: (v: string) => v ? v : '-' },
    { title: '参数配置', key: 'params', width: 100, render: (_: any, r: TaskSetting) => {
      const fields = PARAM_FIELDS[r.task_type] || []
      const requiredCount = fields.filter(f => !f.optional && (f.type === 'password' || f.key === 'loginName')).length
      const configured = fields.filter(f => !f.optional && (f.type === 'password' ? true : r.params?.[f.key])).length
      return fields.length > 0 ? (
        <Tag color={configured >= requiredCount ? 'success' : configured > 0 ? 'orange' : 'default'}>
          {configured >= requiredCount ? '已配置' : '待完善'}
        </Tag>
      ) : <Tag>无需配置</Tag>
    }},
    { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 70, align: 'center' as const, render: (v: number, r: TaskSetting) => (
      <Switch checked={v === 1} onChange={() => handleToggleActive(r)} size="small" />
    )},
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 150, render: (v: string) => formatDateTime(v) },
    { title: '操作', key: 'action', width: 150, fixed: 'right' as const, render: (_: any, record: TaskSetting) => (
      <Space>
        <Tooltip title="测试任务">
          <Button
            type="link"
            onClick={() => handleTest(record)}
            loading={testingTaskType === record.task_type}
            disabled={testingTaskType !== null && testingTaskType !== record.task_type}
          >
            测试
          </Button>
        </Tooltip>
        <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
      </Space>
    )},
  ]

  const getStepIcon = (index: number, steps: TaskStep[]) => {
    const isLast = index === steps.length - 1
    if (testProgress?.status === 'failed' && isLast) {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    }
    if (testProgress?.status === 'completed' || !isLast) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    }
    if (testProgress?.status === 'running' && isLast) {
      return <ClockCircleOutlined style={{ color: '#1677ff' }} spin />
    }
    return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
  }

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
        scroll={{ x: 1100 }}
      />

      {testProgress && (
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <PlayCircleOutlined style={{ color: '#1677ff' }} />
              <span>测试进度 - {TYPE_LABELS[testProgress.task_type] || testProgress.task_type}</span>
              <Tag color={STATUS_COLOR[testProgress.status]}>{STATUS_TEXT[testProgress.status]}</Tag>
            </Space>
          }
          extra={
            <Button
              size="small"
              onClick={() => { setTestProgress(null); setTestingTaskType(null) }}
            >
              关闭
            </Button>
          }
        >
          <Row gutter={24}>
            <Col span={8}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Progress
                  type="dashboard"
                  percent={testProgress.progress}
                  status={testProgress.status === 'failed' ? 'exception' : testProgress.status === 'completed' ? 'success' : 'active'}
                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />
                <div style={{ marginTop: 12, color: '#666' }}>
                  {testProgress.current_step}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                  任务ID: {testProgress.task_biz_id}
                </div>
              </div>
            </Col>
            <Col span={16}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>执行步骤</div>
              <Timeline
                items={testProgress.steps.map((step, idx) => ({
                  dot: getStepIcon(idx, testProgress.steps),
                  color: testProgress.status === 'failed' && idx === testProgress.steps.length - 1 ? 'red' : 'blue',
                  children: (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{step.message}</span>
                        <Tag color="blue">{step.percent}%</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {formatDateTime(step.time)}
                      </div>
                    </div>
                  ),
                }))}
              />
              {testProgress.error_msg && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#fff1f0',
                  border: '1px solid #ffa39e',
                  borderRadius: 6,
                  color: '#cf1322',
                }}>
                  <strong>错误信息：</strong>{testProgress.error_msg}
                </div>
              )}
            </Col>
          </Row>
        </Card>
      )}

      <Modal
        title={`编辑 - ${editing?.name || ''}`}
        open={editOpen}
        onOk={handleSave}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="任务名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="数据源URL" name="source_url">
            <Input />
          </Form.Item>

          {paramFields.length > 0 && (
            <>
              <div style={{ marginTop: 8, marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                <span style={{ fontWeight: 600 }}>执行参数</span>
                <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>密码将加密存储，编辑时不回显</span>
              </div>

              {paramFields.map((f) => {
                if (f.type === 'password') {
                  return (
                    <Form.Item key={f.key} name={f.key} label={f.label} rules={[{ required: true, message: `请输入${f.label}` }]}>
                      <Input.Password placeholder={f.placeholder || ''} visibilityToggle />
                    </Form.Item>
                  )
                }
                if (f.type === 'select') {
                  return (
                    <Form.Item key={f.key} name={f.key} label={f.label}>
                      <Select
                        showSearch
                        placeholder={f.placeholder || ''}
                        options={orgOptions.map(o => ({ value: o.Code, label: `${o.Code} - ${o.Name}` }))}
                        loading={orgLoading}
                        notFoundContent={orgLoading ? '获取中...' : '请先输入用户名'}
                      />
                    </Form.Item>
                  )
                }
                if (f.dependsOn && isU9Task && f.key === 'loginName') {
                  return (
                    <Form.Item key={f.key} label={f.label}>
                      <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name={f.key} noStyle rules={[{ required: true, message: '请输入用户名' }]}>
                          <Input placeholder={f.placeholder || ''} />
                        </Form.Item>
                        <Button
                          type="primary"
                          onClick={() => {
                            const uname = form.getFieldValue(f.key)
                            fetchOrgs(uname)
                          }}
                        >
                          获取组织
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  )
                }
                return (
                  <Form.Item key={f.key} name={f.key} label={f.label} rules={[{ required: true, message: `请输入${f.label}` }]}>
                    <Input placeholder={f.placeholder || ''} />
                  </Form.Item>
                )
              })}
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
