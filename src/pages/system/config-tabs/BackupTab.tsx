import React from 'react'
import { Button, Typography, Space, Table, Tag } from 'antd'
import { ReloadOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons'
import ResizableTable from '../../../components/ResizableTable'
import type { BackupRecord } from './types'
import type { ColumnsType } from 'antd/es/table'

const { Text, Paragraph } = Typography

interface BackupTabProps {
  backupsLoading: boolean
  backupCreating: boolean
  backups: BackupRecord[]
  backupColumns: ColumnsType<BackupRecord>
  loadBackups: () => void
  handleCreateBackup: () => void
}

export default function BackupTab({ backupsLoading, backupCreating, backups, backupColumns, loadBackups, handleCreateBackup }: BackupTabProps) {
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">数据库备份与还原（支持 SQLite 和 MySQL）</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadBackups}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} loading={backupCreating} onClick={handleCreateBackup}>立即备份</Button>
        </Space>
      </div>
      <ResizableTable
        tableKey="pages_system_SystemConfig"
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
}
