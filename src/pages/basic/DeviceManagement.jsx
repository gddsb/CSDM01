import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Drawer, Space, Modal, Form, Input, Select, Popconfirm, message, Descriptions, Row, Col } from 'antd'
import {
  ToolOutlined, PlayCircleOutlined, WarningOutlined, SafetyCertificateOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 设备状态标签颜色映射（与后端 Device 模型一致：运行=1, 停用=0, 维修=2）
const statusColorMap = { '运行': 'green', '维修': 'orange', '停用': 'red' }
const statusOptions = ['运行', '维修', '停用'].map(s => ({ label: s, value: s }))
const specialOptions = [{ label: '是', value: 1 }, { label: '否', value: 0 }]

export default function DeviceManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [typeInput, setTypeInput] = useState(undefined)
  const [specialInput, setSpecialInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined, device_type: undefined, is_special: undefined })

  const runningCount = data.filter(d => d.status === '运行').length
  const faultCount = data.filter(d => d.status === '维修').length
  const specialCount = data.filter(d => d.is_special === true || d.is_special === 1).length

  const stats = [
    { label: '设备总数', value: total, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '运行中', value: runningCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '维修', value: faultCount, icon: <WarningOutlined />, color: '#FF9800' },
    { label: '特种设备数', value: specialCount, icon: <SafetyCertificateOutlined />, color: '#F44336' },
  ]

  const typeOptions = [...new Set(data.map(d => d.device_type).filter(Boolean))].map(t => ({ label: t, value: t }))

  // 获取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        if (query.device_type) params.device_type = query.device_type
        if (query.is_special !== undefined && query.is_special !== null) params.is_special = query.is_special
        const res = await api.get('/basic/devices', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取设备列表失败')
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

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, device_type: typeInput, is_special: specialInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setTypeInput(undefined)
    setSpecialInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, device_type: undefined, is_special: undefined }))
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
        device_code: editing.device_code,
        device_name: editing.device_name,
        device_type: editing.device_type,
        device_model: editing.device_model,
        serial_no: editing.serial_no,
        location: editing.location,
        responsible_person: editing.responsible_person,
        is_special: editing.is_special === true || editing.is_special === 1 ? 1 : 0,
        status: editing.status,
        last_inspection_date: editing.last_inspection_date,
        inspection_cycle: editing.inspection_cycle,
        next_inspection_date: editing.next_inspection_date,
        manufacturer: editing.manufacturer,
        purchase_date: editing.purchase_date,
        warranty_end: editing.warranty_end,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: '运行', is_special: 0 })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        const res = await api.put(`/basic/devices/${editing.device_id}`, payload)
        message.success(res.message || '设备编辑成功')
      } else {
        const res = await api.post('/basic/devices', payload)
        message.success(res.message || '设备新增成功')
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
      const res = await api.delete(`/basic/devices/${record.device_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name' },
    { title: '型号', dataIndex: 'device_model', key: 'device_model', width: 100 },
    { title: '类型', dataIndex: 'device_type', key: 'device_type', width: 90 },
    { title: '位置', dataIndex: 'location', key: 'location', width: 130 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '特种设备', dataIndex: 'is_special', key: 'is_special', width: 90,
      render: v => (v === true || v === 1) ? <Tag color="orange">是</Tag> : <Tag>否</Tag>,
    },
    { title: '上次检定', dataIndex: 'last_inspection_date', key: 'last_inspection_date', width: 120 },
    { title: '下次检定', dataIndex: 'next_inspection_date', key: 'next_inspection_date', width: 120 },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该设备？"
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
    { type: 'input', placeholder: '搜索设备编号/名称/型号', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    { type: 'select', placeholder: '设备类型', options: typeOptions, col: { span: 6 }, value: typeInput, onChange: v => setTypeInput(v) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '运行', value: 1 }, { label: '维修', value: 2 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
    { type: 'select', placeholder: '是否特种设备', options: specialOptions, col: { span: 6 }, value: specialInput, onChange: v => setSpecialInput(v) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="设备档案"
        breadcrumbs="基础数据 / 设备档案"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增设备</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="device_id"
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
        title={editing ? '编辑设备' : '新增设备'}
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
              <Form.Item name="device_name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
                <Input placeholder="请输入设备名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="device_code" label="设备编号" rules={[{ required: true, message: '请输入设备编号' }]}>
                <Input placeholder="请输入设备编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="device_type" label="设备类型" rules={[{ required: true, message: '请输入设备类型' }]}>
                <Input placeholder="请输入设备类型" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="device_model" label="设备型号">
                <Input placeholder="请输入设备型号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="location" label="安装位置" rules={[{ required: true, message: '请输入位置' }]}>
                <Input placeholder="请输入位置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serial_no" label="出厂编号">
                <Input placeholder="请输入出厂编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_special" label="是否特种设备">
                <Select placeholder="请选择" options={specialOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="responsible_person" label="负责人">
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="manufacturer" label="制造商">
                <Input placeholder="请输入制造商" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purchase_date" label="购置日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warranty_end" label="保修截止">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="last_inspection_date" label="上次检定日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_cycle" label="检定周期（月）">
                <Input placeholder="如：6" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="next_inspection_date" label="下次检定日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title="设备详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {current && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="设备编号">{current.device_code}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{current.device_name}</Descriptions.Item>
            <Descriptions.Item label="设备型号">{current.device_model || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{current.device_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="出厂编号">{current.serial_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="安装位置">{current.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status]}>{current.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="是否特种设备">{(current.is_special === true || current.is_special === 1) ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
            <Descriptions.Item label="负责人">{current.responsible_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="制造商">{current.manufacturer || '-'}</Descriptions.Item>
            <Descriptions.Item label="购置日期">{current.purchase_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="保修截止">{current.warranty_end || '-'}</Descriptions.Item>
            <Descriptions.Item label="上次检定日期">{current.last_inspection_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="检定周期（月）">{current.inspection_cycle || '-'}</Descriptions.Item>
            <Descriptions.Item label="下次检定日期">{current.next_inspection_date || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
