import React, { useState, useEffect, useCallback } from 'react'
import { useApp, useMessage } from '../../contexts/AppContext'
import {
  Form, Input, InputNumber, Select, Switch, Button, Row, Col, Typography, Spin,
  Tabs, Table, Tag, Descriptions, Space, Popconfirm, Card, Statistic, Modal, Alert,
} from 'antd'
import {
  SaveOutlined, SettingOutlined, ToolOutlined, SafetyOutlined, BellOutlined,
  DatabaseOutlined, CloudServerOutlined, HistoryOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, RollbackOutlined, SwapOutlined, PoweroffOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

interface ServerInfo {
  name?: string
  status?: string
  port?: number
}

interface TechStackItem {
  category: string
  key: string
  version: string
}

interface TechStack {
  frontend?: { version: string; items: TechStackItem[] }
  backend?: { version: string; items: TechStackItem[] }
}

interface EnvInfo {
  node_version: string
  env: string
  sequelize_version: string
  pid: number
  frontend_server?: ServerInfo
  backend_server?: ServerInfo
  uptime: number
  memory_rss: number
  memory_heap_used: number
  memory_heap_total: number
  cpu_count: number
  os_uptime: number
  disk_used_percent: number
  disk_free: number
  os_version?: string
  platform?: string
  os_type?: string
  os_release?: string
  os_hostname?: string
  cpu_model?: string
  disk_total: number
  disk_used: number
  disk_mount?: string
  cwd: string
  server_time: string
  tech_stack?: TechStack
}

interface DbInfo {
  dialect: string
  connection_status: string
  host?: string
  port?: number
  database?: string
  username?: string
  password_set?: boolean
  storage?: string
  connection_error?: string
}

interface MigrationTarget {
  dialect: string
  name: string
  description: string
  default_port?: number
  default_storage?: string
  is_current: boolean
}

interface BackupRecord {
  filename: string
  size: number
  created_at: string
}

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

function configToFormValues(cfg: Record<string, unknown>): Record<string, unknown> {
  if (!cfg) return {}
  const v = { ...cfg }
  if (typeof v.shift_setting === 'string' && v.shift_setting.length > 0) {
    v.shift_setting = v.shift_setting.split(',').map((s: string) => s.trim()).filter(Boolean)
  } else if (v.shift_setting == null || (Array.isArray(v.shift_setting) && v.shift_setting.length === 0)) {
    v.shift_setting = ['白班']
  }
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach((k: string) => {
    if (v[k] != null) v[k] = String(v[k]) === 'true'
  })
  ;['standard_hours', 'defect_warning_threshold', 'microbe_cycle'].forEach((k: string) => {
    if (v[k] != null && v[k] !== '') v[k] = Number(v[k])
  })
  return v
}

function formValuesToConfig(values: Record<string, unknown>): Record<string, unknown> {
  const cfg = { ...values }
  if (Array.isArray(cfg.shift_setting)) {
    cfg.shift_setting = cfg.shift_setting.join(',')
  }
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach((k: string) => {
    if (typeof cfg[k] === 'boolean') cfg[k] = String(cfg[k])
  })
  delete cfg.system_version
  return cfg
}

export default function SystemConfig() {
  const { updateSystemConfig } = useApp()
  const message = useMessage()
  const [activeTab, setActiveTab] = useState('env')
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lineOptions, setLineOptions] = useState<{ label: string; value: string }[]>([])

  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [envLoading, setEnvLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)

  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
  const [dbLoading, setDbLoading] = useState(false)

  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)

  const [migrationTargets, setMigrationTargets] = useState<MigrationTarget[]>([])
  const [migrationLoading, setMigrationLoading] = useState(false)
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [migrationSubmitting, setMigrationSubmitting] = useState(false)
  const [migrationTarget, setMigrationTarget] = useState<MigrationTarget | null>(null)
  const [migrationForm] = Form.useForm()

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config')
      const values = configToFormValues(res.data)
      form.setFieldsValue(values)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载系统配置失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  const loadEnv = useCallback(async () => {
    setEnvLoading(true)
    try {
      const res = await api.get('/system/config/environment')
      setEnvInfo(res.data)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载项目环境失败')
    } finally {
      setEnvLoading(false)
    }
  }, [])

  const handleRestart = useCallback(async () => {
    Modal.confirm({
      title: '确认重启服务？',
      content: '重启期间服务将短暂不可用，重启完成后会自动刷新环境信息。',
      okText: '确认重启',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setRestartLoading(true)
        try {
          const res = await api.post('/system/config/restart')
          message.success(res.message || '重启指令已发送，服务正在重启...')
          const waitAndRefresh = async (attempt = 0) => {
            const maxAttempts = 20
            const interval = 1500
            if (attempt >= maxAttempts) {
              setRestartLoading(false)
              message.warning('服务重启时间较长，请手动刷新页面查看')
              return
            }
            try {
              await new Promise(resolve => setTimeout(resolve, interval))
              const envRes = await api.get('/system/config/environment')
              setEnvInfo(envRes.data)
              setRestartLoading(false)
              message.success('服务重启成功，环境信息已刷新')
            } catch (e) {
              waitAndRefresh(attempt + 1)
            }
          }
          waitAndRefresh()
        } catch (err: unknown) {
          setRestartLoading(false)
          message.error(err instanceof Error ? err.message : '重启服务失败')
        }
      },
    })
  }, [])

  const loadDb = useCallback(async () => {
    setDbLoading(true)
    try {
      const res = await api.get('/system/config/database')
      setDbInfo(res.data)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载数据库配置失败')
    } finally {
      setDbLoading(false)
    }
  }, [])

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true)
    try {
      const res = await api.get('/system/config/backups')
      setBackups(res.data || [])
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载备份列表失败')
    } finally {
      setBackupsLoading(false)
    }
  }, [])

  const loadMigrationTargets = useCallback(async () => {
    setMigrationLoading(true)
    try {
      const res = await api.get('/system/config/database/migration-targets')
      setMigrationTargets(res.data?.targets || [])
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '加载迁移目标失败')
    } finally {
      setMigrationLoading(false)
    }
  }, [])

  const loadLines = useCallback(async () => {
    try {
      const res = await api.get('/basic/production-lines?status=1')
      const list = res.data?.list || res.data || []
      setLineOptions(list.map((l: { line_name?: string; line_code?: string }) => ({ label: l.line_name || l.line_code, value: l.line_name || l.line_code })))
    } catch (e: unknown) {
      console.warn('加载产线列表失败:', e instanceof Error ? e.message : e)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadEnv()
    loadLines()
  }, [loadConfig, loadEnv, loadLines])

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'env' && !envInfo) loadEnv()
    if (key === 'db' && !dbInfo) loadDb()
    if (key === 'db') loadMigrationTargets()
    if (key === 'backup' && backups.length === 0) loadBackups()
  }

  const openMigrationModal = (target: MigrationTarget) => {
    setMigrationTarget(target)
    setMigrationOpen(true)
    if (target?.dialect === 'sqlite') {
      migrationForm.setFieldsValue({ storage: target.default_storage })
    } else {
      migrationForm.setFieldsValue({
        host: 'localhost',
        port: target?.default_port || 3306,
        database: 'milk_can_mes',
        username: 'root',
        password: '',
      })
    }
  }

  const handleMigrationSubmit = async () => {
    try {
      const values = await migrationForm.validateFields()
      setMigrationSubmitting(true)
      const payload = { target: migrationTarget?.dialect, ...values }
      const res = await api.post('/system/config/database/migrate', payload)
      message.success(res.message || '数据迁移成功，请重启后端服务')
      Modal.success({
        title: '数据迁移完成',
        width: 560,
        content: (
          <div>
            <p>{res.data?.note}</p>
            {res.data?.backup && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                迁移前已自动备份：<Text code>{res.data.backup.filename}</Text>
                （可在备份还原中查看并使用该备份进行还原）
              </p>
            )}
            {res.data?.migration && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                共迁移 {res.data.migration.total_rows} 行数据，涉及 {res.data.migration.tables.length} 张表
              </p>
            )}
          </div>
        ),
      })
      setMigrationOpen(false)
      loadDb()
      loadMigrationTargets()
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return
      message.error(err instanceof Error ? err.message : '迁移失败')
    } finally {
      setMigrationSubmitting(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = formValuesToConfig(values)
      const res = await api.put('/system/config', payload)
      message.success(res.message || '系统配置保存成功')
      updateSystemConfig({
        system_name: payload.system_name || '',
        company_name: payload.company_name || '',
      })
      await loadConfig()
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] })?.errorFields) {
        message.warning('请完善必填配置项后再保存')
        return
      }
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateBackup = async () => {
    setBackupCreating(true)
    try {
      const res = await api.post('/system/config/backups')
      message.success(res.message || '备份创建成功')
      await loadBackups()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '备份失败')
    } finally {
      setBackupCreating(false)
    }
  }

  const handleRestore = async (filename: string) => {
    try {
      const res = await api.post('/system/config/backups/restore', { filename })
      message.success(res.message || '还原成功')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '还原失败')
    }
  }

  const handleDeleteBackup = async (filename: string) => {
    try {
      const res = await api.delete(`/system/config/backups/${encodeURIComponent(filename)}`)
      message.success(res.message || '删除成功')
      await loadBackups()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const SectionTitle = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 18, color: 'var(--color-primary)' }}>{icon}</span>
      <Title level={5} style={{ margin: 0 }}>{title}</Title>
      {desc && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>{desc}</Text>}
    </div>
  )

  const ParamsTab = (
    <Spin spinning={loading}>
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
      >
        <SectionTitle icon={<SettingOutlined />} title="基本配置" desc="系统基础信息设置" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="system_name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
              <Input placeholder="请输入系统名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="system_version" label="系统版本" rules={[{ required: true, message: '请输入系统版本' }]}>
              <Input placeholder="系统版本（只读）" disabled readOnly />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="company_name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
              <Input placeholder="请输入公司名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="contact_phone" label="联系电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

        <SectionTitle icon={<ToolOutlined />} title="生产配置" desc="生产相关默认参数" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="default_line" label="默认产线">
              <Select
                placeholder="请选择默认产线"
                options={lineOptions}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="standard_hours" label="标准工时" rules={[{ required: true, message: '请输入标准工时' }]}>
              <InputNumber min={1} max={24} addonAfter="h" style={{ width: '100%' }} placeholder="请输入标准工时" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="shift_setting" label="班次设置" rules={[{ required: true, message: '请选择班次' }]}>
              <Select mode="multiple" placeholder="请选择班次（默认白班）" options={shiftOptions} />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

        <SectionTitle icon={<SafetyOutlined />} title="质量配置" desc="质量检验默认参数" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="default_standard" label="默认检验标准">
              <Input placeholder="请输入默认检验标准编号或名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="defect_warning_threshold" label="不良率预警阈值" rules={[{ required: true, message: '请输入预警阈值' }]}>
              <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} placeholder="请输入预警阈值" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="microbe_cycle" label="微生物检测周期" rules={[{ required: true, message: '请输入检测周期' }]}>
              <InputNumber min={1} max={90} addonAfter="天" style={{ width: '100%' }} placeholder="请输入检测周期" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

        <SectionTitle icon={<BellOutlined />} title="报警配置" desc="系统报警开关设置" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="device_alarm" label="设备故障报警" valuePropName="checked">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="quality_alarm" label="质量异常报警" valuePropName="checked">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="stock_warning" label="库存预警" valuePropName="checked">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存配置
          </Button>
        </div>
      </Form>
    </Spin>
  )

  const formatBytes = (b: number | undefined): string => {
    if (!b || b === 0) return '-'
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatUptime = (s: number | undefined): string => {
    if (!s || s === 0) return '-'
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}天${h}小时${m}分钟`
    if (h > 0) return `${h}小时${m}分钟`
    return `${m}分钟`
  }

  const EnvTab = (
    <Spin spinning={envLoading}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">展示当前服务运行环境信息（只读）</Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={loadEnv}>刷新</Button>
          <Button
            type="primary"
            danger
            icon={<PoweroffOutlined />}
            loading={restartLoading}
            onClick={handleRestart}
          >
            重启服务
          </Button>
        </div>
      </div>
      {envInfo && (
        <>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Node 版本" value={envInfo.node_version} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="运行环境" value={envInfo.env} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Sequelize 版本" value={envInfo.sequelize_version} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="进程 PID" value={envInfo.pid} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderColor: envInfo.frontend_server?.status === 'running' ? '#52c41a' : '#ff4d4f' }}>
                <Statistic
                  title={envInfo.frontend_server?.name || '前端服务器'}
                  value={envInfo.frontend_server?.status === 'running' ? '运行中' : envInfo.frontend_server?.status === 'offline' ? '已停止' : '未知'}
                  valueStyle={{ color: envInfo.frontend_server?.status === 'running' ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
                  suffix={<span style={{ fontSize: 13, color: '#666' }}>端口: {envInfo.frontend_server?.port}</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderColor: envInfo.backend_server?.status === 'running' ? '#52c41a' : '#ff4d4f' }}>
                <Statistic
                  title={envInfo.backend_server?.name || '后端服务器'}
                  value={envInfo.backend_server?.status === 'running' ? '运行中' : '已停止'}
                  valueStyle={{ color: envInfo.backend_server?.status === 'running' ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
                  suffix={<span style={{ fontSize: 13, color: '#666' }}>端口: {envInfo.backend_server?.port}</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="进程运行时长" value={formatUptime(envInfo.uptime)} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="RSS 内存" value={envInfo.memory_rss} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="堆已用" value={envInfo.memory_heap_used} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="堆总量" value={envInfo.memory_heap_total} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="CPU 核心数" value={envInfo.cpu_count || '-'} suffix="核" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="系统运行时长" value={formatUptime(envInfo.os_uptime)} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="磁盘已用" value={envInfo.disk_used_percent || 0} suffix="%" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="磁盘可用" value={formatBytes(envInfo.disk_free)} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Card size="small" title={<span><DatabaseOutlined style={{ color: '#1890ff', marginRight: 6 }} />详细信息</span>}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="操作系统版本">{envInfo.os_version || envInfo.platform}</Descriptions.Item>
                  <Descriptions.Item label="操作系统类型">{envInfo.os_type || '-'}</Descriptions.Item>
                  <Descriptions.Item label="系统内核版本">{envInfo.os_release || '-'}</Descriptions.Item>
                  <Descriptions.Item label="主机名">{envInfo.os_hostname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="CPU 型号">{envInfo.cpu_model || '-'}</Descriptions.Item>
                  <Descriptions.Item label="磁盘总容量">{formatBytes(envInfo.disk_total)}</Descriptions.Item>
                  <Descriptions.Item label="磁盘已用">{formatBytes(envInfo.disk_used)}（{envInfo.disk_used_percent || 0}%）</Descriptions.Item>
                  <Descriptions.Item label="磁盘可用">{formatBytes(envInfo.disk_free)}</Descriptions.Item>
                  <Descriptions.Item label="磁盘挂载点">{envInfo.disk_mount || '-'}</Descriptions.Item>
                  <Descriptions.Item label="工作目录">{envInfo.cwd}</Descriptions.Item>
                  <Descriptions.Item label="服务器时间">{dayjs(envInfo.server_time).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <span>
                    <SafetyOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                    前端技术栈
                    <Tag style={{ marginLeft: 8 }} color="blue">v{envInfo.tech_stack?.frontend?.version}</Tag>
                  </span>
                }
              >
                <Descriptions column={1} size="small">
                  {envInfo.tech_stack?.frontend?.items?.map((item, idx) => (
                    <Descriptions.Item key={idx} label={
                      <span>
                        <Tag color="blue" style={{ marginRight: 6 }}>{item.category}</Tag>
                        {item.key}
                      </span>
                    }>
                      <code>{item.version}</code>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <span>
                    <CloudServerOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                    后端技术栈
                    <Tag style={{ marginLeft: 8 }} color="green">v{envInfo.tech_stack?.backend?.version}</Tag>
                  </span>
                }
              >
                <Descriptions column={1} size="small">
                  {envInfo.tech_stack?.backend?.items?.map((item, idx) => (
                    <Descriptions.Item key={idx} label={
                      <span>
                        <Tag color="green" style={{ marginRight: 6 }}>{item.category}</Tag>
                        {item.key}
                      </span>
                    }>
                      <code>{item.version}</code>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Spin>
  )

  const DbTab = (
    <Spin spinning={dbLoading}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">展示当前数据库连接信息（密码已脱敏，只读）</Text>
        <Button icon={<ReloadOutlined />} onClick={loadDb}>刷新</Button>
      </div>
      {dbInfo && (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="数据库类型">
              <Tag color={dbInfo.dialect === 'mysql' ? 'blue' : 'gold'}>
                {dbInfo.dialect === 'mysql' ? 'MySQL' : 'SQLite'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="连接状态">
              <Tag color={dbInfo.connection_status === 'connected' ? 'green' : 'red'}>
                {dbInfo.connection_status === 'connected' ? '已连接' : '连接异常'}
              </Tag>
            </Descriptions.Item>
            {dbInfo.dialect === 'mysql' ? (
              <>
                <Descriptions.Item label="主机地址">{dbInfo.host}</Descriptions.Item>
                <Descriptions.Item label="端口">{dbInfo.port}</Descriptions.Item>
                <Descriptions.Item label="数据库名">{dbInfo.database}</Descriptions.Item>
                <Descriptions.Item label="用户名">{dbInfo.username}</Descriptions.Item>
                <Descriptions.Item label="密码" span={2}>
                  {dbInfo.password_set ? '已设置（出于安全考虑不显示）' : '未设置'}
                </Descriptions.Item>
              </>
            ) : (
              <Descriptions.Item label="存储文件" span={2}>{dbInfo.storage}</Descriptions.Item>
            )}
            {dbInfo.connection_error && (
              <Descriptions.Item label="连接错误" span={2}>
                <Text type="danger">{dbInfo.connection_error}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
            数据库连接配置通过环境变量（.env 文件）管理。如需切换数据库，可使用下方的"数据迁移"功能；也可手动编辑服务器 <Text code>server/.env</Text> 文件后重启服务。
          </Paragraph>
        </>
      )}

      <Card
        size="small"
        title={<Space><SwapOutlined />数据迁移</Space>}
        style={{ marginTop: 16 }}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadMigrationTargets} loading={migrationLoading}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="在 SQLite / MySQL / PostgreSQL / MariaDB 等常见数据库环境之间迁移数据"
          description="迁移前系统会自动备份当前 SQLite 数据库（可在「备份还原」中还原）。迁移完成后需要重启后端服务以使新数据库生效。"
        />
        <Spin spinning={migrationLoading}>
          <Row gutter={[12, 12]}>
            {migrationTargets.map(t => (
              <Col key={t.dialect} span={12}>
                <Card
                  size="small"
                  styles={{ body: { padding: 12 } }}
                  style={{
                    borderColor: t.is_current ? 'var(--color-primary)' : undefined,
                    background: t.is_current ? 'var(--bg-hover)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Text strong>{t.name}</Text>
                        {t.is_current && <Tag color="green">当前</Tag>}
                      </Space>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        默认端口：{t.default_port}{t.default_storage ? ` · 默认路径：${t.default_storage}` : ''}
                      </div>
                    </div>
                    <Button
                      type={t.is_current ? 'default' : 'primary'}
                      size="small"
                      icon={<SwapOutlined />}
                      disabled={t.is_current}
                      onClick={() => openMigrationModal(t)}
                    >
                      {t.is_current ? '当前使用' : '迁移到此'}
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>
      </Card>

      <Modal
        title={`数据迁移 - ${migrationTarget?.name || ''}`}
        open={migrationOpen}
        onOk={handleMigrationSubmit}
        onCancel={() => setMigrationOpen(false)}
        confirmLoading={migrationSubmitting}
        okText="开始迁移"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="迁移前系统将自动备份当前 SQLite 数据库"
          description="迁移完成后，系统会更新 .env 配置文件并提示重启后端服务。"
        />
        <Form form={migrationForm} layout="vertical" preserve={false}>
          {migrationTarget?.dialect === 'sqlite' ? (
            <Form.Item
              label="SQLite 文件路径"
              name="storage"
              rules={[{ required: true, message: '请输入 SQLite 文件路径' }]}
              extra="相对路径相对于 server 工作目录，例如 ./data/milk_can_mes.sqlite"
            >
              <Input placeholder="请输入 SQLite 文件路径" />
            </Form.Item>
          ) : (
            <>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item
                    label="主机地址"
                    name="host"
                    rules={[{ required: true, message: '请输入主机地址' }]}
                  >
                    <Input placeholder="如 localhost 或 192.168.1.100" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="端口"
                    name="port"
                    rules={[{ required: true, message: '请输入端口' }]}
                  >
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                label="数据库名"
                name="database"
                rules={[{ required: true, message: '请输入数据库名' }]}
                extra="目标数据库需要提前创建（空数据库即可）"
              >
                <Input placeholder="如 milk_can_mes" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input placeholder="数据库用户名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="密码" name="password">
                    <Input.Password placeholder="数据库密码（可空）" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>
    </Spin>
  )

  const backupColumns = [
    {
      title: '备份文件', dataIndex: 'filename', key: 'filename',
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '文件大小', dataIndex: 'size', key: 'size', width: 120,
      render: (v: number) => v < 1024 ? `${v} B` : v < 1024 * 1024 ? `${(v / 1024).toFixed(1)} KB` : `${(v / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '备份时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: unknown, record: BackupRecord) => (
        <Space size="small">
          <Popconfirm
            title="确认还原该备份？当前数据将被覆盖。"
            onConfirm={() => handleRestore(record.filename)}
            okText="确认还原"
            cancelText="取消"
          >
            <Button type="link" size="small" icon={<RollbackOutlined />}>还原</Button>
          </Popconfirm>
          <Popconfirm
            title="确认删除该备份文件？"
            onConfirm={() => handleDeleteBackup(record.filename)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const BackupTab = (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">数据库备份与还原（仅支持 SQLite，MySQL 请使用数据库管理工具）</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadBackups}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} loading={backupCreating} onClick={handleCreateBackup}>
            立即备份
          </Button>
        </Space>
      </div>
      <Table
        columns={backupColumns}
        dataSource={backups}
        rowKey="filename"
        size="small"
        loading={backupsLoading}
        pagination={false}
        locale={{ emptyText: '暂无备份文件' }}
      />
      <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        提示：还原操作会覆盖当前数据库文件，建议还原前先创建一次备份；还原后建议重启服务以使连接生效。
      </Paragraph>
    </div>
  )

  const tabItems = [
    { key: 'env', label: '项目环境', icon: <CloudServerOutlined />, children: EnvTab },
    { key: 'params', label: '参数配置', icon: <SettingOutlined />, children: ParamsTab },
    { key: 'db', label: '数据库配置', icon: <DatabaseOutlined />, children: DbTab },
    { key: 'backup', label: '备份还原', icon: <HistoryOutlined />, children: BackupTab },
  ]

  return (
    <ThreeSectionPage
      title="系统配置"
      breadcrumbs="系统管理 / 系统配置"
      table={
        <Card size="small" styles={{ body: { padding: '16px 20px' } }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
          />
        </Card>
      }
    />
  )
}
