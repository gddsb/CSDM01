import React from 'react'
import { Button, Space, Tag, Typography } from 'antd'
const { Text } = Typography
import { FolderOutlined, FileOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  sizeText?: string
  created?: string
  modified?: string
  modifiedTime?: string
  ext?: string
}

interface BuildFileColumnsOptions {
  onPreview: (record: FileItem) => void
  onDownload: (record: FileItem) => void
}

export function buildFileColumns({ onPreview, onDownload }: BuildFileColumnsOptions): ColumnsType<FileItem> {
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <Space>
          {record.isDirectory ? (
            <FolderOutlined style={{ color: '#FAAD14', fontSize: 16 }} />
          ) : (
            <FileOutlined style={{ color: '#1890FF', fontSize: 16 }} />
          )}
          <span style={{ cursor: record.isDirectory ? 'pointer' : 'default', color: record.isDirectory ? '#1890FF' : 'inherit' }}>
            {text}
          </span>
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'isDirectory', key: 'type', width: 100, render: (isDir: boolean) => <Tag color={isDir ? 'gold' : 'blue'}>{isDir ? '目录' : '文件'}</Tag> },
    { title: '大小', dataIndex: 'sizeText', key: 'size', width: 120, render: (text: string, record: FileItem) => record.isDirectory ? '-' : text },
    { title: '修改时间', dataIndex: 'modifiedTime', key: 'modifiedTime', width: 200, render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '-' },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: unknown, record) => (
        <Space size="small">
          {!record.isDirectory && <Button type="link" size="small" onClick={() => onPreview(record)}>查看</Button>}
          {!record.isDirectory && <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => onDownload(record)}>下载</Button>}
          {record.isDirectory && <Text type="secondary" style={{ fontSize: 12 }}>仅浏览</Text>}
        </Space>
      ),
    },
  ]
}
