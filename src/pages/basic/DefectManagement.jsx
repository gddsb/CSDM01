import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Row, Col, Switch, Drawer, Descriptions, Space, Popconfirm } from 'antd'
import {
  ImportOutlined, ToolOutlined, DeleteOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 所属大类标签颜色映射
const typeColorMap = { '来料不良': 'blue', '制程不良': 'orange', '检验报废': 'red' }

const categoryOptions = ['来料不良', '制程不良', '检验报废'].map(c => ({ label: c, value: c }))

// 安全获取数组的辅助函数
const toArray = (v) => Array.isArray(v) ? v : []

export default function DefectManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 工序列表（用于关联工序下拉）
  const [processes, setProcesses] = useState([])

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [typeInput, setTypeInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined, defect_type: undefined })

  const processOptions = processes.map(p => ({ label: `${p.process_code} ${p.process_name}`, value: p.process_id }))

  // 拉取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        if (query.defect_type) params.defect_type = query.defect_type
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

  // 拉取工序列表（用于关联工序下拉）
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
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, defect_type: typeInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setTypeInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, defect_type: undefined }))
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  // Modal 打开动画结束后再设置表单值（配合 destroyOnHidden + preserve={false}）
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      const availableUnits = toArray(editing.available_units)
      const relatedProcesses = toArray(editing.related_processes)
      form.setFieldsValue({
        defect_code: editing.defect_code,
        defect_name: editing.defect_name,
        defect_type: editing.defect_type,
        defect_unit: editing.defect_unit,
        available_units: availableUnits,
        display: !!editing.display,
        sort_order: editing.sort_order,
        status: editing.status === '启用' ? '启用' : '停用',
        related_processes: relatedProcesses,
        defect_description: editing.defect_description,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        defect_type: '来料不良',
        display: true,
        status: '启用',
        sort_order: total + 1,
        available_units: [],
        related_processes: [],
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        defect_code: values.defect_code,
        defect_name: values.defect_name,
        defect_type: values.defect_type,
        defect_unit: values.defect_unit,
        available_units: toArray(values.available_units),
        display: !!values.display,
        sort_order: values.sort_order,
        status: values.status,
        related_processes: toArray(values.related_processes),
        defect_description: values.defect_description || '',
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

  const columns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 110, fixed: 'left' },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    { title: '不良名称', dataIndex: 'defect_name', key: 'defect_name', width: 110 },
    {
      title: '所属大类', dataIndex: 'defect_type', key: 'defect_type', width: 100,
      render: v => v ? <Tag color={typeColorMap[v] || 'default'}>{v}</Tag> : '-',
    },
    { title: '默认单位', dataIndex: 'defect_unit', key: 'defect_unit', width: 80 },
    {
      title: '可选单位', dataIndex: 'available_units', key: 'available_units', width: 120,
      render: v => {
        const arr = toArray(v)
        return arr.length > 0 ? arr.join('、') : '-'
      },
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
      title: '不良描述', dataIndex: 'defect_description', key: 'defect_description', width: 200,
      render: v => <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{v || '-'}</div>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90, fixed: 'right',
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 170, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该不良项？"
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

  const filters = [
    { type: 'input', placeholder: '搜索不良编码/名称', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '所属大类', col: { span: 6 },
      options: categoryOptions, value: typeInput, onChange: v => setTypeInput(v),
    },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

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
        title="制程不良分类"
        breadcrumbs="基础数据 / 制程不良分类"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
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
          <Table
            columns={columns}
            dataSource={data}
            rowKey="defect_id"
            size="small"
            loading={loading}
            scroll={{ x: 1200 }}
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
        title={editing ? '编辑不良项' : '新增不良项'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={780}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="defect_code" label="不良编码" rules={[{ required: true, message: '请输入不良编码' }]}>
                <Input placeholder="请输入不良编码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_name" label="不良名称" rules={[{ required: true, message: '请输入不良名称' }]}>
                <Input placeholder="请输入不良名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_type" label="不良类别" rules={[{ required: true, message: '请选择不良类别' }]}>
                <Select placeholder="请选择不良类别" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="defect_unit" label="默认单位" rules={[{ required: true, message: '请输入默认单位' }]}>
                <Input placeholder="如：个、处、片" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="available_units" label="可选单位">
                <Select
                  mode="tags"
                  placeholder="输入单位后回车，如：个、处、片"
                  tokenSeparators={[',']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="display" label="默认显示" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="related_processes" label="关联工序">
            <Select
              mode="multiple"
              placeholder="请选择关联工序（未选择则在所有工序可用）"
              options={processOptions}
              allowClear
            />
          </Form.Item>
          <Form.Item name="defect_description" label="不良描述">
            <Input.TextArea placeholder="请输入不良描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="查看不良项"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={480}
      >
        {viewRecord && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="不良编码">{viewRecord.defect_code}</Descriptions.Item>
            <Descriptions.Item label="不良名称">{viewRecord.defect_name}</Descriptions.Item>
            <Descriptions.Item label="所属大类">
              <Tag color={typeColorMap[viewRecord.defect_type] || 'default'}>{viewRecord.defect_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="默认单位">{viewRecord.defect_unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="可选单位" span={2}>
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
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{viewRecord.defect_description || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
