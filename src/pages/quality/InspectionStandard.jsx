import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Space, Modal, Form, Input, Select, Descriptions, Typography, message, Row, Col } from 'antd'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, EyeOutlined, EditOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { inspectionStandards } from '../../mock/data'

const { Text } = Typography

// 检验项目明细 mock 数据（按标准id分组）
const inspectionItemsMap = {
  s1: [
    { item_name: '外观-印刷色差', category: '外观', method: '目视比对标准样', sample_rule: 'AQL 0.65', standard_value: '无明显色差', unit: '-' },
    { item_name: '外观-表面划伤', category: '外观', method: '目视检查', sample_rule: 'AQL 1.0', standard_value: '无划伤', unit: '-' },
    { item_name: '罐体高度', category: '尺寸', method: '游标卡尺测量', sample_rule: 'AQL 0.4', standard_value: '90.0±0.3', unit: 'mm' },
    { item_name: '罐体直径', category: '尺寸', method: '游标卡尺测量', sample_rule: 'AQL 0.4', standard_value: 'Φ74.0±0.2', unit: 'mm' },
    { item_name: '焊缝强度', category: '性能', method: '拉力试验机', sample_rule: '特殊规则(每批5个)', standard_value: '≥200', unit: 'N' },
    { item_name: '耐压性能', category: '性能', method: '正压测漏机', sample_rule: 'AQL 0.25', standard_value: '0.1MPa保压30s无渗漏', unit: '-' },
  ],
  s2: [
    { item_name: '外观-印刷质量', category: '外观', method: '目视检查', sample_rule: 'AQL 0.65', standard_value: '印刷清晰完整', unit: '-' },
    { item_name: '罐体高度', category: '尺寸', method: '游标卡尺测量', sample_rule: 'AQL 0.4', standard_value: '75.0±0.3', unit: 'mm' },
    { item_name: '密封性', category: '性能', method: '负压测漏', sample_rule: 'AQL 0.25', standard_value: '无渗漏', unit: '-' },
  ],
  s3: [
    { item_name: '外观-印刷色差(伊利专样)', category: '外观', method: '色差仪比对', sample_rule: 'AQL 0.65', standard_value: 'ΔE≤2.0', unit: '-' },
    { item_name: '封口完整性', category: '性能', method: '负压测漏', sample_rule: '特殊规则(每批10个)', standard_value: '无渗漏', unit: '-' },
    { item_name: '马口铁厚度', category: '理化', method: '测厚仪', sample_rule: 'AQL 0.65', standard_value: '0.23±0.01', unit: 'mm' },
  ],
  s4: [
    { item_name: '表面划伤', category: '外观', method: '目视检查', sample_rule: 'AQL 1.0', standard_value: '无明显划伤', unit: '-' },
    { item_name: '板材厚度', category: '理化', method: '千分尺测量', sample_rule: 'AQL 0.65', standard_value: '0.23±0.01', unit: 'mm' },
    { item_name: '镀锡量', category: '理化', method: '化学分析法', sample_rule: '特殊规则(每批1样)', standard_value: '≥2.8', unit: 'g/m²' },
    { item_name: '板材宽度', category: '尺寸', method: '钢卷尺测量', sample_rule: 'AQL 0.4', standard_value: '800±1.0', unit: 'mm' },
  ],
}

const categoryColor = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange' }

const inspectionTypeOptions = ['来料检验', '成品检验', '微生物检验', '环境检验'].map(t => ({ label: t, value: t }))
const statusOptions = ['生效', '失效'].map(s => ({ label: s, value: s }))

export default function InspectionStandard() {
  const [data, setData] = useState(inspectionStandards)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStandard, setCurrentStandard] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const generalCount = data.filter(s => s.standard_type === '通用标准').length
  const customerCount = data.filter(s => s.standard_type === '客户专用标准').length
  const effectiveCount = data.filter(s => s.status === '生效').length

  const stats = [
    { label: '标准总数', value: data.length, icon: <FileProtectOutlined />, color: '#2196F3' },
    { label: '通用标准', value: generalCount, icon: <AppstoreOutlined />, color: '#00BCD4' },
    { label: '客户专用标准', value: customerCount, icon: <SolutionOutlined />, color: '#FF9800' },
    { label: '生效中', value: effectiveCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const filters = [
    { type: 'input', placeholder: '标准号 / 标准名称', icon: <SearchOutlined /> },
    {
      type: 'select', placeholder: '标准类型', options: [
        { label: '通用标准', value: '通用标准' },
        { label: '客户专用标准', value: '客户专用标准' },
      ]
    },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '生效', value: '生效' },
        { label: '停用', value: '停用' },
      ]
    },
  ]

  const showItems = (record) => {
    setCurrentStandard(record)
    setDrawerOpen(true)
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  // Modal 打开动画结束后再设置表单值（配合 destroyOnHidden + preserve={false}）
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      // 表单字段使用 version，数据字段为 version_no，此处做映射回填
      form.setFieldsValue({
        ...editing,
        version: editing.version_no,
      })
    } else {
      form.resetFields()
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(s => s.standard_id === editing.standard_id ? {
          ...s,
          standard_no: values.standard_no,
          standard_name: values.standard_name,
          inspection_type: values.inspection_type,
          version_no: values.version,
          status: values.status,
          description: values.description,
        } : s))
        message.success('检验标准编辑成功')
      } else {
        const newStandard = {
          standard_id: 's' + Date.now(),
          standard_no: values.standard_no,
          standard_name: values.standard_name,
          standard_type: '通用标准',
          customer_code: '-',
          material_id: null,
          material_name: '-',
          version_no: values.version,
          effective_date: dayjs().format('YYYY-MM-DD'),
          status: values.status,
          created_by: null,
          inspection_type: values.inspection_type,
          description: values.description,
        }
        setData(prev => [newStandard, ...prev])
        message.success('检验标准新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '标准号', dataIndex: 'standard_no', key: 'standard_no', width: 130 },
    { title: '标准名称', dataIndex: 'standard_name', key: 'standard_name' },
    {
      title: '标准类型', dataIndex: 'standard_type', key: 'standard_type', width: 120,
      render: v => <Tag color={v === '通用标准' ? 'blue' : 'orange'}>{v}</Tag>
    },
    { title: '关联料品', dataIndex: 'material_name', key: 'material_name', width: 140 },
    { title: '客户编码', dataIndex: 'customer_code', key: 'customer_code', width: 100, render: v => v === '-' ? <Text type="secondary">-</Text> : v },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={v === '生效' ? 'success' : 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => showItems(record)}>查看项目</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      )
    },
  ]

  const itemColumns = [
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    {
      title: '大类', dataIndex: 'category', key: 'category', width: 90,
      render: v => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验方法', dataIndex: 'method', key: 'method' },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 150 },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 160 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检验标准"
        breadcrumbs="质量管理 / 检验标准"
        stats={stats}
        filters={filters}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="standard_id"
            size="small"
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑检验标准' : '新增检验标准'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请输入标准编号' }]}>
                <Input placeholder="请输入标准编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="standard_name" label="标准名称" rules={[{ required: true, message: '请输入标准名称' }]}>
                <Input placeholder="请输入标准名称" />
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
              <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="请输入版本号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title="检验项目明细"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={960}
        destroyOnHidden
      >
        {currentStandard && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="标准号">{currentStandard.standard_no}</Descriptions.Item>
              <Descriptions.Item label="标准名称">{currentStandard.standard_name}</Descriptions.Item>
              <Descriptions.Item label="标准类型">
                <Tag color={currentStandard.standard_type === '通用标准' ? 'blue' : 'orange'}>
                  {currentStandard.standard_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本号">{currentStandard.version_no}</Descriptions.Item>
              <Descriptions.Item label="关联料品">{currentStandard.material_name}</Descriptions.Item>
              <Descriptions.Item label="生效日期">{currentStandard.effective_date}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>检验项目列表</Typography.Title>
            <Table
              columns={itemColumns}
              dataSource={inspectionItemsMap[currentStandard.standard_id] || []}
              rowKey={(r, i) => i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
