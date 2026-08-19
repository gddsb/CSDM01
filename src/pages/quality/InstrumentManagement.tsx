import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Tag, Button, Drawer, Space, Modal, Form, Input, Select, Descriptions, Row, Col } from 'antd'
import {
  ToolOutlined, PlayCircleOutlined, SafetyCertificateOutlined,
  PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

// 状态标签颜色映射（与后端 Instrument 模型一致：在用/停用）
const statusColorMap = { '在用': 'green', '停用': 'red' }
const statusOptions = ['在用', '停用'].map(s => ({ label: s, value: s }))
const calibrationTypeOptions = ['外校', '内校', '不需要校准'].map(s => ({ label: s, value: s }))

export default function InstrumentManagement() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态（仅关键字输入框使用受控值，避免每次按键触发查询；select 直接以 query 为单一数据源）
  const [keywordInput, setKeywordInput] = useState('')
  // 已应用的查询条件（筛选条件单一数据源：select 变化直接修改 query 立即查询）
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined as string | undefined, department: undefined as string | undefined, calibration_type: undefined as string | undefined })
  // 关键字防抖句柄
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 组件卸载时清理防抖计时器
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const inUseCount = data.filter(d => d.status === '在用').length
  const stopCount = data.filter(d => d.status === '停用').length

  const stats: StatItem[] = [
    { label: '仪器总数', value: total, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '在用', value: inUseCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '停用', value: stopCount, icon: <SafetyCertificateOutlined />, color: '#F44336' },
  ]

  const departmentOptions = [...new Set(data.map(d => d.department).filter(Boolean))].map(d => ({ label: d, value: d }))

  // 获取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize, sortBy: 'instrument_no', sortOrder: 'asc' }
        if (query.keyword) params.keyword = query.keyword
        if (query.status) params.status = query.status
        if (query.department) params.department = query.department
        if (query.calibration_type) params.calibration_type = query.calibration_type
        const res = await api.get('/basic/instruments', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取检测仪器列表失败')
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

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  // 查询：仅提交关键字输入框当前值（select 已在各自 onChange 中即时更新到 query）
  const handleSearch = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput }))
  }

  const handleReset = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    setKeywordInput('')
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, department: undefined, calibration_type: undefined }))
  }

  // 关键字输入：受控更新显示值 + 300ms 防抖立即查询
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setKeywordInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(q => ({ ...q, page: 1, keyword: v }))
    }, 300)
  }

  const handleDetail = (record) => {
    setCurrent(record)
    setDetailOpen(true)
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
      form.setFieldsValue({
        instrument_no: editing.instrument_no,
        instrument_name: editing.instrument_name,
        instrument_model: editing.instrument_model,
        precision: editing.precision,
        department: editing.department,
        location: editing.location,
        status: editing.status,
        calibration_type: editing.calibration_type,
        calibration_cycle: editing.calibration_cycle,
        last_calibration_date: editing.last_calibration_date,
        next_calibration_date: editing.next_calibration_date,
        supplier: editing.supplier,
        remarks: editing.remarks,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: '在用' })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        // 编号不可修改，剔除 instrument_no
        delete payload.instrument_no
        const res = await api.put(`/basic/instruments/${editing.instrument_id}`, payload)
        message.success(res.message || '检测仪器编辑成功')
      } else {
        const res = await api.post('/basic/instruments', payload)
        message.success(res.message || '检测仪器新增成功')
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

  const columns = [
    { title: '仪器编号', dataIndex: 'instrument_no', key: 'instrument_no', width: 140, fixed: 'left' as const },
    { title: '仪器名称', dataIndex: 'instrument_name', key: 'instrument_name', width: 130 },
    { title: '型号', dataIndex: 'instrument_model', key: 'instrument_model', width: 110 },
    { title: '精度', dataIndex: 'precision', key: 'precision', width: 100 },
    { title: '使用部门', dataIndex: 'department', key: 'department', width: 110 },
    { title: '存放地点', dataIndex: 'location', key: 'location', width: 110 },
    { title: '校验类型', dataIndex: 'calibration_type', key: 'calibration_type', width: 100 },
    { title: '校准周期(天)', dataIndex: 'calibration_cycle', key: 'calibration_cycle', width: 110 },
    { title: '上次校准日期', dataIndex: 'last_calibration_date', key: 'last_calibration_date', width: 120 },
    { title: '下次校准日期', dataIndex: 'next_calibration_date', key: 'next_calibration_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>,
    },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: 110 },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          {hasPermission('quality:instrument:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  const filters: FilterItem[] = [
    { type: 'input', placeholder: '仪器编号 / 名称 / 型号', col: { flex: '180px' }, value: keywordInput, onChange: handleKeywordChange },
    { type: 'select', field: 'department', placeholder: '使用部门', options: departmentOptions, col: { flex: '150px' }, value: query.department, onChange: (v) => setQuery(q => ({ ...q, page: 1, department: v as string | undefined })) },
    { type: 'select', field: 'calibration_type', placeholder: '校验类型', options: calibrationTypeOptions, col: { flex: '150px' }, value: query.calibration_type, onChange: (v) => setQuery(q => ({ ...q, page: 1, calibration_type: v as string | undefined })) },
    { type: 'select', field: 'status', placeholder: '状态', options: statusOptions, col: { flex: '150px' }, value: query.status, onChange: (v) => setQuery(q => ({ ...q, page: 1, status: v as string | undefined })) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检测仪器"
        breadcrumbs="质量管理 / 检测仪器"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增仪器</Button>,
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
            ]}
          />
        }
        table={
          <ResizableTable tableKey="pages_quality_InstrumentManagement" columns={columns}
            dataSource={data}
            rowKey="instrument_id"
            size="small"
            loading={loading}
            scroll={{ x: 1500 }}
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
        title={editing ? '编辑检测仪器' : '新增检测仪器'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="instrument_no"
                label="仪器编号"
                rules={[{ required: true, message: '请输入仪器编号' }]}
                extra={editing ? '编码已生成，不允许修改' : '编码一经生成不可修改，请仔细核对'}
              >
                <Input placeholder="请输入仪器编号（如 DMCS-ZJC-02）" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="instrument_name" label="仪器名称" rules={[{ required: true, message: '请输入仪器名称' }]}>
                <Input placeholder="请输入仪器名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="instrument_model" label="型号">
                <Input placeholder="请输入型号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="precision" label="精度">
                <Input placeholder="如 0.01mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="department" label="使用部门">
                <Input placeholder="如 生产部" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="location" label="存放地点">
                <Input placeholder="如 下料" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="calibration_type" label="校验类型">
                <Select placeholder="请选择" options={calibrationTypeOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="calibration_cycle" label="校准周期（天）">
                <Input placeholder="如 365" type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplier" label="供应商">
                <Input placeholder="请输入供应商" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="last_calibration_date" label="上次校准日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_calibration_date" label="下次校准日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
        {editing && (
          <div style={{ marginTop: 8, color: '#faad14', fontSize: 12 }}>
            提示：仪器编号一经生成不允许修改。
          </div>
        )}
      </Modal>
      <Drawer
        title="检测仪器详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {current && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="仪器编号">{current.instrument_no}</Descriptions.Item>
            <Descriptions.Item label="仪器名称">{current.instrument_name}</Descriptions.Item>
            <Descriptions.Item label="型号">{current.instrument_model || '-'}</Descriptions.Item>
            <Descriptions.Item label="精度">{current.precision || '-'}</Descriptions.Item>
            <Descriptions.Item label="使用部门">{current.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="存放地点">{current.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status] || 'default'}>{current.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="校验类型">{current.calibration_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="校准周期（天）">{current.calibration_cycle ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="上次校准日期">{current.last_calibration_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="下次校准日期">{current.next_calibration_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="供应商">{current.supplier || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{current.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
