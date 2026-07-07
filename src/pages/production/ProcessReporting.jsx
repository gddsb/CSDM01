import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  message, Drawer, Descriptions, DatePicker
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 工单状态颜色映射
const woStatusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '完工': 'success',
}

export default function ProcessReporting() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [processes, setProcesses] = useState([])
  const [devices, setDevices] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [processInput, setProcessInput] = useState(undefined)
  const [workOrderInput, setWorkOrderInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', process_id: undefined, work_order_id: undefined })

  // 获取报工列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.process_id) params.process_id = query.process_id
        if (query.work_order_id) params.work_order_id = query.work_order_id
        const res = await api.get('/production/process-reports', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取报工列表失败')
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

  // 获取工单、工序、设备
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, procRes, devRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setProcesses(procRes.data || [])
        setDevices(devRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const today = dayjs().format('YYYY-MM-DD')
  const todayCount = data.filter(r => r.report_time && String(r.report_time).startsWith(today)).length
  const totalOutput = data.reduce((s, r) => s + (Number(r.output_qty) || 0), 0)
  const totalDefect = data.reduce((s, r) => s + (Number(r.defect_material) || 0) + (Number(r.defect_process) || 0) + (Number(r.defect_scrap) || 0), 0)

  const stats = [
    { label: '总报工记录', value: total, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '今日报工', value: todayCount, icon: <ClockCircleOutlined />, color: '#00BCD4' },
    { label: '累计产量', value: totalOutput.toLocaleString(), icon: <ProfileOutlined />, color: '#FF9800' },
    { label: '累计不良', value: totalDefect.toLocaleString(), icon: <ProfileOutlined />, color: '#F44336' },
  ]

  // 编辑报工记录（仅工单"开工"状态可编辑）
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
      setSubmitting(true)
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
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, process_id: processInput, work_order_id: workOrderInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setProcessInput(undefined)
    setWorkOrderInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', process_id: undefined, work_order_id: undefined }))
  }

  // 判断报工记录是否可编辑（关联工单处于"开工"状态）
  const isEditable = (r) => r.work_order?.status === '开工'

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '报工人员', dataIndex: 'report_user_name', key: 'report_user_name', width: 100, render: v => v || '-' },
    { title: '投入数量', dataIndex: 'input_qty', key: 'input_qty', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '物料不良', dataIndex: 'defect_material', key: 'defect_material', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 80, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '产出数量', dataIndex: 'output_qty', key: 'output_qty', width: 90, align: 'right',
      render: v => {
        const val = v || 0
        return <Tag color={val > 0 ? 'success' : 'default'}>{val}</Tag>
      }
    },
    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 120, render: v => v || '-' },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time', width: 160, render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '工单状态', key: 'wo_status', width: 90, align: 'center',
      render: (_, r) => {
        const st = r.work_order?.status
        return st ? <Tag color={woStatusColorMap[st] || 'default'}>{st}</Tag> : '-'
      }
    },
    {
      title: '操作', key: 'action', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)}>查看</Button>
          {isEditable(r) && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工序报工"
        breadcrumbs="生产管理 / 工序报工"
        stats={stats}
        actions={
          <ActionButtons hasAdd={false} hasExport={false} />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col flex="200px">
                <Input
                  placeholder="搜索工单编号/工序/人员"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                />
              </Col>
              <Col flex="180px">
                <Select
                  placeholder="工单筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id }))}
                  value={workOrderInput}
                  onChange={setWorkOrderInput}
                />
              </Col>
              <Col flex="180px">
                <Select
                  placeholder="工序筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={processes.map(p => ({ label: `${p.process_code || ''} ${p.process_name || ''}`.trim(), value: p.process_id }))}
                  value={processInput}
                  onChange={setProcessInput}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="report_id"
              size="small"
              loading={loading}
              scroll={{ x: 1400 }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />

      {/* 编辑报工记录（仅工单"开工"状态可用） */}
      <Modal
        title="编辑报工记录"
        open={editOpen}
        onOk={handleEditSubmit}
        confirmLoading={submitting}
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
              <Form.Item label="物料不良" name="defect_material">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="制程不良" name="defect_process">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="报废" name="defect_scrap">
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

      {/* 查看报工详情（只读） */}
      <Drawer
        title="报工详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={560}
      >
        {viewRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{viewRecord.work_order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="工单状态">
              {viewRecord.work_order?.status ? <Tag color={woStatusColorMap[viewRecord.work_order.status] || 'default'}>{viewRecord.work_order.status}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工序">{viewRecord.process_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="报工人员">{viewRecord.report_user_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="投入数量">{(viewRecord.input_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="物料不良">{(viewRecord.defect_material || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="制程不良">{(viewRecord.defect_process || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="报废">{(viewRecord.defect_scrap || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="产出数量">{(viewRecord.output_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="设备">{viewRecord.device_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="报工时间">{viewRecord.report_time ? dayjs(viewRecord.report_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
