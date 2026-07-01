import React, { useState } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  Checkbox, Alert, Descriptions, message
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, ArrowDownOutlined, WarningOutlined,
  PlusOutlined, ExportOutlined, SearchOutlined, ReloadOutlined, EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { processReports, workOrders, orders, processes, devices, defectTypes } from '../../mock/data'

const processMap = Object.fromEntries(processes.map(p => [p.process_id, p]))
// 工单映射：通过报工记录的 work_order_id 反查关联订单 order_no / order_id
const workOrderMap = Object.fromEntries(workOrders.map(w => [w.work_order_id, w]))
const defectMap = Object.fromEntries(defectTypes.map(d => [d.defect_id, d]))
const defectGroups = ['来料不良', '制程不良', '检验报废']

// 订单筛选项：仅展示存在工单的订单，体现 订单 → 工单 的层级关系
const orderFilterOptions = [...new Set(workOrders.map(w => w.order_id))].map(oid => {
  const w = workOrders.find(x => x.order_id === oid)
  return { label: w ? w.order_no : oid, value: oid }
})

export default function ProcessReporting() {
  const [data, setData] = useState(processReports)
  const [search, setSearch] = useState('')
  const [processFilter, setProcessFilter] = useState(undefined)
  const [orderFilter, setOrderFilter] = useState(undefined)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [selWorkOrder, setSelWorkOrder] = useState(null)
  const [selProcess, setSelProcess] = useState(null)
  const [inputQty, setInputQty] = useState(0)
  const [defects, setDefects] = useState({})

  const today = dayjs().format('YYYY-MM-DD')
  const filtered = data.filter(r => {
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase())
    const matchProcess = !processFilter || r.process_id === processFilter
    // 按工单所属订单过滤：通过 work_order_id 反查 order_id
    const wo = workOrderMap[r.work_order_id]
    const matchOrder = !orderFilter || (wo && wo.order_id === orderFilter)
    return matchSearch && matchProcess && matchOrder
  })

  const stats = [
    { label: '总报工记录', value: data.length, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '今日报工', value: data.filter(r => r.report_time && r.report_time.startsWith(today)).length, icon: <ClockCircleOutlined />, color: '#00BCD4' },
    { label: '累计投入', value: data.reduce((s, r) => s + r.input_qty, 0).toLocaleString(), icon: <ArrowDownOutlined />, color: '#FF9800' },
    { label: '累计不良', value: data.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0).toLocaleString(), icon: <WarningOutlined />, color: '#F44336' },
  ]

  // 计算上道工序产出（投入 - 不良合计）
  const computeInputQty = (workOrderId, processId) => {
    const proc = processMap[processId]
    if (!proc) return 0
    const prevReports = data.filter(r => r.work_order_id === workOrderId)
    let prevOutput = null
    let prevSort = -1
    for (const r of prevReports) {
      const rp = processMap[r.process_id]
      if (rp && rp.sort_order < proc.sort_order && rp.sort_order > prevSort) {
        prevSort = rp.sort_order
        prevOutput = r.output_qty
      }
    }
    return prevOutput != null ? prevOutput : 0
  }

  const currentProcess = selProcess ? processMap[selProcess] : null
  const isFirstProcess = currentProcess?.sort_order === 1

  const sumDefectsByType = (type) => Object.entries(defects).reduce((s, [id, qty]) => {
    const d = defectMap[id]
    return s + (d && d.defect_type === type ? (qty || 0) : 0)
  }, 0)
  const totalDefect = Object.values(defects).reduce((s, q) => s + (q || 0), 0)
  const defectMat = sumDefectsByType('来料不良')
  const defectProc = sumDefectsByType('制程不良')
  const defectScrap = sumDefectsByType('检验报废')
  const outputQty = Math.max(0, inputQty - totalDefect)

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setSelWorkOrder(null)
    setSelProcess(null)
    setInputQty(0)
    setDefects({})
    setAddOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      work_order_id: r.work_order_id,
      process_id: r.process_id,
      device_id: r.device_id || undefined,
    })
    setSelWorkOrder(r.work_order_id)
    setSelProcess(r.process_id)
    setInputQty(r.input_qty)
    // 编辑时将历史汇总不良映射到各分组首个不良项，便于继续维护
    const next = {}
    const map = { '来料不良': r.defect_material, '制程不良': r.defect_process, '检验报废': r.defect_scrap }
    defectGroups.forEach(g => {
      const first = defectTypes.find(d => d.defect_type === g)
      if (first && map[g] > 0) next[first.defect_id] = map[g]
    })
    setDefects(next)
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const proc = processMap[values.process_id]
    const w = workOrders.find(w => w.work_order_id === values.work_order_id)
    const finalInput = isFirstProcess ? inputQty : computeInputQty(values.work_order_id, values.process_id)
    const device = devices.find(d => d.device_id === values.device_id)
    if (editing) {
      setData(prev => prev.map(r => r.report_id === editing.report_id ? {
        ...r,
        work_order_id: values.work_order_id,
        work_order_no: w?.work_order_no || r.work_order_no,
        process_id: values.process_id,
        process_name: proc?.process_name || r.process_name,
        input_qty: finalInput,
        defect_material: defectMat,
        defect_process: defectProc,
        defect_scrap: defectScrap,
        output_qty: Math.max(0, finalInput - totalDefect),
        device_id: values.device_id || null,
        device_name: device?.device_name || '-',
        report_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      } : r))
      message.success('报工记录已更新')
    } else {
      const newReport = {
        report_id: 'rp' + Date.now(),
        work_order_id: values.work_order_id,
        work_order_no: w?.work_order_no || '-',
        process_id: values.process_id,
        process_name: proc?.process_name || '-',
        input_qty: finalInput,
        defect_material: defectMat,
        defect_process: defectProc,
        defect_scrap: defectScrap,
        output_qty: Math.max(0, finalInput - totalDefect),
        device_id: values.device_id || null,
        device_name: device?.device_name || '-',
        report_user: 'u7',
        report_user_name: '工序操作人',
        report_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setData(prev => [newReport, ...prev])
      message.success('报工记录已新增')
    }
    setAddOpen(false)
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    {
      // 关联订单：通过报工记录的 work_order_id 反查工单的 order_no，体现 订单 → 工单 层级
      title: '关联订单', key: 'order_no', width: 150,
      render: (_, r) => workOrderMap[r.work_order_id]?.order_no || '-',
    },
    {
      title: '工序', key: 'process', width: 140,
      render: (_, r) => {
        const p = processMap[r.process_id]
        return p ? `${p.process_code} ${p.process_name}` : r.process_name
      },
    },
    { title: '投入数量', dataIndex: 'input_qty', key: 'input_qty', width: 90, render: v => v.toLocaleString() },
    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 90, render: v => v || 0 },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 90, render: v => v || 0 },
    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 90, render: v => v || 0 },
    {
      title: '不良合计', key: 'defect_total', width: 90,
      render: (_, r) => <Tag color={r.defect_material + r.defect_process + r.defect_scrap > 0 ? 'error' : 'default'}>{r.defect_material + r.defect_process + r.defect_scrap}</Tag>,
    },
    { title: '产出数量', dataIndex: 'output_qty', key: 'output_qty', width: 90, render: v => v.toLocaleString() },
    { title: '使用设备', dataIndex: 'device_name', key: 'device_name', width: 130, render: v => v || '-' },
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 100 },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time', width: 160 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, r) => <Button type="link" size="small" onClick={() => handleEdit(r)}>修改</Button>,
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工序报工"
        breadcrumbs="生产管理 / 工序报工"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增报工</Button>}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Select
                  placeholder="订单筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={orderFilterOptions}
                  value={orderFilter}
                  onChange={setOrderFilter}
                />
              </Col>
              <Col span={6}>
                <Input
                  placeholder="搜索工单编号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Col>
              <Col span={6}>
                <Select
                  placeholder="工序筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={processes.map(p => ({ label: `${p.process_code} ${p.process_name}`, value: p.process_id }))}
                  value={processFilter}
                  onChange={setProcessFilter}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setProcessFilter(undefined); setOrderFilter(undefined) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="report_id"
              size="small"
              scroll={{ x: 1650 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
              expandable={{
                expandedRowRender: (r) => {
                  const w = workOrderMap[r.work_order_id]
                  return (
                    <div>
                      <Descriptions title="不良明细" size="small" column={4} bordered>
                        <Descriptions.Item label="来料不良">{r.defect_material}</Descriptions.Item>
                        <Descriptions.Item label="制程不良">{r.defect_process}</Descriptions.Item>
                        <Descriptions.Item label="检验报废">{r.defect_scrap}</Descriptions.Item>
                        <Descriptions.Item label="不良合计">{r.defect_material + r.defect_process + r.defect_scrap}</Descriptions.Item>
                      </Descriptions>
                      <Descriptions title="物料使用信息" size="small" column={4} bordered style={{ marginTop: 12 }}>
                        <Descriptions.Item label="工单物料">{w?.material_name || '-'}</Descriptions.Item>
                        <Descriptions.Item label="投入数量">{r.input_qty}</Descriptions.Item>
                        <Descriptions.Item label="产出数量">{r.output_qty}</Descriptions.Item>
                        <Descriptions.Item label="损耗数量">{r.input_qty - r.output_qty}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  )
                },
              }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '修改报工' : '新增报工'}
        open={addOpen}
        onOk={handleSubmit}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnClose
      >
        <Alert
          message="首道工序投入 = 手工录入；后续工序投入 = 上道产出。产出 = 投入 - 不良合计。"
          type="info"
          showIcon
          style={{ marginBottom: 12, fontSize: 12 }}
        />
        <Form
          form={form}
          layout="vertical"
          className="compact-form"
          onValuesChange={(changed) => {
            if ('work_order_id' in changed) {
              setSelWorkOrder(changed.work_order_id)
              form.setFieldValue('process_id', undefined)
              setSelProcess(null)
              setInputQty(0)
              setDefects({})
            }
            if ('process_id' in changed) {
              const pid = changed.process_id
              setSelProcess(pid)
              const proc = processMap[pid]
              if (proc && proc.sort_order !== 1) {
                const woid = form.getFieldValue('work_order_id')
                setInputQty(computeInputQty(woid, pid))
              } else {
                setInputQty(0)
              }
              setDefects({})
            }
          }}
        >
          {/* 第一行：工单 + 工序 */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="工单" name="work_order_id" rules={[{ required: true, message: '请选择工单' }]}>
                <Select
                  placeholder="请选择工单"
                  options={workOrders.map(w => ({ label: `${w.work_order_no} (订单: ${w.order_no})`, value: w.work_order_id }))}
                  disabled={!!editing}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="工序" name="process_id" rules={[{ required: true, message: '请选择工序' }]}>
                <Select
                  placeholder="请选择工序"
                  options={processes.map(p => ({ label: `${p.process_code} ${p.process_name}`, value: p.process_id }))}
                  disabled={!!editing}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 第二行：投入数量 + 使用设备 */}
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="投入数量">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  value={inputQty}
                  onChange={v => setInputQty(v || 0)}
                  disabled={!isFirstProcess}
                  placeholder={isFirstProcess ? '首道工序手工录入' : '由上道产出自动计算'}
                />
              </Form.Item>
              {!isFirstProcess && selProcess && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8, display: 'block', marginBottom: 8 }}>
                  非首道，投入 = 上道产出（只读）
                </span>
              )}
            </Col>
            <Col span={8}>
              <Form.Item label="使用设备" name="device_id">
                <Select
                  placeholder="选择设备（可选）"
                  allowClear
                  options={devices.map(d => ({ label: `${d.device_code} ${d.device_name}`, value: d.device_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="产出数量（自动计算）">
                <div style={{
                  height: 32, lineHeight: '32px', borderRadius: 6, textAlign: 'center',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  fontWeight: 700, fontSize: 16, color: 'var(--color-primary)',
                }}>
                  {outputQty.toLocaleString()}
                </div>
              </Form.Item>
            </Col>
          </Row>

          {/* 不良项登记：三列 */}
          <Form.Item label="不良项登记" style={{ marginBottom: 8 }}>
            <Row gutter={12}>
              {defectGroups.map(group => {
                const groupDefects = defectTypes.filter(d => d.defect_type === group)
                const groupTotal = groupDefects.reduce((s, d) => s + (defects[d.defect_id] || 0), 0)
                const groupColor = group === '来料不良' ? '#FF9800' : group === '制程不良' ? '#F44336' : '#9E9E9E'
                return (
                  <Col key={group} span={8}>
                    <div style={{
                      border: `1px solid ${groupColor}40`,
                      borderRadius: 6,
                      padding: 10,
                      height: '100%',
                      background: `${groupColor}08`,
                    }}>
                      <div style={{
                        fontWeight: 600, marginBottom: 8, fontSize: 13,
                        color: groupColor, borderBottom: `1px solid ${groupColor}30`,
                        paddingBottom: 6, display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>{group}</span>
                        <span>合计: {groupTotal}</span>
                      </div>
                      {groupDefects.map(d => (
                        <div key={d.defect_id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Checkbox
                            checked={defects[d.defect_id] != null}
                            onChange={e => {
                              setDefects(prev => {
                                const next = { ...prev }
                                if (e.target.checked) next[d.defect_id] = 0
                                else delete next[d.defect_id]
                                return next
                              })
                            }}
                          >
                            <span style={{ fontSize: 12 }}>{d.defect_name}</span>
                          </Checkbox>
                          {defects[d.defect_id] != null && (
                            <InputNumber
                              size="small"
                              min={0}
                              style={{ width: 70 }}
                              value={defects[d.defect_id]}
                              onChange={v => setDefects(prev => ({ ...prev, [d.defect_id]: v || 0 }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Form.Item>

          {/* 底部数量汇总条 */}
          <div style={{
            display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden',
            border: '1px solid var(--border-color)',
          }}>
            {[
              { label: '来料不良', value: defectMat, color: '#FF9800' },
              { label: '制程不良', value: defectProc, color: '#F44336' },
              { label: '检验报废', value: defectScrap, color: '#9E9E9E' },
              { label: '不良合计', value: totalDefect, color: '#E91E63' },
              { label: '投入数量', value: inputQty, color: '#2196F3' },
              { label: '产出数量', value: outputQty, color: '#4CAF50' },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px',
                borderRight: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none',
                background: 'var(--bg-card)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Form>
      </Modal>
    </>
  )
}
