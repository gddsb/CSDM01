import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Breadcrumb, message, Modal, Tag } from 'antd'
import {
  FolderOutlined,
  FileOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import api from '../../utils/api'
import { useApp } from '../../contexts/AppContext'

export default function FileManager() {
  const { message: msg } = useApp()
  const [loading, setLoading] = useState(false)
  const [currentDir, setCurrentDir] = useState('')
  const [items, setItems] = useState([])
  const [breadcrumbs, setBreadcrumbs] = useState([])

  const fetchDirectory = useCallback(async (dir) => {
    setLoading(true)
    try {
      const res = await api.get('/system/files', { params: { dir: dir || '' } })
      const data = res.data || {}
      setItems(data.items || [])
      setCurrentDir(data.currentDir || '/')

      // 生成面包屑
      const pathParts = (data.currentDir && data.currentDir !== '/')
        ? data.currentDir.split('/').filter(Boolean)
        : []
      const crumbs = [{ name: 'uploads', path: '' }]
      let accPath = ''
      for (const part of pathParts) {
        accPath = accPath ? accPath + '/' + part : part
        crumbs.push({ name: part, path: accPath })
      }
      setBreadcrumbs(crumbs)
    } catch (err) {
      msg.error(err.message || '获取文件列表失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [msg])

  useEffect(() => {
    fetchDirectory('')
  }, [fetchDirectory])

  const handleEnterDir = (item) => {
    if (item.isDirectory) {
      fetchDirectory(item.path)
    }
  }

  const handleGoBack = () => {
    if (currentDir && currentDir !== '/') {
      const parent = currentDir.substring(0, currentDir.lastIndexOf('/'))
      fetchDirectory(parent === '/' ? '' : parent)
    }
  }

  const handleGoToCrumb = (path) => {
    fetchDirectory(path)
  }

  const handleDelete = (item) => {
    Modal.confirm({
      title: `确认删除${item.isDirectory ? '目录' : '文件'}？`,
      content: `确定要删除 "${item.name}" 吗？${item.isDirectory ? '仅空目录可删除。' : ''}`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/system/files/${encodeURIComponent(item.path)}`)
          msg.success('删除成功')
          fetchDirectory(currentDir === '/' ? '' : currentDir.replace(/^\//, ''))
        } catch (err) {
          msg.error(err.message || '删除失败')
        }
      },
    })
  }

  const handlePreview = (item) => {
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
              <img
                src={url}
                alt={item.name}
                style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }}
              />
            </div>
          ),
        })
      } else {
        window.open(url, '_blank')
      }
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.isDirectory ? (
            <FolderOutlined style={{ color: '#FAAD14', fontSize: 16 }} />
          ) : (
            <FileOutlined style={{ color: '#1890FF', fontSize: 16 }} />
          )}
          <span
            style={{
              cursor: record.isDirectory ? 'pointer' : 'default',
              color: record.isDirectory ? '#1890FF' : 'inherit',
            }}
            onClick={() => record.isDirectory && handleEnterDir(record)}
          >
            {text}
          </span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isDirectory',
      key: 'type',
      width: 100,
      render: (isDir) => (
        <Tag color={isDir ? 'gold' : 'blue'}>
          {isDir ? '目录' : '文件'}
        </Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'sizeText',
      key: 'size',
      width: 120,
      render: (text, record) => record.isDirectory ? '-' : text,
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 200,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {!record.isDirectory && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            >
              查看
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <Breadcrumb
              items={breadcrumbs.map((b, i) => ({
                title: i < breadcrumbs.length - 1
                  ? <a onClick={() => handleGoToCrumb(b.path)}>{b.name}</a>
                  : b.name,
              }))}
            />
          </Space>
        }
        extra={
          <Space>
            {currentDir && currentDir !== '/' && (
              <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
                返回上级
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchDirectory(currentDir === '/' ? '' : currentDir.replace(/^\//, ''))}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="path"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onDoubleClick: () => record.isDirectory && handleEnterDir(record),
          })}
          locale={{ emptyText: '暂无文件' }}
        />
      </Card>
    </div>
  )
}
