import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space, message,
  Card, Row, Col, Tag, Tooltip, Popconfirm, Switch, List, Avatar
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, UpOutlined, DownOutlined,
  LinkOutlined, CopyOutlined, SettingOutlined, EyeOutlined
} from '@ant-design/icons'
import api from '../../utils/api'

interface DashboardItem {
  path: string
  name: string
  icon?: string
  sort_order?: number
  duration?: number
}

interface DashboardConfig {
  config_id: number
  config_name: string
  dashboards: DashboardItem[]
  default_duration: number
  is_default: number
  status: number
  remarks?: string
  created_at: string
}

interface DashboardUser {
  user_id: number
  username: string
  real_name: string
  avatar_url?: string
}

interface DashboardShare {
  share_id: number
  share_token: string
  share_url: string
  config_id: number
  user_ids: number[]
  expires_at?: string
  status: number
  access_count: number
  created_at: string
}

const { Option } = Select

export default function DashboardSettingsPage() {
  const [configs, setConfigs] = useState<DashboardConfig[]>([])
  const [availableDashboards, setAvailableDashboards] = useState<DashboardItem[]>([])
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [shares, setShares] = useState<DashboardShare[]>([])
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<DashboardConfig | null>(null)
  const [configForm] = Form.useForm()
  const [shareForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [configsRes, dashboardsRes, usersRes, sharesRes] = await Promise.all([
        api.get('/dashboard/dashboards/configs'),
        api.get('/dashboard/dashboards/available'),
        api.get('/dashboard/dashboards/users'),
        api.get('/dashboard/dashboards/shares'),
      ])
      setConfigs(configsRes.data || [])
      setAvailableDashboards(dashboardsRes.data || [])
      setUsers(usersRes.data || [])
      setShares(sharesRes.data || [])
    } catch (err: any) {
      message.error(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddConfig = () => {
    setEditingConfig(null)
    configForm.resetFields()
    configForm.setFieldsValue({
      dashboards: [],
      default_duration: 10,
      is_default: 0,
      status: 1,
    })
    setConfigModalOpen(true)
  }

  const handleEditConfig = (config: DashboardConfig) => {
    setEditingConfig(config)
    configForm.setFieldsValue({
      config_name: config.config_name,
      dashboards: config.dashboards,
      default_duration: config.default_duration,
      is_default: config.is_default,
      status: config.status,
      remarks: config.remarks,
    })
    setConfigModalOpen(true)
  }

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields()
      if (values.dashboards.length === 0) {
        message.error('请至少添加一个看板')
        return
      }
      if (editingConfig) {
        await api.put(`/dashboard/dashboards/configs/${editingConfig.config_id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/dashboard/dashboards/configs', values)
        message.success('创建成功')
      }
      setConfigModalOpen(false)
      loadData()
    } catch (err: any) {
      if (err.errorFields) return
      message.error(err.message || '保存失败')
    }
  }

  const handleDeleteConfig = async (id: number) => {
    try {
      await api.delete(`/dashboard/dashboards/configs/${id}`)
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const handleOpenShareModal = () => {
    shareForm.resetFields()
    shareForm.setFieldsValue({
      expires_days: 7,
      user_ids: [],
    })
    setShareModalOpen(true)
  }

  const handleCreateShare = async () => {
    try {
      const values = await shareForm.validateFields()
      const res = await api.post('/dashboard/dashboards/shares', values)
      message.success('生成成功')
      if (res.data?.share_url) {
        try {
          await navigator.clipboard.writeText(res.data.share_url)
          message.success('链接已复制到剪贴板')
        } catch {}
      }
      setShareModalOpen(false)
      loadData()
    } catch (err: any) {
      if (err.errorFields) return
      message.error(err.message || '生成失败')
    }
  }

  const handleDeleteShare = async (id: number) => {
    try {
      await api.delete(`/dashboard/dashboards/shares/${id}`)
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      message.success('链接已复制到剪贴板')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  const handleMoveDashboard = (index: number, direction: 'up' | 'down') => {
    const dashboards = configForm.getFieldValue('dashboards') || []
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === dashboards.length - 1) return
    const newDashboards = [...dashboards]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[newDashboards[index], newDashboards[swapIndex]] = [newDashboards[swapIndex], newDashboards[index]]
    configForm.setFieldsValue({ dashboards: newDashboards })
  }

  const configColumns = [
    { title: '配置名称', dataIndex: 'config_name', key: 'config_name' },
    {
      title: '看板数量',
      key: 'count',
      render: (_: any, r: DashboardConfig) => r.dashboards?.length || 0,
    },
    {
      title: '默认停留时间',
      dataIndex: 'default_duration',
      key: 'default_duration',
      render: (v: number) => `${v} 秒`,
    },
    {
      title: '默认配置',
      dataIndex: 'is_default',
      key: 'is_default',
      render: (v: number) => v === 1 ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: DashboardConfig) => (
        <Space>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => handleEditConfig(r)}>编辑</Button>
          <Popconfirm title="确认删除该配置？" onConfirm={() => handleDeleteConfig(r.config_id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card title="看板配置管理" style={{ marginBottom: 16 }} extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddConfig}>新建配置</Button>
      }>
        <Table
          rowKey="config_id"
          columns={configColumns}
          dataSource={configs}
          loading={loading}
          pagination={false}
          expandable={{
            expandedRowRender: (r: DashboardConfig) => (
              <List
                dataSource={r.dashboards}
                renderItem={(item, idx) => (
                  <List.Item>
                    <Space>
                      <Tag color="blue">{idx + 1}</Tag>
                      <span>{item.name}</span>
                      <span style={{ color: '#999' }}>停留: {item.duration || r.default_duration}秒</span>
                    </Space>
                  </List.Item>
                )}
              />
            ),
          }}
        />
      </Card>

      <Card title="分享链接管理" extra={
        <Button type="primary" icon={<LinkOutlined />} onClick={handleOpenShareModal}>生成链接</Button>
      }>
        <Table
          rowKey="share_id"
          dataSource={shares}
          loading={loading}
          columns={[
            {
              title: '链接',
              key: 'url',
              render: (_: any, r: DashboardShare) => (
                <Space>
                  <code style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.share_url}
                  </code>
                  <Tooltip title="复制链接">
                    <Button type="text" icon={<CopyOutlined />} onClick={() => handleCopyUrl(r.share_url)} />
                  </Tooltip>
                  <Tooltip title="打开链接">
                    <Button type="text" icon={<EyeOutlined />} onClick={() => window.open(r.share_url, '_blank')} />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: '看板配置',
              key: 'config',
              render: (_: any, r: DashboardShare) => {
                const cfg = configs.find(c => c.config_id === r.config_id)
                return cfg?.config_name || `ID: ${r.config_id}`
              },
            },
            {
              title: '授权用户',
              key: 'users',
              render: (_: any, r: DashboardShare) => {
                if (!r.user_ids || r.user_ids.length === 0) return '所有看板查看者'
                return r.user_ids.map(uid => {
                  const u = users.find(x => x.user_id === uid)
                  return u?.real_name || u?.username || `ID:${uid}`
                }).join(', ')
              },
            },
            { title: '访问次数', dataIndex: 'access_count', key: 'access_count' },
            {
              title: '过期时间',
              key: 'expires',
              render: (_: any, r: DashboardShare) => r.expires_at ? new Date(r.expires_at).toLocaleString() : '永不过期',
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, r: DashboardShare) => (
                <Popconfirm title="确认删除该链接？" onConfirm={() => handleDeleteShare(r.share_id)}>
                  <Button type="link" size="small" danger>删除</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      {/* 配置编辑弹窗 */}
      <Modal
        title={editingConfig ? '编辑看板配置' : '新建看板配置'}
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalOpen(false)}
        okText="保存"
        width={720}
        destroyOnHidden
      >
        <Form form={configForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="配置名称" name="config_name" rules={[{ required: true, message: '请输入配置名称' }]}>
                <Input placeholder="请输入配置名称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="默认停留时间(秒)" name="default_duration" rules={[{ required: true }]}>
                <InputNumber min={3} max={3600} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="设为默认" name="is_default" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="选择看板" required>
            <Form.List name="dashboards">
              {(fields, { add, remove }) => (
                <div>
                  {fields.map((field, index) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8, width: '100%' }} align="start">
                      <Tag>{index + 1}</Tag>
                      <Form.Item
                        {...field}
                        name={[field.name, 'path']}
                        rules={[{ required: true, message: '请选择看板' }]}
                        style={{ marginBottom: 0, minWidth: 200 }}
                      >
                        <Select placeholder="选择看板">
                          {availableDashboards.map(d => (
                            <Option key={d.path} value={d.path}>{d.name}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'duration']}
                        style={{ marginBottom: 0, width: 120 }}
                      >
                        <InputNumber placeholder="停留秒" min={3} max={3600} />
                      </Form.Item>
                      <Space>
                        <Button type="text" icon={<UpOutlined />} onClick={() => handleMoveDashboard(index, 'up')} disabled={index === 0} />
                        <Button type="text" icon={<DownOutlined />} onClick={() => handleMoveDashboard(index, 'down')} disabled={index === fields.length - 1} />
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      </Space>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ path: '', duration: undefined })} icon={<PlusOutlined />} block>
                    添加看板
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select>
              <Option value={1}>启用</Option>
              <Option value={0}>禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 生成分享链接弹窗 */}
      <Modal
        title="生成看板分享链接"
        open={shareModalOpen}
        onOk={handleCreateShare}
        onCancel={() => setShareModalOpen(false)}
        okText="生成链接"
        width={560}
        destroyOnHidden
      >
        <Form form={shareForm} layout="vertical" preserve={false}>
          <Form.Item label="选择看板配置" name="config_id" rules={[{ required: true, message: '请选择看板配置' }]}>
            <Select placeholder="请选择看板配置">
              {configs.filter(c => c.status === 1).map(c => (
                <Option key={c.config_id} value={c.config_id}>{c.config_name} ({c.dashboards?.length || 0}个看板)</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="授权用户（不选则所有看板查看者可访问）" name="user_ids">
            <Select mode="multiple" placeholder="选择用户" optionFilterProp="label">
              {users.map(u => (
                <Option key={u.user_id} value={u.user_id} label={`${u.real_name} (${u.username})`}>
                  <Space>
                    <Avatar size="small" src={u.avatar_url}>{u.real_name?.[0]}</Avatar>
                    <span>{u.real_name}</span>
                    <span style={{ color: '#999' }}>({u.username})</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="有效期(天，0表示永不过期)" name="expires_days" rules={[{ required: true }]}>
            <InputNumber min={0} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
