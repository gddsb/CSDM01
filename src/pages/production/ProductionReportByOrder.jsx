import React, { useState, useMemo } from 'react'
import { Table, Tag, Select, Space, Row, Col, Empty } from 'antd'
import { ProfileOutlined, SearchOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import {
  workOrders, processes, defectTypes, exceptionRecords, processReports
} from '../../mock/data'

const woStatusColor = { '开立': 'default', '开工': 'processing', '关闭': 'warning', '完工': 'success' }

// 模拟各工序不良明细数据（按工序×不良类型×不良描述细分）
// 基于 processReports 的总量生成明细分配
const defectDetailMap = {
  // w1 工单
  'w1_p1': [
    { defect_type: '来料不良', defect_name: '材料划伤', qty: 6 },
    { defect_type: '来料不良', defect_name: '材料变形', qty: 4 },
    { defect_type: '制程不良', defect_name: '焊接不良', qty: 3 },
    { defect_type: '制程不良', defect_name: '补涂漏涂', qty: 2 },
    { defect_type: '检验报废', defect_name: '尺寸超差', qty: 2 },
  ],
  'w1_p2': [
    { defect_type: '来料不良', defect_name: '材料划伤', qty: 2 },
    { defect_type: '来料不良', defect_name: '材料变形', qty: 1 },
    { defect_type: '检验报废', defect_name: '测漏不合格', qty: 1 },
  ],
  'w1_p3': [
    { defect_type: '制程不良', defect_name: '焊接不良', qty: 5 },
    { defect_type: '制程不良', defect_name: '封口不良', qty: 3 },
  ],
  // w2 工单
  'w2_p1': [
    { defect_type: '来料不良', defect_name: '材料划伤', qty: 12 },
    { defect_type: '来料不良', defect_name: '材料变形', qty: 8 },
    { defect_type: '制程不良', defect_name: '焊接不良', qty: 6 },
    { defect_type: '制程不良', defect_name: '补涂漏涂', qty: 4 },
    { defect_type: '检验报废', defect_name: '尺寸超差', qty: 3 },
    { defect_type: '检验报废', defect_name: '测漏不合格', qty: 2 },
  ],
  'w2_p3': [
    { defect_type: '制程不良', defect_name: '封口不良', qty: 4 },
    { defect_type: '制程不良', defect_name: '码垛歪斜', qty: 2 },
    { defect_type: '检验报废', defect_name: '外观不合格', qty: 1 },
  ],
  'w2_p4': [
    { defect_type: '检验报废', defect_name: '密封性不合格', qty: 3 },
    { defect_type: '检验报废', defect_name: '尺寸超差', qty: 1 },
  ],
  // w3 工单
  'w3_p1': [
    { defect_type: '来料不良', defect_name: '材料划伤', qty: 8 },
    { defect_type: '来料不良', defect_name: '材料变形', qty: 3 },
    { defect_type: '制程不良', defect_name: '焊接不良', qty: 4 },
  ],
  'w3_p2': [
    { defect_type: '来料不良', defect_name: '材料变形', qty: 2 },
    { defect_type: '制程不良', defect_name: '补涂漏涂', qty: 3 },
    { defect_type: '检验报废', defect_name: '测漏不合格', qty: 2 },
  ],
  'w3_p4': [
    { defect_type: '检验报废', defect_name: '密封性不合格', qty: 2 },
    { defect_type: '检验报废', defect_name: '外观不合格', qty: 1 },
  ],
  // w4 工单
  'w4_p1': [
    { defect_type: '来料不良', defect_name: '材料划伤', qty: 5 },
    { defect_type: '制程不良', defect_name: '焊接不良', qty: 2 },
  ],
}

// 模拟停机记录明细（补充 w1、w3 的异常记录）
const extraExceptionRecords = [
  { record_id: 'er4', work_order_id: 'w1', work_order_no: 'WO20260630001', order_id: 'o1', order_no: 'MO-16260630001', exception_type: 'E02', exception_type_name: '清场', device_id: null, device_name: null, start_time: '2026-06-30 12:00', end_time: '2026-06-30 12:30', duration: 30, reason: '午间清场' },
  { record_id: 'er5', work_order_id: 'w3', work_order_no: 'WO20260628001', order_id: 'o4', order_no: 'MO-16260628001', exception_type: 'E03', exception_type_name: '停机待料', device_id: null, device_name: null, start_time: '2026-06-28 09:00', end_time: '2026-06-28 10:00', duration: 60, reason: '马口铁基材未到货' },
  { record_id: 'er6', work_order_id: 'w3', work_order_no: 'WO20260628001', order_id: 'o4', order_no: 'MO-16260628001', exception_type: 'E01', exception_type_name: '换型调机', device_id: null, device_name: null, start_time: '2026-06-28 10:30', end_time: '2026-06-28 11:15', duration: 45, reason: '800g换1200g换型调试' },
  { record_id: 'er7', work_order_id: 'w3', work_order_no: 'WO20260628001', order_id: 'o4', order_no: 'MO-16260628001', exception_type: 'E04', exception_type_name: '设备故障', device_id: 'd3', device_name: '自动码垛机', start_time: '2026-06-28 14:00', end_time: '2026-06-28 14:20', duration: 20, reason: '码垛机械手位置偏移' },
  { record_id: 'er8', work_order_id: 'w1', work_order_no: 'WO20260630001', order_id: 'o1', order_no: 'MO-16260630001', exception_type: 'E03', exception_type_name: '停机待料', device_id: null, device_name: null, start_time: '2026-06-30 15:00', end_time: '2026-06-30 15:20', duration: 20, reason: '等待覆膜材料' },
]

// 合并原始和补充的异常记录
const allExceptionRecords = [...exceptionRecords, ...extraExceptionRecords]

export default function ProductionReportByOrder() {
  const [selectedWOId, setSelectedWOId] = useState(null)

  // 工单搜索选项 - 按工单编号倒序
  const woOptions = useMemo(() => {
    return [...workOrders]
      .sort((a, b) => b.work_order_no.localeCompare(a.work_order_no))
      .map(w => {
        return {
          value: w.work_order_id,
          label: `${w.work_order_no} | ${w.material_name || '-'}`,
          wo: w,
        }
      })
  }, [])

  const selectedWO = workOrders.find(w => w.work_order_id === selectedWOId)

  // 获取选中工单的工序报工记录
  const relatedReports = useMemo(() => {
    if (!selectedWOId) return []
    return processReports.filter(r => r.work_order_id === selectedWOId)
  }, [selectedWOId])

  // 构建不良明细树状数据（工序→不良分类→不良描述）
  const defectTreeData = useMemo(() => {
    if (!relatedReports.length) return []
    const typeOrder = { '来料不良': 0, '制程不良': 1, '检验报废': 2 }
    // 按工序顺序排列
    const sortedReports = [...relatedReports].sort((a, b) => {
      const pa = processes.find(p => p.process_id === a.process_id)
      const pb = processes.find(p => p.process_id === b.process_id)
      return (pa?.sort || 0) - (pb?.sort || 0)
    })
    // 先收集所有数据计算总数
    let grandTotal = 0
    const processData = sortedReports.map(report => {
      const key = `${report.work_order_id}_${report.process_id}`
      const details = defectDetailMap[key] || []
      const sortedDetails = [...details].sort((a, b) => (typeOrder[a.defect_type] ?? 9) - (typeOrder[b.defect_type] ?? 9))
      // 按不良分类分组
      const typeGroups = {}
      sortedDetails.forEach(d => {
        if (!typeGroups[d.defect_type]) typeGroups[d.defect_type] = []
        typeGroups[d.defect_type].push(d)
      })
      const typeChildren = Object.entries(typeGroups).map(([type, items]) => {
        const typeSubtotal = items.reduce((s, d) => s + d.qty, 0)
        return {
          key: `${report.process_id}_${type}`,
          defect_type: type,
          type_subtotal: typeSubtotal,
          children: items.map(d => ({
            key: `${report.process_id}_${type}_${d.defect_name}`,
            defect_name: d.defect_name,
            qty: d.qty,
          })),
        }
      })
      const processTotal = typeChildren.reduce((s, t) => s + t.type_subtotal, 0)
      grandTotal += processTotal
      return {
        key: `proc_${report.process_id}`,
        process_name: report.process_name,
        process_total: processTotal,
        children: typeChildren,
      }
    })
    // 存储总数供列计算使用
    return { tree: processData, grandTotal }
  }, [relatedReports])

  const totalDefect = defectTreeData.grandTotal || 0

  // 停机记录 - 使用合并后的数据，按停机类型排序以便合并单元格
  const relatedExceptions = useMemo(() => {
    if (!selectedWOId) return []
    return allExceptionRecords
      .filter(e => e.work_order_id === selectedWOId)
      .sort((a, b) => a.exception_type_name.localeCompare(b.exception_type_name))
  }, [selectedWOId])

  // 停机时间按异常类型汇总
  const exceptionSummary = useMemo(() => {
    if (!relatedExceptions.length) return { rows: [], totalCount: 0, totalDuration: 0 }
    const map = {}
    relatedExceptions.forEach(e => {
      if (!map[e.exception_type_name]) {
        map[e.exception_type_name] = { count: 0, duration: 0 }
      }
      map[e.exception_type_name].count += 1
      map[e.exception_type_name].duration += e.duration || 0
    })
    const rows = Object.entries(map).map(([type, v]) => ({
      key: type,
      exception_type: type,
      count: v.count,
      duration: v.duration,
    }))
    const totalCount = rows.reduce((s, r) => s + r.count, 0)
    const totalDuration = rows.reduce((s, r) => s + r.duration, 0)
    return { rows, totalCount, totalDuration }
  }, [relatedExceptions])

  const stats = [
    { label: '工序数', value: relatedReports.length, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '不良总数', value: totalDefect, icon: <ProfileOutlined />, color: '#FF9800' },
    { label: '停机次数', value: exceptionSummary.totalCount, icon: <ProfileOutlined />, color: '#f5222d' },
    { label: '停机时长', value: `${(exceptionSummary.totalDuration / 60).toFixed(1)}h`, icon: <ProfileOutlined />, color: '#9C27B0' },
  ]

  // 不良明细树状列
  const defectColumns = [
    {
      title: '工序', dataIndex: 'process_name', key: 'process_name', width: 60,
      render: (v, r) => {
        if (!v) return ''
        if (r.children) return <strong style={{ color: '#1565C0' }}>{v}</strong>
        return <span style={{ color: '#E65100' }}>{v}</span>
      },
    },
    {
      title: '不良分类', dataIndex: 'defect_type', key: 'defect_type', width: 60,
      render: (v, r) => {
        if (!v) return ''
        if (r.children) return <strong style={{ color: '#E65100' }}>{v}</strong>
        const colorMap = { '来料不良': 'orange', '制程不良': 'red', '检验报废': 'volcano' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      },
    },
    {
      title: '不良描述', dataIndex: 'defect_name', key: 'defect_name', width: 60,
      render: (v, r) => {
        if (!v) return ''
        return <span style={{ color: '#616161' }}>{v}</span>
      },
    },
    {
      title: '数量', dataIndex: 'qty', key: 'qty', width: 40, align: 'right',
      render: (v, r) => {
        if (v == null) return ''
        return <span style={{ color: '#424242' }}>{v}</span>
      },
    },
    {
      title: '工序分类不良', key: 'type_subtotal', width: 40, align: 'right',
      render: (_, r) => {
        if (r.type_subtotal == null) return ''
        return <strong style={{ color: '#E65100' }}>{r.type_subtotal}</strong>
      },
    },
    {
      title: '工序不良', key: 'process_total', width: 40, align: 'right',
      render: (_, r) => {
        if (r.process_total == null) return ''
        return <strong style={{ color: '#1565C0' }}>{r.process_total}</strong>
      },
    },
    {
      title: '分类不良率', key: 'type_rate', width: 40, align: 'right',
      render: (_, r) => {
        if (r.type_subtotal == null || !totalDefect) return ''
        return <strong style={{ color: '#E65100' }}>{((r.type_subtotal / totalDefect) * 100).toFixed(0)}%</strong>
      },
    },
    {
      title: '工序不良率', key: 'process_rate', width: 40, align: 'right',
      render: (_, r) => {
        if (r.process_total == null || !totalDefect) return ''
        return <strong style={{ color: '#1565C0' }}>{((r.process_total / totalDefect) * 100).toFixed(0)}%</strong>
      },
    },
  ]

  // 停机记录树状数据（停机类型→每条记录）
  const excTreeData = useMemo(() => {
    if (!relatedExceptions.length) return []
    const map = {}
    relatedExceptions.forEach(e => {
      if (!map[e.exception_type_name]) map[e.exception_type_name] = []
      map[e.exception_type_name].push(e)
    })
    return Object.entries(map).map(([type, items]) => ({
      key: `exc_${type}`,
      exception_type_name: type,
      type_count: items.length,
      type_duration: items.reduce((s, e) => s + (e.duration || 0), 0),
      children: items.map(e => ({
        key: e.record_id,
        start_time: e.start_time,
        end_time: e.end_time,
        duration: e.duration,
        device_name: e.device_name,
        reason: e.reason,
      })),
    }))
  }, [relatedExceptions])

  // 停机记录树状列
  const excColumns = [
    {
      title: '停机类型', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 60,
      render: (v, r) => {
        if (!v) return ''
        if (r.children) return <strong style={{ color: '#6A1B9A' }}>{v}</strong>
        return <span style={{ color: '#616161' }}>{v}</span>
      },
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 60,
      render: v => v ? <span style={{ color: '#424242' }}>{v}</span> : '',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 60,
      render: v => v ? <span style={{ color: '#424242' }}>{v}</span> : '',
    },
    {
      title: '时长(分钟)', dataIndex: 'duration', key: 'duration', width: 40, align: 'right',
      render: (v, r) => {
        if (v == null) return ''
        if (r.children) return <strong style={{ color: '#6A1B9A' }}>{v}</strong>
        return <span style={{ color: '#424242' }}>{v}</span>
      },
    },
    {
      title: '设备', dataIndex: 'device_name', key: 'device_name', width: 60,
      render: v => {
        if (!v) return ''
        return <span style={{ color: '#616161' }}>{v}</span>
      },
    },
    {
      title: '原因/备注', dataIndex: 'reason', key: 'reason', width: 60,
      render: v => v ? <span style={{ color: '#616161' }}>{v}</span> : '',
    },
  ]

  return (
    <ThreeSectionPage
      title="生产报工(工单)"
      breadcrumbs="生产管理 / 生产报工(工单)"
      stats={stats}
      table={
        <div>
          <Row gutter={[12, 8]} style={{ marginBottom: 16 }} align="middle">
            <Col flex="500px">
              <Select
                showSearch
                placeholder="输入工单编号、料号或料品名称搜索"
                style={{ width: '100%' }}
                value={selectedWOId}
                onChange={setSelectedWOId}
                filterOption={(input, option) => {
                  const wo = option.wo
                  if (!wo) return false
                  const search = input.toLowerCase()
                  return wo.work_order_no?.toLowerCase().includes(search) ||
                    wo.material_name?.toLowerCase().includes(search) ||
                    wo.order_no?.toLowerCase().includes(search)
                }}
                options={woOptions}
                optionRender={(option) => {
                  const wo = option.wo
                  if (!wo) return null
                  return (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span style={{ width: 130 }}>{wo.work_order_no}</span>
                      <span style={{ width: 100 }}>{wo.material_name || '-'}</span>
                      <span style={{ width: 80, textAlign: 'right' }}>{wo.target_qty?.toLocaleString()}</span>
                      <span style={{ width: 60 }}><Tag color={woStatusColor[wo.status]} style={{ margin: 0 }}>{wo.status}</Tag></span>
                    </div>
                  )
                }}
              />
            </Col>
          </Row>

          {!selectedWO ? (
            <Empty description="请选择工单查看生产报工统计" style={{ marginTop: 60 }} />
          ) : (
            <Row gutter={16}>
              {/* 不良明细统计 */}
              <Col span={12}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                  工序不良统计 — {selectedWO.work_order_no}
                </div>
                <Table
                  size="small"
                  columns={defectColumns}
                  dataSource={defectTreeData.tree || []}
                  pagination={false}
                  expandable={{
                    defaultExpandAllRows: true,
                    childrenColumnName: 'children',
                  }}
                  scroll={{ x: 380 }}
                />
              </Col>

              {/* 停机时间统计 */}
              <Col span={12}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                  停机时间统计 — {selectedWO.work_order_no}
                </div>
                <Table
                  size="small"
                  columns={excColumns}
                  dataSource={excTreeData}
                  pagination={false}
                  expandable={{
                    defaultExpandAllRows: true,
                    childrenColumnName: 'children',
                  }}
                  scroll={{ x: 340 }}
                />
              </Col>
            </Row>
          )}
        </div>
      }
    />
  )
}
