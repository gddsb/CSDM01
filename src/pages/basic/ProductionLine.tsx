import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Row, Col, Space, Drawer, Descriptions, Popconfirm, Card } from 'antd'
import {
  DeploymentUnitOutlined, PlayCircleOutlined, ToolOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined, DeleteOutlined,
  UnorderedListOutlined, SettingOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

const statusColorMap = { '运行中': 'green', '维护中': 'orange', '停用': 'red' }
const statusOptions = ['运行中', '维护中', '停用'].map(s => ({ label: s, value: s }))

export default function ProductionLine() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const [processOptions, setProcessOptions] = useState([])
  const [selectedProcesses, setSelectedProcesses] = useState([])
  const [selectedLineProcesses, setSelectedLineProcesses] = useState([])

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
        const processRes = await api.get('/basic/processes', { params: { pageSize: 100 } })
        const processes = (processRes.data || []).sort((a, b) => {
          const codeA = a.process_code || ''
          const codeB = b.process_code || ''
          return codeA.localeCompare(codeB, 'zh-Hans-CN', { numeric: true })
        })
        setProcessOptions(processes.map(p => ({
          label: `${p.process_code} - ${p.process_name}`,
          value: p.process_id,
          code: p.process_code,
          name: p.process_name,
        })))
      } catch (err) {
        console.error('获取选项数据失败:', err)
      }
    }
    fetchOptions()
  }, [])

  const fetchLineProcesses = async (lineId) => {
    try {
      const res = await api.get(`/basic/production-lines/${lineId}/processes`)
      const processes = (res.data || []).sort((a, b) => {
        const sortA = Number(a.sort_order) || 0
        const sortB = Number(b.sort_order) || 0
        if (sortA !== sortB) return sortA - sortB
        const codeA = a.process_code || ''
        const codeB = b.process_code || ''
        return codeA.localeCompare(codeB, 'zh-Hans-CN', { numeric: true })
      })
      return processes
    } catch (err) {
      console.error('获取产线工序失败:', err)
      return []
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
    setSelectedProcesses([])
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setSelectedProcesses([])
    setModalVisible(true)
  }

  const handleView = async (record) => {
    setViewRecord(record)
    const processes = await fetchLineProcesses(record.line_id)
    setSelectedLineProcesses(processes)
  }

  const handleAfterOpenChange = async (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        line_code: editing.line_code,
        line_name: editing.line_name,
        workshop: editing.workshop,
        sort_order: editing.sort_order,
        status: editing.status,
      })
      try {
        const res = await api.get(`/basic/production-lines/${editing.line_id}/processes`)
        const processes = (res.data || []).map(p => ({
          process_id: p.process_id,
          process_code: p.process_code,
          process_name: p.process_name,
          sort_order: p.sort_order,
        }))
        setSelectedProcesses(processes)
      } catch (e) {
        console.error('获取产线工序失败:', e)
      }
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
      if (editing) {
        try {
          await api.delete(`/basic/production-lines/${lineId}/processes`)
        } catch (e) {
          console.warn('清空旧工序关联失败:', e)
        }
      }
      for (const p of selectedProcesses) {
        await api.post(`/basic/production-lines/${lineId}/processes`, {
          process_id: p.process_id,
          sort_order: p.sort_order,
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
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const availableProcessOptions = processOptions.filter(
    p => !selectedProcesses.find(sp => sp.process_id === p.value)
  )

  const handleSelectProcesses = (processIds) => {
    const newProcesses = processIds
      .filter(id => !selectedProcesses.find(sp => sp.process_id === id))
      .map(id => {
        const info = processOptions.find(p => p.value === id)
        return {
          process_id: id,
          process_code: info?.code || '',
          process_name: info?.name || '',
          sort_order: selectedProcesses.length,
        }
      })
    const combined = [...selectedProcesses, ...newProcesses]
    combined.sort((a, b) => {
      const codeA = a.process_code || ''
      const codeB = b.process_code || ''
      return codeA.localeCompare(codeB, 'zh-Hans-CN', { numeric: true })
    })
    const reordered = combined.map((p, idx) => ({ ...p, sort_order: idx }))
    setSelectedProcesses(reordered)
  }

  const handleRemoveProcess = (processId) => {
    const filtered = selectedProcesses.filter(p => p.process_id !== processId)
    filtered.sort((a, b) => {
      const codeA = a.process_code || ''
      const codeB = b.process_code || ''
      return codeA.localeCompare(codeB, 'zh-Hans-CN', { numeric: true })
    })
    const reordered = filtered.map((p, idx) => ({ ...p, sort_order: idx }))
    setSelectedProcesses(reordered)
  }

  const columns = [
    { title: '产线编号', dataIndex: 'line_code', key: 'line_code', width: 110 },
    { title: '产线名称', dataIndex: 'line_name', key: 'line_name', width: 100 },
    {
      title: '产线工序',
      dataIndex: 'process_names',
      key: 'process_names',
      width: 250,
      render: (text) => {
        if (!text) return <Tag color="default">未配置</Tag>
        const names = text.split('、').filter(Boolean)
        return (
          <Space size="small" wrap>
            {names.map((name, idx) => (
              <Tag key={idx} color="cyan">{name}</Tag>
            ))}
          </Space>
        )
      },
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
          {hasPermission('basic:line:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  const processColumns = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '工序编号', dataIndex: 'process_code', key: 'process_code', width: 120 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name', width: 150 },
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
        width={640}
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
                <span>工序配置</span>
              </Space>
            }
            style={{ marginTop: 16 }}
            size="small"
          >
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                <Select
                  mode="multiple"
                  placeholder="请选择工序（可一次性多选，按工序编号自动排序）"
                  style={{ width: '100%' }}
                  value={undefined}
                  onChange={handleSelectProcesses}
                  options={availableProcessOptions}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  maxTagCount="responsive"
                />
              </Col>
            </Row>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedProcesses.map((p, idx) => {
                const bgColor = idx % 2 === 0 ? '#f5f7fa' : '#e8ecf1'
                return (
                  <div key={p.process_id} style={{ backgroundColor: bgColor, padding: 10, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>
                      {idx + 1}. {p.process_name}
                      <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8, fontSize: 12 }}>{p.process_code}</span>
                    </span>
                    <Popconfirm title="确认移除该工序？" onConfirm={() => handleRemoveProcess(p.process_id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                )
              })}
              {selectedProcesses.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>
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
        width={640}
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
                  <UnorderedListOutlined />
                  <span>工序列表</span>
                </Space>
              }
              size="small"
            >
              <Table
                columns={processColumns}
                dataSource={selectedLineProcesses}
                rowKey="process_id"
                size="small"
                pagination={false}
                bordered
              />
            </Card>
          </div>
        )}
      </Drawer>
    </>
  )
}
