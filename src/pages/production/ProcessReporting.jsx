import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  message, Drawer, Descriptions, Card, Divider, Popconfirm, DatePicker,
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined, PlusOutlined, DeleteOutlined, SaveOutlined,
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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [processDefects, setProcessDefects] = useState([])

  const [viewRecord, setViewRecord] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()
  const [addForm] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [woQuery, setWoQuery] = useState({ page: 1, pageSize: 1000, keyword: '', status: '开工' })
  const [woTotal, setWoTotal] = useState(0)
  const [selectedWOId, setSelectedWOId] = useState(null)

  const [statsData, setStatsData] = useState({
    workingWoCount: 0,
    totalInputQty: 0,
    totalOutputQty: 0,
  })

  const [addDefectModalOpen, setAddDefectModalOpen] = useState(false)
  const [addDefectType, setAddDefectType] = useState('')
  const [addDefectForm] = Form.useForm()

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, procRes, devRes] = await Promise.all([
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setDefectTypes(defectRes.data || [])
        setProcesses(procRes.data || [])
        setDevices(devRes.data || [])
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

  const fetchProcessDefects = useCallback(async (processId) => {
    if (!selectedWO || !processId) {
      setProcessDefects([])
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
      setProcessDefects(res.data || [])
    } catch (err) {
      message.error(err.message || '获取不良记录失败')
    }
  }, [selectedWO])

  useEffect(() => {
    fetchProcessDefects(selectedProcessId)
  }, [selectedProcessId, fetchProcessDefects])

  const processDefectItems = useMemo(() => {
    if (!selectedProcessId) return { process: [], material: [] }

    const defaultProcessDefects = defectTypes.filter(d =>
      d.category_name === '制程不良' && d.display === true
    )
    const defaultMaterialDefects = defectTypes.filter(d =>
      d.category_name === '来料不良' && d.display === true
    )

    const existingMap = {}
    processDefects.forEach(d => {
      existingMap[d.defect_name] = d
    })

    const processItems = defaultProcessDefects.map(d => ({
      defect_type_id: d.defect_id,
      defect_code: d.defect_code || '',
      defect_category: d.category_name,
      defect_name: d.defect_name,
      quantity: existingMap[d.defect_name]?.quantity || 0,
      unit: d.defect_unit || '',
      isDefault: true,
    }))

    const extraProcess = processDefects.filter(d =>
      d.defect_category === '制程不良' && !defaultProcessDefects.find(dp => dp.defect_name === d.defect_name)
    )
    extraProcess.forEach(d => {
      processItems.push({
        defect_type_id: d.defect_type_id,
        defect_code: d.defect_code || '',
        defect_category: d.defect_category,
        defect_name: d.defect_name,
        quantity: d.quantity,
        unit: d.unit || '',
        isDefault: false,
      })
    })

    const materialItems = defaultMaterialDefects.map(d => ({
      defect_type_id: d.defect_id,
      defect_code: d.defect_code || '',
      defect_category: d.category_name,
      defect_name: d.defect_name,
      quantity: existingMap[d.defect_name]?.quantity || 0,
      unit: d.defect_unit || '',
      isDefault: true,
    }))

    const extraMaterial = processDefects.filter(d =>
      d.defect_category === '来料不良' && !defaultMaterialDefects.find(dm => dm.defect_name === d.defect_name)
    )
    extraMaterial.forEach(d => {
      materialItems.push({
        defect_type_id: d.defect_type_id,
        defect_code: d.defect_code || '',
        defect_category: d.defect_category,
        defect_name: d.defect_name,
        quantity: d.quantity,
        unit: d.unit || '',
        isDefault: false,
      })
    })

    return { process: processItems, material: materialItems }
  }, [selectedProcessId, defectTypes, processDefects])

  const [processDefectData, setProcessDefectData] = useState([])
  const [materialDefectData, setMaterialDefectData] = useState([])

  useEffect(() => {
    setProcessDefectData(processDefectItems.process.map((item, idx) => ({ ...item, key: `p-${idx}` })))
    setMaterialDefectData(processDefectItems.material.map((item, idx) => ({ ...item, key: `m-${idx}` })))
  }, [processDefectItems])

  const processOptions = useMemo(() => {
    if (!selectedWO) return []
    return reports.map(r => ({
      label: r.process_name,
      value: r.process_id,
    }))
  }, [selectedWO, reports])

  const handleSelectWO = (record) => {
    setSelectedWO(record)
    setSelectedWOId(record?.work_order_id)
    setSelectedProcessId(null)
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

  const handleProcessQtyChange = (key, value) => {
    setProcessDefectData(prev =>
      prev.map(item => item.key === key ? { ...item, quantity: Number(value) || 0 } : item)
    )
  }

  const handleMaterialQtyChange = (key, value) => {
    setMaterialDefectData(prev =>
      prev.map(item => item.key === key ? { ...item, quantity: Number(value) || 0 } : item)
    )
  }

  const handleSaveDefects = async () => {
    if (!selectedWO || !selectedProcessId) return
    try {
      setSaving(true)
      const allItems = [
        ...processDefectData.filter(d => Number(d.quantity) > 0),
        ...materialDefectData.filter(d => Number(d.quantity) > 0),
      ]
      const payload = {
        work_order_id: selectedWO.work_order_id,
        process_id: selectedProcessId,
        items: allItems,
      }
      const res = await api.post('/production/process-defects/batch-save', payload)
      message.success(res.message || '保存成功')
      fetchProcessDefects(selectedProcessId)
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddDefect = (type) => {
    setAddDefectType(type)
    addDefectForm.resetFields()
    setAddDefectModalOpen(true)
  }

  const handleAddDefectSubmit = async () => {
    try {
      const values = await addDefectForm.validateFields()
      const defectType = defectTypes.find(d => d.defect_id === values.defect_type_id)
      const defectName = values.defect_name || defectType?.defect_name

      if (addDefectType === 'process') {
        const exists = processDefectData.find(item => item.defect_name === defectName)
        if (exists) {
          message.warning('同一分类下同一不良项目只允许一条记录')
          return
        }
      } else {
        const exists = materialDefectData.find(item => item.defect_name === defectName)
        if (exists) {
          message.warning('同一分类下同一不良项目只允许一条记录')
          return
        }
      }

      const newItem = {
        key: `${addDefectType}-${Date.now()}`,
        defect_type_id: values.defect_type_id,
        defect_code: defectType?.defect_code || '',
        defect_category: addDefectType === 'process' ? '制程不良' : '来料不良',
        defect_name: defectName,
        quantity: values.quantity || 0,
        unit: values.unit || defectType?.defect_unit || '',
        isDefault: false,
      }

      if (addDefectType === 'process') {
        setProcessDefectData(prev => [...prev, newItem])
      } else {
        setMaterialDefectData(prev => [...prev, newItem])
      }
      setAddDefectModalOpen(false)
      message.success('已添加，点击保存按钮生效')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleDeleteDefectItem = (key, type) => {
    if (type === 'process') {
      setProcessDefectData(prev => prev.filter(item => item.key !== key))
    } else {
      setMaterialDefectData(prev => prev.filter(item => item.key !== key))
    }
  }

  const reportColumns = [
    { title: '工单号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '投入数量', dataIndex: 'input_qty', key: 'input_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '合格数量', key: 'qualified_qty', width: 100, align: 'right',
      render: (_, r) => {
        const q = Number(r.input_qty || 0) - Number(r.defect_material || 0) - Number(r.defect_process || 0) - Number(r.defect_scrap || 0)
        return Math.max(0, q).toLocaleString()
      },
    },
    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '投入工时', dataIndex: 'report_time', key: 'input_hours', width: 100, render: () => '-' },
    { title: '开工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 100, render: v => v || '-' },
    {
      title: '开工时间', key: 'start_time', width: 160,
      render: (_, r) => r.report_time ? dayjs(r.report_time).format('YYYY-MM-DD HH:mm') : '-',
    },
    { title: '完工时间', key: 'finish_time', width: 160, render: () => '-' },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
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

  const woColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', width: 140 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={woStatusColorMap[v] || 'default'}>{v}</Tag>,
    },
  ]

  const processDefectColumns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 120, render: v => v || '-' },
    { title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 180 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80, render: v => v || '-' },
    {
      title: '不良数量', key: 'quantity', width: 120, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={val => handleProcessQtyChange(r.key, val)}
          style={{ width: '100%' }}
          disabled={selectedWO?.status !== '开工'}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => !r.isDefault && selectedWO?.status === '开工' && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDefectItem(r.key, 'process')}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const materialDefectColumns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 120, render: v => v || '-' },
    { title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 180 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80, render: v => v || '-' },
    {
      title: '不良数量', key: 'quantity', width: 120, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={val => handleMaterialQtyChange(r.key, val)}
          style={{ width: '100%' }}
          disabled={selectedWO?.status !== '开工'}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => !r.isDefault && selectedWO?.status === '开工' && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDefectItem(r.key, 'material')}>
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

  const defectTypeOptions = (category) => {
    const catName = category === 'process' ? '制程不良' : '来料不良'
    return defectTypes
      .filter(d => d.category_name === catName)
      .map(d => ({ label: d.defect_name, value: d.defect_id, unit: d.defect_unit }))
  }

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
                        style={{ width: 200 }}
                        value={selectedProcessId}
                        onChange={setSelectedProcessId}
                        options={processOptions}
                        allowClear
                      />
                      <span style={{ fontWeight: 600, marginLeft: 12 }}>工序报工</span>
                    </Space>
                  }
                  extra={
                    <Space>
                      {selectedWO?.status === '开工' && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                          添加报工
                        </Button>
                      )}
                      {selectedProcessId && selectedWO?.status === '开工' && (
                        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveDefects}>
                          保存不良记录
                        </Button>
                      )}
                    </Space>
                  }
                >
                  {selectedProcessId ? (
                    <Row gutter={16}>
                      <Col span={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#FA8C16' }}>制程不良记录</span>
                          {selectedWO?.status === '开工' && (
                            <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => handleAddDefect('process')}>
                              添加不良项目
                            </Button>
                          )}
                        </div>
                        <Table
                          columns={processDefectColumns}
                          dataSource={processDefectData}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          locale={{ emptyText: '暂无制程不良项目' }}
                        />
                      </Col>
                      <Col span={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#1890FF' }}>来料不良登记</span>
                          {selectedWO?.status === '开工' && (
                            <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => handleAddDefect('material')}>
                              添加不良项目
                            </Button>
                          )}
                        </div>
                        <Table
                          columns={materialDefectColumns}
                          dataSource={materialDefectData}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          locale={{ emptyText: '暂无来料不良项目' }}
                        />
                      </Col>
                    </Row>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      请先选择工序
                    </div>
                  )}
                </Card>

                <Card size="small" title="报工列表">
                  <Table
                    columns={reportColumns}
                    dataSource={reports}
                    rowKey="report_id"
                    size="small"
                    scroll={{ x: 1500 }}
                    pagination={false}
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

      <Modal
        title={addDefectType === 'process' ? '添加制程不良项目' : '添加来料不良项目'}
        open={addDefectModalOpen}
        onOk={handleAddDefectSubmit}
        onCancel={() => setAddDefectModalOpen(false)}
        okText="添加"
        cancelText="取消"
        width={480}
        destroyOnHidden
      >
        <Form form={addDefectForm} layout="vertical" className="compact-form">
          <Form.Item label="不良项目" name="defect_type_id" rules={[{ required: true, message: '请选择不良项目' }]}>
            <Select
              placeholder="请选择不良项目"
              showSearch
              optionFilterProp="label"
              options={defectTypeOptions(addDefectType)}
              onChange={(value) => {
                const d = defectTypes.find(dt => dt.defect_id === value)
                if (d) {
                  addDefectForm.setFieldsValue({
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
          <Form.Item label="单位" name="unit">
            <Input placeholder="如：个、件、小片等" />
          </Form.Item>
          <Form.Item label="数量" name="quantity">
            <InputNumber min={0} style={{ width: '100%' }} defaultValue={0} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
