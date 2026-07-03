import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Row, Col, Switch, Drawer, Descriptions, Space } from 'antd'
import {
  ImportOutlined, ToolOutlined, DeleteOutlined,
  EditOutlined, PlusOutlined, EyeOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { defectTypes as defectData } from '../../mock/data'

// 所属大类标签颜色映射
const typeColorMap = { '来料不良': 'blue', '制程不良': 'orange', '检验报废': 'red' }

const categoryOptions = ['来料不良', '制程不良', '检验报废'].map(c => ({ label: c, value: c }))
const severityOptions = ['轻微', '一般', '严重'].map(s => ({ label: s, value: s }))

export default function DefectManagement() {
  const [data, setData] = useState(defectData)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [form] = Form.useForm()

  const incomingCount = data.filter(d => d.defect_type === '来料不良').length
  const processCount = data.filter(d => d.defect_type === '制程不良').length
  const scrapCount = data.filter(d => d.defect_type === '检验报废').length

  const stats = [
    { label: '来料不良数', value: incomingCount, icon: <ImportOutlined />, color: '#2196F3' },
    { label: '制程不良数', value: processCount, icon: <ToolOutlined />, color: '#FF9800' },
    { label: '检验报废数', value: scrapCount, icon: <DeleteOutlined />, color: '#F44336' },
  ]

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    // 表单字段使用 defect_category，数据字段为 defect_type，此处做映射回填
    form.setFieldsValue({
      ...record,
      defect_category: record.defect_type,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(d => editing.defect_id === d.defect_id ? {
          ...d,
          defect_code: values.defect_code,
          defect_name: values.defect_name,
          defect_type: values.defect_category,
          severity: values.severity,
          description: values.description,
          defect_unit: values.defect_unit || d.defect_unit,
          available_units: values.available_units ? values.available_units.split(',').map(u => u.trim()) : d.available_units,
          display: !!values.display,
          sort_order: values.sort_order ? parseInt(values.sort_order) : d.sort_order,
        } : d))
        message.success('不良项编辑成功')
      } else {
        const newDefect = {
          defect_id: 'df' + Date.now(),
          defect_code: values.defect_code,
          defect_name: values.defect_name,
          defect_type: values.defect_category,
          severity: values.severity,
          description: values.description,
          defect_unit: values.defect_unit || '个',
          available_units: values.available_units ? values.available_units.split(',').map(u => u.trim()) : ['个'],
          display: !!values.display,
          sort_order: values.sort_order ? parseInt(values.sort_order) : data.length + 1,
          status: '启用',
        }
        setData(prev => [newDefect, ...prev])
        message.success('不良项新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 130 },
    { title: '不良名称', dataIndex: 'defect_name', key: 'defect_name' },
    {
      title: '所属大类', dataIndex: 'defect_type', key: 'defect_type', width: 110,
      render: v => <Tag color={typeColorMap[v]}>{v}</Tag>,
    },
    { title: '默认单位', dataIndex: 'defect_unit', key: 'defect_unit', width: 90 },
    {
      title: '可选单位', dataIndex: 'available_units', key: 'available_units', width: 120,
      render: v => Array.isArray(v) ? v.join('、') : v,
    },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="不良分类"
        breadcrumbs="基础数据 / 不良分类"
        stats={stats}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="defect_id"
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑不良项' : '新增不良项'}
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
              <Form.Item name="defect_code" label="不良编码" rules={[{ required: true, message: '请输入不良编码' }]}>
                <Input placeholder="请输入不良编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="defect_name" label="不良名称" rules={[{ required: true, message: '请输入不良名称' }]}>
                <Input placeholder="请输入不良名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="defect_category" label="不良类别" rules={[{ required: true, message: '请选择不良类别' }]}>
                <Select placeholder="请选择不良类别" options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重等级" rules={[{ required: true, message: '请选择严重等级' }]}>
                <Select placeholder="请选择严重等级" options={severityOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="defect_unit" label="默认单位" rules={[{ required: true, message: '请输入默认单位' }]}>
                <Input placeholder="如：个、处、片" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="available_units" label="可选单位（逗号分隔）" rules={[{ required: true, message: '请输入可选单位' }]}>
                <Input placeholder="如：个,处 或 个" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="display" label="默认显示" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
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
              <Tag color={typeColorMap[viewRecord.defect_type]}>{viewRecord.defect_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重等级">{viewRecord.severity || '-'}</Descriptions.Item>
            <Descriptions.Item label="默认单位">{viewRecord.defect_unit}</Descriptions.Item>
            <Descriptions.Item label="可选单位">{Array.isArray(viewRecord.available_units) ? viewRecord.available_units.join('、') : viewRecord.available_units}</Descriptions.Item>
            <Descriptions.Item label="默认显示">{viewRecord.display ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={viewRecord.status === '启用' ? 'green' : 'red'}>{viewRecord.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{viewRecord.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
