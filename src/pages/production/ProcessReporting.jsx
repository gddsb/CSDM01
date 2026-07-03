import React, { useState } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  Checkbox, Alert, Descriptions, message, Drawer
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, ArrowDownOutlined, WarningOutlined,
  PlusOutlined, ExportOutlined, SearchOutlined, ReloadOutlined, EditOutlined, EyeOutlined
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
  const [viewRecord, setViewRecord] = useState(null)
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
  const [defectUnits, setDefectUnits] = useState({})
  const [showMoreDefects, setShowMoreDefects] = useState(false)

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
    // 默认将全部来料不良、制程不良中 display=true 的项、全部检验报废添加到不良列表
    const defaultDefects = {}
    const defaultUnits = {}
    defectTypes.forEach(d => {
      if (d.defect_type === '来料不良' || d.defect_type === '检验报废' || (d.defect_type === '制程不良' && d.display)) {
        defaultDefects[d.defect_id] = 0
        defaultUnits[d.defect_id] = d.defect_unit
      }
    })
    setDefects(defaultDefects)
    setDefectUnits(defaultUnits)
    setShowMoreDefects(false)
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
    // 编辑时补充初始化所有默认可见项（来料不良全部、制程不良 display=true、检验报废全部）
    const unitNext = {}
    defectTypes.forEach(d => {
      if (d.defect_type === '来料不良' || d.defect_type === '检验报废' || (d.defect_type === '制程不良' && d.display)) {
        if (next[d.defect_id] == null) next[d.defect_id] = 0
        unitNext[d.defect_id] = d.defect_unit
      }
    })
    Object.keys(next).forEach(id => {
      const d = defectMap[id]
      if (d && !unitNext[id]) unitNext[id] = d.defect_unit
    })
    setDefects(next)
    setDefectUnits(unitNext)
    setShowMoreDefects(false)
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
    { title: '投入数量', dataIndex: 'input_qty', key: 'input_qty', width: 90, render: v => v?.toLocaleString() },
    {
      title: '合格数量', dataIndex: 'output_qty', key: 'output_qty', width: 90,
      render: v => v?.toLocaleString(),
    },
    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 90, render: v => v || 0 },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 90, render: v => v || 0 },
    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 90, render: v => v || 0 },
    {
      title: '不良合计', key: 'defect_total', width: 90,
      render: (_, r) => <Tag color={r.defect_material + r.defect_process + r.defect_scrap > 0 ? 'error' : 'default'}>{r.defect_material + r.defect_process + r.defect_scrap}</Tag>,
    },
    { title: '使用设备', dataIndex: 'device_name', key: 'device_name', width: 130, render: v => v || '-' },
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 100 },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time', width: 160 },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}>修改</Button>
        </Space>
      ),
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
        width={1000}
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

          {/* 不良项登记：来料不良/制程不良左右两侧，检验报废下方 */}
          <Form.Item label="不良项登记" style={{ marginBottom: 8 }}>
            {(() => {
              // 各分组当前已显示的缺陷项
              const matItems = defectTypes.filter(d => d.defect_type === '来料不良' && defects[d.defect_id] != null)
              const procItems = defectTypes.filter(d => d.defect_type === '制程不良' && defects[d.defect_id] != null)
              const scrapItems = defectTypes.filter(d => d.defect_type === '检验报废' && defects[d.defect_id] != null)
              // 制程不良中尚未添加的隐藏项
              const procHidden = defectTypes.filter(d => d.defect_type === '制程不良' && defects[d.defect_id] == null)

              const renderDefectRow = (d) => (
                <div key={d.defect_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ flex: 1, fontSize: 12 }}>{d.defect_name}</span>
                  <InputNumber
                    size="small"
                    min={0}
                    style={{ width: 70 }}
                    value={defects[d.defect_id]}
                    onChange={v => setDefects(prev => ({ ...prev, [d.defect_id]: v || 0 }))}
                  />
                  {d.available_units.length > 1 ? (
                    <Select
                      size="small"
                      style={{ width: 55 }}
                      value={defectUnits[d.defect_id] || d.defect_unit}
                      options={d.available_units.map(u => ({ label: u, value: u }))}
                      onChange={u => setDefectUnits(prev => ({ ...prev, [d.defect_id]: u }))}
                    />
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 30, textAlign: 'center' }}>{d.defect_unit}</span>
                  )}
                </div>
              )

              return (
                <>
                  {/* 上排：来料不良 + 制程不良 */}
                  <Row gutter={12} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <div style={{ border: '1px solid #FF980040', borderRadius: 6, padding: '8px 12px', background: '#FF980008' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#FF9800', borderBottom: '1px solid #FF980030', paddingBottom: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>来料不良</span>
                          <span>合计: {matItems.reduce((s, d) => s + (defects[d.defect_id] || 0), 0)}</span>
                        </div>
                        {matItems.map(renderDefectRow)}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ border: '1px solid #F4433640', borderRadius: 6, padding: '8px 12px', background: '#F4433608' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#F44336', borderBottom: '1px solid #F4433630', paddingBottom: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>制程不良</span>
                          <span>合计: {procItems.reduce((s, d) => s + (defects[d.defect_id] || 0), 0)}</span>
                        </div>
                        {procItems.map(renderDefectRow)}
                        {/* 添加其他项：下拉框放在最后一行 */}
                        {procHidden.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>添加其他项：</span>
                            <Select
                              size="small"
                              style={{ flex: 1 }}
                              placeholder="请选择"
                              value={undefined}
                              options={procHidden.map(d => ({ label: d.defect_name, value: d.defect_id }))}
                              onChange={id => {
                                const d = defectMap[id]
                                if (d) {
                                  setDefects(prev => ({ ...prev, [id]: 0 }))
                                  setDefectUnits(u => ({ ...u, [id]: d.defect_unit }))
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </Col>
                  </Row>
                  {/* 下排：检验报废 */}
                  <Row gutter={12}>
                    <Col span={24}>
                      <div style={{ border: '1px solid #9E9E9E40', borderRadius: 6, padding: '8px 12px', background: '#9E9E9E08' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#9E9E9E', borderBottom: '1px solid #9E9E9E30', paddingBottom: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>检验报废</span>
                          <span>合计: {scrapItems.reduce((s, d) => s + (defects[d.defect_id] || 0), 0)}</span>
                        </div>
                        <Row gutter={12}>
                          {scrapItems.map(d => (
                            <Col span={6} key={d.defect_id}>
                              {renderDefectRow(d)}
                            </Col>
                          ))}
                        </Row>
                      </div>
                    </Col>
                  </Row>
                </>
              )
            })()}
          </Form.Item>
        </Form>
      </Modal>
      {/* 查看报工详情 */}
      <Drawer
        title="报工详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={700}
      >
        {viewRecord && (() => {
          const wo = workOrders.find(w => w.work_order_id === viewRecord.work_order_id)
          const proc = processMap[viewRecord.process_id]
          const relatedReports = data.filter(r => r.work_order_id === viewRecord.work_order_id)
          return (
            <>
              <Descriptions column={3} size="small" bordered style={{ marginBottom: 24 }}>
                <Descriptions.Item label="工单编号">{viewRecord.work_order_no}</Descriptions.Item>
                <Descriptions.Item label="工序">{proc ? `${proc.process_code} ${proc.process_name}` : viewRecord.process_name}</Descriptions.Item>
                <Descriptions.Item label="报工人">{viewRecord.report_user_name}</Descriptions.Item>
                <Descriptions.Item label="投入数量">{viewRecord.input_qty?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="合格数量">{viewRecord.output_qty?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="使用设备">{viewRecord.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="来料不良">{viewRecord.defect_material || 0}</Descriptions.Item>
                <Descriptions.Item label="制程不良">{viewRecord.defect_process || 0}</Descriptions.Item>
                <Descriptions.Item label="检验报废">{viewRecord.defect_scrap || 0}</Descriptions.Item>
                <Descriptions.Item label="报工时间" span={3}>{viewRecord.report_time}</Descriptions.Item>
              </Descriptions>
              <h5 style={{ marginBottom: 12 }}>该工单各工序报工情况</h5>
              <Table
                size="small"
                dataSource={relatedReports}
                rowKey="report_id"
                pagination={false}
                bordered
                columns={[
                  { title: '工序', render: (_, r) => { const p = processMap[r.process_id]; return p ? `${p.process_code} ${p.process_name}` : r.process_name } },
                  { title: '投入数量', dataIndex: 'input_qty', render: v => v?.toLocaleString() },
                  { title: '合格数量', dataIndex: 'output_qty', render: v => v?.toLocaleString() },
                  { title: '来料不良', dataIndex: 'defect_material', render: v => v || 0 },
                  { title: '制程不良', dataIndex: 'defect_process', render: v => v || 0 },
                  { title: '检验报废', dataIndex: 'defect_scrap', render: v => v || 0 },
                  { title: '报工人', dataIndex: 'report_user_name' },
                  { title: '报工时间', dataIndex: 'report_time' },
                ]}
              />
            </>
          )
        })()}
      </Drawer>
    </>
  )
}
