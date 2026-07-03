import React, { useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col, message, Drawer, Descriptions } from 'antd'
import {
  TeamOutlined, ToolOutlined, UserOutlined, SolutionOutlined,
  PlusOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { manpowerRecords, workOrders } from '../../mock/data'

export default function ManpowerRecord() {
  const [data, setData] = useState(manpowerRecords)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  const filtered = data.filter(r => {
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  const stats = [
    { label: '总记录数', value: data.length, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '累计技工', value: data.reduce((s, r) => s + (r.skilled_workers || 0), 0), icon: <ToolOutlined />, color: '#FF9800' },
    { label: '累计普工', value: data.reduce((s, r) => s + (r.general_workers || 0), 0), icon: <UserOutlined />, color: '#00BCD4' },
    { label: '累计劳务工', value: data.reduce((s, r) => s + (r.contract_workers || 0), 0), icon: <SolutionOutlined />, color: '#9C27B0' },
  ]

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setAddOpen(true)
  }

  const handleView = (r) => {
    setCurrentRecord(r)
    setDetailOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      work_order_id: r.work_order_id,
      skilled_workers: r.skilled_workers,
      general_workers: r.general_workers,
      contract_workers: r.contract_workers,
      auxiliary_workers: r.auxiliary_workers,
      remarks: r.remarks,
    })
    setAddOpen(true)
  }

  const handleDelete = (r) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除工单 ${r.work_order_no} 的人员投入记录？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.filter(x => x.record_id !== r.record_id))
        message.success('记录已删除')
      },
    })
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const w = workOrders.find(w => w.work_order_id === values.work_order_id)
    if (editing) {
      setData(prev => prev.map(r => r.record_id === editing.record_id ? {
        ...r,
        work_order_id: values.work_order_id,
        work_order_no: w?.work_order_no || r.work_order_no,
        skilled_workers: values.skilled_workers || 0,
        general_workers: values.general_workers || 0,
        contract_workers: values.contract_workers || 0,
        auxiliary_workers: values.auxiliary_workers || 0,
        remarks: values.remarks || '',
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      } : r))
      message.success('人员投入记录已更新')
    } else {
      const newRecord = {
        record_id: 'mr' + Date.now(),
        work_order_id: values.work_order_id,
        work_order_no: w?.work_order_no || '-',
        skilled_workers: values.skilled_workers || 0,
        general_workers: values.general_workers || 0,
        contract_workers: values.contract_workers || 0,
        auxiliary_workers: values.auxiliary_workers || 0,
        remarks: values.remarks || '',
        record_user: 'u6',
        record_user_name: '生产管理',
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setData(prev => [newRecord, ...prev])
      message.success('人员投入记录已新增')
    }
    setAddOpen(false)
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160, fixed: 'left' },
    { title: '技工人数', dataIndex: 'skilled_workers', key: 'skilled_workers', width: 100, render: v => v || 0 },
    { title: '普工人数', dataIndex: 'general_workers', key: 'general_workers', width: 100, render: v => v || 0 },
    { title: '劳务工人数', dataIndex: 'contract_workers', key: 'contract_workers', width: 110, render: v => v || 0 },
    { title: '其他辅助', dataIndex: 'auxiliary_workers', key: 'auxiliary_workers', width: 100, render: v => v || 0 },
    {
      title: '合计人数', key: 'total', width: 100,
      render: (_, r) => (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0),
    },
    {
      title: '总工时(小时)', key: 'total_hours', width: 120,
      render: (_, r) => {
        const totalWorkers = (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0)
        const wo = workOrders.find(w => w.work_order_id === r.work_order_id)
        if (!wo || !wo.start_time) return '-'
        const start = dayjs(wo.start_time)
        const end = wo.finish_time ? dayjs(wo.finish_time) : dayjs()
        const hours = end.diff(start, 'hour', true)
        return (totalWorkers * hours).toFixed(1)
      },
    },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 120, render: v => v || '-' },
    { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 100 },
    { title: '记录时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, r) => {
        const wo = workOrders.find(w => w.work_order_id === r.work_order_id)
        const isCompleted = wo && wo.status === '完工'
        if (isCompleted) {
          return <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        }
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="人员投入记录"
        breadcrumbs="生产管理 / 人员投入"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增记录</Button>}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Input
                  placeholder="搜索工单编号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => setSearch('')}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="record_id"
              size="small"
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑人员投入' : '新增人员投入'}
        open={addOpen}
        onOk={handleSubmit}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="工单" name="work_order_id" rules={[{ required: true, message: '请选择工单' }]}>
            <Select
              placeholder="请选择工单"
              options={workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="技工人数" name="skilled_workers" rules={[{ required: true, message: '请输入技工人数' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="技工人数" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="普工人数" name="general_workers" rules={[{ required: true, message: '请输入普工人数' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="普工人数" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="劳务工人数" name="contract_workers" rules={[{ required: true, message: '请输入劳务工人数' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="劳务工人数" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="其他辅助人数" name="auxiliary_workers">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="其他辅助人数" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="请输入备注，如：白班/夜班" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="人员记录详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {currentRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="技工人数">{currentRecord.skilled_workers}</Descriptions.Item>
            <Descriptions.Item label="普工人数">{currentRecord.general_workers}</Descriptions.Item>
            <Descriptions.Item label="劳务工人数">{currentRecord.contract_workers}</Descriptions.Item>
            <Descriptions.Item label="辅助人数">{currentRecord.auxiliary_workers}</Descriptions.Item>
            <Descriptions.Item label="备注">{currentRecord.remarks || '-'}</Descriptions.Item>
            <Descriptions.Item label="记录人">{currentRecord.record_user_name}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{currentRecord.created_at}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
