import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Row, Col, Switch, Drawer, Descriptions, Space, Popconfirm, Upload, Image, Checkbox } from 'antd'
import {
  ImportOutlined, ToolOutlined, DeleteOutlined,
  PlusOutlined, EyeOutlined,
  UploadOutlined, PictureOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

// 不良类型标签颜色映射
const typeColorMap = { '来料不良': 'blue', '制程不良': 'orange', '检验报废': 'red' }

// 检验类型选项
const categoryNameOptions = [
  { label: '来料检验类型', value: '来料检验类型' },
  { label: '制程检验类型', value: '制程检验类型' },
]

// 检验类型 → 不良类型联动映射
const defectTypeMap = {
  '来料检验类型': [{ label: '来料不良', value: '来料不良' }],
  '制程检验类型': [
    { label: '来料不良', value: '来料不良' },
    { label: '制程不良', value: '制程不良' },
    { label: '检验报废', value: '检验报废' },
  ],
}

// 安全获取数组的辅助函数
const toArray = (v) => Array.isArray(v) ? v : []

export default function DefectManagement() {
  const message = useMessage()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [viewImages, setViewImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 工序列表（用于关联工序下拉）
  const [processes, setProcesses] = useState([])

  // 不良图片
  const [defectImages, setDefectImages] = useState([])
  const [imageLoading, setImageLoading] = useState(false)

  // 当前选中检验类型（用于联动不良类型下拉）
  const [selectedCategory, setSelectedCategory] = useState(undefined)

  // 筛选条件
  const [filterCategory, setFilterCategory] = useState(undefined)
  const [filterType, setFilterType] = useState(undefined)
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterDisplay, setFilterDisplay] = useState([1, 0])
  const [filterStatus, setFilterStatus] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 30,
    category_name: undefined,
    defect_type: undefined,
    keyword: '',
    display: [1, 0],
    status: undefined,
  })

  const processOptions = processes.map(p => ({ label: `${p.process_code} ${p.process_name}`, value: p.process_id }))

  // 拉取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.category_name) params.category_name = query.category_name
        if (query.defect_type) params.defect_type = query.defect_type
        if (Array.isArray(query.display)) {
          if (query.display.length === 1) params.display = query.display[0]
        } else if (query.display !== undefined && query.display !== null && query.display !== '') {
          params.display = query.display
        }
        if (query.status !== undefined && query.status !== null && query.status !== '') params.status = query.status
        const res = await api.get('/basic/defect-types', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取不良分类列表失败')
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

  // 拉取工序列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/basic/processes', { params: { pageSize: 200 } })
        if (!cancelled) setProcesses(res.data || [])
      } catch (err) {
        if (!cancelled) setProcesses([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({
      ...q,
      page: 1,
      category_name: filterCategory,
      defect_type: filterType,
      keyword: filterKeyword,
      display: filterDisplay,
      status: filterStatus,
    }))
  }

  const handleReset = () => {
    setFilterCategory(undefined)
    setFilterType(undefined)
    setFilterKeyword('')
    setFilterDisplay([1, 0])
    setFilterStatus(undefined)
    setQuery(q => ({
      ...q,
      page: 1,
      category_name: undefined,
      defect_type: undefined,
      keyword: '',
      display: [1, 0],
      status: undefined,
    }))
  }

  // 检验类型筛选变化
  const handleFilterCategoryChange = (value) => {
    setFilterCategory(value)
  }

  // 拉取不良图片
  const fetchImages = async (defectId) => {
    if (!defectId) { setDefectImages([]); return }
    setImageLoading(true)
    try {
      const res = await api.get(`/basic/defect-types/${defectId}/images`)
      setDefectImages(res.data || [])
    } catch {
      setDefectImages([])
    } finally {
      setImageLoading(false)
    }
  }

  // 图片上传
  const handleImageUpload = async (options) => {
    const { file, onSuccess, onError } = options
    const formData = new FormData()
    formData.append('images', file)
    try {
      const res = await api.post(`/basic/defect-types/${editing.defect_id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      message.success(res.message || '上传成功')
      onSuccess && onSuccess(res)
      fetchImages(editing.defect_id)
    } catch (err) {
      message.error(err.message || '上传失败')
      onError && onError(err)
    }
  }

  // 删除图片
  const handleDeleteImage = async (imageId) => {
    try {
      await api.delete(`/basic/defect-types/${editing.defect_id}/images/${imageId}`)
      message.success('删除成功')
      fetchImages(editing.defect_id)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleAdd = async () => {
    setEditing(null)
    setDefectImages([])
    setSelectedCategory(undefined)
    setModalVisible(true)
    // 自动获取下一个编码
    try {
      const res = await api.get('/basic/defect-types/next-code')
      form.setFieldsValue({ defect_code: res.data?.defect_code })
    } catch {
      // 获取失败则手动输入
    }
  }

  const handleEdit = (record) => {
    setEditing(record)
    setSelectedCategory(record.category_name)
    setModalVisible(true)
    fetchImages(record.defect_id)
  }

  // Modal 打开动画结束后再设置表单值
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      const availableUnits = toArray(editing.available_units)
      const relatedProcesses = toArray(editing.related_processes)
      form.setFieldsValue({
        defect_code: editing.defect_code,
        category_name: editing.category_name,
        defect_type: editing.defect_type,
        defect_name: editing.defect_name,
        defect_unit: editing.defect_unit,
        available_units: availableUnits,
        sort_order: editing.sort_order,
        display: !!editing.display,
        status: editing.status === '启用' ? '启用' : '停用',
        related_processes: relatedProcesses,
        category_desc: editing.category_desc,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        display: true,
        status: '启用',
        sort_order: total + 1,
        available_units: ['小片', '罐', '大张'],
        related_processes: [],
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      // 新增时若编码未自动获取到，则实时获取
      let defectCode = values.defect_code
      if (!editing && !defectCode && values.defect_type) {
        try {
          const codeRes = await api.get('/basic/defect-types/next-code', {
            params: { defect_type: values.defect_type, category_name: values.category_name }
          })
          defectCode = codeRes.data?.defect_code
        } catch {
          // 获取失败继续，后端会再次校验
        }
      }
      const payload = {
        defect_code: defectCode,
        defect_name: values.defect_name,
        defect_type: values.defect_type,
        category_name: values.category_name || '',
        parent_id: 0,
        defect_unit: values.defect_unit,
        available_units: toArray(values.available_units),
        display: !!values.display,
        sort_order: values.sort_order,
        status: values.status,
        related_processes: toArray(values.related_processes),
        category_desc: values.category_desc || '',
      }
      if (editing) {
        const res = await api.put(`/basic/defect-types/${editing.defect_id}`, payload)
        message.success(res.message || '不良项编辑成功')
      } else {
        const res = await api.post('/basic/defect-types', payload)
        message.success(res.message || '不良项新增成功')
      }
      setModalVisible(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/basic/defect-types/${record.defect_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  // 检验类型变更时联动不良类型
  const handleCategoryChange = (value) => {
    setSelectedCategory(value)
    // 清空已选不良类型
    form.setFieldsValue('defect_type', undefined)
    // 来料检验类型不关联具体工序，清空并禁用
    if (value === '来料检验类型') {
      form.setFieldsValue('related_processes', [])
    }
    // 清空不良编码，待选择不良类型后再生成
    if (!editing) {
      form.setFieldsValue('defect_code', '')
    }
  }

  // 不良类型变更时重新生成编码
  const handleDefectTypeChange = async (value) => {
    if (editing) return
    if (!value) {
      form.setFieldsValue('defect_code', '')
      return
    }
    const categoryName = form.getFieldValue('category_name')
    try {
      const res = await api.get('/basic/defect-types/next-code', {
        params: { defect_type: value, category_name: categoryName }
      })
      form.setFieldsValue('defect_code', res.data?.defect_code)
    } catch {
      // 获取失败则手动输入
    }
  }

  // 当前可用的不良类型选项
  const currentDefectTypeOptions = selectedCategory ? (defectTypeMap[selectedCategory] || []) : []

  const columns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 110, fixed: 'left' },
    {
      title: '检验类型', dataIndex: 'category_name', key: 'category_name', width: 110,
      render: v => v ? <Tag color="purple">{v}</Tag> : '-',
    },
    {
      title: '不良类型', dataIndex: 'defect_type', key: 'defect_type', width: 100,
      render: v => v ? <Tag color={typeColorMap[v] || 'default'}>{v}</Tag> : '-',
    },
    { title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 120 },
    { title: '默认单位', dataIndex: 'defect_unit', key: 'defect_unit', width: 80 },
    {
      title: '是否默认', dataIndex: 'display', key: 'display', width: 90,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '关联工序', dataIndex: 'related_processes', key: 'related_processes', width: 160,
      render: v => {
        const arr = toArray(v)
        if (arr.length === 0) return <Tag color="default">全部工序</Tag>
        return (
          <Space size="small" wrap>
            {arr.map(pid => {
              const p = processes.find(proc => proc.process_id === pid)
              return p ? <Tag key={pid} color="cyan">{p.process_name}</Tag> : null
            })}
          </Space>
        )
      },
    },
    {
      title: '不良描述', dataIndex: 'category_desc', key: 'category_desc', width: 200,
      render: v => <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{v || '-'}</div>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90, fixed: 'right',
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 130, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={async () => {
            setViewRecord(record)
            try {
              const res = await api.get(`/basic/defect-images?defect_id=${record.defect_id}`)
              setViewImages(res.data || [])
            } catch (e) {
              setViewImages([])
            }
          }}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  // 筛选时不良类型下拉选项（所有不良类型，不联动）
  const filterTypeOptions = [
    { label: '来料不良', value: '来料不良' },
    { label: '制程不良', value: '制程不良' },
    { label: '检验报废', value: '检验报废' },
  ]

  // 即时查询：筛选条件变化时立即触发（跳过首次渲染）
  const isFirstFilter = useRef(true)
  useEffect(() => {
    if (isFirstFilter.current) {
      isFirstFilter.current = false
      return
    }
    handleSearch()
  }, [filterCategory, filterType, filterKeyword, filterDisplay, filterStatus])

  // 自定义筛选区
  const filterBar = (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 12, marginBottom: 12, padding: '0 2px' }}>
      <Select
        placeholder="检验类型"
        allowClear
        showSearch
        style={{ width: 200, flexShrink: 0 }}
        options={categoryNameOptions}
        value={filterCategory}
        onChange={handleFilterCategoryChange}
      />
      <Select
        placeholder="不良类型"
        allowClear
        showSearch
        style={{ width: 200, flexShrink: 0 }}
        options={filterTypeOptions}
        value={filterType}
        onChange={v => setFilterType(v)}
      />
      <Input
        placeholder="不良项目"
        allowClear
        style={{ width: 200, flexShrink: 0 }}
        value={filterKeyword}
        onChange={e => setFilterKeyword(e.target.value)}
        onPressEnter={handleSearch}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: '#666', fontSize: 14, whiteSpace: 'nowrap' }}>是否默认</span>
        <Checkbox.Group
          options={[{ label: '是', value: 1 }, { label: '否', value: 0 }]}
          value={filterDisplay}
          onChange={v => setFilterDisplay(v)}
        />
      </div>
      <Select
        placeholder="状态"
        allowClear
        style={{ width: 120, flexShrink: 0 }}
        options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]}
        value={filterStatus}
        onChange={v => setFilterStatus(v)}
      />
      <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
      <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
    </div>
  )

  // 统计数据
  const incomingCount = data.filter(d => d.defect_type === '来料不良').length
  const processCount = data.filter(d => d.defect_type === '制程不良').length
  const scrapCount = data.filter(d => d.defect_type === '检验报废').length

  const stats = [
    { label: '来料不良数', value: incomingCount, icon: <ImportOutlined />, color: '#2196F3' },
    { label: '制程不良数', value: processCount, icon: <ToolOutlined />, color: '#FF9800' },
    { label: '检验报废数', value: scrapCount, icon: <DeleteOutlined />, color: '#F44336' },
    { label: '总数', value: total, icon: <PlusOutlined />, color: '#4CAF50' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="不良分类"
        breadcrumbs="基础数据 / 不良分类"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增不良项</Button>,
            ]}
          />
        }
        table={
          <>
            {filterBar}
            <Table
              columns={columns}
              dataSource={data}
              rowKey="defect_id"
              size="small"
              loading={loading}
              scroll={{ x: 1250 }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </>
        }
      />
      <Modal
        title={editing ? '编辑不良项' : '新增不良项'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={820}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="defect_code" label="不良编码">
                <Input placeholder="系统自动生成" disabled={!editing} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category_name" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select
                  placeholder="请选择检验类型"
                  options={categoryNameOptions}
                  onChange={handleCategoryChange}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_type" label="不良类型" rules={[{ required: true, message: '请选择不良类型' }]}>
                <Select
                  placeholder="请先选择检验类型"
                  options={currentDefectTypeOptions}
                  disabled={!selectedCategory}
                  onChange={handleDefectTypeChange}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="defect_name" label="不良项目" rules={[{ required: true, message: '请输入不良项目' }]}>
                <Input placeholder="请输入不良项目" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="available_units" 
                label="可选单位" 
                rules={[{ required: true, message: '请至少选择一个可选单位' }]}
              >
                <Checkbox.Group
                  options={['小片', '罐', '大张']}
                  onChange={(checkedValues) => {
                    const currentDefault = form.getFieldValue('defect_unit')
                    if (currentDefault && !checkedValues.includes(currentDefault)) {
                      form.setFieldsValue({ defect_unit: undefined })
                    }
                    if (checkedValues.length === 1) {
                      form.setFieldsValue({ defect_unit: checkedValues[0] })
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.available_units !== cur.available_units}>
                {({ getFieldValue, setFieldsValue }) => {
                  const availableUnits = getFieldValue('available_units') || []
                  const defaultUnit = getFieldValue('defect_unit')
                  if (defaultUnit && !availableUnits.includes(defaultUnit)) {
                    setTimeout(() => setFieldsValue({ defect_unit: undefined }), 0)
                  }
                  return (
                    <Form.Item 
                      name="defect_unit"
                      label="默认单位" 
                      rules={[{ required: true, message: '请选择默认单位' }]}
                    >
                      <Select
                        placeholder="请选择默认单位"
                        options={availableUnits.map(u => ({ label: u, value: u }))}
                      />
                    </Form.Item>
                  )
                }}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="display" label="默认显示" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="related_processes" label="关联工序">
            <Select
              mode="multiple"
              placeholder="请选择关联工序（未选择则在所有工序可用）"
              options={processOptions}
              allowClear
              disabled={selectedCategory === '来料检验类'}
            />
          </Form.Item>
          {/* 不良图片上传 */}
          <Form.Item label="不良图片">
            {editing ? (
              <div>
                <Upload
                  listType="picture-card"
                  multiple
                  showUploadList={false}
                  customRequest={handleImageUpload}
                  accept="image/*"
                  style={{ width: 72, height: 72 }}
                >
                  <div style={{ fontSize: 12 }}>
                    <UploadOutlined style={{ fontSize: 18 }} />
                    <div style={{ marginTop: 2 }}>上传图片</div>
                  </div>
                </Upload>
                <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                  每种不良最多上传10张图片，图片自动命名为"不良编码+两位流水码"
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {imageLoading && <div style={{ color: '#999' }}>加载中...</div>}
                  {!imageLoading && defectImages.length === 0 && (
                    <div style={{ color: '#999' }}>暂无图片</div>
                  )}
                  {defectImages.map(img => (
                    <div key={img.image_id} style={{ position: 'relative', width: 104, height: 104, border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
                      <Image
                        src={img.image_url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt={img.image_name}
                      />
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', padding: 4 }}
                        onClick={() => handleDeleteImage(img.image_id)}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, padding: '2px 4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.image_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#999', padding: '12px 0' }}>
                <PictureOutlined /> 保存后可上传不良图片
              </div>
            )}
          </Form.Item>
          <Form.Item name="category_desc" label="不良描述">
            <Input.TextArea placeholder="请输入不良描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="查看不良项"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={520}
      >
        {viewRecord && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="不良编码">{viewRecord.defect_code}</Descriptions.Item>
            <Descriptions.Item label="不良项目">{viewRecord.defect_name}</Descriptions.Item>
            <Descriptions.Item label="检验类型">
              {viewRecord.category_name ? <Tag color="purple">{viewRecord.category_name}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="不良类型">
              <Tag color={typeColorMap[viewRecord.defect_type] || 'default'}>{viewRecord.defect_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="默认单位">{viewRecord.defect_unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="可选单位">
              {toArray(viewRecord.available_units).join('、') || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="默认显示">{viewRecord.display ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            <Descriptions.Item label="关联工序" span={2}>
              {(() => {
                const arr = toArray(viewRecord.related_processes)
                if (arr.length === 0) return <Tag color="default">全部工序</Tag>
                return arr.map(pid => {
                  const p = processes.find(proc => proc.process_id === pid)
                  return p ? <Tag key={pid} color="cyan">{p.process_name}</Tag> : null
                })
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={viewRecord.status === '启用' ? 'green' : 'red'}>{viewRecord.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="不良描述" span={2}>
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{viewRecord.category_desc || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
        {viewImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>不良图片（点击可放大）</div>
            <Image.PreviewGroup>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {viewImages.map(img => (
                  <Image
                    key={img.image_id}
                    width={88}
                    height={88}
                    src={img.image_url}
                    style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                  />
                ))}
              </div>
            </Image.PreviewGroup>
          </div>
        )}
      </Drawer>
    </>
  )
}
