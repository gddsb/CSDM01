import React from 'react'
import { Button, Space, Tag } from 'antd'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
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
  onDelete: (record: FileItem) => void
}

export function buildFileColumns({ onPreview, onDelete }: BuildFileColumnsOptions): ColumnsType<FileItem> {
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
      title: '操作', key: 'action',
      render: (_: unknown, record) => (
        <Space size="small">
          {!record.isDirectory && <Button type="link" size="small" onClick={() => onPreview(record)}>查看</Button>}
          <Button type="link" size="small" danger onClick={() => onDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ]
}
