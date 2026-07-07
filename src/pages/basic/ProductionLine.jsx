import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Row, Col, Space, Drawer, Descriptions, Popconfirm, Card } from 'antd'
import {
  DeploymentUnitOutlined, PlayCircleOutlined, ToolOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined, DeleteOutlined,
  UnorderedListOutlined, SettingOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const statusColorMap = { '运行中': 'green', '维护中': 'orange', '停用': 'red' }
const statusOptions = ['运行中', '维护中', '停用'].map(s => ({ label: s, value: s }))

export default function ProductionLine() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const [processOptions, setProcessOptions] = useState([])
  const [deviceOptions, setDeviceOptions] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [lineDevices, setLineDevices] = useState([])
  const [processModalVisible, setProcessModalVisible] = useState(false)
  const [deviceModalVisible, setDeviceModalVisible] = useState(false)
  const [processForm] = Form.useForm()
  const [deviceForm] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [workshopInput, setWorkshopInput] = useState(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined, workshop: undefined })

  const runningCount = data.filter(l => l.status === '运行中').length
  const maintenanceCount = data.filter(l => l.status === '维护中').length

  const stats = [
    { label: '总产线数', value: total, icon: <DeploymentUnitOutlined />, color: '#2196F3' },
    { label: '运行中', value: runningCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '维护中', value: maintenanceCount, icon: <ToolOutlined />, color: '#FF9800' },
  ]

  const workshopOptions = [...new Set(data.map(l => l.workshop).filter(Boolean))].map(w => ({ label: w, value: w }))

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        if (query.workshop) params.workshop = query.workshop
        const res = await api.get('/basic/production-lines', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取产线列表失败')
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

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [processRes, deviceRes] = await Promise.all([
          api.get('/basic/processes', { params: { pageSize: 100 } }),
          api.get('/basic/devices', { params: { pageSize: 100 } }),
        ])
        setProcessOptions((processRes.data || []).map(p => ({
          label: `${p.process_code} - ${p.process_name}`,
          value: p.process_id,
          code: p.process_code,
          name: p.process_name,
        })))
        setDeviceOptions((deviceRes.data || []).map(d => ({
          label: `${d.device_code} - ${d.device_name}`,
          value: d.device_id,
          code: d.device_code,
          name: d.device_name,
          model: d.device_model,
        })))
      } catch (err) {
        console.error('获取选项数据失败:', err)
      }
    }
    fetchOptions()
  }, [])

  const fetchLineRelations = async (lineId) => {
    try {
      const [processesRes, devicesRes] = await Promise.all([
        api.get(`/basic/production-lines/${lineId}/processes`),
        api.get(`/basic/production-lines/${lineId}/devices`),
      ])
      setLineProcesses(processesRes.data || [])
      setLineDevices(devicesRes.data || [])
    } catch (err) {
      console.error('获取产线关联数据失败:', err)
    }
  }

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, workshop: workshopInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setWorkshopInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, workshop: undefined }))
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleView = (record) => {
    setViewRecord(record)
    fetchLineRelations(record.line_id)
  }

  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        line_code: editing.line_code,
        line_name: editing.line_name,
        workshop: editing.workshop,
        line_leader: editing.line_leader,
        sort_order: editing.sort_order,
        status: editing.status,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: '运行中', sort_order: total + 1 })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        const res = await api.put(`/basic/production-lines/${editing.line_id}`, payload)
        message.success(res.message || '产线编辑成功')
      } else {
        const res = await api.post('/basic/production-lines', payload)
        message.success(res.message || '产线新增成功')
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
      const res = await api.delete(`/basic/production-lines/${record.line_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleAddProcess = async () => {
    try {
      const values = await processForm.validateFields()
      await api.post(`/basic/production-lines/${viewRecord.line_id}/processes`, {
        process_id: values.process_id,
        sort_order: lineProcesses.length,
      })
      message.success('关联成功')
      setProcessModalVisible(false)
      processForm.resetFields()
      fetchLineRelations(viewRecord.line_id)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleRemoveProcess = async (processId) => {
    try {
      await api.delete(`/basic/production-lines/${viewRecord.line_id}/processes/${processId}`)
      message.success('移除成功')
      fetchLineRelations(viewRecord.line_id)
    } catch (err) {
      message.error(err.message || '操作失败')
    }
  }

  const handleAddDevice = async () => {
    try {
      const values = await deviceForm.validateFields()
      await api.post(`/basic/production-lines/${viewRecord.line_id}/devices`, {
        device_id: values.device_id,
        process_id: values.process_id || null,
        sort_order: lineDevices.length,
      })
      message.success('关联成功')
      setDeviceModalVisible(false)
      deviceForm.resetFields()
      fetchLineRelations(viewRecord.line_id)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleRemoveDevice = async (deviceId) => {
    try {
      await api.delete(`/basic/production-lines/${viewRecord.line_id}/devices/${deviceId}`)
      message.success('移除成功')
      fetchLineRelations(viewRecord.line_id)
    } catch (err) {
      message.error(err.message || '操作失败')
    }
  }

  const columns = [
    { title: '产线编号', dataIndex: 'line_code', key: 'line_code', width: 110 },
    { title: '产线名称', dataIndex: 'line_name', key: 'line_name', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: '所属车间', dataIndex: 'workshop', key: 'workshop', width: 110 },
    { title: '负责人', dataIndex: 'line_leader', key: 'line_leader', width: 100 },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该产线？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const processColumns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '工序编号', dataIndex: 'process_code', key: 'process_code', width: 100 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name', width: 120 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认移除该工序？"
          onConfirm={() => handleRemoveProcess(record.process_id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const deviceColumns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 100 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 120 },
    { title: '设备型号', dataIndex: 'device_model', key: 'device_model', width: 120 },
    { title: '关联工序', dataIndex: 'process_name', key: 'process_name', width: 120, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认移除该设备？"
          onConfirm={() => handleRemoveDevice(record.device_id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索产线编号/名称', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '运行中', value: 1 }, { label: '维护中', value: 2 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
    { type: 'select', placeholder: '车间筛选', options: workshopOptions, col: { span: 6 }, value: workshopInput, onChange: v => setWorkshopInput(v) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="产线管理"
        breadcrumbs="基础数据 / 产线管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增产线</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="line_id"
            size="small"
            loading={loading}
            pagination={{
              current: query.page,
              pageSize: query.pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
            }}
          />
        }
      />
      <Modal
        title={editing ? '编辑产线' : '新增产线'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="line_code" label="产线编号" rules={[{ required: true, message: '请输入产线编号' }]}>
                <Input placeholder="如：LINE-A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="line_name" label="产线名称" rules={[{ required: true, message: '请输入产线名称' }]}>
                <Input placeholder="如：A线" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="workshop" label="所属车间" rules={[{ required: true, message: '请输入车间' }]}>
                <Input placeholder="请输入车间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="line_leader" label="负责人">
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title="产线详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={720}
      >
        {viewRecord && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 20 }}>
              <Descriptions.Item label="产线编号">{viewRecord.line_code}</Descriptions.Item>
              <Descriptions.Item label="产线名称">{viewRecord.line_name}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColorMap[viewRecord.status]}>{viewRecord.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="所属车间">{viewRecord.workshop || '-'}</Descriptions.Item>
              <Descriptions.Item label="负责人">{viewRecord.line_leader || '-'}</Descriptions.Item>
              <Descriptions.Item label="排序号">{viewRecord.sort_order ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Card
              title={
                <Space>
                  <UnorderedListOutlined />
                  <span>关联工序</span>
                </Space>
              }
              extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setProcessModalVisible(true)}>添加工序</Button>}
              style={{ marginBottom: 16 }}
            >
              <Table
                columns={processColumns}
                dataSource={lineProcesses}
                rowKey="id"
                size="small"
                pagination={false}
                bordered
                rowClassName="no-hover"
              />
            </Card>

            <Card
              title={
                <Space>
                  <SettingOutlined />
                  <span>关联设备</span>
                </Space>
              }
              extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setDeviceModalVisible(true)}>添加设备</Button>}
            >
              <Table
                columns={deviceColumns}
                dataSource={lineDevices}
                rowKey="id"
                size="small"
                pagination={false}
                bordered
                rowClassName="no-hover"
              />
            </Card>
          </div>
        )}
      </Drawer>
      <Modal
        title="添加关联工序"
        open={processModalVisible}
        onOk={handleAddProcess}
        onCancel={() => setProcessModalVisible(false)}
        okText="确认"
        cancelText="取消"
        width={480}
      >
        <Form form={processForm} layout="vertical">
          <Form.Item name="process_id" label="工序" rules={[{ required: true, message: '请选择工序' }]}>
            <Select
              placeholder="请选择工序"
              options={processOptions}
              showSearch
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="添加关联设备"
        open={deviceModalVisible}
        onOk={handleAddDevice}
        onCancel={() => setDeviceModalVisible(false)}
        okText="确认"
        cancelText="取消"
        width={480}
      >
        <Form form={deviceForm} layout="vertical">
          <Form.Item name="device_id" label="设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select
              placeholder="请选择设备"
              options={deviceOptions}
              showSearch
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="process_id" label="关联工序（可选）">
            <Select
              placeholder="请选择工序（可选）"
              options={processOptions}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}