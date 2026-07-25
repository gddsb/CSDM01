import React, { useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, Typography, Row, Col } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, SearchOutlined, PlusOutlined, EyeOutlined, EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { inspectionStandards, materials } from '../../mock/data'

const categoryColor: Record<string, string> = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange', '微生物': 'green', '环境': 'geekblue' }

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

const categoryOptions = [
  { label: '外观', value: '外观' },
  { label: '尺寸', value: '尺寸' },
  { label: '性能', value: '性能' },
  { label: '理化', value: '理化' },
  { label: '微生物', value: '微生物' },
  { label: '环境', value: '环境' },
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
  const [editing, setEditing] = useState<any>(null)
  const [viewMode, setViewMode] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [itemModalVisible, setItemModalVisible] = useState(false)
  const [itemEditing, setItemEditing] = useState<any>(null)
  const [standardItems, setStandardItems] = useState<any[]>([])
  const [form] = Form.useForm()
  const [itemForm] = Form.useForm()

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
    { type: 'select', placeholder: '检验类型', options: inspectionTypeOptions },
    { type: 'select', placeholder: '标准类型', options: standardTypeOptions },
    { type: 'select', placeholder: '状态', options: statusOptions },
  ]

  const refreshStandardNo = (vals: any) => {
    if (!vals.inspection_type || !vals.standard_type) return
    const matCode = vals.material_id ? materials.find((m: any) => m.material_id === vals.material_id)?.material_code : undefined
    const newNo = generateStandardNo(data, vals.inspection_type, vals.standard_type, matCode)
    form.setFieldsValue({ standard_no: newNo })
  }

  const handleAdd = () => {
    setEditing(null)
    setViewMode(false)
    setStandardItems([])
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

  const handleView = (record: any) => {
    setEditing(record)
    setViewMode(true)
    const items = (window as any).__standardItems?.[record.standard_id] || []
    setStandardItems(items)
    form.setFieldsValue({
      ...record,
      version: record.version_no,
    })
    setModalVisible(true)
  }

  const handleEdit = (record: any) => {
    setEditing(record)
    setViewMode(false)
    const items = (window as any).__standardItems?.[record.standard_id] || []
    setStandardItems(items)
    form.setFieldsValue({
      ...record,
      version: record.version_no,
    })
    setModalVisible(true)
  }

  const handleInspectionTypeChange = () => {
    if (viewMode) return
    const vals = form.getFieldsValue()
    if (!editing) refreshStandardNo(vals)
  }

  const handleStandardTypeChange = () => {
    if (viewMode) return
    const vals = form.getFieldsValue()
    if (!editing) refreshStandardNo(vals)
  }

  const handleMaterialChange = (val: string) => {
    if (viewMode) return
    const vals = form.getFieldsValue()
    if (!editing && vals.standard_type === '专用标准') {
      const matCode = val ? materials.find((m: any) => m.material_id === val)?.material_code : undefined
      const newNo = generateStandardNo(data, vals.inspection_type, vals.standard_type, matCode)
      form.setFieldsValue({ standard_no: newNo })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const material = values.material_id ? materials.find((m: any) => m.material_id === values.material_id) : null
      if (editing) {
        setData(prev => prev.map((s: any) => s.standard_id === editing.standard_id ? {
          ...s,
          standard_no: values.standard_no,
          standard_name: values.standard_name,
          inspection_type: values.inspection_type,
          standard_type: values.standard_type,
          material_id: values.material_id || null,
          material_name: material?.material_name || '-',
          version_no: values.version,
          status: values.status,
          description: values.description,
        } : s))
        if (!(window as any).__standardItems) (window as any).__standardItems = {}
        (window as any).__standardItems[editing.standard_id] = standardItems
        message.success('检验标准编辑成功')
      } else {
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
        if (!(window as any).__standardItems) (window as any).__standardItems = {}
        (window as any).__standardItems[newStandard.standard_id] = standardItems
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

  const handleAddItem = () => {
    setItemEditing(null)
    itemForm.resetFields()
    itemForm.setFieldsValue({ category: '外观' })
    setItemModalVisible(true)
  }

  const handleEditItem = (record: any) => {
    setItemEditing(record)
    itemForm.setFieldsValue(record)
    setItemModalVisible(true)
  }

  const handleDeleteItem = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除检验项目"${record.item_name}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setStandardItems(prev => prev.filter((i: any) => i.id !== record.id))
        message.success('删除成功')
      },
    })
  }

  const handleItemSubmit = async () => {
    try {
      const values = await itemForm.validateFields()
      if (itemEditing) {
        setStandardItems(prev => prev.map((i: any) => i.id === itemEditing.id ? { ...i, ...values } : i))
        message.success('检验项目编辑成功')
      } else {
        const newItem = { id: 'it' + Date.now(), ...values }
        setStandardItems(prev => [...prev, newItem])
        message.success('检验项目新增成功')
      }
      setItemModalVisible(false)
    } catch (e) {
    }
  }

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
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === '开立' ? (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          ) : (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          )}
        </Space>
      )
    },
  ]

  const itemTableColumns = [
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    {
      title: '大类', dataIndex: 'category', key: 'category', width: 90,
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验方法', dataIndex: 'method', key: 'method' },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 140 },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
  ]

  const itemTableColumnsWithAction = [
    ...itemTableColumns,
    {
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditItem(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteItem(record)}>删除</Button>
        </Space>
      )
    },
  ]

  const disabledInput = <Input disabled placeholder="系统自动生成" />

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
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={viewMode ? '查看检验标准' : (editing ? '编辑检验标准' : '新增检验标准')}
        open={modalVisible}
        onOk={viewMode ? undefined : handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText={viewMode ? '关闭' : '取消'}
        footer={viewMode ? [<Button key="close" onClick={() => setModalVisible(false)}>关闭</Button>] : undefined}
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请输入标准编号' }]}>
                {viewMode ? disabledInput : <Input disabled placeholder="系统自动生成" />}
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={inspectionTypeOptions} onChange={handleInspectionTypeChange} disabled={viewMode} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="standard_type" label="标准类型" rules={[{ required: true, message: '请选择标准类型' }]}>
                <Select placeholder="请选择标准类型" options={standardTypeOptions} onChange={handleStandardTypeChange} disabled={viewMode} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="standard_name" label="标准名称" rules={[{ required: true, message: '请输入标准名称' }]}>
                <Input placeholder="请输入标准名称" disabled={viewMode} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="material_id" label="参照料品">
                <Select
                  placeholder="专用标准请参照料品(取料号前三位)"
                  options={materialOptions}
                  allowClear
                  onChange={handleMaterialChange}
                  showSearch
                  optionFilterProp="label"
                  disabled={viewMode}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                {viewMode ? disabledInput : <Input disabled placeholder="系统自动生成" />}
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} disabled={viewMode} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" rows={2} disabled={viewMode} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>检验项目列表</Typography.Title>
          {!viewMode && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>新增项目</Button>
          )}
        </div>
        <Table
          columns={viewMode ? itemTableColumns : itemTableColumnsWithAction}
          dataSource={standardItems}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: viewMode ? '暂无检验项目' : '暂无检验项目，点击右上角"新增项目"添加' }}
        />
      </Modal>
      <Modal
        title={itemEditing ? '编辑检验项目' : '新增检验项目'}
        open={itemModalVisible}
        onOk={handleItemSubmit}
        onCancel={() => setItemModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="category" label="项目大类" rules={[{ required: true, message: '请选择项目大类' }]}>
                <Select placeholder="请选择项目大类" options={categoryOptions} />
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
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="如 mm、N、%等，无则填 -" />
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
            <Col span={24}>
              <Form.Item name="sample_rule" label="抽样方式">
                <Input placeholder="如 AQL 0.65、每批5个等" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
