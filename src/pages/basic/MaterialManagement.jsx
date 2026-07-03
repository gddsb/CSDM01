import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Drawer, Space, message, Descriptions, Row, Col } from 'antd'
import {
  ProfileOutlined, CheckCircleOutlined, ExperimentOutlined, StopOutlined,
  EditOutlined, EyeOutlined, PlusOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { materials as materialsData } from '../../mock/data'

// 状态标签颜色映射
const statusColorMap = { '启用': 'green', '试产': 'orange', '停产': 'red' }

export default function MaterialManagement() {
  const [data, setData] = useState(materialsData)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()

  const enabledCount = data.filter(m => m.status === '启用').length
  const trialCount = data.filter(m => m.status === '试产').length
  const stoppedCount = data.filter(m => m.status === '停产').length

  const stats = [
    { label: '料品总数', value: data.length, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '启用', value: enabledCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '试产', value: trialCount, icon: <ExperimentOutlined />, color: '#FF9800' },
    { label: '停产', value: stoppedCount, icon: <StopOutlined />, color: '#F44336' },
  ]

  const categoryOptions = [...new Set(data.map(m => m.category_name))].map(c => ({ label: c, value: c }))
  const statusOptions = ['启用', '试产', '停产'].map(s => ({ label: s, value: s }))

  const filters = [
    { type: 'input', placeholder: '搜索料号', col: { span: 6 } },
    { type: 'input', placeholder: '搜索品名', col: { span: 6 } },
    { type: 'select', placeholder: '状态筛选', options: statusOptions, col: { span: 6 } },
    { type: 'select', placeholder: '分类筛选', options: categoryOptions, col: { span: 6 } },
  ]

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDetail = (record) => {
    setCurrent(record)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(m => m.material_id === editing.material_id ? { ...m, ...values } : m))
        message.success('料品编辑成功')
      } else {
        const newMaterial = {
          material_id: 'm' + (data.length + 1),
          ...values,
        }
        setData(prev => [...prev, newMaterial])
        message.success('料品新增成功')
      }
      setModalOpen(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '品名', dataIndex: 'material_name', key: 'material_name' },
    { title: '规格', dataIndex: 'specification', key: 'specification' },
    { title: '菲林版本', dataIndex: 'film_version', key: 'film_version', width: 90 },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '分类', dataIndex: 'category_name', key: 'category_name', width: 90 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 110 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '安全库存', key: 'safety_stock', width: 150,
      render: (_, r) => `${r.min_safety_stock.toLocaleString()} - ${r.max_safety_stock.toLocaleString()}`,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="料品档案"
        breadcrumbs="基础数据 / 料品档案"
        stats={stats}
        filters={filters}
        actions={
          <ActionButtons
            hasAdd={false}
            extra={[<Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增料品</Button>]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="material_id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑料品' : '新增料品'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="material_code" label="料号" rules={[{ required: true, message: '请输入料号' }]}>
                <Input placeholder="请输入料号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="material_name" label="品名" rules={[{ required: true, message: '请输入品名' }]}>
                <Input placeholder="请输入品名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="specification" label="规格">
                <Input placeholder="请输入规格" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="film_version" label="菲林版本">
                <Input placeholder="请输入菲林版本" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="version_no" label="版本号">
                <Input placeholder="请输入版本号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category_name" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                <Select placeholder="请选择分类" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="customer_name" label="客户名称">
                <Input placeholder="请输入客户名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="请输入单位" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="min_safety_stock" label="最小安全库存" rules={[{ required: true, message: '请输入最小安全库存' }]}>
                <Input placeholder="请输入最小安全库存" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="max_safety_stock" label="最大安全库存" rules={[{ required: true, message: '请输入最大安全库存' }]}>
                <Input placeholder="请输入最大安全库存" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title="料品详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {current && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="料号">{current.material_code}</Descriptions.Item>
            <Descriptions.Item label="品名">{current.material_name}</Descriptions.Item>
            <Descriptions.Item label="规格">{current.specification}</Descriptions.Item>
            <Descriptions.Item label="菲林版本">{current.film_version}</Descriptions.Item>
            <Descriptions.Item label="版本号">{current.version_no}</Descriptions.Item>
            <Descriptions.Item label="分类">{current.category_name}</Descriptions.Item>
            <Descriptions.Item label="客户编码">{current.customer_code}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{current.customer_name}</Descriptions.Item>
            <Descriptions.Item label="单位">{current.unit}</Descriptions.Item>
            <Descriptions.Item label="最小安全库存">{current.min_safety_stock.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="最大安全库存">{current.max_safety_stock.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status]}>{current.status}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
