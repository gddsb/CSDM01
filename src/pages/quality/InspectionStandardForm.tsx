import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Space, Form, Input, Select, Typography, Row, Col, Modal, Breadcrumb, Card, message as antMsg, Alert, Tag, Popconfirm, Checkbox, InputNumber, Table, Divider } from 'antd'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { DeleteOutlined, PlusOutlined, ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useMessage } from '../../contexts/AppContext'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'
import type { ColumnsType } from 'antd/es/table'

const categoryColor: Record<string, string> = { '感官要求': 'blue', '尺寸要求': 'cyan', '理化性能要求': 'purple', '微生物检测要求': 'green', '环境检测要求': 'geekblue', '其它要求': 'default' }

const inspectionTypeOptions = [
  { label: '首件', value: '首件' },
  { label: '制程', value: '制程' },
  { label: '成品', value: '成品' },
  { label: '来料', value: '来料' },
  { label: '其它', value: '其它' },
]

const standardTypeOptions = [
  { label: '材料检验', value: '材料检验' },
  { label: '产品检验', value: '产品检验' },
  { label: '环境检验', value: '环境检验' },
  { label: '微生物检验标准', value: '微生物检验标准' },
  { label: '其它检验', value: '其它检验' },
]

const inspectionPlanOptions = [
  { label: '逐批计数抽样', value: '逐批计数抽样' },
  { label: '连续生产抽样', value: '连续生产抽样' },
  { label: '孤立批抽样', value: '孤立批抽样' },
  { label: '全检不抽样', value: '全检不抽样' },
]

const categoryOptions = [
  { label: '感官要求', value: '感官要求' },
  { label: '尺寸要求', value: '尺寸要求' },
  { label: '理化性能要求', value: '理化性能要求' },
  { label: '微生物检测要求', value: '微生物检测要求' },
  { label: '环境检测要求', value: '环境检测要求' },
  { label: '其它要求', value: '其它要求' },
]

const itemTypeOptions = [
  { label: '定性（仅判定 OK/NG）', value: 'qualitative' },
  { label: '定量（记录测量数值）', value: 'quantitative' },
]

const samplingPlanOptions = [
  { label: 'AQL抽样', value: 'AQL抽样' },
  { label: '按数量抽样', value: '按数量抽样' },
  { label: '固定数量抽样', value: '固定数量抽样' },
  { label: '全检', value: '全检' },
]

const aqlValueOptions = [
  { label: '0.65', value: 0.65 },
  { label: '1.0', value: 1.0 },
  { label: '2.5', value: 2.5 },
  { label: '4.0', value: 4.0 },
  { label: '6.5', value: 6.5 },
]

const defectLevelOptions = [
  { label: 'A类致命缺陷', value: 'A类致命缺陷' },
  { label: 'B类严重缺陷', value: 'B类严重缺陷' },
  { label: 'C类次要缺陷', value: 'C类次要缺陷' },
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
  const [effectiveDate, setEffectiveDate] = useState<string>('')
  const message = useMessage()
  const generatingRef = useRef(false)
  const readOnly = isEdit && currentStatus !== '开立'

  const formStandardType = Form.useWatch('standard_type', form)
  const watchItemType = Form.useWatch('item_type', itemForm)
  const watchSamplingPlan = Form.useWatch('sampling_plan', itemForm)

  const generateStandardNo = useCallback(async (st: string) => {
    if (!st || generatingRef.current) return
    generatingRef.current = true
    setIsGeneratingNo(true)
    try {
      const res = await api.get('/basic/standards/generate/no', { params: { standard_type: st } })
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
    if (!isEdit && formStandardType) {
      generateStandardNo(formStandardType)
    }
  }, [formStandardType, isEdit, generateStandardNo])

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
          standard_type: detail.standard_type,
          inspection_plan: detail.inspection_plan || undefined,
          material_id: detail.material_id || undefined,
          version_no: detail.version_no,
          status: detail.status,
          description: detail.description,
        })
        setEffectiveDate(detail.effective_date ? formatDateTime(detail.effective_date) : '')
        setCurrentItems(detail.items ? detail.items.map((it: any) => ({
          ...it,
          _key: it.item_id != null ? `item_${it.item_id}` : `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          inspection_types: it.inspection_types ? it.inspection_types.split(',').filter(Boolean) : [],
        })) : [])
        setCurrentStatus(detail.status || '')
      }).catch(() => {
        message.error('加载数据失败')
      }).finally(() => setLoading(false))
    } else {
      form.resetFields()
      form.setFieldsValue({
        standard_type: '材料检验',
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
          if (formStandardType) {
            await generateStandardNo(formStandardType)
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
      // 重新加载详情，获取后端自动设置的生效日期
      const res = await api.get(`/basic/standards/${id}`)
      const detail = res.data || {}
      form.setFieldsValue({ status: detail.status || '生效' })
      setEffectiveDate(detail.effective_date ? formatDateTime(detail.effective_date) : '')
      setCurrentStatus('生效')
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
      category: '感官要求',
      defect_level: 'B类严重缺陷',
      inspection_types: [],
      item_type: 'qualitative',
      sampling_plan: 'AQL抽样',
      sampling_ratio: null,
      aql_value: 2.5,
      // 分段抽样默认2段
      segments: [
        { max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 },
        { max_qty: 500, sample_count: 10, accept_number: 1, reject_number: 2 },
      ],
      fixed_count: 10,
      fixed_accept: 1,
      fixed_reject: 2,
    })
    setItemModalVisible(true)
  }

  const handleEditItem = (record: any) => {
    setItemEditing(record)
    // 解析 sampling_detail JSON
    let detail: any = {}
    if (record.sampling_detail) {
      try {
        detail = typeof record.sampling_detail === 'string' ? JSON.parse(record.sampling_detail) : record.sampling_detail
      } catch {
        detail = {}
      }
    }
    itemForm.setFieldsValue({
      item_name: record.item_name,
      category: record.category,
      method: record.method,
      standard_value: record.standard_value,
      unit: record.unit,
      defect_level: record.defect_level,
      inspection_types: record.inspection_types || [],
      item_type: record.item_type || 'qualitative',
      nominal_value: record.nominal_value ?? undefined,
      upper_limit: record.upper_limit ?? undefined,
      lower_limit: record.lower_limit ?? undefined,
      sampling_plan: record.sampling_plan || 'AQL抽样',
      sampling_ratio: record.sampling_ratio ?? null,
      aql_value: detail.aql_value ?? 2.5,
      segments: detail.segments || [{ max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 }],
      fixed_count: detail.fixed_count ?? 10,
      fixed_accept: detail.accept_number ?? 1,
      fixed_reject: detail.reject_number ?? 2,
    })
    setItemModalVisible(true)
  }

  const handleDeleteItem = (record: any) => {
    setCurrentItems(prev => prev.filter((i: any) => i._key !== record._key))
    antMsg.success('已删除')
  }

  const handleItemSubmit = async () => {
    try {
      const values = await itemForm.validateFields()
      // 构建 sampling_detail JSON
      const plan = values.sampling_plan || 'AQL抽样'
      let samplingDetail: any = {}
      if (plan === 'AQL抽样') {
        samplingDetail = { aql_value: values.aql_value || 2.5 }
      } else if (plan === '按数量抽样') {
        samplingDetail = { segments: values.segments || [] }
      } else if (plan === '固定数量抽样') {
        samplingDetail = {
          fixed_count: values.fixed_count || 1,
          accept_number: values.fixed_accept ?? 0,
          reject_number: values.fixed_reject ?? 1,
        }
      } else if (plan === '全检') {
        samplingDetail = {}
      }

      const itemData = {
        ...values,
        sampling_detail: JSON.stringify(samplingDetail),
        sampling_plan: plan,
        sampling_ratio: values.sampling_ratio ?? null,
      }
      // 移除临时字段
      delete itemData.aql_value
      delete itemData.segments
      delete itemData.fixed_count
      delete itemData.fixed_accept
      delete itemData.fixed_reject
      delete itemData.need_sample_count

      if (itemEditing) {
        setCurrentItems(prev => prev.map((i: any) =>
          i._key === itemEditing._key
            ? { ...i, ...itemData }
            : i
        ))
      } else {
        setCurrentItems(prev => [...prev, { ...itemData, _key: `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }])
      }
      setItemModalVisible(false)
    } catch (e) {
    }
  }

  const itemTableColumns: ColumnsType<any> = [
    {
      title: '项目大类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 160, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
    {
      title: '缺陷等级', dataIndex: 'defect_level', key: 'defect_level', width: 120,
      render: (v: string) => {
        const colorMap: any = { 'A类致命缺陷': 'red', 'B类严重缺陷': 'orange', 'C类次要缺陷': 'blue' }
        return v ? <Tag color={colorMap[v] || 'default'}>{v}</Tag> : '-'
      }
    },
    { title: '检验标准', dataIndex: 'standard_value', key: 'standard_value', width: 200, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
    {
      title: '抽样方案', dataIndex: 'sampling_plan', key: 'sampling_plan', width: 120,
      render: (v: string) => {
        if (!v) return '-'
        const colorMap: any = { 'AQL抽样': 'blue', '按数量抽样': 'green', '固定数量抽样': 'orange', '全检': 'purple' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    {
      title: '抽样比例', dataIndex: 'sampling_ratio', key: 'sampling_ratio', width: 90,
      render: (v: number | null) => v != null ? `${v}%` : '-'
    },
    {
      title: '操作', key: 'action', fixed: 'right', width: 120,
      render: (_: any, record: any) => readOnly ? '-' : (
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
            {!readOnly && <Button onClick={() => navigate('/quality/standards')}>取消</Button>}
            {!readOnly && <Button type="primary" icon={<SaveOutlined />} loading={saving || isGeneratingNo} onClick={handleSubmit}>保存</Button>}
            {readOnly && <Button onClick={() => navigate('/quality/standards')}>返回</Button>}
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
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请选择标准类型自动生成' }]}>
                <Input placeholder="自动生成" disabled size="small" style={{ width: 140 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 220 }}>
              <Form.Item name="standard_type" label="标准类型" rules={[{ required: true, message: '请选择标准类型' }]}>
                <Select placeholder="请选择" options={standardTypeOptions} disabled={isEdit} size="small" style={{ width: 140 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 140 }}>
              <Form.Item name="version_no" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input disabled size="small" style={{ width: 60 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 160 }}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={[{ label: '开立', value: '开立' }, { label: '生效', value: '生效' }, { label: '失效', value: '失效' }]} disabled size="small" style={{ width: 84 }} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 220 }}>
              <Form.Item label="生效日期">
                <Input value={effectiveDate || '—'} disabled size="small" style={{ width: 160 }} />
              </Form.Item>
            </Col>
          </Row>
          <Row wrap={false} style={{ display: 'flex', flexWrap: 'nowrap', marginLeft: -2, marginRight: -2 }} className="standard-header-form">
            <Col flex="none" style={{ padding: '0 2px', width: 500 }}>
              <Form.Item name="standard_name" label="标准名称" rules={[{ required: true, message: '请输入标准名称' }]}>
                <Input placeholder="请输入标准名称" size="small" style={{ width: 420 }} disabled={readOnly} />
              </Form.Item>
            </Col>
            <Col flex="none" style={{ padding: '0 2px', width: 260 }}>
              <Form.Item name="inspection_plan" label="检验方案">
                <Select placeholder="请选择检验方案" allowClear options={inspectionPlanOptions} disabled={readOnly} size="small" style={{ width: 170 }} />
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
                  disabled={readOnly}
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
                <Input placeholder="请输入描述" size="small" style={{ width: '100%' }} disabled={readOnly} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>检验项目列表</Typography.Title>
            {!readOnly && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>新增项目</Button>}
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <ResizableTable
              tableKey="pages_quality_InspectionStandardForm_items"
              columns={itemTableColumns}
              dataSource={currentItems}
              rowKey={(r: any) => r._key || r.item_id}
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
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
        width={760}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="category" label="项目分类" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="请选择" options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="defect_level" label="缺陷等级">
                <Select placeholder="请选择" allowClear options={defectLevelOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="inspection_types" label="检验类型" rules={[{ required: true, message: '请选择' }]}>
                <Checkbox.Group options={inspectionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unit" label="单位">
                <Input placeholder="如 mm、N、%等" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="item_type" label="项目类型" rules={[{ required: true, message: '请选择' }]}
                extra={watchItemType === 'quantitative' ? '录入多测量值并按上下限自动判定' : '每件样品判定 OK/NG'}>
                <Select placeholder="请选择" options={itemTypeOptions} />
              </Form.Item>
            </Col>
          </Row>

          {/* 定量项目的标称值/上下限 */}
          <Form.Item shouldUpdate={(p, c) => (p.item_type ?? 'qualitative') !== (c.item_type ?? 'qualitative')} noStyle>
            {() => itemForm.getFieldValue('item_type') === 'quantitative' ? (
              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item label="标称值" name="nominal_value" extra="可选">
                    <Input type="number" placeholder="如 90.0" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="upper_limit" label="上限" extra="超出判NG">
                    <Input type="number" placeholder="如 90.3" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="lower_limit" label="下限" extra="低于判NG">
                    <Input type="number" placeholder="如 89.7" />
                  </Form.Item>
                </Col>
                <Col span={6} />
              </Row>
            ) : null}
          </Form.Item>

          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="standard_value" label="检验要求" rules={[{ required: true, message: '请输入' }]}>
                <Input.TextArea placeholder="如 90.0±0.3、≥200 等" autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="method" label="检验方法">
                <Input.TextArea placeholder="如 游标卡尺测量等" autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 抽样方案配置 */}
          <Divider style={{ margin: '8px 0' }} orientation="left">抽样方案配置</Divider>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="sampling_plan" label="抽样方案" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="请选择" options={samplingPlanOptions} onChange={() => {
                  // 切换方案时清空配置
                  const plan = itemForm.getFieldValue('sampling_plan')
                  if (plan === 'AQL抽样') {
                    itemForm.setFieldsValue({ aql_value: 2.5 })
                  } else if (plan === '固定数量抽样') {
                    itemForm.setFieldsValue({ fixed_count: 10, fixed_accept: 1, fixed_reject: 2 })
                  } else if (plan === '按数量抽样') {
                    itemForm.setFieldsValue({ segments: [{ max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 }] })
                  }
                }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sampling_ratio" label="抽样比例(%)"
                extra="可选，按比例抽样时生效">
                <InputNumber min={0} max={100} placeholder="如 10" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8} />
          </Row>

          {/* AQL 抽样配置 */}
          {watchSamplingPlan === 'AQL抽样' && (
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="aql_value" label="AQL值" rules={[{ required: true, message: '请选择' }]}
                  extra="检验水平Ⅱ，根据到货数量查表">
                  <Select placeholder="请选择" options={aqlValueOptions} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Alert
                  type="info"
                  showIcon
                  message="AQL抽样说明"
                  description="根据 AQL 值和到货数量自动查表确定样本量(n)、允收值(Ac)和拒收值(Re)。判定：不合格数≤Ac → 合格，≥Re → 不合格"
                />
              </Col>
            </Row>
          )}

          {/* 按数量抽样配置 */}
          {watchSamplingPlan === '按数量抽样' && (
            <Form.Item label="分段数量配置（最多5段）" required>
              <Form.List name="segments" rules={[{
                validator: async (_, value) => {
                  if (!value || value.length === 0) return Promise.reject(new Error('至少添加1个分段'))
                  if (value.length > 5) return Promise.reject(new Error('最多5段'))
                  return Promise.resolve()
                },
              }]}>
                {(fields, { add, remove }, { errors }) => (
                  <>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={fields}
                      rowKey={(record: any) => record.key}
                      columns={[
                        {
                          title: '到货数量上限',
                          dataIndex: 'max_qty',
                          render: (_: any, record: any) => (
                            <Form.Item name={[record.name, 'max_qty']} rules={[{ required: true, message: '必填' }]} noStyle>
                              <InputNumber min={1} placeholder="如 100" style={{ width: '100%' }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '抽样数量',
                          dataIndex: 'sample_count',
                          render: (_: any, record: any) => (
                            <Form.Item name={[record.name, 'sample_count']} rules={[{ required: true, message: '必填' }]} noStyle>
                              <InputNumber min={1} placeholder="如 5" style={{ width: '100%' }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '允收值(Ac)',
                          dataIndex: 'accept_number',
                          render: (_: any, record: any) => (
                            <Form.Item name={[record.name, 'accept_number']} rules={[{ required: true, message: '必填' }]} noStyle>
                              <InputNumber min={0} placeholder="如 1" style={{ width: '100%' }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '拒收值(Re)',
                          dataIndex: 'reject_number',
                          render: (_: any, record: any) => (
                            <Form.Item name={[record.name, 'reject_number']} rules={[{ required: true, message: '必填' }]} noStyle>
                              <InputNumber min={1} placeholder="如 2" style={{ width: '100%' }} />
                            </Form.Item>
                          ),
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 60,
                          render: (_: any, record: any, idx: number) => (
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              disabled={fields.length <= 1}
                              onClick={() => remove(record.name)}
                            />
                          ),
                        },
                      ]}
                    />
                    <Button
                      type="dashed"
                      onClick={() => add({ max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 })}
                      style={{ width: '100%', marginTop: 8 }}
                      disabled={fields.length >= 5}
                    >
                      <PlusOutlined /> 添加分段
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}

          {/* 固定数量抽样配置 */}
          {watchSamplingPlan === '固定数量抽样' && (
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="fixed_count" label="抽样数量" rules={[{ required: true, message: '请输入' }]}>
                  <InputNumber min={1} placeholder="如 10" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="fixed_accept" label="允收值(Ac)" rules={[{ required: true, message: '请输入' }]}>
                  <InputNumber min={0} placeholder="如 1" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="fixed_reject" label="拒收值(Re)" rules={[{ required: true, message: '请输入' }]}>
                  <InputNumber min={1} placeholder="如 2" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* 全检 */}
          {watchSamplingPlan === '全检' && (
            <Alert
              type="info"
              showIcon
              message="全检说明"
              description="按来料数量100%全检，每件检验合格判OK/NG。任一件不合格则整批判不合格。无需设置允收/拒收值。"
            />
          )}
        </Form>
      </Modal>
    </div>
  )
}
