import ResizableTable from '../../components/ResizableTable'
import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Row, Col, InputNumber, message } from 'antd'
import {
  FileSearchOutlined, AppstoreOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'

const categoryOptions = [
  { label: '外观', value: '外观' },
  { label: '尺寸', value: '尺寸' },
  { label: '性能', value: '性能' },
  { label: '理化', value: '理化' },
  { label: '微生物', value: '微生物' },
  { label: '环境', value: '环境' },
]

const inspectionTypeOptions = [
  { label: '材料检验', value: '材料检验' },
  { label: '产品检验', value: '产品检验' },
  { label: '其它检验', value: '其它检验' },
]

const mockItems = [
  { id: 'it1', item_code: 'APP-001', item_name: '外观-印刷色差', category: '外观', inspection_type: '产品检验', method: '目视比对标准样', sample_rule: 'AQL 0.65', standard_value: '无明显色差', unit: '-', sort_order: 1, status: '启用' },
  { id: 'it2', item_code: 'APP-002', item_name: '外观-表面划伤', category: '外观', inspection_type: '产品检验', method: '目视检查', sample_rule: 'AQL 1.0', standard_value: '无划伤', unit: '-', sort_order: 2, status: '启用' },
  { id: 'it3', item_code: 'DIM-001', item_name: '罐体高度', category: '尺寸', inspection_type: '产品检验', method: '游标卡尺测量', sample_rule: 'AQL 0.4', standard_value: '90.0±0.3', unit: 'mm', sort_order: 3, status: '启用' },
  { id: 'it4', item_code: 'DIM-002', item_name: '罐体直径', category: '尺寸', inspection_type: '产品检验', method: '游标卡尺测量', sample_rule: 'AQL 0.4', standard_value: 'Φ74.0±0.2', unit: 'mm', sort_order: 4, status: '启用' },
  { id: 'it5', item_code: 'PER-001', item_name: '焊缝强度', category: '性能', inspection_type: '产品检验', method: '拉力试验机', sample_rule: '特殊规则(每批5个)', standard_value: '≥200', unit: 'N', sort_order: 5, status: '启用' },
  { id: 'it6', item_code: 'PER-002', item_name: '耐压性能', category: '性能', inspection_type: '产品检验', method: '正压测漏机', sample_rule: 'AQL 0.25', standard_value: '0.1MPa保压30s无渗漏', unit: '-', sort_order: 6, status: '启用' },
  { id: 'it7', item_code: 'PHC-001', item_name: '马口铁厚度', category: '理化', inspection_type: '材料检验', method: '测厚仪', sample_rule: 'AQL 0.65', standard_value: '0.23±0.01', unit: 'mm', sort_order: 7, status: '启用' },
  { id: 'it8', item_code: 'PHC-002', item_name: '镀锡量', category: '理化', inspection_type: '材料检验', method: '化学分析法', sample_rule: '特殊规则(每批1样)', standard_value: '≥2.8', unit: 'g/m²', sort_order: 8, status: '启用' },
  { id: 'it9', item_code: 'ENV-001', item_name: '车间温度', category: '环境', inspection_type: '其它检验', method: '温湿度计', sample_rule: '每2小时记录', standard_value: '20-25℃', unit: '℃', sort_order: 9, status: '启用' },
  { id: 'it10', item_code: 'ENV-002', item_name: '车间湿度', category: '环境', inspection_type: '其它检验', method: '温湿度计', sample_rule: '每2小时记录', standard_value: '45-65%RH', unit: '%RH', sort_order: 10, status: '启用' },
]

const categoryColor: Record<string, string> = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange', '微生物': 'green', '环境': 'geekblue' }

export default function InspectionStandardItem() {
  const [data, setData] = useState(mockItems)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const appearanceCount = data.filter(i => i.category === '外观').length
  const dimensionCount = data.filter(i => i.category === '尺寸').length
  const performanceCount = data.filter(i => i.category === '性能').length
  const physicoCount = data.filter(i => i.category === '理化').length

  const stats = [
    { label: '项目总数', value: data.length, icon: <FileSearchOutlined />, color: '#2196F3' },
    { label: '外观类', value: appearanceCount, icon: <AppstoreOutlined />, color: '#1890FF' },
    { label: '尺寸类', value: dimensionCount, icon: <AppstoreOutlined />, color: '#13C2C2' },
    { label: '性能类', value: performanceCount, icon: <AppstoreOutlined />, color: '#FA8C16' },
    { label: '理化类', value: physicoCount, icon: <AppstoreOutlined />, color: '#722ED1' },
  ]

  const filters = [
    { type: 'input', placeholder: '项目编码 / 项目名称', icon: <SearchOutlined /> },
    { type: 'select', placeholder: '检验类型', options: inspectionTypeOptions },
    { type: 'select', placeholder: '项目大类', options: categoryOptions },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '启用', value: '启用' },
        { label: '停用', value: '停用' },
      ]
    },
  ]

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      inspection_type: '产品检验',
      category: '外观',
      status: '启用',
      sort_order: data.length + 1,
    })
    setModalVisible(true)
  }

  const handleEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除检验项目"${record.item_name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.filter((i: any) => i.id !== record.id))
        message.success('删除成功')
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map((i: any) => i.id === editing.id ? { ...i, ...values } : i))
        message.success('检验项目编辑成功')
      } else {
        const maxCode = data.reduce((max: number, i: any) => {
          const num = parseInt(i.item_code.split('-')[1] || '0', 10)
          return num > max ? num : max
        }, 0)
        const categoryPrefix = values.category.substring(0, 2).toUpperCase()
        const newItem = {
          id: 'it' + Date.now(),
          item_code: `${categoryPrefix}-${String(maxCode + 1).padStart(3, '0')}`,
          ...values,
        }
        setData(prev => [newItem, ...prev])
        message.success('检验项目新增成功')
      }
      setModalVisible(false)
    } catch (e) {
    }
  }

  const columns = [
    { title: '项目编码', dataIndex: 'item_code', key: 'item_code', width: 110, fixed: 'left' },
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name', width: 180 },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 100,
      render: (v: string) => <Tag color={v === '材料检验' ? 'blue' : v === '产品检验' ? 'green' : 'purple'}>{v}</Tag>
    },
    {
      title: '大类', dataIndex: 'category', key: 'category', width: 90,
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验方法', dataIndex: 'method', key: 'method', width: 160 },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 160 },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 180 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === '启用' ? 'success' : 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      )
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检验标准项目维护"
        breadcrumbs="质量管理 / 检验标准项目维护"
        stats={stats}
        filters={filters}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <ResizableTable tableKey="pages_quality_InspectionStandardItem"             columns={columns}
            dataSource={data}
            rowKey="id"
            size="small"
            scroll={{ x: 1400 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑检验项目' : '新增检验项目'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="项目大类" rules={[{ required: true, message: '请选择项目大类' }]}>
                <Select placeholder="请选择项目大类" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={inspectionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="如 mm、N、%等，无则填 -" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_value" label="标准值" rules={[{ required: true, message: '请输入标准值' }]}>
                <Input placeholder="如 90.0±0.3、≥200 等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sample_rule" label="抽样方式">
                <Input placeholder="如 AQL 0.65、每批5个等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="method" label="检验方法" rules={[{ required: true, message: '请输入检验方法' }]}>
                <Input placeholder="如 游标卡尺测量、拉力试验机等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态">
                  <Select.Option value="启用">启用</Select.Option>
                  <Select.Option value="停用">停用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
