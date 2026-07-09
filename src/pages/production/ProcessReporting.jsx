import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  message, Drawer, Descriptions, Card, Divider, Popconfirm, DatePicker, Tabs,
  Upload, Image,
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined, PlusOutlined, DeleteOutlined, SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const woStatusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '完工': 'success',
}

export default function ProcessReporting() {
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWO, setSelectedWO] = useState(null)
  const [reports, setReports] = useState([])
  const [defectTypes, setDefectTypes] = useState([])
  const [processes, setProcesses] = useState([])
  const [devices, setDevices] = useState([])
  const [materials, setMaterials] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [activeTab, setActiveTab] = useState('defect')

  const [processDefectList, setProcessDefectList] = useState([])
  const [materialDefectList, setMaterialDefectList] = useState([])
  const [processMaterialList, setProcessMaterialList] = useState([])

  const [viewRecord, setViewRecord] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()
  const [addForm] = Form.useForm()

  const [defectModalOpen, setDefectModalOpen] = useState(false)
  const [defectModalType, setDefectModalType] = useState('process')
  const [defectModalForm] = Form.useForm()

  const [materialModalOpen, setMaterialModalOpen] = useState(false)
  const [materialModalForm] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [woQuery, setWoQuery] = useState({ page: 1, pageSize: 1000, keyword: '', status: '开工' })
  const [woTotal, setWoTotal] = useState(0)
  const [selectedWOId, setSelectedWOId] = useState(null)

  const [statsData, setStatsData] = useState({
    workingWoCount: 0,
    totalInputQty: 0,
    totalOutputQty: 0,
  })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, procRes, devRes, matRes] = await Promise.all([
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setDefectTypes(defectRes.data || [])
        setProcesses(procRes.data || [])
        setDevices(devRes.data || [])
        setMaterials(matRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取基础数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: woQuery.page, pageSize: woQuery.pageSize }
        if (woQuery.keyword) params.keyword = woQuery.keyword
        if (woQuery.status) params.status = woQuery.status
        const res = await api.get('/production/work-orders', { params })
        if (cancelled) return
        const list = res.data || []
        setWorkOrders(list)
        setWoTotal(res.total || 0)

        const workingList = list.filter(w => w.status === '开工')
        const totalInput = workingList.reduce((sum, w) => sum + (Number(w.input_qty) || 0), 0)
        const totalOutput = workingList.reduce((sum, w) => sum + (Number(w.output_qty) || 0), 0)
        setStatsData({
          workingWoCount: workingList.length,
          totalInputQty: totalInput,
          totalOutputQty: totalOutput,
        })
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取工单列表失败')
          setWorkOrders([])
          setWoTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [woQuery])

  useEffect(() => {
    if (!selectedWO) return
    fetchReports(selectedWO.work_order_id)
    fetchLineProcesses(selectedWO.line_id)
  }, [selectedWO])

  const fetchReports = useCallback(async (woId) => {
    try {
      const res = await api.get('/production/process-reports', {
        params: { work_order_id: woId, page: 1, pageSize: 1000 },
      })
      setReports(res.data || [])
    } catch (err) {
      message.error(err.message || '获取报工记录失败')
    }
  }, [])

  const fetchLineProcesses = useCallback(async (lineId) => {
    if (!lineId) {
      setLineProcesses([])
      return
    }
    try {
      const res = await api.get(`/basic/production-lines/${lineId}/processes`)
      const procs = res.data || []
      const sorted = [...procs].sort((a, b) => {
        const sa = Number(a.sort_order) || 0
        const sb = Number(b.sort_order) || 0
        return sa - sb
      })
      setLineProcesses(sorted)
    } catch (err) {
      setLineProcesses([])
    }
  }, [])

  const fetchProcessDefects = useCallback(async (processId) => {
    if (!selectedWO || !processId) {
      setProcessDefectList([])
      setMaterialDefectList([])
      return
    }
    try {
      const res = await api.get('/production/process-defects', {
        params: {
          work_order_id: selectedWO.work_order_id,
          process_id: processId,
          page: 1,
          pageSize: 1000,
        },
      })
      const list = res.data || []
      setProcessDefectList(list.filter(d => d.defect_category === '制程不良'))
      setMaterialDefectList(list.filter(d => d.defect_category === '来料不良'))
    } catch (err) {
      message.error(err.message || '获取不良记录失败')
    }
  }, [selectedWO])

  const fetchProcessMaterials = useCallback(async (processId) => {
    if (!selectedWO || !processId) {
      setProcessMaterialList([])
      return
    }
    try {
      const res = await api.get('/production/process-materials', {
        params: {
          work_order_id: selectedWO.work_order_id,
          process_id: processId,
          page: 1,
          pageSize: 1000,
        },
      })
      setProcessMaterialList(res.data || [])
    } catch (err) {
      message.error(err.message || '获取物料记录失败')
    }
  }, [selectedWO])

  useEffect(() => {
    if (activeTab === 'defect') {
      fetchProcessDefects(selectedProcessId)
    } else if (activeTab === 'material') {
      fetchProcessMaterials(selectedProcessId)
    }
  }, [activeTab, selectedProcessId, fetchProcessDefects, fetchProcessMaterials])

  const processOptions = useMemo(() => {
    return lineProcesses.map(p => ({
      label: `${p.process_code || ''} ${p.process_name || ''}`.trim(),
      value: p.process_id,
    }))
  }, [lineProcesses])

  const handleSelectWO = (record) => {
    setSelectedWO(record)
    setSelectedWOId(record?.work_order_id)
    setSelectedProcessId(null)
    setActiveTab('defect')
  }

  const handleSearch = () => {
    setWoQuery(q => ({ ...q, page: 1, keyword: keywordInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setWoQuery(q => ({ ...q, page: 1, keyword: '' }))
  }

  const handleAdd = () => {
    if (!selectedWO) {
      message.warning('请先选择工单')
      return
    }
    addForm.resetFields()
    addForm.setFieldsValue({
      process_id: selectedProcessId || undefined,
      input_qty: 0,
      output_qty: 0,
      defect_material: 0,
      defect_process: 0,
      defect_scrap: 0,
      report_user_name: '',
      report_time: dayjs(),
    })
    setAddOpen(true)
  }

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields()
      setSaving(true)
      const payload = {
        work_order_id: selectedWO.work_order_id,
        process_id: values.process_id,
        input_qty: values.input_qty ?? 0,
        defect_material: values.defect_material ?? 0,
        defect_process: values.defect_process ?? 0,
        defect_scrap: values.defect_scrap ?? 0,
        output_qty: values.output_qty ?? 0,
        device_id: values.device_id || null,
        report_user_name: values.report_user_name || '',
        report_time: values.report_time ? values.report_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
      }
      const res = await api.post('/production/process-reports', payload)
      message.success(res.message || '报工已添加')
      setAddOpen(false)
      fetchReports(selectedWO.work_order_id)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      input_qty: r.input_qty ?? 0,
      defect_material: r.defect_material ?? 0,
      defect_process: r.defect_process ?? 0,
      defect_scrap: r.defect_scrap ?? 0,
      output_qty: r.output_qty ?? 0,
      device_id: r.device_id ?? undefined,
      report_user_name: r.report_user_name ?? '',
      report_time: r.report_time ? dayjs(r.report_time) : undefined,
    })
    setEditOpen(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        input_qty: values.input_qty ?? 0,
        defect_material: values.defect_material ?? 0,
        defect_process: values.defect_process ?? 0,
        defect_scrap: values.defect_scrap ?? 0,
        output_qty: values.output_qty ?? 0,
        device_id: values.device_id || null,
        report_user_name: values.report_user_name || '',
        report_time: values.report_time ? values.report_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
      }
      const res = await api.put(`/production/process-reports/${editing.report_id}`, payload)
      message.success(res.message || '报工记录已更新')
      setEditOpen(false)
      setEditing(null)
      fetchReports(selectedWO.work_order_id)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddDefect = (type) => {
    setDefectModalType(type)
    defectModalForm.resetFields()
    setDefectModalOpen(true)
  }

  const handleDefectModalSubmit = async () => {
    try {
      const values = await defectModalForm.validateFields()
      const defectType = defectTypes.find(d => d.defect_id === values.defect_type_id)
      const defectName = values.defect_name || defectType?.defect_name
      const currentList = defectModalType === 'process' ? processDefectList : materialDefectList
      const exists = currentList.find(d => d.defect_name === defectName)
      if (exists) {
        message.warning('同一工单同一不良项目只允许一条记录')
        return
      }
      setSaving(true)
      const category = defectModalType === 'process' ? '制程不良' : '来料不良'
      const payload = {
        work_order_id: selectedWO.work_order_id,
        process_id: selectedProcessId,
        defect_category: category,
        defect_name: defectName,
        defect_type_id: values.defect_type_id || null,
        quantity: Number(values.quantity) || 0,
        unit: values.unit || defectType?.defect_unit || '',
        defect_images: values.defect_images || [],
      }
      await api.post('/production/process-defects', payload)
      message.success('添加成功')
      setDefectModalOpen(false)
      fetchProcessDefects(selectedProcessId)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDefect = async (id) => {
    try {
      setSaving(true)
      await api.delete(`/production/process-defects/${id}`)
      message.success('删除成功')
      fetchProcessDefects(selectedProcessId)
    } catch (e) {
      message.error(e.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMaterial = () => {
    materialModalForm.resetFields()
    setMaterialModalOpen(true)
  }

  const handleMaterialModalSubmit = async () => {
    try {
      const values = await materialModalForm.validateFields()
      setSaving(true)
      const payload = {
        work_order_id: selectedWO.work_order_id,
        process_id: selectedProcessId,
        material_type: values.material_type || '投入物料',
        material_code: values.material_code || '',
        material_name: values.material_name || '',
        specification: values.specification || '',
        material_batch: values.material_batch || '',
        quantity: Number(values.quantity) || 0,
        label_images: values.label_images || [],
      }
      await api.post('/production/process-materials', payload)
      message.success('添加成功')
      setMaterialModalOpen(false)
      fetchProcessMaterials(selectedProcessId)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMaterial = async (id) => {
    try {
      setSaving(true)
      await api.delete(`/production/process-materials/${id}`)
      message.success('删除成功')
      fetchProcessMaterials(selectedProcessId)
    } catch (e) {
      message.error(e.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const reportTimes = useMemo(() => {
    const map = {}
    reports.forEach(r => {
      const date = r.report_time ? String(r.report_time).substring(0, 10).replace('T', ' ') : ''
      const key = `${date}_${r.process_id}`
      if (!map[key]) {
        map[key] = {
          key,
          date,
          process_id: r.process_id,
          process_name: r.process_name,
          total_input: 0,
          count: 0,
        }
      }
      map[key].total_input += Number(r.input_qty) || 0
      map[key].count += 1
    })
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  }, [reports])

  const reportColumns = [
    { title: '工单号', dataIndex: 'work_order_no', key: 'work_order_no', width: 140 },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '投入数量', dataIndex: 'input_qty', key: 'input_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '合格数量', key: 'qualified_qty', width: 100, align: 'right',
      render: (_, r) => {
        const q = Number(r.input_qty || 0) - Number(r.defect_material || 0) - Number(r.defect_process || 0) - Number(r.defect_scrap || 0)
        return Math.max(0, q).toLocaleString()
      },
    },
    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 90, render: v => v || '-' },
    {
      title: '报工时间', key: 'report_time', width: 140,
      render: (_, r) => r.report_time ? dayjs(r.report_time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)}>查看</Button>
          {selectedWO?.status === '开工' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  const reportTimeColumns = [
    { title: '序号', key: 'index', width: 60, render: (_, __, idx) => idx + 1 },
    { title: '工单号', key: 'wo', width: 140, render: () => selectedWO?.work_order_no || '-' },
    { title: '开工日期', dataIndex: 'date', key: 'date', width: 110 },
    { title: '投入数量', dataIndex: 'total_input', key: 'total_input', width: 110, align: 'right', render: v => Math.round(v || 0).toLocaleString() },
    { title: '报工次数', dataIndex: 'count', key: 'count', width: 90, align: 'right' },
  ]

  const defectTypeOptions = (category) => {
    const catName = category === 'process' ? '制程不良' : '来料不良'
    return defectTypes
      .filter(d => d.category_name === catName)
      .map(d => ({ label: d.defect_name, value: d.defect_id, unit: d.defect_unit, code: d.defect_code }))
  }

  const materialOptions = materials.map(m => ({
    label: `${m.material_code || ''} ${m.material_name || ''}`.trim(),
    value: m.material_id,
    material_code: m.material_code,
    material_name: m.material_name,
    specification: m.specification,
  }))

  const defectColumns = (type) => [
    { title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 160 },
    { title: '不良数量', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70, render: v => v || '-' },
    {
      title: '不良图片', key: 'images', width: 120,
      render: (_, r) => {
        const imgs = r.defect_images || []
        if (!imgs.length) return <span style={{ color: '#bbb' }}>无</span>
        return (
          <Image.PreviewGroup>
            <Space size={4}>
              {imgs.slice(0, 3).map((img, i) => (
                <Image key={i} src={img} width={32} height={32} style={{ objectFit: 'cover', borderRadius: 2 }} />
              ))}
            </Space>
          </Image.PreviewGroup>
        )
      },
    },
    {
      title: '操作', key: 'action', width: 70,
      render: (_, r) => selectedWO?.status === '开工' && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDefect(r.defect_id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const materialColumns = [
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130, render: v => v || '-' },
    { title: '品名', dataIndex: 'material_name', key: 'material_name', width: 160, render: v => v || '-' },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 140, render: v => v || '-' },
    { title: '批号', dataIndex: 'material_batch', key: 'material_batch', width: 120, render: v => v || '-' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '标签图片', key: 'images', width: 120,
      render: (_, r) => {
        const imgs = r.label_images || []
        if (!imgs.length) return <span style={{ color: '#bbb' }}>无</span>
        return (
          <Image.PreviewGroup>
            <Space size={4}>
              {imgs.slice(0, 3).map((img, i) => (
                <Image key={i} src={img} width={32} height={32} style={{ objectFit: 'cover', borderRadius: 2 }} />
              ))}
            </Space>
          </Image.PreviewGroup>
        )
      },
    },
    {
      title: '操作', key: 'action', width: 70,
      render: (_, r) => selectedWO?.status === '开工' && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteMaterial(r.material_id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const stats = [
    { label: '开工工单数量', value: statsData.workingWoCount, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '累计投入数量', value: statsData.totalInputQty.toLocaleString(), icon: <ProfileOutlined />, color: '#FF9800' },
    { label: '累计产出数量', value: statsData.totalOutputQty.toLocaleString(), icon: <ProfileOutlined />, color: '#4CAF50' },
  ]

  const dummyUpload = {
    beforeUpload: () => false,
  }

  const defectImagesNorm = (val) => Array.isArray(val) ? val : []
  const labelImagesNorm = (val) => Array.isArray(val) ? val : []

  const tabItems = [
    {
      key: 'defect',
      label: '工序不良记录',
      children: selectedProcessId ? (
        <Row gutter={16}>
          <Col span={12}>
            <Card
              size="small"
              title={<span style={{ color: '#FA8C16' }}>来料不良</span>}
              extra={selectedWO?.status === '开工' && (
                <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => handleAddDefect('material')}>
                  添加
                </Button>
              )}
              style={{ height: '100%' }}
            >
              <Table
                columns={defectColumns('material')}
                dataSource={materialDefectList}
                rowKey="defect_id"
                size="small"
                pagination={false}
                locale={{ emptyText: '暂无数来不良记录' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card
              size="small"
              title={<span style={{ color: '#F5222D' }}>制程不良</span>}
              extra={selectedWO?.status === '开工' && (
                <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => handleAddDefect('process')}>
                  添加
                </Button>
              )}
              style={{ height: '100%' }}
            >
              <Table
                columns={defectColumns('process')}
                dataSource={processDefectList}
                rowKey="defect_id"
                size="small"
                pagination={false}
                locale={{ emptyText: '暂无制程不良记录' }}
              />
            </Card>
          </Col>
        </Row>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>请先选择工序</div>
      ),
    },
    {
      key: 'material',
      label: '工序料品记录',
      children: selectedProcessId ? (
        <div>
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            {selectedWO?.status === '开工' && (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddMaterial}>
                添加物料
              </Button>
            )}
          </div>
          <Table
            columns={materialColumns}
            dataSource={processMaterialList}
            rowKey="material_id"
            size="small"
            scroll={{ x: 900 }}
            pagination={false}
            locale={{ emptyText: '暂无物料记录' }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>请先选择工序</div>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="生产报工"
        breadcrumbs="生产管理 / 生产报工"
        stats={stats}
        actions={
          <ActionButtons hasAdd={false} hasExport={false} />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col flex="360px">
                <Select
                  placeholder="请选择工单编号"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={selectedWOId}
                  onChange={(value) => {
                    const wo = workOrders.find(w => w.work_order_id === value)
                    if (wo) {
                      handleSelectWO(wo)
                    } else {
                      handleSelectWO(null)
                    }
                  }}
                  options={workOrders.map(w => ({
                    label: `${w.work_order_no} ${w.material_code || ''} ${w.material_name || ''} ${w.specification || ''}`.trim(),
                    value: w.work_order_id,
                  }))}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>

            {selectedWO && (
              <>
                <Divider orientation="left" style={{ margin: '12px 0' }}>
                  <span style={{ fontWeight: 600 }}>
                    工单：{selectedWO.work_order_no}
                    <Tag color={woStatusColorMap[selectedWO.status]} style={{ marginLeft: 8 }}>
                      {selectedWO.status}
                    </Tag>
                  </span>
                </Divider>

                <Card
                  size="small"
                  style={{ marginBottom: 12 }}
                  title={
                    <Space>
                      <Select
                        placeholder="请选择工序"
                        style={{ width: 220 }}
                        value={selectedProcessId}
                        onChange={setSelectedProcessId}
                        options={processOptions}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                      />
                      {selectedWO?.status === '开工' && selectedProcessId && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                          添加报工
                        </Button>
                      )}
                    </Space>
                  }
                >
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    size="small"
                  />
                </Card>

                <Card size="small" title="报工次数记录">
                  <Table
                    columns={reportTimeColumns}
                    dataSource={reportTimes}
                    rowKey="key"
                    size="small"
                    scroll={{ x: 700 }}
                    pagination={false}
                    locale={{ emptyText: '暂无报工记录' }}
                  />
                </Card>
              </>
            )}
          </div>
        }
      />

      <Modal
        title="编辑报工记录"
        open={editOpen}
        onOk={handleEditSubmit}
        confirmLoading={saving}
        onCancel={() => { setEditOpen(false); setEditing(null) }}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        {editing && (
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="工单编号">{editing.work_order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="工序">{editing.process_name || '-'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="投入数量" name="input_qty" rules={[{ required: true, message: '请输入投入数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入投入数量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产出数量" name="output_qty" rules={[{ required: true, message: '请输入产出数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入产出数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="来料不良" name="defect_material">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="制程不良" name="defect_process">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检验报废" name="defect_scrap">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="设备" name="device_id">
                <Select
                  placeholder="请选择设备"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={devices.map(d => ({ label: `${d.device_code || ''} ${d.device_name || ''}`.trim(), value: d.device_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="报工人员" name="report_user_name" rules={[{ required: true, message: '请输入报工人员' }]}>
                <Input placeholder="请输入报工人员姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="报工时间" name="report_time">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
              placeholder="选择报工时间"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加报工记录"
        open={addOpen}
        onOk={handleAddSubmit}
        confirmLoading={saving}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        {selectedWO && (
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="工单编号">{selectedWO.work_order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="产品名称">{selectedWO.material_name || '-'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={addForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="工序" name="process_id" rules={[{ required: true, message: '请选择工序' }]}>
                <Select
                  placeholder="请选择工序"
                  options={processOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="投入数量" name="input_qty" rules={[{ required: true, message: '请输入投入数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入投入数量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产出数量" name="output_qty" rules={[{ required: true, message: '请输入产出数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入产出数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="来料不良" name="defect_material">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="制程不良" name="defect_process">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检验报废" name="defect_scrap">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="设备" name="device_id">
                <Select
                  placeholder="请选择设备"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={devices.map(d => ({ label: `${d.device_code || ''} ${d.device_name || ''}`.trim(), value: d.device_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="报工人员" name="report_user_name" rules={[{ required: true, message: '请输入报工人员' }]}>
                <Input placeholder="请输入报工人员姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="报工时间" name="report_time">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
              placeholder="选择报工时间"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={defectModalType === 'process' ? '添加制程不良' : '添加来料不良'}
        open={defectModalOpen}
        onOk={handleDefectModalSubmit}
        confirmLoading={saving}
        onCancel={() => setDefectModalOpen(false)}
        okText="添加"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <Form form={defectModalForm} layout="vertical" className="compact-form" initialValues={{ quantity: 0, defect_images: [] }}>
          <Form.Item label="不良项目" name="defect_type_id" rules={[{ required: true, message: '请选择不良项目' }]}>
            <Select
              placeholder="请选择不良项目"
              showSearch
              optionFilterProp="label"
              options={defectTypeOptions(defectModalType)}
              onChange={(value) => {
                const d = defectTypes.find(dt => dt.defect_id === value)
                if (d) {
                  defectModalForm.setFieldsValue({
                    defect_name: d.defect_name,
                    unit: d.defect_unit,
                  })
                }
              }}
            />
          </Form.Item>
          <Form.Item label="不良名称" name="defect_name" rules={[{ required: true, message: '请输入不良名称' }]}>
            <Input placeholder="可手动输入" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="不良数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="单位" name="unit">
                <Input placeholder="如：个、件" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="不良图片" name="defect_images" getValueFromEvent={defectImagesNorm}>
            <Upload {...dummyUpload} listType="picture-card" multiple maxCount={6}>
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 4 }}>上传</div>
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加工序物料"
        open={materialModalOpen}
        onOk={handleMaterialModalSubmit}
        confirmLoading={saving}
        onCancel={() => setMaterialModalOpen(false)}
        okText="添加"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={materialModalForm} layout="vertical" className="compact-form" initialValues={{ quantity: 0, label_images: [] }}>
          <Form.Item label="料号" name="material_code">
            <Select
              placeholder="请选择料号"
              allowClear
              showSearch
              optionFilterProp="label"
              options={materialOptions}
              onChange={(_, option) => {
                if (option) {
                  materialModalForm.setFieldsValue({
                    material_code: option.material_code,
                    material_name: option.material_name,
                    specification: option.specification,
                  })
                }
              }}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="品名" name="material_name">
                <Input placeholder="请输入品名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="规格" name="specification">
                <Input placeholder="请输入规格" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="批号" name="material_batch">
                <Input placeholder="请输入批号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="标签图片" name="label_images" getValueFromEvent={labelImagesNorm}>
            <Upload {...dummyUpload} listType="picture-card" multiple maxCount={6}>
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 4 }}>上传</div>
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="报工详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={560}
      >
        {viewRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{viewRecord.work_order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="工序">{viewRecord.process_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="报工人员">{viewRecord.report_user_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="投入数量">{(viewRecord.input_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="来料不良">{(viewRecord.defect_material || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="制程不良">{(viewRecord.defect_process || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="检验报废">{(viewRecord.defect_scrap || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="产出数量">{(viewRecord.output_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="设备">{viewRecord.device_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="报工时间">{viewRecord.report_time ? dayjs(viewRecord.report_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
