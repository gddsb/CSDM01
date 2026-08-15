import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Row, Col, Card, Tabs, Form, Button, Modal, Input, Popconfirm,
  Spin, Typography, Tag, Space,
} from 'antd'
import {
  SettingOutlined, CloudServerOutlined, DatabaseOutlined,
  SaveOutlined, FolderOutlined, ApiOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ResizableTable from '../../components/ResizableTable'
import { useApp } from '../../contexts/AppContext'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'
import ParamsTab from './config-tabs/ParamsTab'
import EnvTab from './config-tabs/EnvTab'
import DbTab from './config-tabs/DbTab'
import BackupTab from './config-tabs/BackupTab'
import FilesTab from './config-tabs/FilesTab'
import { buildFileColumns, type FileItem } from './config-tabs/fileColumns'
import { configToFormValues, formValuesToConfig } from './config-tabs/configTransform'
import type { BackupRecord, DbInfo, EnvInfo, MigrationTarget } from './config-tabs/types'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

export default function SystemConfig() {
  const { updateSystemConfig } = useApp()
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void } } }).antd?.message
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

  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const [fileCurrentDir, setFileCurrentDir] = useState('')
  const [fileBreadcrumbs, setFileBreadcrumbs] = useState<{ name: string; path: string }[]>([])
  const [fileLoading, setFileLoading] = useState(false)

  const [migrationTargets] = useState<MigrationTarget[]>([ { name: 'SQLite', description: '本地文件数据库（开发环境）', dialect: 'sqlite', is_current: false }, { name: 'MySQL', description: '生产关系型数据库', dialect: 'mysql', is_current: false } ])
  const [migrationLoading, setMigrationLoading] = useState(false)
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [migrationSubmitting, setMigrationSubmitting] = useState(false)
  const [migrationTarget, setMigrationTarget] = useState<MigrationTarget | null>(null)
  const [migrationForm] = Form.useForm()
  const [initStorage, setInitStorage] = useState('')
  const [initLoading, setInitLoading] = useState(false)

  const showSuccess = (msg: string) => message?.success(msg)
  const showError = (msg: string) => message?.error(msg)
  const showWarning = (msg: string) => message?.warning(msg)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config')
      form.setFieldsValue(configToFormValues(res.data))
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载系统配置失败')
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
      showError(err instanceof Error ? err.message : '加载项目环境失败')
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
          showSuccess(res.message || '重启指令已发送，服务正在重启...')
          const waitAndRefresh = async (attempt = 0) => {
            if (attempt >= 20) {
              setRestartLoading(false)
              showWarning('服务重启时间较长，请手动刷新页面查看')
              return
            }
            try {
              await new Promise(resolve => setTimeout(resolve, 1500))
              const envRes = await api.get('/system/config/environment')
              setEnvInfo(envRes.data)
              setRestartLoading(false)
              showSuccess('服务重启成功，环境信息已刷新')
            } catch {
              waitAndRefresh(attempt + 1)
            }
          }
          waitAndRefresh()
        } catch (err: unknown) {
          setRestartLoading(false)
          showError(err instanceof Error ? err.message : '重启服务失败')
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
      showError(err instanceof Error ? err.message : '加载数据库配置失败')
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
      showError(err instanceof Error ? err.message : '加载备份列表失败')
    } finally {
      setBackupsLoading(false)
    }
  }, [])

  const loadFileDirectory = useCallback(async (dir: string) => {
    setFileLoading(true)
    try {
      const res = await api.get('/system/files', { params: { dir: dir || '' } })
      const data = res.data || {}
      setFileItems(data.items || [])
      setFileCurrentDir(data.currentDir || '/')
      const pathParts = (data.currentDir && data.currentDir !== '/') ? data.currentDir.split('/').filter(Boolean) : []
      const crumbs = [{ name: 'uploads', path: '' }]
      let accPath = ''
      for (const part of pathParts) {
        accPath = accPath ? accPath + '/' + part : part
        crumbs.push({ name: part, path: accPath })
      }
      setFileBreadcrumbs(crumbs)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '获取文件列表失败')
      setFileItems([])
    } finally {
      setFileLoading(false)
    }
  }, [])


  const loadLines = useCallback(async () => {
    try {
      const res = await api.get('/basic/production-lines?status=1')
      const list = res.data?.list || res.data || []
      setLineOptions(list.map((l: { line_name?: string; line_code?: string }) => ({ label: l.line_name || l.line_code || '', value: l.line_name || l.line_code || '' })))
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
    if (key === 'backup' && backups.length === 0) loadBackups()
    if (key === 'files' && fileItems.length === 0) loadFileDirectory('')
  }

  const handleFileGoBack = () => {
    if (fileCurrentDir && fileCurrentDir !== '/') {
      const parent = fileCurrentDir.substring(0, fileCurrentDir.lastIndexOf('/'))
      loadFileDirectory(parent === '/' ? '' : parent)
    }
  }

  const handleFileDelete = (item: FileItem) => {
    Modal.confirm({
      title: `确认删除${item.isDirectory ? '目录' : '文件'}？`,
      content: `确定要删除 "${item.name}" 吗？${item.isDirectory ? '仅空目录可删除。' : ''}`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/system/files/${encodeURIComponent(item.path)}`)
          showSuccess('删除成功')
          loadFileDirectory(fileCurrentDir === '/' ? '' : fileCurrentDir.replace(/^\//, ''))
        } catch (err: unknown) {
          showError(err instanceof Error ? err.message : '删除失败')
        }
      },
    })
  }

  const handleFilePreview = (item: FileItem) => {
    if (!item.isDirectory) {
      const url = '/' + item.path
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(item.name)
      if (isImage) {
        Modal.info({
          title: item.name,
          width: 600,
          icon: null,
          content: (
            <div style={{ textAlign: 'center' }}>
              <img src={url} alt={item.name} style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }} />
            </div>
          ),
        })
      } else {
        window.open(url, '_blank')
      }
    }
  }

  const openMigrationModal = (target: MigrationTarget) => {
    setMigrationTarget(target)
    setMigrationOpen(true)
    if (target?.dialect === 'sqlite') {
      migrationForm.setFieldsValue({ storage: target.default_storage })
    } else {
      migrationForm.setFieldsValue({ host: 'localhost', port: target?.default_port || 3306, database: 'milk_can_mes', username: 'root', password: '' })
    }
  }

  const handleMigrationSubmit = async () => {
    try {
      const values = await migrationForm.validateFields()
      setMigrationSubmitting(true)
      const payload = { target: migrationTarget?.dialect, ...values }
      const res = await api.post('/system/config/database/migrate', payload)
      showSuccess(res.message || '数据迁移成功，请重启后端服务')
      Modal.success({
        title: '数据迁移完成',
        width: 560,
        content: (
          <div>
            <p>{res.data?.note}</p>
            {res.data?.backup && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>迁移前已自动备份：<Text code>{res.data.backup.filename}</Text></p>}
            {res.data?.migration && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>共迁移 {res.data.migration.total_rows} 行数据，涉及 {res.data.migration.tables.length} 张表</p>}
          </div>
        ),
      })
      setMigrationOpen(false)
      loadDb()
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return
      showError(err instanceof Error ? err.message : '迁移失败')
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
      showSuccess(res.message || '系统配置保存成功')
      updateSystemConfig({ system_name: String(payload.system_name ?? ''), company_name: String(payload.company_name ?? '') })
      await loadConfig()
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] })?.errorFields) {
        showWarning('请完善必填配置项后再保存')
        return
      }
      showError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateBackup = async () => {
    setBackupCreating(true)
    try {
      const res = await api.post('/system/config/backups')
      showSuccess(res.message || '备份创建成功')
      await loadBackups()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '备份失败')
    } finally {
      setBackupCreating(false)
    }
  }

  const handleRestore = async (filename: string) => {
    try {
      const res = await api.post('/system/config/backups/restore', { filename })
      showSuccess(res.message || '还原成功')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '还原失败')
    }
  }

  const handleDeleteBackup = async (filename: string) => {
    try {
      const res = await api.delete(`/system/config/backups/${encodeURIComponent(filename)}`)
      showSuccess(res.message || '删除成功')
      await loadBackups()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleInitDatabase = useCallback(async () => {
    setInitLoading(true)
    try {
      const res = await api.post('/system/config/database/init', { storage: initStorage })
      showSuccess(res.message || '数据库初始化成功')
      loadDb()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '数据库初始化失败')
    } finally {
      setInitLoading(false)
    }
  }, [initStorage, loadDb])

  const selectedTarget = migrationTarget?.dialect || ''
  const setSelectedTarget = (dialect: string) => {
    const t = migrationTargets.find(m => m.dialect === dialect)
    if (t) openMigrationModal(t)
  }

  const backupColumns: ColumnsType<BackupRecord> = useMemo(() => [
    { title: '文件名', dataIndex: 'filename', key: 'filename', width: 280, render: (t: string) => <Text code style={{ fontSize: 12 }}>{t}</Text> },
    { title: '大小', dataIndex: 'size', key: 'size', width: 110, render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
    { title: '修改时间', dataIndex: 'mtime', key: 'mtime', width: 180, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: unknown, r: BackupRecord) => (
        <Space size="small">
          <Button size="small" type="primary" ghost onClick={() => handleRestore(r.filename)}>还原</Button>
          <Popconfirm title="确认删除该备份？" onConfirm={() => handleDeleteBackup(r.filename)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [])

  const fileColumns: ColumnsType<FileItem> = useMemo(() => buildFileColumns({
    onPreview: handleFilePreview,
    onDelete: handleFileDelete,
  }), [fileCurrentDir])

  return (
    <div>
      <Spin spinning={loading || envLoading || dbLoading || migrationLoading || backupsLoading || fileLoading}>
        <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: 'params',
                label: <span><SettingOutlined /> 参数配置</span>,
                children: <ParamsTab form={form} loading={loading} saving={saving} lineOptions={lineOptions} handleSave={handleSave} />,
              },
              {
                key: 'env',
                label: <span><CloudServerOutlined /> 运行环境</span>,
                children: <EnvTab envLoading={envLoading} restartLoading={restartLoading} envInfo={envInfo} loadEnv={loadEnv} handleRestart={handleRestart} />,
              },
              {
                key: 'db',
                label: <span><DatabaseOutlined /> 数据库</span>,
                children: <DbTab dbLoading={dbLoading} dbInfo={dbInfo} migrationTargets={migrationTargets} selectedTarget={initStorage} setSelectedTarget={setInitStorage} handleMigrate={() => openMigrationModal(migrationTargets[1])}migrationLoading={migrationLoading} initStorage={initStorage} setInitStorage={setInitStorage} handleInitDatabase={handleInitDatabase} initLoading={initLoading} />,
              },
              {
                key: 'backup',
                label: <span><SaveOutlined /> 备份还原</span>,
                children: <BackupTab backupsLoading={backupsLoading} backupCreating={backupCreating} backups={backups} backupColumns={backupColumns} loadBackups={loadBackups} handleCreateBackup={handleCreateBackup} />,
              },
              {
                key: 'files',
                label: <span><FolderOutlined /> 文件管理</span>,
                children: <FilesTab filesLoading={fileLoading} fileData={{ current: fileCurrentDir, separator: '/', files: fileItems, breadcrumbs: fileBreadcrumbs }} fileColumns={fileColumns} handleFileOpen={(r) => r.isDirectory ? loadFileDirectory(r.path) : handleFilePreview(r)} handleFileBreadcrumb={loadFileDirectory} handleFileGoBack={handleFileGoBack} />,
              },
            ]}
          />
        </Card>
      </Spin>

      <Modal
        open={migrationOpen}
        title={`迁移到 ${migrationTarget?.name || ''}`}
        onOk={handleMigrationSubmit}
        onCancel={() => setMigrationOpen(false)}
        confirmLoading={migrationSubmitting}
        okText="开始迁移"
        cancelText="取消"
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">目标：{migrationTarget?.description}</Text>
        </div>
        <Form form={migrationForm} layout="vertical">
          {migrationTarget?.dialect === 'sqlite' ? (
            <Form.Item name="storage" label="数据库文件路径" rules={[{ required: true, message: '请输入文件路径' }]}>
              <Input placeholder="./data/milk_can_mes.sqlite" />
            </Form.Item>
          ) : (
            <>
              <Row gutter={12}>
                <Col span={14}><Form.Item name="host" label="主机" rules={[{ required: true }]}><Input placeholder="localhost" /></Form.Item></Col>
                <Col span={10}><Form.Item name="port" label="端口" rules={[{ required: true }]}><Input type="number" /></Form.Item></Col>
              </Row>
              <Form.Item name="database" label="数据库名" rules={[{ required: true }]}><Input placeholder="milk_can_mes" /></Form.Item>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input placeholder="root" /></Form.Item>
              <Form.Item name="password" label="密码"><Input.Password placeholder="请输入密码" /></Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
