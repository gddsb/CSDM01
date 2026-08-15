import React, { useMemo, useState } from 'react'
import { Button, Row, Col, Spin, Typography, Card, Descriptions, Tag, Space, Alert, Table, Popconfirm } from 'antd'
import { ReloadOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined, SwapOutlined } from '@ant-design/icons'
import { formatBytes } from './format'
import type { DbInfo, MigrationTarget } from './types'
import type { ColumnsType } from 'antd/es/table'

const { Text, Paragraph } = Typography

interface DbTabProps {
  dbLoading: boolean
  dbInfo: DbInfo | null
  migrationTargets: MigrationTarget[]
  selectedTarget: string
  setSelectedTarget: (v: string) => void
  handleMigrate: () => void
  migrationLoading: boolean
  initStorage: string
  setInitStorage: (v: string) => void
  handleInitDatabase: () => void
  initLoading: boolean
}

const migrationColumns: ColumnsType<MigrationTarget> = [
  { title: '数据库', dataIndex: 'name', key: 'name', width: 140 },
  { title: '说明', dataIndex: 'description', key: 'description' },
  { title: '当前', key: 'is_current', width: 80, render: (_: unknown, r: MigrationTarget) => r.is_current ? <Tag color="green">是</Tag> : '-' },
]

export default function DbTab(props: DbTabProps) {
  const { dbLoading, dbInfo, migrationTargets, selectedTarget, setSelectedTarget, handleMigrate, migrationLoading, initStorage, setInitStorage, handleInitDatabase, initLoading } = props
  const targets = useMemo(() => migrationTargets || [], [migrationTargets])
  return (
    <Spin spinning={dbLoading}>
      {dbInfo && (
        <>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="数据库类型"><Tag color="blue">{dbInfo.dialect}</Tag></Descriptions.Item>
            <Descriptions.Item label="版本">{dbInfo.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="当前数据库">{dbInfo.database}</Descriptions.Item>
            <Descriptions.Item label="数据库大小">{formatBytes(dbInfo.size)}</Descriptions.Item>
            <Descriptions.Item label="表数量">{dbInfo.table_count}</Descriptions.Item>
            <Descriptions.Item label="字符集">{dbInfo.charset || '-'}</Descriptions.Item>
            <Descriptions.Item label="连接地址" span={2}>{dbInfo.host}:{dbInfo.port}</Descriptions.Item>
          </Descriptions>
          {dbInfo.dialect === 'sqlite' && (
            <Alert
              type="info"
              showIcon
              message="SQLite 数据维护"
              description="开发环境使用 SQLite 单文件数据库。可从备份还原，也可在备份页导出。生产环境建议切换到 MySQL。"
              style={{ marginBottom: 16 }}
            />
          )}
          <Card size="small" title="数据库迁移" style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 12 }}>
              <Text>目标数据库：</Text>
              <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} style={{ width: 280, padding: 4 }}>
                {targets.map((t) => <option key={t.name} value={t.name}>{t.name} - {t.description}</option>)}
              </select>
              <Button type="primary" icon={<SwapOutlined />} loading={migrationLoading} onClick={handleMigrate}>迁移</Button>
            </Space>
            <Table size="small" columns={migrationColumns} dataSource={targets} rowKey="name" pagination={false} />
          </Card>
          <Card size="small" title="初始化数据库">
            <Space style={{ marginBottom: 12 }}>
              <Text>数据库类型：</Text>
              <select value={initStorage} onChange={(e) => setInitStorage(e.target.value)} style={{ width: 200, padding: 4 }}>
                <option value="sqlite">SQLite（开发）</option>
                <option value="mysql">MySQL（生产）</option>
              </select>
              <Popconfirm
                title="确认初始化数据库？这会清空所有数据并写入演示数据。"
                onConfirm={handleInitDatabase}
                okText="确认"
                cancelText="取消"
              >
                <Button danger icon={<PlusOutlined />} loading={initLoading}>初始化</Button>
              </Popconfirm>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              初始化会删除所有业务数据并重新创建表结构与种子数据。生产环境请先备份。
            </Paragraph>
          </Card>
        </>
      )}
    </Spin>
  )
}
