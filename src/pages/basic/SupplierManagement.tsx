import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Tag, Button, Modal, Form, Input, Select, Row, Col, Drawer, Descriptions, Space, Popconfirm } from 'antd'
import {
  ShopOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, EyeOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

export default function SupplierManagement() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [form] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [categoryInput, setCategoryInput] = useState<string | undefined>(undefined)
  const [statusInput, setStatusInput] = useState<number | string | undefined>(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', category: undefined as string | undefined, status: undefined as number | string | undefined })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params: any = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.category) params.supplier_category = query.category
        if (query.status !== undefined && query.status !== null) params.status = query.status
        const res = await api.get('/basic/suppliers', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err: any) {
        if (!cancelled) {
          message.error(err.message || '获取供应商档案列表失败')
          setData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, category: categoryInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setCategoryInput(undefined)
    setStatusInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', category: undefined, status: undefined }))
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await api.post('/basic/suppliers/seed')
      message.success(res.message || '种子数据导入成功')
      refresh()
    } catch (err: any) {
      message.error(err.message || '种子数据导入失败')
    } finally {
      setSeeding(false)
    }
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record: any) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleAfterOpenChange = (open: boolean) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        supplier_code: editing.supplier_code,
        supplier_name: editing.supplier_name,
        short_name: editing.short_name,
        supplier_category: editing.supplier_category,
        contact_person: editing.contact_person,
        phone: editing.phone,
        email: editing.email,
        address: editing.address,
        status: editing.status === 1 ? '生效' : '失效',
        credit_level: editing.credit_level,
        tax_id: editing.tax_id,
        bank_account: editing.bank_account,
        bank_name: editing.bank_name,
        sort_order: editing.sort_order,
        remark: editing.remark,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        status: '生效',
        sort_order: total + 1,
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        supplier_code: values.supplier_code,
        supplier_name: values.supplier_name,
        short_name: values.short_name,
        supplier_category: values.supplier_category,
        contact_person: values.contact_person,
        phone: values.phone,
        email: values.email,
        address: values.address,
        status: values.status,
        credit_level: values.credit_level,
        tax_id: values.tax_id,
        bank_account: values.bank_account,
        bank_name: values.bank_name,
        sort_order: values.sort_order,
        remark: values.remark || '',
      }
      if (editing) {
        const res = await api.put(`/basic/suppliers/${editing.supplier_id}`, payload)
        message.success(res.message || '供应商编辑成功')
      } else {
        const res = await api.post('/basic/suppliers', payload)
        message.success(res.message || '供应商新增成功')
      }
      setModalVisible(false)
      refresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/suppliers/${record.supplier_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '编码', dataIndex: 'supplier_code', key: 'supplier_code', width: 110, fixed: 'left' },
    { title: '名称', dataIndex: 'supplier_name', key: 'supplier_name', width: 260 },
    { title: '简称', dataIndex: 'short_name', key: 'short_name', width: 120 },
    { title: '分类', dataIndex: 'supplier_category', key: 'supplier_category', width: 130, render: (v: any) => v || '-' },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person', width: 90 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
    { title: '地址', dataIndex: 'address', key: 'address', width: 240 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90, fixed: 'right',
      render: (v: any, record: any) => {
        const enabled = (record.status === 1 || record.status === '生效' || v === 1 || v === '生效')
        return <Tag color={enabled ? 'green' : 'red'}>{enabled ? '生效' : '失效'}</Tag>
      },
    },
    {
      title: '操作', key: 'action', fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setViewRecord(record)}>查看</Button>
          {hasPermission('basic:supplier:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {hasPermission('basic:supplier:delete') && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const activeCount = data.filter(d => d.status === 1 || d.status === '生效').length
  const inactiveCount = data.filter(d => d.status === 0 || d.status === '失效').length

  const stats = [
    { label: '供应商总数', value: total, icon: <ShopOutlined />, color: '#2196F3' },
    { label: '生效', value: activeCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '失效', value: inactiveCount, icon: <CloseCircleOutlined />, color: '#F44336' },
  ]

  const categoryOptions = [
    { label: '原料类(A)', value: '原料类(A)' },
    { label: '辅料类(B)', value: '辅料类(B)' },
    { label: '委外加工类(C)', value: '委外加工类(C)' },
    { label: '内部供应商', value: '内部供应商' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="供应商档案"
        breadcrumbs="基础数据 / 供应商档案"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="seed" icon={<DatabaseOutlined />} onClick={handleSeed} loading={seeding}>导入种子数据</Button>,
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增供应商</Button>,
            ]}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Input
                  placeholder="搜索编码/名称/简称"
                  style={{ width: '100%' }}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  allowClear
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="分类筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={categoryOptions}
                  value={categoryInput}
                  onChange={setCategoryInput}
                />
              </Col>
              <Col span={3}>
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={[{ label: '生效', value: 1 }, { label: '失效', value: 0 }]}
                  value={statusInput}
                  onChange={setStatusInput}
                />
              </Col>
              <Col span={11}>
                <Space>
                  <Button type="primary" onClick={handleSearch}>查询</Button>
                  <Button onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>
            <ResizableTable
              tableKey="pages_basic_SupplierManagement"
              columns={columns}
              dataSource={data}
              rowKey="supplier_id"
              size="small"
              loading={loading}
              scroll={{ x: 1450 }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: (p: number, ps: number) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />
      <Modal
        title={editing ? '编辑供应商' : '新增供应商'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={780}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="supplier_code" label="编码" rules={[{ required: true, message: '请输入供应商编码' }]}>
                <Input placeholder="如：A-012" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="supplier_name" label="名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
                <Input placeholder="请输入供应商全称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="short_name" label="简称">
                <Input placeholder="请输入简称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="supplier_category" label="分类">
                <Select placeholder="请选择供应商分类" allowClear options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="credit_level" label="信用等级">
                <Select placeholder="请选择信用等级" allowClear
                  options={[
                    { label: 'A 级', value: 'A' },
                    { label: 'B 级', value: 'B' },
                    { label: 'C 级', value: 'C' },
                    { label: 'D 级', value: 'D' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={[{ label: '生效', value: '生效' }, { label: '失效', value: '失效' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="contact_person" label="联系人">
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}>
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="address" label="地址">
                <Input placeholder="请输入地址" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="tax_id" label="税号">
                <Input placeholder="纳税人识别号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="bank_name" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="bank_account" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="查看供应商"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={560}
      >
        {viewRecord && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="编码">{viewRecord.supplier_code}</Descriptions.Item>
            <Descriptions.Item label="名称">{viewRecord.supplier_name}</Descriptions.Item>
            <Descriptions.Item label="简称">{viewRecord.short_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="分类">{viewRecord.supplier_category || '-'}</Descriptions.Item>
            <Descriptions.Item label="信用等级">{viewRecord.credit_level || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={(viewRecord.status === 1 || viewRecord.status === '生效') ? 'green' : 'red'}>
                {(viewRecord.status === 1 || viewRecord.status === '生效') ? '生效' : '失效'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="联系人">{viewRecord.contact_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{viewRecord.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{viewRecord.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{viewRecord.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="税号">{viewRecord.tax_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            <Descriptions.Item label="开户银行">{viewRecord.bank_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="银行账号">{viewRecord.bank_account || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{viewRecord.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{viewRecord.created_at ? String(viewRecord.created_at).slice(0, 10) : '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{viewRecord.remark || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
