import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Button, Popconfirm, Space, Typography } from 'antd'
import dayjs from 'dayjs'
import api from '../../../utils/api'
import BackupTab from '../config-tabs/BackupTab'
import type { BackupRecord } from '../config-tabs/types'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

export default function BackupConfigPage() {
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void } } }).antd?.message
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)

  const showSuccess = (msg: string) => message?.success(msg)
  const showError = (msg: string) => message?.error(msg)

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

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  return (
    <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
      <BackupTab
        backupsLoading={backupsLoading}
        backupCreating={backupCreating}
        backups={backups}
        backupColumns={backupColumns}
        loadBackups={loadBackups}
        handleCreateBackup={handleCreateBackup}
      />
    </Card>
  )
}
