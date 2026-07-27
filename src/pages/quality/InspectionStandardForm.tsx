import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Space, Form, Input, Select, Typography, Row, Col, Modal, Breadcrumb, Card, InputNumber, message as antMsg, Alert, Tag, Popconfirm } from 'antd'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMessage } from '../../contexts/AppContext'
import { PlusOutlined, ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const categoryColor: Record<string, string> = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange', '微生物': 'green', '环境': 'geekblue' }

const inspectionTypeOptions = [
  { label: '首件', value: '首件' },
  { label: '制程', value: '制程' },
  { label: '成品', value: '成品' },
  { label: '其它', value: '其它' },
]

const standardTypeOptions = [
  { label: '通用标准', value: '通用标准' },
  { label: '专用标准', value: '专用标准' },
  { label: '临时标准', value: '临时标准' },
]

const categoryOptions = [
  { label: '外观', value: '外观' },
  { label: '尺寸', value: '尺寸' },
  { label: '性能', value: '性能' },
  { label: '理化', value: '理化' },
  { label: '微生物', value: '微生物' },
  { label: '环境', value: '环境' },
]

export default function InspectionStandardForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const [form] = Form.useForm()
  const [itemForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [currentItems, setCurrentItems] = useState<any[]>([])
  const [itemModalVisible, setItemModalVisible] = useState(false)
  const [itemEditing, setItemEditing] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [isGeneratingNo, setIsGeneratingNo] = useState(false)
  const message = useMessage()
  const generatingRef = useRef(false)

  const formInspectionType = Form.useWatch('inspection_type', form)
  const formStandardType = Form.useWatch('standard_type', form)

  const generateStandardNo = useCallback(async (it: string, st: string) => {
    if (!it || !st || generatingRef.current) return
    generatingRef.current = true
    setIsGeneratingNo(true)
    try {
      const res = await api.get('/basic/standards/generate/no', { params: { inspection_type: it, standard_type: st } })
      if (res.success !== false && res.data?.standard_no) {
        form.setFieldsValue({ standard_no: res.data.standard_no })
      }
    } catch (e) {
    } finally {
      setIsGeneratingNo(false)
      generatingRef.current = false
    }
  }, [form])

  useEffect(() => {
    if (!isEdit && formInspectionType && formStandardType) {
      generateStandardNo(formInspectionType, formStandardType)
    }
  }, [formInspectionType, formStandardType, isEdit, generateStandardNo])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get('/basic/materials', { params: { page_size: 500 } })
      const list = res.data?.list || res.data || []
      setMaterials(list.map((m: any) => ({
        label: `${m.material_code} - ${m.material_name}`,
        value: m.material_id,
        material_code: m.material_code,
        material_name: m.material_name,
      })))
    } catch (e) {
      setMaterials([])
    }
  }, [])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  useEffect(() => {
    if (isEdit) {
      setLoading(true)
      api.get(`/basic/standards/${id}`).then((res: any) => {
        const detail = res.data || {}
        form.setFieldsValue({
          standard_no: detail.standard_no,
          standard_name: detail.standard_name,
          inspection_type: detail.inspection_type,
          standard_type: detail.standard_type,
          material_id: detail.material_id || undefined,
          version_no: detail.version_no,
          status: detail.status,
          description: detail.description,
        })
        setCurrentItems(detail.items || [])
        setCurrentStatus(detail.status || '')
      }).catch(() => {
        message.error('加载数据失败')
      }).finally(() => setLoading(false))
    } else {
      form.resetFields()
      form.setFieldsValue({
        inspection_type: '首件',
        standard_type: '通用标准',
        status: '开立',
        version_no: 'V1',
      })
      setCurrentItems([])
      setCurrentStatus('开立')
    }
  }, [isEdit, id, form, message])

  const handleMaterialChange = (_val: any, option: any) => {
    if (option) {
      form.setFieldsValue({ material_name: option.material_name })
    } else {
      form.setFieldsValue({ material_name: undefined })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        items: currentItems,
      }
      setSaving(true)
      if (isEdit) {
        await api.put(`/basic/standards/${id}`, payload)
        message.success('编辑成功')
        navigate('/quality/standards')
      } else {
        const res = await api.post('/basic/standards', payload)
        if (res.success === false && res.message?.includes('已存在')) {
          if (formInspectionType && formStandardType) {
            await generateStandardNo(formInspectionType, formStandardType)
          }
          message.warning('标准编号已存在，已自动重新生成，请确认后再保存')
          setSaving(false)
          return
        }
        message.success('新增成功')
        navigate('/quality/standards')
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAudit = async () => {
    try {
      setAuditing(true)
      await api.put(`/basic/standards/${id}`, { status: '生效' })
      message.success('审核通过，标准已生效')
      setCurrentStatus('生效')
      form.setFieldsValue({ status: '生效' })
    } catch (e: any) {
      message.error(e?.message || '审核失败')
    } finally {
      setAuditing(false)
    }
  }

  const handleAddItem = () => {
    setItemEditing(null)
    itemForm.resetFields()
    itemForm.setFieldsValue({
      category: '外观',
      sort_order: currentItems.length + 1,
      defect_level: 'B类严重缺陷',
    })
    setItemModalVisible(true)
  }

  const handleEditItem = (record: any) => {
    setItemEditing(record)
    itemForm.setFieldsValue({
      item_name: record.item_name,
      category: record.category,
      method: record.method,
      sample_rule: record.sample_rule,
      standard_value: record.standard_value,
      unit: record.unit,
      sort_order: record.sort_order,
      defect_level: record.defect_level,
    })
    setItemModalVisible(true)
  }

  const handleDeleteItem = (record: any) => {
    setCurrentItems(prev => prev.filter((i: any) => i._key !== record._key && i.item_id !== record.item_id))
    antMsg.success('已删除')
  }

  const handleItemSubmit = async () => {
    try {
      const values = await itemForm.validateFields()
      if (itemEditing) {
        setCurrentItems(prev => prev.map((i: any) =>
          (i._key === itemEditing._key || i.item_id === itemEditing.item_id)
            ? { ...i, ...values }
            : i
        ))
      } else {
        setCurrentItems(prev => [...prev, { ...values, _key: 'new_' + Date.now() }])
      }
      setItemModalVisible(false)
    } catch (e) {
    }
  }

  const itemTableColumns = [
    {
      title: '项目大类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => <span style={{ color: categoryColor[v] || '#999' }}>{v}</span>
    },
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 180 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    {
      title: '缺陷等级', dataIndex: 'defect_level', key: 'defect_level', width: 120,
      render: (v: string) => {
        const colorMap: any = { 'A类致命缺陷': 'red', 'B类严重缺陷': 'orange', 'C类次要缺陷': 'blue' }
        return v ? <Tag color={colorMap[v] || 'default'}>{v}</Tag> : '-'
      }
    },
    { title: '检验方法', dataIndex: 'method', key: 'method' },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 140 },
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

  if (loading) return <div style={{ padding: 24 }}>加载中...</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb items={[
          { title: <Link to="/">首页</Link> },
          { title: <Link to="/quality/standards">检验标准</Link> },
          { title: isEdit ? '编辑标准' : '新增标准' },
        ]} />
      </div>

      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/standards')}>返回列表</Button>
            <Typography.Title level={4} style={{ margin: 0 }}>{isEdit ? '编辑检验标准' : '新增检验标准'}</Typography.Title>
          </Space>
        }
        extra={
          <Space>
            {isEdit && currentStatus === '开立' && (
              <Popconfirm title="确认审核通过？审核后标准状态将变为生效，不可再编辑" onConfirm={handleAudit} okText="确认审核" cancelText="取消">
                <Button type="primary" icon={<CheckCircleOutlined />} loading={auditing}>审核</Button>
              </Popconfirm>
            )}
            <Button onClick={() => navigate('/quality/standards')}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving || isGeneratingNo} onClick={handleSubmit}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="horizontal" className="compact-form" preserve={false} style={{ rowGap: 0 }} labelCol={{ flex: '72px', style: { width: 72, whiteSpace: 'nowrap', overflow: 'visible', flexShrink: 0, textAlign: 'right' } }} wrapperCol={{ flex: 1, style: { minWidth: 0, overflow: 'hidden' } }}>
          <style>{`
            .standard-header-form .ant-form-item {
              margin-bottom: 4px !important;
              flex-wrap: nowrap !important;
            }
            .standard-header-form .ant-form-item-row {
              flex-wrap: nowrap !important;
            }
            .standard-header-form .ant-form-item-label {
              white-space: nowrap !important;
              overflow: visible !important;
              flex-shrink: 0 !important;
              width: 72px !important;
              min-width: 72px !important;
            }
            .standard-header-form .ant-form-item-label > label {
              white-space: nowrap !important;
              overflow: visible !important;
            }
            .standard-header-form .ant-form-item-control {
              min-width: 0 !important;
              overflow: hidden !important;
            }
          `}</style>
          <Row wrap={false} style={{ display: 'flex', flexWrap: 'nowrap', marginLeft: -2, marginRight: -2 }} className="standard-header-form">
            <Col flex="none" style={{ padding: '0 2px', width: 220 }}>
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请选择检验类型和标准类型自动生成' }]}>
                <Input placeholder="自动生成" disabled size="small" style={{ width: 140 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 170 }}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择" options={inspectionTypeOptions} disabled={isEdit} size="small" style={{ width: 90 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 220 }}>
              <Form.Item name="standard_type" label="标准类型" rules={[{ required: true, message: '请选择标准类型' }]}>
                <Select placeholder="请选择" options={standardTypeOptions} disabled={isEdit} size="small" style={{ width: 140 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 140 }}>
              <Form.Item name="version_no" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input disabled={!isEdit} placeholder="V1" size="small" style={{ width: 60 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 160 }}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={[{ label: '开立', value: '开立' }, { label: '生效', value: '生效' }, { label: '失效', value: '失效' }]} disabled size="small" style={{ width: 84 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row wrap={false} style={{ display: 'flex', flexWrap: 'nowrap', marginLeft: -2, marginRight: -2 }} className="standard-header-form">
            <Col flex="none" style={{ padding: '0 2px', width: 500 }}>
              <Form.Item name="standard_name" label="标准名称" rules={[{ required: true, message: '请输入标准名称' }]}>
                <Input placeholder="请输入标准名称" size="small" style={{ width: 420 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row wrap={false} style={{ display: 'flex', flexWrap: 'nowrap', marginLeft: -2, marginRight: -2 }} className="standard-header-form">
            <Col flex="none" style={{ padding: '0 2px', width: 500 }}>
              <Form.Item name="material_id" label="参照料品">
                <Select
                  placeholder="请选择参照料品（可选）"
                  showSearch
                  allowClear
                  size="small"
                  style={{ width: 420 }}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={materials}
                  onChange={handleMaterialChange}
                />
              </Form.Item>
            </Col>
            <Col flex="auto" style={{ padding: '0 2px', minWidth: 0 }}>
              <Form.Item name="description" label="描述">
                <Input placeholder="请输入描述" size="small" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>检验项目列表</Typography.Title>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>新增项目</Button>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <ResizableTable
              tableKey="pages_quality_InspectionStandardForm_items"
              columns={itemTableColumns}
              dataSource={currentItems}
              rowKey={(r: any) => r._key || r.item_id}
              size="small"
              pagination={false}
              scroll={{ x: 1300 }}
              locale={{ emptyText: '暂无检验项目，点击右上角"新增项目"添加' }}
            />
          </div>
        </div>
      </Card>

      <Modal
        title={itemEditing ? '编辑检验项目' : '新增检验项目'}
        open={itemModalVisible}
        onOk={handleItemSubmit}
        onCancel={() => setItemModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="项目分类" rules={[{ required: true, message: '请选择项目分类' }]}>
                <Select placeholder="请选择项目分类" options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="standard_value" label="标准要求" rules={[{ required: true, message: '请输入标准要求' }]}>
                <Input placeholder="如 90.0±0.3、≥200 等" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="如 mm、N、%等，无则填 -" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_level" label="缺陷等级">
                <Select
                  placeholder="请选择缺陷等级"
                  allowClear
                  options={[
                    { label: 'A类致命缺陷', value: 'A类致命缺陷' },
                    { label: 'B类严重缺陷', value: 'B类严重缺陷' },
                    { label: 'C类次要缺陷', value: 'C类次要缺陷' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="sample_rule" label="抽样方式">
                <Input placeholder="如 AQL 0.65、每批5个等" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="method" label="检验方法">
                <Input placeholder="如 游标卡尺测量、拉力试验机等" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
