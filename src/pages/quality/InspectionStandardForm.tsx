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
      upper_limit: record.upper_limit ?? undefined,
      lower_limit: record.lower_limit ?? undefined,
      sampling_plan: record.sampling_plan || 'AQL抽样',
      aql_value: detail.aql_value ?? 2.5,
      segments: detail.segments || [{ max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 }],
      fixed_count: detail.fixed_count ?? 10,
      fixed_accept: detail.accept_number ?? 1,
      fixed_reject: detail.reject_number ?? 2,
    })
    setItemModalVisible(true)
  }

  // 解析抽样详情为显示文本（同步修复：兼容顶层字段和JSON对象）
  const renderSamplingSummary = (record: any): React.ReactNode => {
    if (!record) return '-'
    const plan = record.sampling_plan || ''
    if (!plan && !record.sampling_detail) return '-'
    let detail: any = {}
    if (record.sampling_detail) {
      try {
        detail = typeof record.sampling_detail === 'string' ? JSON.parse(record.sampling_detail) : { ...record.sampling_detail }
      } catch { detail = {} }
    }
    if (detail.accept_number === undefined || detail.accept_number === null) {
      if (record.accept_number !== undefined && record.accept_number !== null) detail.accept_number = record.accept_number
    }
    if (detail.reject_number === undefined || detail.reject_number === null) {
      if (record.reject_number !== undefined && record.reject_number !== null) detail.reject_number = record.reject_number
    }
    if (detail.fixed_count === undefined || detail.fixed_count === null) {
      if (record.need_sample_count !== undefined && record.need_sample_count !== null && plan === '固定数量抽样') detail.fixed_count = record.need_sample_count
      else if (record.sample_count !== undefined && record.sample_count !== null && plan === '固定数量抽样') detail.fixed_count = record.sample_count
    }
    const displayPlan = plan || 'AQL抽样'
    if (displayPlan === 'AQL抽样') {
      const v = detail.aql_value
      return <span>AQL: <strong>{v === null || v === undefined ? '-' : v}</strong></span>
    }
    if (displayPlan === '固定数量抽样') {
      const ac = detail.accept_number
      const re = detail.reject_number
      const cnt = detail.fixed_count
      return (
        <Space direction="vertical" size={0} style={{ lineHeight: 1.5 }}>
          <span>抽样数: <strong>{cnt === null || cnt === undefined ? '-' : cnt}</strong></span>
          {(ac !== undefined && ac !== null) || (re !== undefined && re !== null) ? (
            <span style={{ fontSize: 12, color: '#555' }}>Ac={ac === undefined || ac === null ? '-' : ac} / Re={re === undefined || re === null ? '-' : re}</span>
          ) : null}
        </Space>
      )
    }
    if (displayPlan === '按数量抽样') {
      const segments = (detail.segments || []) as any[]
      if (segments.length === 0) return '-'
      return (
        <div style={{ lineHeight: 1.5 }}>
          {segments.map((s, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              ≤{s.max_qty ?? '-'}: n=<strong>{s.sample_count ?? '-'}</strong> Ac={s.accept_number ?? 0} Re={s.reject_number ?? 1}
            </div>
          ))}
        </div>
      )
    }
    if (displayPlan === '全检') return <Tag color="purple">100% 全检</Tag>
    return plan || '-'
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
      }
      // 移除临时字段
      delete itemData.aql_value
      delete itemData.segments
      delete itemData.fixed_count
      delete itemData.fixed_accept
      delete itemData.fixed_reject
      delete itemData.need_sample_count
      delete itemData.nominal_value
      delete itemData.sampling_ratio

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
      title: '抽样方案', dataIndex: 'sampling_plan', key: 'sampling_plan', width: 110,
      render: (v: string) => {
        if (!v) return '-'
        const colorMap: any = { 'AQL抽样': 'blue', '按数量抽样': 'green', '固定数量抽样': 'orange', '全检': 'purple' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    {
      title: '抽样信息', key: 'sampling_info', width: 260,
      render: (_: any, record: any) => renderSamplingSummary(record)
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
            {!readOnly && <Button onClick={() => navigate('/quality/standards')}>取消</Button>}
            {!readOnly && <Button type="primary" icon={<SaveOutlined />} loading={saving || isGeneratingNo} onClick={handleSubmit}>保存</Button>}
            {isEdit && currentStatus === '开立' && (
              <Popconfirm title="确认审核通过？审核后标准状态将变为生效，不可再编辑" onConfirm={handleAudit} okText="确认审核" cancelText="取消">
                <Button type="primary" icon={<CheckCircleOutlined />} loading={auditing} style={{ background: '#52c41a', borderColor: '#52c41a' }}>审核</Button>
              </Popconfirm>
            )}
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
          {/* 第一行：项目分类、项目名称、缺陷等级、项目类型（确保四列完整显示） */}
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="category" label="项目分类" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="请选择" options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="defect_level" label="缺陷等级">
                <Select placeholder="请选择" allowClear options={defectLevelOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="item_type" label="项目类型" rules={[{ required: true, message: '请选择' }]}>
                <Select
                  placeholder="请选择"
                  options={itemTypeOptions}
                  optionRender={(opt: any) => (
                    <div style={{ padding: '2px 0' }}>
                      {opt.label}
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {opt.value === 'quantitative' ? '录入多测量值，按上下限自动判定' : '每件样品判定OK/NG'}
                      </div>
                    </div>
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 第二行：检验类型一行显示 + 单位（窄）+ 上限/下限（仅定量显示，且更窄） */}
          <Row gutter={12} align="top">
            {/* 检验类型：占 15 栅格（给复选框一行显示足够空间，禁止换行） */}
            <Col span={15}>
              <Form.Item
                name="inspection_types"
                label="检验类型"
                rules={[{ required: true, message: '请选择' }]}
                extra="适用的检验环节，可多选">
                <Checkbox.Group
                  options={inspectionTypeOptions}
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: '4px 16px',
                    paddingTop: 4,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                />
              </Form.Item>
            </Col>
            {/* 单位：占 3 栅格（缩窄，短文本足够） */}
            <Col span={watchItemType === 'quantitative' ? 3 : 9}>
              <Form.Item name="unit" label="单位" extra="mm / N / % 等">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            {/* 上限：仅"定量项目类型"时显示，占 3 栅格（缩窄，数字用） */}
            {watchItemType === 'quantitative' && (
              <Col span={3}>
                <Form.Item name="upper_limit" label="上限" extra="超出判不合格">
                  <Input type="number" placeholder="数值" />
                </Form.Item>
              </Col>
            )}
            {/* 下限：仅"定量项目类型"时显示，占 3 栅格（缩窄，数字用） */}
            {watchItemType === 'quantitative' && (
              <Col span={3}>
                <Form.Item name="lower_limit" label="下限" extra="低于判不合格">
                  <Input type="number" placeholder="数值" />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* 第三行：检验要求 */}
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="standard_value" label="检验要求" rules={[{ required: true, message: '请输入' }]}
                extra="示例：90.0±0.3、≥200MPa、外观无明显划痕、菌落总数≤100cfu/g">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 第四行：检验方法 */}
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="method" label="检验方法"
                extra="示例：游标卡尺测量 / 目视检查（1.0视力，正常光照，30cm距离）">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 抽样方案配置（调整说明Alert位于各方案行的右边，占span=剩余宽度） */}
          <Divider style={{ margin: '4px 0 12px 0' }} orientation="left">抽样方案配置</Divider>

          <Row gutter={12} align="top">
            <Col span={8}>
              <Form.Item name="sampling_plan" label="抽样方案" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="请选择" options={samplingPlanOptions} onChange={() => {
                  const plan = itemForm.getFieldValue('sampling_plan')
                  if (plan === 'AQL抽样') itemForm.setFieldsValue({ aql_value: 2.5 })
                  else if (plan === '固定数量抽样') itemForm.setFieldsValue({ fixed_count: 10, fixed_accept: 1, fixed_reject: 2 })
                  else if (plan === '按数量抽样') itemForm.setFieldsValue({ segments: [{ max_qty: 100, sample_count: 5, accept_number: 0, reject_number: 1 }] })
                }} />
              </Form.Item>
            </Col>
            {/* 方案说明位置：根据当前选中方案显示精简版说明（位于同一行右边） */}
            <Col span={16}>
              {watchSamplingPlan === 'AQL抽样' && (
                <Alert type="info" showIcon style={{ marginTop: 4, padding: '4px 12px', fontSize: 12 }}
                  message="AQL抽样：按 AQL 值和到货数量查表获取 n/Ac/Re；不合格数≤Ac 接收，≥Re 拒收" />
              )}
              {watchSamplingPlan === '固定数量抽样' && (
                <Alert type="info" showIcon style={{ marginTop: 4, padding: '4px 12px', fontSize: 12 }}
                  message="固定数量抽样：检验时抽取固定件数；按 Ac/Re 判定整批。示例：n=10, Ac=1, Re=2 → 1件不合格仍可接收" />
              )}
              {watchSamplingPlan === '按数量抽样' && (
                <Alert type="info" showIcon style={{ marginTop: 4, padding: '4px 12px', fontSize: 12 }}
                  message="按数量抽样：根据到货数量从分段表中取对应抽样数；最多5个分段；每段独立配置 n/Ac/Re" />
              )}
              {watchSamplingPlan === '全检' && (
                <Alert type="info" showIcon style={{ marginTop: 4, padding: '4px 12px', fontSize: 12 }}
                  message="全检：100% 逐件检验；任一件 NG 整批判不合格" />
              )}
            </Col>
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
        </Form>
      </Modal>
    </div>
  )
}
