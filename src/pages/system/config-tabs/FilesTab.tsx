import React from 'react'
import { Button, Breadcrumb, Space, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import ResizableTable from '../../../components/ResizableTable'
import type { FileItem } from './fileColumns'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

export interface BreadcrumbItem { name: string; path: string }

interface FilesTabProps {
  filesLoading: boolean
  fileData: { current: string; separator: string; files: FileItem[]; breadcrumbs: BreadcrumbItem[] } | null
  fileColumns: ColumnsType<FileItem>
  handleFileOpen: (record: FileItem) => void
  handleFileBreadcrumb: (path: string) => void
  handleFileGoBack: () => void
}

export default function FilesTab({ filesLoading, fileData, fileColumns, handleFileOpen, handleFileBreadcrumb, handleFileGoBack }: FilesTabProps) {
  const current = fileData?.current || ''
  const files = fileData?.files || []
  const breadcrumbs = fileData?.breadcrumbs || []
  const canGoBack = current && current !== '/'
  return (
    <Spin spinning={filesLoading}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Breadcrumb
          items={breadcrumbs.map((b, i) => ({
            title: i < breadcrumbs.length - 1
              ? <a onClick={() => handleFileBreadcrumb(b.path)}>{b.name}</a>
              : b.name,
          }))}
        />
        <Space>
          {canGoBack && (
            <Button icon={<ArrowLeftOutlined />} onClick={handleFileGoBack}>返回上级</Button>
          )}
        </Space>
      </div>
      <ResizableTable
        tableKey="system_config_files"
        rowKey="path"
        columns={fileColumns}
        dataSource={files}
        loading={filesLoading}
        pagination={false}
        size="small"
        onRow={(record) => ({
          onDoubleClick: () => (record as FileItem).isDirectory && handleFileOpen(record as FileItem),
        })}
        locale={{ emptyText: '暂无文件' }}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        提示：双击目录可进入；上传文件目录为 server/uploads，删除操作不可恢复。
      </Text>
    </Spin>
  )
}
