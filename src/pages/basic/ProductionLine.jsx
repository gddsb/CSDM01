import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Typography, message, Row, Col } from 'antd'
import {
  DeploymentUnitOutlined, PlayCircleOutlined, ToolOutlined,
  EditOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { productionLines, processes } from '../../mock/data'

const { Text } = Typography

// 产线状态标签颜色映射
const statusColorMap = { '运行中': 'green', '维护中': 'orange', '停用': 'red' }

const statusOptions = ['运行中', '维护中', '停用'].map(s => ({ label: s, value: s }))

export default function ProductionLine() {
  const [data, setData] = useState(productionLines)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const runningCount = data.filter(l => l.status === '运行中').length
  const maintenanceCount = data.filter(l => l.status === '维护中').length

  const stats = [
    { label: '总产线数', value: data.length, icon: <DeploymentUnitOutlined />, color: '#2196F3' },
    { label: '运行中', value: runningCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '维护中', value: maintenanceCount, icon: <ToolOutlined />, color: '#FF9800' },
  ]

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
        setData(prev => prev.map(l => l.line_id === editing.line_id ? { ...l, ...values } : l))
        message.success('产线编辑成功')
      } else {
        const newLine = {
          line_id: 'l' + Date.now(),
          line_code: 'LINE-' + (data.length + 1),
          sort_order: data.length + 1,
          line_leader: null,
          ...values,
        }
        setData(prev => [newLine, ...prev])
        message.success('产线新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '产线编号', dataIndex: 'line_code', key: 'line_code', width: 120 },
    { title: '产线名称', dataIndex: 'line_name', key: 'line_name', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: '所属车间', dataIndex: 'workshop', key: 'workshop', width: 120 },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
      ),
    },
  ]

  // 展开行：展示该产线关联的工序列表
  const processColumns = [
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '工序编码', dataIndex: 'process_code', key: 'process_code', width: 120 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
  ]

  const expandedRowRender = (record) => (
    <div style={{ padding: '4px 0' }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {record.line_name}（{record.line_code}）关联工序，共 {processes.length} 道：
      </Text>
      <Table
        columns={processColumns}
        dataSource={processes}
        rowKey="process_id"
        size="small"
        pagination={false}
      />
    </div>
  )

  return (
    <>
      <ThreeSectionPage
        title="产线管理"
        breadcrumbs="基础数据 / 产线管理"
        stats={stats}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="line_id"
            size="small"
            expandable={{
              expandedRowRender,
              rowExpandable: () => true,
            }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑产线' : '新增产线'}
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
              <Form.Item name="line_name" label="产线名称" rules={[{ required: true, message: '请输入产线名称' }]}>
                <Input placeholder="请输入产线名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workshop" label="车间" rules={[{ required: true, message: '请输入车间' }]}>
                <Input placeholder="请输入车间" />
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
    </>
  )
}
