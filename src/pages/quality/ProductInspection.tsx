import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Select, DatePicker, Space, Row, Col, Modal, Form, Input, Drawer, Descriptions, Typography } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, PercentageOutlined,
  PlusOutlined, ExportOutlined, ReloadOutlined, SearchOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { workOrders, processes } from '../../mock/data'

const { RangePicker } = DatePicker
const { Title } = Typography

const INSPECTION_TYPES = [
  { label: '首件', value: '首件', color: 'blue' },
  { label: '制程', value: '制程', color: 'purple' },
  { label: '成品', value: '成品', color: 'green' },
]

const resultColor = { '合格': 'success', '不合格': 'error' }
const handleColor = { '入库': 'green', '退货': 'red', '让步接收': 'orange', '报废': 'red' }
const triggerColor = { '自动': 'blue', '手工': 'purple' }
const statusColor = { '已完成': 'success', '检验中': 'processing', '待检': 'default' }
const typeColorMap = Object.fromEntries(INSPECTION_TYPES.map(t => [t.value, t.color]))

const initialInspections = [
  { inspection_id: 'pi1', inspection_no: 'CP20260630001', inspection_type: '首件', work_order_id: 'w1', work_order_no: 'WO20260630001', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', process_id: 'p3', process_name: '成圆焊接', item_name: '焊缝强度', standard_value: '≥200N', actual_value: '235N', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 09:10:00', trigger_type: '手工', standard_name: '900g奶粉罐检验标准V1', handle_type: '-', status: '已完成' },
  { inspection_id: 'pi2', inspection_no: 'CP20260630002', inspection_type: '制程', work_order_id: 'w1', work_order_no: 'WO20260630001', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', process_id: 'p4', process_name: '补涂烘干', item_name: '涂层厚度', standard_value: '8±2μm', actual_value: '9μm', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 13:05:00', trigger_type: '手工', standard_name: '-', handle_type: '-', status: '已完成' },
  { inspection_id: 'pi3', inspection_no: 'CP20260630003', inspection_type: '制程', work_order_id: 'w1', work_order_no: 'WO20260630001', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', process_id: 'p7', process_name: '正压测漏', item_name: '保压测试', standard_value: '0.1MPa保压30s无渗漏', actual_value: '保压通过', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 14:20:00', trigger_type: '自动', standard_name: '-', handle_type: '-', status: '已完成' },
  { inspection_id: 'pi4', inspection_no: 'CP20260630004', inspection_type: '成品', work_order_id: 'w1', work_order_no: 'WO20260630001', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', process_id: 'p9', process_name: '人工全检', item_name: '成品全检', standard_value: '按检验标准逐项检验', actual_value: '全部合格', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 16:00:00', trigger_type: '自动', standard_name: '900g奶粉罐检验标准V1', handle_type: '入库', status: '已完成' },
  { inspection_id: 'pi5', inspection_no: 'CP20260629001', inspection_type: '制程', work_order_id: 'w2', work_order_no: 'WO20260629001', material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', process_id: 'p3', process_name: '成圆焊接', item_name: '焊缝强度', standard_value: '≥200N', actual_value: '185N', result: '不合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-29 11:00:00', trigger_type: '手工', standard_name: '-', handle_type: '-', status: '已完成' },
  { inspection_id: 'pi6', inspection_no: 'CP20260629002', inspection_type: '制程', work_order_id: 'w2', work_order_no: 'WO20260629001', material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', process_id: 'p1', process_name: '裁剪下料', item_name: '板材尺寸', standard_value: '800±1.0mm', actual_value: '800.2mm', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-29 10:15:00', trigger_type: '手工', standard_name: '-', handle_type: '-', status: '已完成' },
  { inspection_id: 'pi7', inspection_no: 'CP20260628001', inspection_type: '成品', work_order_id: 'w3', work_order_no: 'WO20260628001', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', process_id: '-', process_name: '成品检验', item_name: '成品全检', standard_value: '按检验标准逐项检验', actual_value: '全部合格', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-28 15:30:00', trigger_type: '自动', standard_name: '900g奶粉罐检验标准V1', handle_type: '入库', status: '已完成' },
  { inspection_id: 'pi8', inspection_no: 'CP20260701001', inspection_type: '首件', work_order_id: 'w4', work_order_no: 'WO20260701001', material_code: 'ML-400-B', material_name: '400g奶粉罐', specification: '400g奶粉罐', process_id: 'p1', process_name: '裁剪下料', item_name: '首件确认', standard_value: '按首件检验清单确认', actual_value: '待检', result: '-', inspector: '-', inspector_name: '-', inspection_time: '-', trigger_type: '手工', standard_name: '400g奶粉罐检验标准V1', handle_type: '-', status: '待检' },
]

const workOrderOptions = workOrders.map(w => ({ label: `${w.work_order_no} (${w.material_name})`, value: w.work_order_id }))
const processOptions = processes.map(p => ({ label: p.process_name, value: p.process_id }))

export default function ProductInspection() {
  const [data, setData] = useState(initialInspections)
  const [inspectionType, setInspectionType] = useState(undefined)
  const [workOrderId, setWorkOrderId] = useState(undefined)
  const [result, setResult] = useState(undefined)
  const [dateRange, setDateRange] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const message = useMessage()

  const selectedWorkOrderId = Form.useWatch('work_order_id', form)
  const selectedWorkOrder = workOrders.find(w => w.work_order_id === selectedWorkOrderId)

  const filtered = useMemo(() => {
    return data.filter(item => {
      const matchType = !inspectionType || item.inspection_type === inspectionType
      const matchWo = !workOrderId || item.work_order_id === workOrderId
      const matchResult = !result || item.result === result
      let matchDate = true
      if (dateRange && dateRange[0] && dateRange[1] && item.inspection_time && item.inspection_time !== '-') {
        const t = dayjs(item.inspection_time)
        matchDate = t.isAfter(dayjs(dateRange[0]).subtract(1, 'day')) && t.isBefore(dayjs(dateRange[1]).add(1, 'day'))
      }
      return matchType && matchWo && matchResult && matchDate
    })
  }, [data, inspectionType, workOrderId, result, dateRange])

  const totalCount = filtered.length
  const passCount = filtered.filter(i => i.result === '合格').length
  const failCount = filtered.filter(i => i.result === '不合格').length
  const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : '0.0'
  const firstPieceCount = filtered.filter(i => i.inspection_type === '首件').length
  const processCount = filtered.filter(i => i.inspection_type === '制程').length
  const finishedCount = filtered.filter(i => i.inspection_type === '成品').length

  const stats = [
    { label: '检验总数', value: totalCount, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '首件', value: firstPieceCount, icon: <ExperimentOutlined />, color: '#1890FF' },
    { label: '制程', value: processCount, icon: <ExperimentOutlined />, color: '#722ED1' },
    { label: '成品', value: finishedCount, icon: <ExperimentOutlined />, color: '#52C41A' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <PercentageOutlined />, color: '#9C27B0' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ inspector_name: '质量检验员', result: '合格', inspection_type: '制程' })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const wo = workOrders.find(w => w.work_order_id === values.work_order_id)
      const proc = processes.find(p => p.process_id === values.process_id)
      const now = Date.now()
      const newRecord = {
        inspection_id: 'pi' + now,
        inspection_no: 'CP' + dayjs().format('YYYYMMDD') + String(Math.floor(Math.random() * 9000) + 1000),
        inspection_type: values.inspection_type,
        work_order_id: wo.work_order_id,
        work_order_no: wo.work_order_no,
        material_name: wo.material_name,
        process_id: proc?.process_id || '-',
        process_name: proc?.process_name || '-',
        item_name: values.item_name,
        standard_value: values.standard_value,
        actual_value: values.actual_value,
        result: values.result,
        inspector: 'u5',
        inspector_name: values.inspector_name || '质量检验员',
        inspection_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        trigger_type: values.trigger_type || '手工',
        standard_name: values.standard_name || '-',
        handle_type: '-',
        status: '已完成',
      }
      setData(prev => [newRecord, ...prev])
      message.success(`已新增${values.inspection_type}检验记录`)
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const showDetail = (record) => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' },
    {
      title: '类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 80,
      render: v => <Tag color={typeColorMap[v] || 'default'}>{v}</Tag>
    },
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', width: 180 },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 150 },
    {
      title: '结果', dataIndex: 'result', key: 'result', width: 80,
      render: v => v && v !== '-' ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 90,
      render: v => v && v !== '-' ? <Tag color={triggerColor[v] || 'default'}>{v}</Tag> : '-'
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验员', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
      )
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="产品检测"
        breadcrumbs="质量管理 / 产品检测"
        stats={stats}
        actions={
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增检验</Button>
            <Button icon={<ExportOutlined />}>导出</Button>
          </>
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={5}>
                <Select
                  placeholder="检验类型（首件/制程/成品）"
                  allowClear
                  style={{ width: '100%' }}
                  options={INSPECTION_TYPES}
                  value={inspectionType}
                  onChange={setInspectionType}
                />
              </Col>
              <Col span={5}>
                <Select
                  placeholder="工单选择"
                  allowClear
                  style={{ width: '100%' }}
                  options={workOrderOptions}
                  value={workOrderId}
                  onChange={setWorkOrderId}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="检验结果"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '合格', value: '合格' },
                    { label: '不合格', value: '不合格' },
                  ]}
                  value={result}
                  onChange={setResult}
                />
              </Col>
              <Col span={7}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={setDateRange}
                />
              </Col>
              <Col span={3}>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setInspectionType(undefined); setWorkOrderId(undefined); setResult(undefined); setDateRange(null) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <ResizableTable
              tableKey="pages_quality_ProductInspection"
              columns={columns}
              dataSource={filtered}
              rowKey="inspection_id"
              size="small"
              scroll={{ x: 1700 }}
              pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title="新增产品检验"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={INSPECTION_TYPES} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_order_id" label="关联工单" rules={[{ required: true, message: '请选择工单' }]}>
                <Select placeholder="请选择工单" options={workOrderOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedWorkOrder?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trigger_type" label="触发方式">
                <Select
                  placeholder="请选择触发方式"
                  options={[
                    { label: '手工', value: '手工' },
                    { label: '自动', value: '自动' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="process_id" label="检验工序" rules={[{ required: true, message: '请选择检验工序' }]}>
                <Select placeholder="请选择检验工序" options={processOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item_name" label="检验项目" rules={[{ required: true, message: '请输入检验项目' }]}>
                <Input placeholder="请输入检验项目" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_value" label="标准值" rules={[{ required: true, message: '请输入标准值' }]}>
                <Input placeholder="请输入标准值" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_value" label="实测值" rules={[{ required: true, message: '请输入实测值' }]}>
                <Input placeholder="请输入实测值" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="result" label="检验结果" rules={[{ required: true, message: '请选择检验结果' }]}>
                <Select
                  placeholder="请选择检验结果"
                  options={[
                    { label: '合格', value: '合格' },
                    { label: '不合格', value: '不合格' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspector_name" label="检验人">
                <Input placeholder="请输入检验人" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={780}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="检验类型">
                <Tag color={typeColorMap[current.inspection_type]}>{current.inspection_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联工单">{current.work_order_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status]}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="料品名称">{current.material_name}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                {current.trigger_type ? <Tag color={triggerColor[current.trigger_type]}>{current.trigger_type}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="检验工序">{current.process_name}</Descriptions.Item>
              <Descriptions.Item label="检验项目">{current.item_name}</Descriptions.Item>
              <Descriptions.Item label="检验标准" span={2}>{current.standard_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="标准值">{current.standard_value}</Descriptions.Item>
              <Descriptions.Item label="实测值">{current.actual_value}</Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{current.inspection_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result && current.result !== '-' ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {current.handle_type && current.handle_type !== '-' ? <Tag color={handleColor[current.handle_type]}>{current.handle_type}</Tag> : '-'}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </>
  )
}
