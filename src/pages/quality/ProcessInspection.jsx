import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Select, DatePicker, Space, Row, Col, Modal, Form, Input, message } from 'antd'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, PercentageOutlined,
  PlusOutlined, ExportOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { workOrders, processes } from '../../mock/data'

const { RangePicker } = DatePicker

const resultColor = { '合格': 'success', '不合格': 'error' }

// 过程检验 mock 数据（基于 workOrders 与 processes 生成）
const initialProcessInspections = [
  { inspection_id: 'pi1', inspection_no: 'GC20260630001', work_order_id: 'w1', work_order_no: 'WO20260630001', material_name: '900g奶粉罐', process_id: 'p3', process_name: '成圆焊接', item_name: '焊缝强度', standard_value: '≥200N', actual_value: '235N', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 12:10:00' },
  { inspection_id: 'pi2', inspection_no: 'GC20260630002', work_order_id: 'w1', work_order_no: 'WO20260630001', material_name: '900g奶粉罐', process_id: 'p4', process_name: '补涂烘干', item_name: '涂层厚度', standard_value: '8±2μm', actual_value: '9μm', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 13:05:00' },
  { inspection_id: 'pi3', inspection_no: 'GC20260630003', work_order_id: 'w1', work_order_no: 'WO20260630001', material_name: '900g奶粉罐', process_id: 'p7', process_name: '正压测漏', item_name: '保压测试', standard_value: '0.1MPa保压30s无渗漏', actual_value: '保压通过', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 14:20:00' },
  { inspection_id: 'pi4', inspection_no: 'GC20260629001', work_order_id: 'w2', work_order_no: 'WO20260629001', material_name: '800g奶粉罐', process_id: 'p3', process_name: '成圆焊接', item_name: '焊缝强度', standard_value: '≥200N', actual_value: '185N', result: '不合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-29 11:00:00' },
  { inspection_id: 'pi5', inspection_no: 'GC20260629002', work_order_id: 'w2', work_order_no: 'WO20260629001', material_name: '800g奶粉罐', process_id: 'p1', process_name: '裁剪下料', item_name: '板材尺寸', standard_value: '800±1.0mm', actual_value: '800.2mm', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-29 10:15:00' },
  { inspection_id: 'pi6', inspection_no: 'GC20260628001', work_order_id: 'w3', work_order_no: 'WO20260628001', material_name: '900g奶粉罐', process_id: 'p8', process_name: '在线光检测', item_name: '外观缺陷', standard_value: '无明显缺陷', actual_value: '合格', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-28 15:30:00' },
  { inspection_id: 'pi7', inspection_no: 'GC20260628002', work_order_id: 'w3', work_order_no: 'WO20260628001', material_name: '900g奶粉罐', process_id: 'p6', process_name: '翻边封口', item_name: '翻边高度', standard_value: '2.8±0.2mm', actual_value: '2.9mm', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-28 14:00:00' },
  { inspection_id: 'pi8', inspection_no: 'GC20260630004', work_order_id: 'w1', work_order_no: 'WO20260630001', material_name: '900g奶粉罐', process_id: 'p9', process_name: '人工全检', item_name: '外观全检', standard_value: '无明显缺陷', actual_value: '合格', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 15:00:00' },
]

const workOrderOptions = workOrders.map(w => ({ label: `${w.work_order_no} (${w.material_name})`, value: w.work_order_id }))
const processOptions = processes.map(p => ({ label: p.process_name, value: p.process_id }))

export default function ProcessInspection() {
  const [data, setData] = useState(initialProcessInspections)
  const [workOrderId, setWorkOrderId] = useState(undefined)
  const [result, setResult] = useState(undefined)
  const [dateRange, setDateRange] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const selectedWorkOrderId = Form.useWatch('work_order_id', form)
  const selectedWorkOrder = workOrders.find(w => w.work_order_id === selectedWorkOrderId)

  const filtered = useMemo(() => {
    return data.filter(item => {
      const matchWo = !workOrderId || item.work_order_id === workOrderId
      const matchResult = !result || item.result === result
      let matchDate = true
      if (dateRange && dateRange[0] && dateRange[1]) {
        const t = dayjs(item.inspection_time)
        matchDate = t.isAfter(dayjs(dateRange[0]).subtract(1, 'day')) && t.isBefore(dayjs(dateRange[1]).add(1, 'day'))
      }
      return matchWo && matchResult && matchDate
    })
  }, [data, workOrderId, result, dateRange])

  const totalCount = data.length
  const passCount = data.filter(i => i.result === '合格').length
  const failCount = data.filter(i => i.result === '不合格').length
  const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : '0.0'

  const stats = [
    { label: '检验批次', value: totalCount, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '合格批次', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格批次', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <PercentageOutlined />, color: '#9C27B0' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ inspector_name: '质量检验员', result: '合格' })
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
        inspection_no: 'GC' + dayjs().format('YYYYMMDD') + String(Math.floor(Math.random() * 9000) + 1000),
        work_order_id: wo.work_order_id,
        work_order_no: wo.work_order_no,
        material_name: wo.material_name,
        process_id: proc.process_id,
        process_name: proc.process_name,
        item_name: values.item_name,
        standard_value: values.standard_value,
        actual_value: values.actual_value,
        result: values.result,
        inspector: 'u5',
        inspector_name: values.inspector_name || '质量检验员',
        inspection_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setData(prev => [newRecord, ...prev])
      message.success('过程检验记录已新增')
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' },
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
    { title: '检验工序', dataIndex: 'process_name', key: 'process_name', width: 100 },
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 110 },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 160 },
    { title: '实测值', dataIndex: 'actual_value', key: 'actual_value', width: 120 },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: v => <Tag color={resultColor[v]}>{v}</Tag>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160 },
  ]

  return (
    <>
      <ThreeSectionPage
        title="过程检验"
        breadcrumbs="质量管理 / 过程检验"
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
              <Col span={6}>
                <Select
                  placeholder="工单选择"
                  allowClear
                  style={{ width: '100%' }}
                  options={workOrderOptions}
                  value={workOrderId}
                  onChange={setWorkOrderId}
                />
              </Col>
              <Col span={6}>
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
              <Col span={8}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={setDateRange}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setWorkOrderId(undefined); setResult(undefined); setDateRange(null) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="inspection_id"
              size="small"
              scroll={{ x: 1400 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title="新增过程检验"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={620}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="work_order_id" label="工单选择" rules={[{ required: true, message: '请选择工单' }]}>
                <Select placeholder="请选择工单" options={workOrderOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedWorkOrder?.material_name || '-'} disabled />
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
    </>
  )
}
