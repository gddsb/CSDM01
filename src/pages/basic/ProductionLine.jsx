import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Typography, message, Row, Col, Space, Drawer, Descriptions } from 'antd'
import {
  DeploymentUnitOutlined, PlayCircleOutlined, ToolOutlined,
  EditOutlined, PlusOutlined, MinusOutlined, EyeOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { productionLines, processes, devices } from '../../mock/data'

const { Text } = Typography

// 产线状态标签颜色映射
const statusColorMap = { '运行中': 'green', '维护中': 'orange', '停用': 'red' }

const statusOptions = ['运行中', '维护中', '停用'].map(s => ({ label: s, value: s }))

// A线~Z线 26个选项
const lineNameOptions = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i) + '线').map(n => ({ label: n, value: n }))

const processOptions = processes.map(p => ({
  label: `${p.process_code} ${p.process_name}`,
  value: p.process_id,
}))
const deviceOptions = devices.map(d => ({
  label: `${d.device_code} ${d.device_name}`,
  value: d.device_id,
}))

export default function ProductionLine() {
  const [data, setData] = useState(productionLines)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [lineProcesses, setLineProcesses] = useState([])
  const [viewRecord, setViewRecord] = useState(null)
  const [form] = Form.useForm()

  const runningCount = data.filter(l => l.status === '运行中').length
  const maintenanceCount = data.filter(l => l.status === '维护中').length

  const stats = [
    { label: '总产线数', value: data.length, icon: <DeploymentUnitOutlined />, color: '#2196F3' },
    { label: '运行中', value: runningCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '维护中', value: maintenanceCount, icon: <ToolOutlined />, color: '#FF9800' },
  ]

  // 已被使用的产线名称（编辑时排除自身）
  const getUsedLineNames = (excludeId) => data.filter(l => l.line_id !== excludeId).map(l => l.line_name)

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setLineProcesses([])
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setLineProcesses([...(record.line_processes || [])])
    setModalVisible(true)
  }

  // 添加工序设备关联时的校验
  const addProcessDevice = () => {
    setLineProcesses(prev => [...prev, { process_id: undefined, device_id: undefined }])
  }

  const updateProcessItem = (index, field, value) => {
    const next = [...lineProcesses]
    next[index] = { ...next[index], [field]: value }
    setLineProcesses(next)
  }

  const removeProcessItem = (index) => {
    setLineProcesses(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      // 校验工序设备不重复
      for (let i = 0; i < lineProcesses.length; i++) {
        for (let j = i + 1; j < lineProcesses.length; j++) {
          if (lineProcesses[i].process_id && lineProcesses[j].process_id &&
              lineProcesses[i].process_id === lineProcesses[j].process_id &&
              lineProcesses[i].device_id && lineProcesses[j].device_id &&
              lineProcesses[i].device_id === lineProcesses[j].device_id) {
            message.error('不能重复关联同一工序和同一设备')
            return
          }
        }
      }
      const payload = { ...values, line_processes: lineProcesses }
      if (editing) {
        setData(prev => prev.map(l => l.line_id === editing.line_id ? { ...l, ...payload } : l))
        message.success('产线编辑成功')
      } else {
        const newLine = {
          line_id: 'l' + Date.now(),
          line_code: 'LINE-' + (data.length + 1),
          sort_order: data.length + 1,
          line_leader: null,
          ...payload,
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
    { title: '产线编号', dataIndex: 'line_code', key: 'line_code', width: 100 },
    { title: '产线名称', dataIndex: 'line_name', key: 'line_name', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: '所属车间', dataIndex: 'workshop', key: 'workshop', width: 100 },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    {
      title: '设备名称', key: 'device_names', width: 200,
      render: (_, r) => {
        const lp = r.line_processes || []
        const devs = lp.filter(p => p.device_id).map(p => {
          const d = devices.find(dev => dev.device_id === p.device_id)
          return d ? d.device_name : ''
        }).filter(Boolean)
        return devs.length > 0 ? devs.join('、') : '-'
      },
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  // 展开行：展示该产线关联的工序与设备
  const expandedRowRender = (record) => {
    const lp = record.line_processes || []
    const rows = lp.map((item, idx) => {
      const proc = processes.find(p => p.process_id === item.process_id)
      const dev = devices.find(d => d.device_id === item.device_id)
      return { key: idx, sort_order: idx + 1, process_code: proc?.process_code || '-', process_name: proc?.process_name || '-', device_code: dev?.device_code || '-', device_name: dev?.device_name || '-' }
    })
    return (
      <div style={{ padding: '4px 0' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {record.line_name}（{record.line_code}）关联工序与设备，共 {rows.length} 项：
        </Text>
        <Table
          columns={[
            { title: '序号', dataIndex: 'sort_order', width: 60 },
            { title: '工序编码', dataIndex: 'process_code', width: 100 },
            { title: '工序名称', dataIndex: 'process_name', width: 120 },
            { title: '设备编号', dataIndex: 'device_code', width: 120 },
            { title: '设备名称', dataIndex: 'device_name' },
          ]}
          dataSource={rows}
          size="small"
          pagination={false}
          rowKey="key"
        />
      </div>
    )
  }

  // 编辑时已使用的工序和设备（用于禁用已选项）
  const usedProcessIds = useMemo(() => {
    const ids = new Set()
    lineProcesses.forEach(item => { if (item.process_id) ids.add(item.process_id) })
    return ids
  }, [lineProcesses])

  const usedDeviceIds = useMemo(() => {
    const ids = new Set()
    lineProcesses.forEach(item => { if (item.device_id) ids.add(item.device_id) })
    return ids
  }, [lineProcesses])

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
      {/* 新增/编辑弹窗 */}
      <Modal
        title={editing ? '编辑产线' : '新增产线'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="line_name" label="产线名称" rules={[{ required: true, message: '请选择产线名称' }]}>
                <Select
                  placeholder="请选择产线名称"
                  options={lineNameOptions.filter(o => !getUsedLineNames(editing?.line_id).includes(o.value))}
                />
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
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>工序与设备关联</div>
          {lineProcesses.map((item, index) => {
            // 计算当前行以外的已选项，用于禁用
            const otherProcessIds = new Set(lineProcesses.filter((_, i) => i !== index).map(it => it.process_id).filter(Boolean))
            const otherDeviceIds = new Set(lineProcesses.filter((_, i) => i !== index).map(it => it.device_id).filter(Boolean))
            return (
              <Row gutter={12} key={index} style={{ marginBottom: 8, alignItems: 'center' }}>
                <Col span={10}>
                  <Select
                    placeholder="请选择工序"
                    options={processOptions}
                    value={item.process_id}
                    onChange={v => updateProcessItem(index, 'process_id', v)}
                    style={{ width: '100%' }}
                    status={item.process_id && otherProcessIds.has(item.process_id) ? 'error' : undefined}
                  />
                </Col>
                <Col span={10}>
                  <Select
                    placeholder="请选择设备"
                    options={deviceOptions}
                    value={item.device_id}
                    onChange={v => updateProcessItem(index, 'device_id', v)}
                    style={{ width: '100%' }}
                    status={item.device_id && otherDeviceIds.has(item.device_id) ? 'error' : undefined}
                  />
                </Col>
                <Col span={4}>
                  <Button
                    type="text"
                    danger
                    icon={<MinusOutlined />}
                    onClick={() => removeProcessItem(index)}
                  />
                </Col>
              </Row>
            )
          })}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={addProcessDevice}
            style={{ marginTop: 4 }}
          >
            添加工序与设备关联
          </Button>
          {lineProcesses.length > 0 && (() => {
            const processCounts = {}
            const deviceCounts = {}
            lineProcesses.forEach(item => {
              if (item.process_id) processCounts[item.process_id] = (processCounts[item.process_id] || 0) + 1
              if (item.device_id) deviceCounts[item.device_id] = (deviceCounts[item.device_id] || 0) + 1
            })
            const dupProcesses = Object.entries(processCounts).filter(([_, c]) => c > 1).map(([id]) => processes.find(p => p.process_id === id)?.process_name).filter(Boolean)
            const dupDevices = Object.entries(deviceCounts).filter(([_, c]) => c > 1).map(([id]) => devices.find(d => d.device_id === id)?.device_name).filter(Boolean)
            return (dupProcesses.length > 0 || dupDevices.length > 0) ? (
              <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>
                {dupProcesses.length > 0 && `存在重复工序：${dupProcesses.join('、')}; `}
                {dupDevices.length > 0 && `存在重复设备：${dupDevices.join('、')}`}
              </div>
            ) : null
          })()}
        </Form>
      </Modal>
      {/* 查看详情 Drawer */}
      <Drawer
        title="产线详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={520}
      >
        {viewRecord && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="产线编号">{viewRecord.line_code}</Descriptions.Item>
              <Descriptions.Item label="产线名称">{viewRecord.line_name}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColorMap[viewRecord.status]}>{viewRecord.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="所属车间">{viewRecord.workshop}</Descriptions.Item>
              <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>工序与设备关联</div>
            {expandedRowRender(viewRecord)}
          </>
        )}
      </Drawer>
    </>
  )
}
