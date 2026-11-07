/**
 * 通用 CRUD 页面模板 — 权限引擎 V2 的 IAM 模块复用
 *
 * 用法：
 *   <SimpleCrudPage
 *     title="业务对象字典"
 *     apiPath="/iam/business-objects"
 *     columns={[...]}
 *     fields={[...]}
 *   />
 *
 * 依赖：/iam/business-objects 的后端接口：
 *   GET    /?page=&pageSize=&xxx=          列表
 *   POST   /                                新增
 *   PUT    /:id                             修改
 *   DELETE /:id                             删除
 */
import { useState, useEffect } from 'react'
import { Button, Table, Modal, Form, Input, InputNumber, Select, Switch, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export interface FieldDef {
  name: string
  label: string
  type?: 'input' | 'textarea' | 'number' | 'select' | 'switch'
  options?: { label: string; value: any }[]
  required?: boolean
  width?: number
  disabledInEdit?: boolean
  placeholder?: string
}

export interface SimpleCrudPageProps {
  title: string
  apiPath: string
  columns: any[]
  fields: FieldDef[]
  rowKey?: string
  searchFields?: FieldDef[]
  renderTag?: (col: string, val: any) => React.ReactNode
}

export default function SimpleCrudPage(props: SimpleCrudPageProps) {
  const { title, apiPath, columns, fields, rowKey = 'id', searchFields = [], renderTag } = props

  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const [searchForm] = Form.useForm()
  const [searchParams, setSearchParams] = useState<Record<string, any>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(apiPath, { params: { page, pageSize, ...searchParams } })
      setList(res.data?.rows ?? res.data?.list ?? [])
      setTotal(res.total ?? res.data?.total ?? 0)
    } catch (e: any) {
      message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize, searchParams])

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue(row)
    setModalOpen(true)
  }

  const handleDelete = async (row: any) => {
    try {
      await api.delete(`${apiPath}/${row[rowKey]}`)
      message.success('删除成功')
      load()
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await api.put(`${apiPath}/${editing[rowKey]}`, values)
        message.success('修改成功')
      } else {
        await api.post(apiPath, values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  // 渲染列：如果 col 有 tagRender 配置
  const finalColumns = columns.map(col => ({
    ...col,
    render: col.render ?? ((val: any) => {
      if (renderTag && renderTag(col.dataIndex, val)) return renderTag(col.dataIndex, val)
      return val
    }),
  }))

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>{title}</h2>

      {/* 搜索栏 */}
      {searchFields.length > 0 && (
        <Form form={searchForm} layout="inline" onFinish={(v) => { setSearchParams(v); setPage(1) }} style={{ marginBottom: 12 }}>
          {searchFields.map(f => (
            <Form.Item key={f.name} name={f.name} label={f.label}>
              {renderField(f)}
            </Form.Item>
          ))}
          <Space>
            <Button type="primary" htmlType="submit">查询</Button>
            <Button onClick={() => { searchForm.resetFields(); setSearchParams({}); setPage(1) }}>重置</Button>
          </Space>
        </Form>
      )}

      {/* 工具栏 */}
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </Space>

      {/* 表格 */}
      <Table
        rowKey={rowKey}
        columns={[
          ...finalColumns,
          {
            title: '操作',
            key: 'actions',
            fixed: 'right',
            width: 160,
            render: (_: any, row: any) => (
              <Space size="small">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(row)}>编辑</Button>
                <Popconfirm title="确认删除？" onConfirm={() => handleDelete(row)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={list}
        loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps) } }}
        scroll={{ x: 'max-content' }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={editing ? `编辑 ${title}` : `新增 ${title}`}
        open={modalOpen}
        width={680}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          {fields.map(f => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : undefined}
            >
              {renderField(f, editing)}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

function renderField(f: FieldDef, editing?: any) {
  const disabled = editing && f.disabledInEdit
  switch (f.type) {
    case 'textarea':
      return <Input.TextArea rows={3} placeholder={f.placeholder} disabled={disabled} />
    case 'number':
      return <InputNumber placeholder={f.placeholder} style={{ width: '100%' }} disabled={disabled} />
    case 'select':
      return <Select options={f.options} placeholder={f.placeholder} disabled={disabled} allowClear />
    case 'switch':
      return <Switch />
    default:
      return <Input placeholder={f.placeholder} disabled={disabled} />
  }
}
