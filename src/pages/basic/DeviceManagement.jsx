import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Space, Modal, Form, Input, Select, message, Descriptions, Row, Col } from 'antd'
import {
  ToolOutlined, PlayCircleOutlined, WarningOutlined, SafetyCertificateOutlined,
  EditOutlined, EyeOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { devices as devicesData } from '../../mock/data'

// 设备状态标签颜色映射
const statusColorMap = { '运行': 'green', '待机': 'blue', '故障': 'red' }

const statusOptions = ['运行', '待机', '故障'].map(s => ({ label: s, value: s }))

export default function DeviceManagement() {
  const [data, setData] = useState(devicesData)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const runningCount = data.filter(d => d.status === '运行').length
  const faultCount = data.filter(d => d.status === '故障').length
  const specialCount = data.filter(d => d.is_special === 1).length

  const stats = [
    { label: '设备总数', value: data.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '运行中', value: runningCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '故障', value: faultCount, icon: <WarningOutlined />, color: '#F44336' },
    { label: '特种设备数', value: specialCount, icon: <SafetyCertificateOutlined />, color: '#FF9800' },
  ]

  const typeOptions = [...new Set(data.map(d => d.device_type))].map(t => ({ label: t, value: t }))
  const specialOptions = [{ label: '是', value: 1 }, { label: '否', value: 0 }]

  const filters = [
    { type: 'input', placeholder: '搜索设备编号/名称', col: { span: 6 } },
    { type: 'select', placeholder: '设备类型', options: typeOptions, col: { span: 6 } },
    { type: 'select', placeholder: '状态', options: statusOptions, col: { span: 6 } },
    { type: 'select', placeholder: '是否特种设备', options: specialOptions, col: { span: 6 } },
  ]

  const handleDetail = (record) => {
    setCurrent(record)
    setDetailOpen(true)
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
        setData(prev => prev.map(d => d.device_id === editing.device_id ? { ...d, ...values } : d))
        message.success('设备编辑成功')
      } else {
        const newDevice = {
          device_id: 'd' + Date.now(),
          device_model: '-',
          serial_no: '-',
          responsible_person: null,
          is_special: 0,
          last_inspection_date: '-',
          inspection_cycle: 6,
          next_inspection_date: '-',
          manufacturer: '-',
          purchase_date: '-',
          warranty_end: '-',
          ...values,
        }
        setData(prev => [newDevice, ...prev])
        message.success('设备新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
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
      render: v => v === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>,
    },
    { title: '上次检定', dataIndex: 'last_inspection_date', key: 'last_inspection_date', width: 120 },
    { title: '下次检定', dataIndex: 'next_inspection_date', key: 'next_inspection_date', width: 120 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="设备档案"
        breadcrumbs="基础数据 / 设备档案"
        stats={stats}
        filters={filters}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="device_id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑设备' : '新增设备'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={520}
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
              <Form.Item name="location" label="位置" rules={[{ required: true, message: '请输入位置' }]}>
                <Input placeholder="请输入位置" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
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
            <Descriptions.Item label="设备型号">{current.device_model}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{current.device_type}</Descriptions.Item>
            <Descriptions.Item label="出厂编号">{current.serial_no}</Descriptions.Item>
            <Descriptions.Item label="安装位置">{current.location}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status]}>{current.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="是否特种设备">{current.is_special === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
            <Descriptions.Item label="制造商">{current.manufacturer}</Descriptions.Item>
            <Descriptions.Item label="购置日期">{current.purchase_date}</Descriptions.Item>
            <Descriptions.Item label="保修截止">{current.warranty_end}</Descriptions.Item>
            <Descriptions.Item label="上次检定日期">{current.last_inspection_date}</Descriptions.Item>
            <Descriptions.Item label="检定周期（月）">{current.inspection_cycle}</Descriptions.Item>
            <Descriptions.Item label="下次检定日期">{current.next_inspection_date}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
