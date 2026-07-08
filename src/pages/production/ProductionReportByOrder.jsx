import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Tag, Select, Row, Col, Input, InputNumber, DatePicker, Form, Button,
  Space, Tabs, message, Popconfirm, Card, Descriptions
} from 'antd'
import {
  ArrowLeftOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  FileTextOutlined, CloseCircleOutlined, ToolOutlined, PictureOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { TabPane } = Tabs
const { RangePicker } = DatePicker

const exceptionTypeOptions = [
  { label: '设备故障', value: '设备故障' },
  { label: '来料不良', value: '来料不良' },
  { label: '产品换型', value: '产品换型' },
  { label: '其它原因', value: '其它原因' },
]

const materialTypeOptionsByProcess = {
  '下料': ['马口铁素铁', '印花马口铁'],
  '检验': ['马口铁素铁', '印花马口铁'],
  '焊接': ['涂料', '稀释剂'],
  '烘干': ['涂料', '稀释剂'],
  '封口': ['底盖', '上盖'],
  '测漏': ['底盖', '上盖'],
  '跺': ['纸板', '覆膜纸板', '缠绕膜', 'PO袋', 'PE膜', '其它'],
  '包装': ['纸板', '覆膜纸板', '缠绕膜', 'PO袋', 'PE膜', '其它'],
}

export default function ProductionReportByOrder() {
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null)
  const [workOrder, setWorkOrder] = useState(null)
  const [processes, setProcesses] = useState([])
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])

  const [reports, setReports] = useState([])
  const [defects, setDefects] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [materials, setMaterials] = useState([])

  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(false)

  const [defectForm] = Form.useForm()
  const [exceptionForm] = Form.useForm()
  const [materialForm] = Form.useForm()

  const [defectFilters, setDefectFilters] = useState({ process_id: undefined, defect_category: undefined, defect_name: '' })
  const [exceptionFilters, setExceptionFilters] = useState({ exception_type: undefined, device_id: undefined, stop_type: '' })
  const [materialFilters, setMaterialFilters] = useState({ process_id: undefined, material_batch: '' })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, procRes, defectRes, deviceRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setProcesses(procRes.data || [])
        setDefectTypes(defectRes.data || [])
        setDevices(deviceRes.data || [])
      } catch (err) {
        message.error(err.message || '获取基础数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedWorkOrderId) return
    fetchWorkOrderData()
  }, [selectedWorkOrderId])

  const fetchWorkOrderData = useCallback(async () => {
    setLoading(true)
    try {
      const [woRes, reportRes, defectRes, exceptionRes, materialRes] = await Promise.all([
        api.get(`/production/work-orders/${selectedWorkOrderId}`),
        api.get('/production/process-reports', { params: { work_order_id: selectedWorkOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-defects', { params: { work_order_id: selectedWorkOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { work_order_id: selectedWorkOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { work_order_id: selectedWorkOrderId, page: 1, pageSize: 1000 } }),
      ])
      setWorkOrder(woRes.data)
      setReports(reportRes.data || [])
      setDefects(defectRes.data || [])
      setExceptions(exceptionRes.data || [])
      setMaterials(materialRes.data || [])
    } catch (err) {
      message.error(err.message || '获取报工数据失败')
    } finally {
      setLoading(false)
    }
  }, [selectedWorkOrderId])

  const refreshData = useCallback(() => {
    fetchWorkOrderData()
  }, [fetchWorkOrderData])

  const isWorkOrderClosed = workOrder?.status === '完工'

  const woStatusColor = { '开立': 'default', '开工': 'processing', '完工': 'success' }

  const workOrderOptions = useMemo(() => {
    return [...workOrders]
      .sort((a, b) => (b.work_order_no || '').localeCompare(a.work_order_no || ''))
      .map(o => ({
        value: o.work_order_id,
        label: (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}>
            <span style={{ width: 160 }}>{o.work_order_no}</span>
            <span style={{ width: 120, color: 'var(--text-secondary)' }}>{o.material_name || '-'}</span>
            <span><Tag color={woStatusColor[o.status] || 'default'} style={{ margin: 0 }}>{o.status}</Tag></span>
          </div>
        ),
      }))
  }, [workOrders])

  const processOptions = useMemo(() => {
    return processes.map(p => ({
      label: `${p.process_code || ''} ${p.process_name || ''}`.trim(),
      value: p.process_id,
    }))
  }, [processes])

  const defectCategoryOptions = useMemo(() => {
    const categories = [...new Set(defectTypes.map(d => d.category_name).filter(Boolean))]
    return categories.map(c => ({ label: c, value: c }))
  }, [defectTypes])

  const defectNameOptions = useMemo(() => {
    return defectTypes.map(d => ({
      label: d.defect_name,
      value: d.defect_id,
      category: d.category_name,
      unit: d.defect_unit,
      available_units: d.available_units,
    }))
  }, [defectTypes])

  const deviceOptions = useMemo(() => {
    return devices.map(d => ({
      label: `${d.device_code || ''} ${d.device_name || ''}`.trim(),
      value: d.device_id,
    }))
  }, [devices])

  const getMaterialTypeOptions = (processName) => {
    const type = materialTypeOptionsByProcess[processName] || []
    return type.map(t => ({ label: t, value: t }))
  }

  const getDefaultMaterialType = (processName) => {
    const types = materialTypeOptionsByProcess[processName] || []
    if (types.length === 0) return ''
    if (types.includes('印花马口铁')) return '印花马口铁'
    if (types.includes('稀释剂')) return '稀释剂'
    if (types.includes('上盖')) return '上盖'
    return types[0]
  }

  const summaryData = useMemo(() => {
    const processMap = {}
    processes.forEach(p => {
      processMap[p.process_id] = p
    })

    reports.forEach(r => {
      if (!processMap[r.process_id]) return
      if (!processMap[r.process_id].reportData) {
        processMap[r.process_id].reportData = {
          input_qty: 0,
          defect_material_small: 0,
          defect_material_cover: 0,
          defect_process_small: 0,
          defect_process_cover: 0,
          output_qty: 0,
        }
      }
      const data = processMap[r.process_id].reportData
      data.input_qty += Number(r.input_qty || 0)
      data.defect_material_small += Number(r.defect_material || 0)
      data.defect_process_small += Number(r.defect_process || 0)
      data.output_qty += Number(r.output_qty || 0)
    })

    defects.forEach(d => {
      if (!processMap[d.process_id]) return
      if (!processMap[d.process_id].reportData) {
        processMap[d.process_id].reportData = {
          input_qty: 0,
          defect_material_small: 0,
          defect_material_cover: 0,
          defect_process_small: 0,
          defect_process_cover: 0,
          output_qty: 0,
        }
      }
      const data = processMap[d.process_id].reportData
      if (d.defect_category === '来料不良') {
        if (d.unit === '小片') data.defect_material_small += Number(d.quantity || 0)
        else data.defect_material_cover += Number(d.quantity || 0)
      } else {
        if (d.unit === '小片') data.defect_process_small += Number(d.quantity || 0)
        else data.defect_process_cover += Number(d.quantity || 0)
      }
    })

    const sortedProcesses = [...processes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const result = []
    let firstInput = 0

    sortedProcesses.forEach((p, index) => {
      const reportData = p.reportData || {
        input_qty: 0,
        defect_material_small: 0,
        defect_material_cover: 0,
        defect_process_small: 0,
        defect_process_cover: 0,
        output_qty: 0,
      }

      let inputQty = reportData.input_qty
      if (index === 0 && inputQty === 0) {
        inputQty = materials
          .filter(m => m.process_id === p.process_id)
          .reduce((sum, m) => sum + Number(m.quantity || 0), 0)
      }
      if (index === 0) firstInput = inputQty

      if (index > 0) {
        const prevProcess = sortedProcesses[index - 1]
        const prevReportData = prevProcess.reportData || { output_qty: 0 }
        inputQty = prevReportData.output_qty
      }

      const defectTotal = reportData.defect_material_small + reportData.defect_material_cover +
        reportData.defect_process_small + reportData.defect_process_cover
      const qualified = Math.max(0, inputQty - defectTotal)

      result.push({
        process_id: p.process_id,
        process_code: p.process_code,
        process_name: p.process_name,
        input: inputQty,
        qualified: qualified,
        defect_total: defectTotal,
        defect_material_small: reportData.defect_material_small,
        defect_material_cover: reportData.defect_material_cover,
        defect_process_small: reportData.defect_process_small,
        defect_process_cover: reportData.defect_process_cover,
        defect_total_ratio: firstInput > 0 ? ((defectTotal / firstInput) * 100).toFixed(2) : '0.00',
        defect_material_ratio: firstInput > 0 ? (((reportData.defect_material_small + reportData.defect_material_cover) / firstInput) * 100).toFixed(2) : '0.00',
        defect_process_ratio: firstInput > 0 ? (((reportData.defect_process_small + reportData.defect_process_cover) / firstInput) * 100).toFixed(2) : '0.00',
      })
    })

    return result
  }, [processes, reports, defects, materials])

  const handleSubmitDefect = async () => {
    try {
      const values = await defectForm.validateFields()
      const defectType = defectTypes.find(d => d.defect_id === values.defect_type_id)
      const payload = {
        work_order_id: selectedWorkOrderId,
        process_id: values.process_id,
        defect_category: values.defect_category || (defectType?.category_name || ''),
        defect_name: values.defect_name,
        defect_type_id: values.defect_type_id,
        quantity: values.quantity,
        unit: values.unit,
      }
      await api.post('/production/process-defects', payload)
      message.success('不良记录已新增')
      defectForm.resetFields()
      refreshData()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleDeleteDefect = async (id) => {
    try {
      await api.delete(`/production/process-defects/${id}`)
      message.success('删除成功')
      refreshData()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleSubmitException = async () => {
    try {
      const values = await exceptionForm.validateFields()
      const payload = {
        work_order_id: selectedWorkOrderId,
        exception_type: values.exception_type,
        device_id: values.device_id,
        stop_type: values.stop_type,
        confirm_user: values.confirm_user,
        start_time: values.start_time?.format('YYYY-MM-DD HH:mm:ss'),
        end_time: values.end_time?.format('YYYY-MM-DD HH:mm:ss'),
        description: values.description,
      }
      await api.post('/production/process-exceptions', payload)
      message.success('异常工时记录已新增')
      exceptionForm.resetFields()
      refreshData()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleDeleteException = async (id) => {
    try {
      await api.delete(`/production/process-exceptions/${id}`)
      message.success('删除成功')
      refreshData()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleSubmitMaterial = async () => {
    try {
      const values = await materialForm.validateFields()
      const payload = {
        work_order_id: selectedWorkOrderId,
        process_id: values.process_id,
        material_type: values.material_type,
        material_batch: values.material_batch,
        quantity: values.quantity,
      }
      await api.post('/production/process-materials', payload)
      message.success('制程物料记录已新增')
      materialForm.resetFields()
      refreshData()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleDeleteMaterial = async (id) => {
    try {
      await api.delete(`/production/process-materials/${id}`)
      message.success('删除成功')
      refreshData()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const filteredDefects = useMemo(() => {
    return defects.filter(d => {
      if (defectFilters.process_id && d.process_id !== defectFilters.process_id) return false
      if (defectFilters.defect_category && d.defect_category !== defectFilters.defect_category) return false
      if (defectFilters.defect_name && !d.defect_name.includes(defectFilters.defect_name)) return false
      return true
    })
  }, [defects, defectFilters])

  const filteredExceptions = useMemo(() => {
    return exceptions.filter(e => {
      if (exceptionFilters.exception_type && e.exception_type !== exceptionFilters.exception_type) return false
      if (exceptionFilters.device_id && e.device_id !== exceptionFilters.device_id) return false
      if (exceptionFilters.stop_type && !e.stop_type?.includes(exceptionFilters.stop_type)) return false
      return true
    })
  }, [exceptions, exceptionFilters])

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (materialFilters.process_id && m.process_id !== materialFilters.process_id) return false
      if (materialFilters.material_batch && !m.material_batch?.includes(materialFilters.material_batch)) return false
      return true
    })
  }, [materials, materialFilters])

  const summaryColumns = [
    { title: '工序', key: 'process', width: 140, render: (_, r) => `${r.process_code || ''} ${r.process_name || ''}`.trim() },
    { title: '投入', key: 'input', width: 80, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '合格', key: 'qualified', width: 80, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '不良合计', key: 'defect_total', width: 90, align: 'right', render: v => <span style={{ color: '#FAAD14', fontWeight: 500 }}>{(v || 0).toLocaleString()}</span> },
    { title: '来料不良-小片', key: 'defect_material_small', width: 120, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '来料不良-带盖', key: 'defect_material_cover', width: 120, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '制程不良-小片', key: 'defect_process_small', width: 120, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '制程不良-带盖', key: 'defect_process_cover', width: 120, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '不良合计占比', key: 'defect_total_ratio', width: 100, align: 'right', render: v => <span style={{ color: '#FAAD14', fontWeight: 500 }}>{v}%</span> },
    { title: '来料不良占比', key: 'defect_material_ratio', width: 100, align: 'right', render: v => `${v}%` },
    { title: '制程不良占比', key: 'defect_process_ratio', width: 100, align: 'right', render: v => `${v}%` },
  ]

  const defectColumns = [
    { title: '工序', key: 'process', width: 140, render: (_, r) => `${r.process_code || ''} ${r.process_name || ''}`.trim() },
    { title: '不良分类', key: 'defect_category', width: 120, render: v => <Tag color={v === '来料不良' ? 'blue' : v === '制程不良' ? 'orange' : 'red'}>{v || '-'}</Tag> },
    { title: '不良名称', key: 'defect_name', width: 150 },
    { title: '数量', key: 'quantity', width: 80, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '单位', key: 'unit', width: 80 },
    { title: '登记时间', key: 'record_time', width: 160, render: v => v ? String(v).substring(0, 19).replace('T', ' ') : '-' },
    {
      title: '操作', key: 'action', width: 80, render: (_, r) => !isWorkOrderClosed && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDefect(r.defect_id)} okText="删除" cancelText="取消">
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ]

  const exceptionColumns = [
    { title: '异常类型', key: 'exception_type', width: 120, render: v => <Tag color={v === '设备故障' ? 'error' : v === '来料不良' ? 'blue' : v === '产品换型' ? 'orange' : 'default'}>{v || '-'}</Tag> },
    { title: '设备', key: 'device', width: 140, render: (_, r) => `${r.device_code || ''} ${r.device_name || ''}`.trim() || '-' },
    { title: '停机类型', key: 'stop_type', width: 120, render: v => v || '-' },
    { title: '开始', key: 'start_time', width: 160, render: v => v ? String(v).substring(0, 19).replace('T', ' ') : '-' },
    { title: '恢复', key: 'end_time', width: 160, render: v => v ? String(v).substring(0, 19).replace('T', ' ') : '-' },
    { title: '时长(min)', key: 'duration', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '确认人', key: 'confirm_user_name', width: 100, render: v => v || '-' },
    { title: '描述', key: 'description', width: 200, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 80, render: (_, r) => !isWorkOrderClosed && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteException(r.exception_id)} okText="删除" cancelText="取消">
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ]

  const materialColumns = [
    { title: '工序', key: 'process', width: 140, render: (_, r) => `${r.process_code || ''} ${r.process_name || ''}`.trim() },
    { title: '物料类型', key: 'material_type', width: 120 },
    { title: '物料批号', key: 'material_batch', width: 150, render: v => v || '-' },
    { title: '数量', key: 'quantity', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '登记时间', key: 'record_time', width: 160, render: v => v ? String(v).substring(0, 19).replace('T', ' ') : '-' },
    {
      title: '操作', key: 'action', width: 80, render: (_, r) => !isWorkOrderClosed && (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteMaterial(r.material_id)} okText="删除" cancelText="取消">
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ]

  if (!selectedWorkOrderId) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>选择工单</div>
        <Select
          showSearch
          placeholder="输入工单号或料品名称搜索"
          style={{ width: 600 }}
          value={selectedWorkOrderId}
          onChange={setSelectedWorkOrderId}
          filterOption={(input, option) => {
            const o = workOrders.find(w => w.work_order_id === option.value)
            if (!o) return false
            const search = input.toLowerCase()
            return (o.work_order_no || '').toLowerCase().includes(search) ||
              (o.material_name || '').toLowerCase().includes(search)
          }}
          options={workOrderOptions}
          popupMatchSelectWidth={600}
        />
        {workOrders.length > 0 && (
          <>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, marginTop: 24 }}>工单列表</div>
            <Table
              size="small"
              columns={[
                { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160 },
                { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 120 },
                { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 140 },
                { title: '计划数量', dataIndex: 'target_qty', key: 'target_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
                { title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
                { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 100 },
                { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={woStatusColor[v] || 'default'}>{v}</Tag> },
              ]}
              dataSource={workOrders}
              rowKey="work_order_id"
              pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
              scroll={{ x: 1000 }}
              onRow={record => ({ onClick: () => setSelectedWorkOrderId(record.work_order_id) })}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedWorkOrderId(null)}>返回</Button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 600, marginRight: 12 }}>{workOrder?.work_order_no || '-'}</span>
          <Tag color={woStatusColor[workOrder?.status] || 'default'}>{workOrder?.status || '-'}</Tag>
        </div>
        <Button icon={<ReloadOutlined />} onClick={refreshData}>刷新</Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={4} size="small" bordered>
          <Descriptions.Item label="工单号">{workOrder?.work_order_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="产品编号">{workOrder?.material_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="产品名称">{workOrder?.material_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="生产线">{workOrder?.line_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="计划数量">{(workOrder?.planned_qty || workOrder?.target_qty || 0).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="开工时间">{workOrder?.start_time ? String(workOrder.start_time).substring(0, 19).replace('T', ' ') : '-'}</Descriptions.Item>
          <Descriptions.Item label="完工时间">{workOrder?.finish_time ? String(workOrder.finish_time).substring(0, 19).replace('T', ' ') : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<><FileTextOutlined /> 工序报工明细</>} key="summary">
          <Table
            columns={summaryColumns}
            dataSource={summaryData}
            rowKey="process_id"
            size="small"
            loading={loading}
            pagination={false}
            scroll={{ x: 1300 }}
          />
        </TabPane>

        <TabPane tab={<><CloseCircleOutlined /> 工序不良登记</>} key="defect">
          {!isWorkOrderClosed && (
            <Card style={{ marginBottom: 16 }}>
              <Form form={defectForm} layout="horizontal" onFinish={handleSubmitDefect}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="process_id" label="工序" rules={[{ required: true, message: '请选择工序' }]}>
                      <Select placeholder="请选择工序" options={processOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="defect_category" label="不良分类">
                      <Select placeholder="请选择分类" options={defectCategoryOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="defect_type_id" label="不良项目">
                      <Select
                        placeholder="选择不良项目"
                        options={defectNameOptions}
                        onChange={(value) => {
                          const defect = defectTypes.find(d => d.defect_id === value)
                          if (defect) {
                            defectForm.setFieldsValue({
                              defect_category: defect.category_name,
                              defect_name: defect.defect_name,
                              unit: defect.defect_unit,
                            })
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="defect_name" label="不良名称" rules={[{ required: true, message: '请输入不良名称' }]}>
                      <Input placeholder="可手动输入" />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="数量" />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请选择单位' }]}>
                      <Select placeholder="选择单位" options={[{ label: '小片', value: '小片' }, { label: '罐', value: '罐' }]} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>新增</Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          )}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col flex="180px">
              <Select
                placeholder="工序筛选"
                allowClear
                style={{ width: '100%' }}
                options={processOptions}
                value={defectFilters.process_id}
                onChange={v => setDefectFilters(f => ({ ...f, process_id: v }))}
              />
            </Col>
            <Col flex="150px">
              <Select
                placeholder="不良分类"
                allowClear
                style={{ width: '100%' }}
                options={defectCategoryOptions}
                value={defectFilters.defect_category}
                onChange={v => setDefectFilters(f => ({ ...f, defect_category: v }))}
              />
            </Col>
            <Col flex="200px">
              <Input
                placeholder="不良名称搜索"
                allowClear
                value={defectFilters.defect_name}
                onChange={e => setDefectFilters(f => ({ ...f, defect_name: e.target.value }))}
              />
            </Col>
            <Col>
              <Button onClick={() => setDefectFilters({ process_id: undefined, defect_category: undefined, defect_name: '' })}>重置筛选</Button>
            </Col>
          </Row>
          <Table
            columns={defectColumns}
            dataSource={filteredDefects}
            rowKey="defect_id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `已筛选 ${filteredDefects.length}/${defects.length} 条` }}
            scroll={{ x: 1000 }}
          />
        </TabPane>

        <TabPane tab={<><ToolOutlined /> 异常工时登记</>} key="exception">
          {!isWorkOrderClosed && (
            <Card style={{ marginBottom: 16 }}>
              <Form form={exceptionForm} layout="horizontal" onFinish={handleSubmitException}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="exception_type" label="异常类型" rules={[{ required: true, message: '请选择异常类型' }]}>
                      <Select placeholder="请选择" options={exceptionTypeOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="device_id" label="设备编号">
                      <Select placeholder="请选择设备" options={deviceOptions} allowClear />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="stop_type" label="停机类型">
                      <Input placeholder="停机类型描述" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="confirm_user" label="确认人">
                      <Input placeholder="确认人姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                      <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="end_time" label="结束时间">
                      <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="description" label="问题描述">
                      <Input.TextArea rows={2} placeholder="请输入问题描述" />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>新增</Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          )}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col flex="180px">
              <Select
                placeholder="异常类型"
                allowClear
                style={{ width: '100%' }}
                options={exceptionTypeOptions}
                value={exceptionFilters.exception_type}
                onChange={v => setExceptionFilters(f => ({ ...f, exception_type: v }))}
              />
            </Col>
            <Col flex="180px">
              <Select
                placeholder="设备筛选"
                allowClear
                style={{ width: '100%' }}
                options={deviceOptions}
                value={exceptionFilters.device_id}
                onChange={v => setExceptionFilters(f => ({ ...f, device_id: v }))}
              />
            </Col>
            <Col flex="200px">
              <Input
                placeholder="停机类型搜索"
                allowClear
                value={exceptionFilters.stop_type}
                onChange={e => setExceptionFilters(f => ({ ...f, stop_type: e.target.value }))}
              />
            </Col>
            <Col>
              <Button onClick={() => setExceptionFilters({ exception_type: undefined, device_id: undefined, stop_type: '' })}>重置筛选</Button>
            </Col>
          </Row>
          <Table
            columns={exceptionColumns}
            dataSource={filteredExceptions}
            rowKey="exception_id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `已筛选 ${filteredExceptions.length}/${exceptions.length} 条` }}
            scroll={{ x: 1300 }}
          />
        </TabPane>

        <TabPane tab={<><PictureOutlined /> 制程信息登记</>} key="material">
          {!isWorkOrderClosed && (
            <Card style={{ marginBottom: 16 }}>
              <Form form={materialForm} layout="horizontal" onFinish={handleSubmitMaterial}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="process_id" label="工序" rules={[{ required: true, message: '请选择工序' }]}>
                      <Select
                        placeholder="请选择工序"
                        options={processOptions}
                        onChange={(value) => {
                          const process = processes.find(p => p.process_id === value)
                          if (process) {
                            materialForm.setFieldsValue({
                              material_type: getDefaultMaterialType(process.process_name),
                            })
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="material_type" label="物料类型" rules={[{ required: true, message: '请选择物料类型' }]}>
                      <Select
                        placeholder="请选择物料类型"
                        options={(() => {
                          const processId = materialForm.getFieldValue('process_id')
                          const process = processes.find(p => p.process_id === processId)
                          return getMaterialTypeOptions(process?.process_name || '')
                        })()}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="material_batch" label="物料批号">
                      <Input placeholder="非必填" />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="数量" />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>新增</Button>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          )}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col flex="180px">
              <Select
                placeholder="工序筛选"
                allowClear
                style={{ width: '100%' }}
                options={processOptions}
                value={materialFilters.process_id}
                onChange={v => setMaterialFilters(f => ({ ...f, process_id: v }))}
              />
            </Col>
            <Col flex="200px">
              <Input
                placeholder="批号搜索"
                allowClear
                value={materialFilters.material_batch}
                onChange={e => setMaterialFilters(f => ({ ...f, material_batch: e.target.value }))}
              />
            </Col>
            <Col>
              <Button onClick={() => setMaterialFilters({ process_id: undefined, material_batch: '' })}>重置筛选</Button>
            </Col>
          </Row>
          <Table
            columns={materialColumns}
            dataSource={filteredMaterials}
            rowKey="material_id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `已筛选 ${filteredMaterials.length}/${materials.length} 条` }}
            scroll={{ x: 900 }}
          />
        </TabPane>
      </Tabs>
    </div>
  )
}