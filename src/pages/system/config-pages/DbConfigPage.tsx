import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Form, Input, Row, Col, Modal, Typography } from 'antd'
import api from '../../../utils/api'
import DbTab from '../config-tabs/DbTab'
import type { DbInfo, MigrationTarget } from '../config-tabs/types'

const { Text } = Typography

export default function DbConfigPage() {
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void } } }).antd?.message
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
  const [dbLoading, setDbLoading] = useState(false)

  const [migrationTargets, setMigrationTargets] = useState<MigrationTarget[]>([
    { name: 'SQLite', description: '本地文件数据库（开发环境）', dialect: 'sqlite', default_storage: './data/milk_can_mes.sqlite', default_port: undefined, is_current: false },
    { name: 'MySQL', description: '生产关系型数据库', dialect: 'mysql', default_port: 3306, default_storage: undefined, is_current: false },
  ])
  const [selectedMigrationTarget, setSelectedMigrationTarget] = useState<string>('')
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [migrationSubmitting, setMigrationSubmitting] = useState(false)
  const [migrationTarget, setMigrationTarget] = useState<MigrationTarget | null>(null)
  const [migrationForm] = Form.useForm()
  const [initStorage, setInitStorage] = useState('mysql')
  const [initLoading, setInitLoading] = useState(false)

  const showSuccess = (msg: string) => message?.success(msg)
  const showError = (msg: string) => message?.error(msg)
  const showWarning = (msg: string) => message?.warning(msg)

  const loadDb = useCallback(async () => {
    setDbLoading(true)
    try {
      const res = await api.get('/system/config/database')
      const info = res.data as DbInfo | null
      setDbInfo(info)
      if (info?.dialect) {
        const currentDialect = String(info.dialect).toLowerCase()
        setMigrationTargets(prev => prev.map(m => ({
          ...m,
          is_current: m.dialect.toLowerCase() === currentDialect,
        })))
        setSelectedMigrationTarget(currentDialect)
        setInitStorage(prev => prev || currentDialect)
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载数据库配置失败')
    } finally {
      setDbLoading(false)
    }
  }, [])

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

  const setSelectedTarget = (dialect: string) => {
    setSelectedMigrationTarget(dialect)
    const t = migrationTargets.find(m => m.dialect.toLowerCase() === String(dialect).toLowerCase())
    if (t) openMigrationModal(t)
  }
  const handleMigrateDefault = () => {
    const t = migrationTargets.find(m => m.dialect.toLowerCase() === 'mysql')
    if (t) openMigrationModal(t)
  }

  useEffect(() => {
    loadDb()
  }, [loadDb])

  return (
    <>
      <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
        <DbTab
          dbLoading={dbLoading}
          dbInfo={dbInfo}
          migrationTargets={migrationTargets}
          selectedTarget={selectedMigrationTarget}
          setSelectedTarget={setSelectedTarget}
          handleMigrate={handleMigrateDefault}
          migrationLoading={migrationSubmitting}
          initStorage={initStorage}
          setInitStorage={setInitStorage}
          handleInitDatabase={handleInitDatabase}
          initLoading={initLoading}
        />
      </Card>

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
    </>
  )
}
