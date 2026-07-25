import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Space, Modal, Form, Input, Select, Descriptions, Typography, Row, Col } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, EyeOutlined, EditOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { inspectionStandards, materials } from '../../mock/data'

const { Text } = Typography

const inspectionItemsMap: Record<string, any[]> = {
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

const categoryColor: Record<string, string> = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange' }

const inspectionTypeOptions = [
  { label: '材料检验', value: '材料检验' },
  { label: '产品检验', value: '产品检验' },
  { label: '其它检验', value: '其它检验' },
]

const standardTypeOptions = [
  { label: '通用标准', value: '通用标准' },
  { label: '专用标准', value: '专用标准' },
  { label: '临时标准', value: '临时标准' },
]

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '生效', value: '生效' },
  { label: '失效', value: '失效' },
]

const INSPECTION_PREFIX: Record<string, string> = {
  '材料检验': 'IQC',
  '产品检验': 'IPQC',
  '其它检验': 'SPI',
}

const getTypeCode = (inspectionType: string, standardType: string, materialCode?: string): string => {
  if (standardType === '通用标准') return '000'
  if (standardType === '临时标准') return '999'
  if (standardType === '专用标准') {
    if (inspectionType === '材料检验' || inspectionType === '产品检验') {
      return materialCode ? materialCode.substring(0, 3).toUpperCase() : '001'
    }
    return '111'
  }
  return '000'
}

const generateStandardNo = (data: any[], inspectionType: string, standardType: string, materialCode?: string): string => {
  const prefix = INSPECTION_PREFIX[inspectionType] || 'IQC'
  const typeCode = getTypeCode(inspectionType, standardType, materialCode)
  const matched = data.filter(s => {
    const parts = s.standard_no ? s.standard_no.split('-') : []
    return parts[0] === prefix && parts[1] === typeCode
  })
  const maxSeq = matched.reduce((max: number, s: any) => {
    const parts = s.standard_no ? s.standard_no.split('-') : []
    const seq = parseInt(parts[2] || '0', 10)
    return seq > max ? seq : max
  }, 0)
  const nextSeq = String(maxSeq + 1).padStart(3, '0')
  return `${prefix}-${typeCode}-${nextSeq}`
}

export default function InspectionStandard() {
  const [data, setData] = useState(inspectionStandards)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStandard, setCurrentStandard] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const message = useMessage()

  const generalCount = data.filter(s => s.standard_type === '通用标准').length
  const dedicatedCount = data.filter(s => s.standard_type === '专用标准').length
  const tempCount = data.filter(s => s.standard_type === '临时标准').length
  const effectiveCount = data.filter(s => s.status === '生效').length

  const stats = [
    { label: '标准总数', value: data.length, icon: <FileProtectOutlined />, color: '#2196F3' },
    { label: '通用标准', value: generalCount, icon: <AppstoreOutlined />, color: '#00BCD4' },
    { label: '专用标准', value: dedicatedCount, icon: <SolutionOutlined />, color: '#FF9800' },
    { label: '临时标准', value: tempCount, icon: <SolutionOutlined />, color: '#9C27B0' },
    { label: '生效中', value: effectiveCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const filters = [
    { type: 'input', placeholder: '标准号 / 标准名称', icon: <SearchOutlined /> },
    {
      type: 'select', placeholder: '检验类型', options: inspectionTypeOptions
    },
    {
      type: 'select', placeholder: '标准类型', options: standardTypeOptions
    },
    {
      type: 'select', placeholder: '状态', options: statusOptions
    },
  ]

  const showItems = (record: any) => {
    setCurrentStandard(record)
    setDrawerOpen(true)
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      inspection_type: '材料检验',
      standard_type: '通用标准',
      status: '开立',
      version: 'V1',
    })
    const newNo = generateStandardNo(data, '材料检验', '通用标准')
    form.setFieldsValue({ standard_no: newNo })
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
        ...editing,
        version: editing.version_no,
      })
    }
  }

  const handleInspectionTypeChange = () => {
    const vals = form.getFieldsValue()
    if (!editing && vals.inspection_type && vals.standard_type) {
      const matCode = vals.material_id ? materials.find((m: any) => m.material_id === vals.material_id)?.material_code : undefined
      const newNo = generateStandardNo(data, vals.inspection_type, vals.standard_type, matCode)
      form.setFieldsValue({ standard_no: newNo })
    }
  }

  const handleStandardTypeChange = () => {
    const vals = form.getFieldsValue()
    if (!editing && vals.inspection_type && vals.standard_type) {
      const matCode = vals.material_id ? materials.find((m: any) => m.material_id === vals.material_id)?.material_code : undefined
      const newNo = generateStandardNo(data, vals.inspection_type, vals.standard_type, matCode)
      form.setFieldsValue({ standard_no: newNo })
    }
  }

  const handleMaterialChange = (val: string) => {
    const vals = form.getFieldsValue()
    if (!editing && vals.inspection_type && vals.standard_type === '专用标准') {
      const matCode = val ? materials.find((m: any) => m.material_id === val)?.material_code : undefined
      const newNo = generateStandardNo(data, vals.inspection_type, vals.standard_type, matCode)
      form.setFieldsValue({ standard_no: newNo })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map((s: any) => s.standard_id === editing.standard_id ? {
          ...s,
          standard_no: values.standard_no,
          standard_name: values.standard_name,
          inspection_type: values.inspection_type,
          standard_type: values.standard_type,
          material_id: values.material_id || null,
          material_name: values.material_id ? materials.find((m: any) => m.material_id === values.material_id)?.material_name || '-' : '-',
          version_no: values.version,
          status: values.status,
          description: values.description,
        } : s))
        message.success('检验标准编辑成功')
      } else {
        const material = values.material_id ? materials.find((m: any) => m.material_id === values.material_id) : null
        const newStandard = {
          standard_id: 's' + Date.now(),
          standard_no: values.standard_no,
          standard_name: values.standard_name,
          standard_type: values.standard_type,
          customer_code: '-',
          material_id: values.material_id || null,
          material_name: material?.material_name || '-',
          version_no: values.version,
          effective_date: dayjs().format('YYYY-MM-DD'),
          status: values.status,
          created_by: 'u4',
          inspection_type: values.inspection_type,
          description: values.description,
        }
        setData(prev => [newStandard, ...prev])
        message.success('检验标准新增成功')
      }
      setModalVisible(false)
    } catch (e) {
    }
  }

  const materialOptions = materials.map((m: any) => ({
    label: `${m.material_code} - ${m.material_name}`,
    value: m.material_id,
  }))

  const columns = [
    { title: '标准号', dataIndex: 'standard_no', key: 'standard_no', width: 140 },
    { title: '标准名称', dataIndex: 'standard_name', key: 'standard_name' },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 100,
      render: (v: string) => <Tag color={v === '材料检验' ? 'blue' : v === '产品检验' ? 'green' : 'purple'}>{v}</Tag>
    },
    {
      title: '标准类型', dataIndex: 'standard_type', key: 'standard_type', width: 100,
      render: (v: string) => <Tag color={v === '通用标准' ? 'blue' : v === '专用标准' ? 'orange' : 'purple'}>{v}</Tag>
    },
    { title: '关联料品', dataIndex: 'material_name', key: 'material_name', width: 140 },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const colorMap: Record<string, string> = { '开立': 'default', '生效': 'success', '失效': 'error' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_: any, record: any) => (
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
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
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
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
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
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请输入标准编号' }]}>
                <Input placeholder="系统自动生成，可手动调整" />
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
                <Select placeholder="请选择检验类型" options={inspectionTypeOptions} onChange={handleInspectionTypeChange} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="standard_type" label="标准类型" rules={[{ required: true, message: '请选择标准类型' }]}>
                <Select placeholder="请选择标准类型" options={standardTypeOptions} onChange={handleStandardTypeChange} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="material_id" label="关联料品">
                <Select
                  placeholder="专用标准请选择关联料品"
                  options={materialOptions}
                  allowClear
                  onChange={handleMaterialChange}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="如 V1" />
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
              <Descriptions.Item label="检验类型">{currentStandard.inspection_type}</Descriptions.Item>
              <Descriptions.Item label="标准类型">
                <Tag color={currentStandard.standard_type === '通用标准' ? 'blue' : currentStandard.standard_type === '专用标准' ? 'orange' : 'purple'}>
                  {currentStandard.standard_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本号">{currentStandard.version_no}</Descriptions.Item>
              <Descriptions.Item label="关联料品">{currentStandard.material_name}</Descriptions.Item>
              <Descriptions.Item label="生效日期">{currentStandard.effective_date}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentStandard.status === '生效' ? 'success' : currentStandard.status === '失效' ? 'error' : 'default'}>
                  {currentStandard.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>检验项目列表</Typography.Title>
            <Table
              columns={itemColumns}
              dataSource={inspectionItemsMap[currentStandard.standard_id] || []}
              rowKey={(r: any, i: number) => i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
