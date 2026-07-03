import React, { useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, message, Tooltip, Typography, Row, Col } from 'antd'
import {
  OrderedListOutlined, CheckCircleOutlined,
  EditOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { processes as processesData } from '../../mock/data'

const { Text } = Typography

// 自动生成工序编码 P-##
const genProcessCode = (existingData) => {
  const maxNo = existingData.reduce((max, p) => {
    const match = p.process_code?.match(/P-(\d+)$/)
    return match ? Math.max(max, parseInt(match[1])) : max
  }, 0)
  return 'P-' + String(maxNo + 1).padStart(2, '0')
}

export default function ProcessManagement() {
  const [data, setData] = useState(processesData)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const enabledCount = data.filter(p => p.status === '启用').length

  const stats = [
    { label: '总工序数', value: data.length, icon: <OrderedListOutlined />, color: '#2196F3' },
    { label: '启用数', value: enabledCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  // 上移
  const handleMoveUp = (record) => {
    const index = data.findIndex(p => p.process_id === record.process_id)
    if (index <= 0) {
      message.warning('已是第一道工序，无法上移')
      return
    }
    const newData = [...data]
    const prev = newData[index - 1]
    // 交换排序号
    newData[index - 1] = { ...record, sort_order: prev.sort_order }
    newData[index] = { ...prev, sort_order: record.sort_order }
    setData(newData)
    message.success('已上移')
  }

  // 下移
  const handleMoveDown = (record) => {
    const index = data.findIndex(p => p.process_id === record.process_id)
    if (index >= data.length - 1) {
      message.warning('已是最后一道工序，无法下移')
      return
    }
    const newData = [...data]
    const next = newData[index + 1]
    newData[index + 1] = { ...record, sort_order: next.sort_order }
    newData[index] = { ...next, sort_order: record.sort_order }
    setData(newData)
    message.success('已下移')
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(p => p.process_id === editing.process_id ? { ...p, ...values } : p))
        message.success('工序编辑成功')
      } else {
        const newProcess = {
          process_id: 'p' + Date.now(),
          process_code: genProcessCode(data),
          sort_order: data.length + 1,
          status: '启用',
          ...values,
        }
        setData(prev => [newProcess, ...prev])
        message.success('工序新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '工序编码', dataIndex: 'process_code', key: 'process_code', width: 120 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record, index) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" disabled={index === 0} onClick={() => handleMoveUp(record)}>上移</Button>
          <Button type="link" size="small" disabled={index === data.length - 1} onClick={() => handleMoveDown(record)}>下移</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工序管理"
        breadcrumbs="基础数据 / 工序管理"
        stats={stats}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <>
            <div style={{ marginBottom: 8 }}>
              <Tooltip title="可按住工序行拖动调整顺序，或使用操作列的上移/下移按钮调整工序先后顺序。">
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  支持拖拽排序：可按住行拖动调整工序先后顺序，也可使用「上移/下移」按钮调整。
                </Text>
              </Tooltip>
            </div>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="process_id"
              size="small"
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </>
        }
      />
      <Modal
        title={editing ? '编辑工序' : '新增工序'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="process_name" label="工序名称" rules={[{ required: true, message: '请输入工序名称' }]}>
                <Input placeholder="请输入工序名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="process_code" label="工序编码">
                <Input placeholder="自动生成" disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="workshop" label="所属车间">
                <Input placeholder="请输入所属车间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="standard_hours" label="标准工时">
                <InputNumber placeholder="请输入标准工时" min={0} step={0.1} style={{ width: '100%' }} addonAfter="小时" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
