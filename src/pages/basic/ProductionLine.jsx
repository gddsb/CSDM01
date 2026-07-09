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
  const [selectedProcesses, setSelectedProcesses] = useState([])
  const [selectedDevices, setSelectedDevices] = useState([])
  const [processModalVisible, setProcessModalVisible] = useState(false)
  const [deviceModalVisible, setDeviceModalVisible] = useState(false)
  const [processForm] = Form.useForm()
  const [deviceForm] = Form.useForm()

  const [selectedLine, setSelectedLine] = useState(null)
  const [selectedLineRelations, setSelectedLineRelations] = useState([])

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
      const processes = processesRes.data || []
      const devices = devicesRes.data || []
      const relations = []
      processes.forEach(p => {
        const processDevices = devices.filter(d => d.process_id === p.process_id)
        if (processDevices.length === 0) {
          relations.push({
            sort_order: p.sort_order,
            process_id: p.process_id,
            process_code: p.process_code,
            process_name: p.process_name,
            device_id: null,
            device_code: '-',
            device_name: '-',
          })
        } else {
          processDevices.forEach(d => {
            relations.push({
              sort_order: p.sort_order,
              process_id: p.process_id,
              process_code: p.process_code,
              process_name: p.process_name,
              device_id: d.device_id,
              device_code: d.device_code,
              device_name: d.device_name,
            })
          })
        }
      })
      setSelectedLineRelations(relations)
    } catch (err) {
      console.error('获取产线关联数据失败:', err)
      setSelectedLineRelations([])
    }
  }

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, workshop: workshopInput }))
    setSelectedLine(null)
    setSelectedLineRelations([])
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setWorkshopInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, workshop: undefined }))
    setSelectedLine(null)
    setSelectedLineRelations([])
  }

  const handleAdd = () => {
    setEditing(null)
    setSelectedProcesses([])
    setSelectedDevices([])
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setSelectedProcesses([])
    setSelectedDevices([])
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
        sort_order: editing.sort_order,
        status: editing.status,
      })
    } else {
      form.resetFields()
      const nextSort = data.length > 0 ? Math.max(...data.map(d => Number(d.sort_order) || 0)) + 1 : 1
      const existingLetters = data
        .map(d => {
          const match = d.line_name?.match(/^([A-Z])线$/)
          return match ? match[1] : null
        })
        .filter(Boolean)
      let nextLetter = 'A'
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (const c of alphabet) {
        if (!existingLetters.includes(c)) {
          nextLetter = c
          break
        }
      }
      const nextCode = `LINE-${nextLetter}`
      form.setFieldsValue({
        status: '运行中',
        sort_order: nextSort,
        line_code: nextCode,
        line_name: `${nextLetter}线`,
        workshop: '制罐车间',
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      let lineId
      if (editing) {
        const res = await api.put(`/basic/production-lines/${editing.line_id}`, payload)
        lineId = editing.line_id
        message.success(res.message || '产线编辑成功')
      } else {
        const res = await api.post('/basic/production-lines', payload)
        lineId = res.data.line_id
        message.success(res.message || '产线新增成功')
      }
      for (const p of selectedProcesses) {
        await api.post(`/basic/production-lines/${lineId}/processes`, {
          process_id: p.process_id,
          sort_order: p.sort_order,
        })
      }
      for (const d of selectedDevices) {
        await api.post(`/basic/production-lines/${lineId}/devices`, {
          device_id: d.device_id,
          process_id: d.process_id || null,
          sort_order: d.sort_order,
        })
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
      if (selectedLine?.line_id === record.line_id) {
        setSelectedLine(null)
        setSelectedLineRelations([])
      }
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [addDeviceProcessId, setAddDeviceProcessId] = useState(null)

  const availableProcessOptions = processOptions.filter(
    p => !selectedProcesses.find(sp => sp.process_id === p.value)
  )

  const usedDeviceIds = selectedDevices.map(d => d.device_id)
  const availableDeviceOptions = deviceOptions.filter(
    d => !usedDeviceIds.includes(d.value)
  )

  const handleSelectProcess = (processId) => {
    const processInfo = processOptions.find(p => p.value === processId)
    if (!processInfo) return
    const newProcess = {
      process_id: processId,
      process_code: processInfo.code || '',
      process_name: processInfo.name || '',
      sort_order: selectedProcesses.length,
    }
    setSelectedProcesses([...selectedProcesses, newProcess])
    setSelectedProcessId(processId)
  }

  const handleAddDeviceToProcess = async () => {
    try {
      const values = await deviceForm.validateFields()
      const deviceIds = Array.isArray(values.device_ids) ? values.device_ids : []
      if (deviceIds.length === 0) {
        message.warning('请选择设备')
        return
      }
      const newDevices = deviceIds.map((deviceId, idx) => {
        const deviceInfo = deviceOptions.find(d => d.value === deviceId)
        return {
          device_id: deviceId,
          device_code: deviceInfo?.code || '',
          device_name: deviceInfo?.name || '',
          process_id: addDeviceProcessId,
          sort_order: selectedDevices.length + idx,
        }
      })
      setSelectedDevices([...selectedDevices, ...newDevices])
      setDeviceModalVisible(false)
      deviceForm.resetFields()
      message.success(`已添加 ${deviceIds.length} 台设备`)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const openAddDeviceModal = (processId) => {
    setAddDeviceProcessId(processId)
    deviceForm.resetFields()
    setDeviceModalVisible(true)
  }

  const handleRemoveProcess = (processId) => {
    setSelectedProcesses(selectedProcesses.filter(p => p.process_id !== processId))
    setSelectedDevices(selectedDevices.filter(d => d.process_id !== processId))
  }

  const handleAddDevice = async () => {
    try {
      const values = await deviceForm.validateFields()
      const existing = selectedDevices.find(d => d.device_id === values.device_id)
      if (existing) {
        message.warning('该设备已添加')
        return
      }
      const deviceInfo = deviceOptions.find(d => d.value === values.device_id)
      setSelectedDevices([...selectedDevices, {
        device_id: values.device_id,
        device_code: deviceInfo?.code || '',
        device_name: deviceInfo?.name || '',
        process_id: values.process_id || null,
        sort_order: selectedDevices.length,
      }])
      setDeviceModalVisible(false)
      deviceForm.resetFields()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    }
  }

  const handleRemoveDevice = (deviceId) => {
    setSelectedDevices(selectedDevices.filter(d => d.device_id !== deviceId))
  }

  const handleRemoveRelation = async (relation) => {
    if (!selectedLine) return
    try {
      if (relation.device_id) {
        await api.delete(`/basic/production-lines/${selectedLine.line_id}/devices/${relation.device_id}`)
      } else {
        await api.delete(`/basic/production-lines/${selectedLine.line_id}/processes/${relation.process_id}`)
      }
      message.success('移除成功')
      fetchLineRelations(selectedLine.line_id)
    } catch (err) {
      message.error(err.message || '操作失败')
    }
  }

  const columns = [
    {
      title: '选择',
      key: 'select',
      width: 60,
      render: (_, record) => (
        <Button
          type={selectedLine?.line_id === record.line_id ? 'primary' : 'default'}
          size="small"
          onClick={() => {
            if (selectedLine?.line_id === record.line_id) {
              setSelectedLine(null)
              setSelectedLineRelations([])
            } else {
              setSelectedLine(record)
              fetchLineRelations(record.line_id)
            }
          }}
        >
          {selectedLine?.line_id === record.line_id ? '已选' : '选择'}
        </Button>
      ),
    },
    { title: '产线编号', dataIndex: 'line_code', key: 'line_code', width: 110 },
    { title: '产线名称', dataIndex: 'line_name', key: 'line_name', width: 100 },
    {
      title: '产线工序',
      dataIndex: 'process_names',
      key: 'process_names',
      width: 200,
      render: (text) => text || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: '所属车间', dataIndex: 'workshop', key: 'workshop', width: 110 },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  const relationColumns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '工序编号', dataIndex: 'process_code', key: 'process_code', width: 100 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 120 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认移除？"
          onConfirm={() => handleRemoveRelation(record)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const modalRelationColumns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '工序编号', dataIndex: 'process_code', key: 'process_code', width: 100 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 120 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认移除？"
          onConfirm={() => {
            if (record.device_id) {
              handleRemoveDevice(record.device_id)
            } else {
              handleRemoveProcess(record.process_id)
            }
          }}
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

  const buildModalRelations = () => {
    const relations = []
    selectedProcesses.forEach(p => {
      const processDevices = selectedDevices.filter(d => d.process_id === p.process_id)
      if (processDevices.length === 0) {
        relations.push({
          sort_order: p.sort_order,
          process_id: p.process_id,
          process_code: p.process_code,
          process_name: p.process_name,
          device_id: null,
          device_code: '-',
          device_name: '-',
        })
      } else {
        processDevices.forEach(d => {
          relations.push({
            sort_order: p.sort_order,
            process_id: p.process_id,
            process_code: p.process_code,
            process_name: p.process_name,
            device_id: d.device_id,
            device_code: d.device_code,
            device_name: d.device_name,
          })
        })
      }
    })
    return relations
  }

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
          <div>
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
            {selectedLine && (
              <Card
                title={`${selectedLine.line_name} - 工序设备关联列表`}
                style={{ marginTop: 16 }}
              >
                {selectedLineRelations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const processMap = {}
                      selectedLineRelations.forEach(r => {
                        if (!processMap[r.process_id]) {
                          processMap[r.process_id] = {
                            sort_order: r.sort_order,
                            process_id: r.process_id,
                            process_code: r.process_code,
                            process_name: r.process_name,
                            devices: [],
                          }
                        }
                        if (r.device_id) {
                          processMap[r.process_id].devices.push({
                            device_id: r.device_id,
                            device_code: r.device_code,
                            device_name: r.device_name,
                          })
                        }
                      })
                      return Object.values(processMap)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((p, idx) => {
                          const bgColor = idx % 2 === 0 ? '#f5f7fa' : '#e8ecf1'
                          return (
                            <div key={p.process_id} style={{ backgroundColor: bgColor, padding: 12, borderRadius: 4 }}>
                              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                {idx + 1}. {p.process_name}
                                <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8, fontSize: 12 }}>{p.process_code}</span>
                              </div>
                              {p.devices.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {p.devices.map(d => (
                                    <Tag key={d.device_id}>{d.device_name}</Tag>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ color: '#999', fontSize: 12 }}>暂无关联设备</div>
                              )}
                            </div>
                          )
                        })
                    })()}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>
                    该产线暂无关联的工序和设备，请先添加产线后再配置
                  </div>
                )}
              </Card>
            )}
          </div>
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
        width={720}
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
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
          <Card
            title={
              <Space>
                <SettingOutlined />
                <span>工序设备配置</span>
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Select
                  placeholder="请选择工序添加到产线"
                  style={{ width: '100%' }}
                  value={null}
                  onChange={handleSelectProcess}
                  options={availableProcessOptions}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Col>
            </Row>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedProcesses.map((p, idx) => {
                const processDevices = selectedDevices.filter(d => d.process_id === p.process_id)
                const bgColor = idx % 2 === 0 ? '#f5f7fa' : '#e8ecf1'
                return (
                  <div key={p.process_id} style={{ backgroundColor: bgColor, padding: 12, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>
                        {idx + 1}. {p.process_name}
                        <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8, fontSize: 12 }}>{p.process_code}</span>
                      </span>
                      <Space>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openAddDeviceModal(p.process_id)}>
                          添加设备
                        </Button>
                        <Popconfirm title="确认移除该工序？" onConfirm={() => handleRemoveProcess(p.process_id)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                    {processDevices.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {processDevices.map(d => (
                          <Tag
                            key={d.device_id}
                            closable
                            onClose={(e) => {
                              e.preventDefault()
                              handleRemoveDevice(d.device_id)
                            }}
                          >
                            {d.device_name}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#999', fontSize: 12 }}>暂无关联设备</div>
                    )}
                  </div>
                )
              })}
              {selectedProcesses.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>
                  请从上方下拉框选择工序添加到产线
                </div>
              )}
            </div>
          </Card>
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
              <Descriptions.Item label="排序号">{viewRecord.sort_order ?? '-'}</Descriptions.Item>
            </Descriptions>
            <Card
              title={
                <Space>
                  <SettingOutlined />
                  <span>工序设备关联列表</span>
                </Space>
              }
            >
              <Table
                columns={relationColumns}
                dataSource={selectedLineRelations}
                rowKey={(r) => `${r.process_id}-${r.device_id}`}
                size="small"
                pagination={false}
                bordered
              />
            </Card>
          </div>
        )}
      </Drawer>
      <Modal
        title="添加工序设备"
        open={deviceModalVisible}
        onOk={handleAddDeviceToProcess}
        onCancel={() => setDeviceModalVisible(false)}
        okText="确认添加"
        cancelText="取消"
        width={480}
      >
        <Form form={deviceForm} layout="vertical">
          <Form.Item name="device_ids" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select
              mode="multiple"
              placeholder="请选择设备（可多选）"
              options={availableDeviceOptions}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#999' }}>
            提示：已被其他工序选择的设备不再出现在列表中
          </div>
        </Form>
      </Modal>
    </>
  )
}