/**
 * DailyReport.tsx — 制罐车间生产日报
 *
 * 后端：GET /api/daily-report?date=&line=&shift=
 * 结构：PDF 表格原样还原（表头 + 生产记录 + 停机记录 + 不良分类交叉表）
 */
import React, { useEffect, useState, useCallback } from 'react'
import { DatePicker, Select, Button, Space, Spin, Card, Row, Col, Divider } from 'antd'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import ThreeSectionPage from '../../components/ThreeSectionPage'

const { RangePicker } = DatePicker

interface ProductionRow {
  seq: number
  reportOrderId: number
  reportOrderNo: string
  startTime: string
  endTime: string
  productionBatch: string | null
  materialName: string
  specification: string | null
  ironBatchNo: string | null
  inputQty: number
  outputQty: number
  incomingDefectSmall: number
  incomingDefectCap: number
  processDefect: number
  inspectionDefect: number
  edgeWeightKg: number | null
  skilledCount: number
  generalCount: number
  laborCount: number
  otherCount: number
  abnormalHours: number
  totalHours: number
}

interface DowntimeRow {
  reportOrderId: number
  productionBatch: string | null
  startTime: string
  stopCode: string
  description: string | null
  endTime: string | null
  confirmUser: string | null
  durationHours: number
}

interface DefectCell { defectName: string; defectId: number }
interface DefectCol { reportOrderId: number; reportOrderNo: string }
interface DefectMatrix {
  rows: DefectCell[]
  cols: DefectCol[]
  cells: number[][]
  colSubtotals: number[]
}

interface DailyReportData {
  header: { date: string; line: string; shift: string }
  productionRows: ProductionRow[]
  downtime: DowntimeRow[]
  incomingDefectMatrix: DefectMatrix
  processDefectMatrix: DefectMatrix
}

const STOP_CODE_LABEL: Record<string, string> = {
  A: '停机待料', B: '换型换线', C: '制程调整', D: '故障维修', E: '其它异常',
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  const v = Number(n)
  return v.toFixed(digits)
}

export default function DailyReport() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DailyReportData | null>(null)
  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [line, setLine] = useState<string | undefined>(undefined)
  const [shift, setShift] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/daily-report', { params: { date, line, shift } })
      setData(r.data?.data || r.data || null)
    } catch (e) {
      console.error('[DailyReport] load err', e)
    } finally {
      setLoading(false)
    }
  }, [date, line, shift])

  useEffect(() => { load() }, [load])

  const totalInputs = data?.productionRows.reduce((s, r) => s + r.inputQty, 0) || 0
  const totalOutputs = data?.productionRows.reduce((s, r) => s + r.outputQty, 0) || 0
  const totalProcessDefect = data?.productionRows.reduce((s, r) => s + r.processDefect, 0) || 0
  const totalInspectionDefect = data?.productionRows.reduce((s, r) => s + r.inspectionDefect, 0) || 0
  const totalDowntimeHours = data?.downtime.reduce((s, r) => s + r.durationHours, 0) || 0

  return (
    <ThreeSectionPage
      title="制罐车间生产日报"
      breadcrumbs="报表中心 / 生产日报"
      filters={[
        { label: '日期', children: (
          <DatePicker
            value={dayjs(date)}
            onChange={(d) => setDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
            allowClear={false}
          />
        )},
        { label: '产线', children: (
          <Select
            value={line}
            onChange={setLine}
            style={{ width: 120 }}
            allowClear
            placeholder="全部"
            options={[{ value: 'A线', label: 'A线' }, { value: 'B线', label: 'B线' }]}
          />
        )},
        { label: '班次', children: (
          <Select
            value={shift}
            onChange={setShift}
            style={{ width: 120 }}
            allowClear
            placeholder="全部"
            options={[{ value: '白班', label: '白班' }, { value: '晚班', label: '晚班' }]}
          />
        )},
      ]}
      stats={[
        { label: '报工单', value: data?.productionRows.length || 0 },
        { label: '投入数量', value: fmtNum(totalInputs, 0) },
        { label: '入库数量', value: fmtNum(totalOutputs, 0) },
        { label: '制程不良', value: fmtNum(totalProcessDefect, 0), color: '#ff4d4f' },
        { label: '检验废品', value: fmtNum(totalInspectionDefect, 0), color: '#fa8c16' },
        { label: '停机总时', value: `${fmtNum(totalDowntimeHours, 1)}h`, color: '#1890ff' },
      ]}
    >
      <Spin spinning={loading}>
        {!data ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
        ) : (
          <DailyReportView data={data} />
        )}
      </Spin>
    </ThreeSectionPage>
  )
}

/** 纯展示组件 — 按 PDF 表格结构渲染 */
function DailyReportView({ data }: { data: DailyReportData }) {
  const { header, productionRows, downtime, incomingDefectMatrix, processDefectMatrix } = data

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
      {/* ============ 表头 ============ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>制罐车间生产日报表</div>
        <div style={{ color: '#666', fontSize: 13 }}>
          日期：{header.date} &nbsp;|&nbsp; 生产线：{header.line || '—'} &nbsp;|&nbsp; 班次：{header.shift || '—'}
        </div>
      </div>

      {/* ============ 1. 生产记录 ============ */}
      <Card size="small" title="① 生产记录" style={{ marginBottom: 16 }} bodyStyle={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', fontWeight: 600 }}>
              <Th>序号</Th>
              <Th colSpan={2}>生产时间</Th>
              <Th colSpan={4}>基本信息</Th>
              <Th colSpan={2}>投入产出</Th>
              <Th colSpan={2}>来料不良</Th>
              <Th colSpan={2}>制程不良(汇总)</Th>
              <Th>废品合计</Th>
              <Th>料边(kg)</Th>
              <Th colSpan={5}>工时汇总</Th>
            </tr>
            <tr style={{ background: '#fafafa', fontSize: 12, color: '#666' }}>
              <Th>号</Th>
              <Th>开始</Th><Th>结束</Th>
              <Th>生产批号</Th><Th>产品名称</Th><Th>规格</Th><Th>印铁批号</Th>
              <Th>投入</Th><Th>入库</Th>
              <Th>小张</Th><Th>带盖</Th>
              <Th>制程</Th><Th>检验</Th>
              <Th>合计</Th>
              <Th>kg</Th>
              <Th>技工</Th><Th>普工</Th><Th>劳务</Th><Th>其它</Th>
              <Th>异常</Th><Th>合计(h)</Th>
            </tr>
          </thead>
          <tbody>
            {productionRows.length === 0 ? (
              <tr><td colSpan={22} style={{ textAlign: 'center', padding: 30, color: '#999' }}>无完工报工单</td></tr>
            ) : productionRows.map(r => (
              <tr key={r.reportOrderId} style={{ borderTop: '1px solid #eee' }}>
                <Td>{r.seq}</Td>
                <Td>{fmtTime(r.startTime)}</Td>
                <Td>{fmtTime(r.endTime)}</Td>
                <Td><InputEditable value={r.productionBatch} /></Td>
                <Td>{r.materialName}</Td>
                <Td>{r.specification || '—'}</Td>
                <Td>{r.ironBatchNo || '—'}</Td>
                <Td>{fmtNum(r.inputQty, 0)}</Td>
                <Td>{fmtNum(r.outputQty, 0)}</Td>
                <Td>{fmtNum(r.incomingDefectSmall, 0)}</Td>
                <Td>{fmtNum(r.incomingDefectCap, 0)}</Td>
                <Td>{fmtNum(r.processDefect, 0)}</Td>
                <Td>{fmtNum(r.inspectionDefect, 0)}</Td>
                <Td style={{ fontWeight: 600 }}>{fmtNum(r.processDefect + r.inspectionDefect + r.incomingDefectSmall + r.incomingDefectCap, 0)}</Td>
                <Td>{r.edgeWeightKg !== null ? fmtNum(r.edgeWeightKg, 2) : '—'}</Td>
                <Td>{r.skilledCount}</Td>
                <Td>{r.generalCount}</Td>
                <Td>{r.laborCount}</Td>
                <Td>{r.otherCount}</Td>
                <Td>{fmtNum(r.abnormalHours, 2)}</Td>
                <Td style={{ fontWeight: 600 }}>{fmtNum(r.totalHours, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ============ 2+3 停机记录 + 不良分类 ============ */}
      <Row gutter={16}>
        <Col span={11}>
          <Card size="small" title="② 停机记录" bodyStyle={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Th>批号</Th><Th>停机时间</Th><Th>代码</Th><Th>故障描述</Th><Th>修复时间</Th><Th>确认人</Th>
                </tr>
              </thead>
              <tbody>
                {downtime.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#999' }}>无停机记录</td></tr>
                ) : downtime.map((d, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <Td>{d.productionBatch || '—'}</Td>
                    <Td>{fmtDate(d.startTime)} {fmtTime(d.startTime)}</Td>
                    <Td><StopCodeBadge code={d.stopCode} /></Td>
                    <Td>{d.description || '—'}</Td>
                    <Td>{fmtTime(d.endTime)}</Td>
                    <Td>{d.confirmUser || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: '#999', padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
              停机代号：A-停机待料 &nbsp; B-换型换线 &nbsp; C-制程调整 &nbsp; D-故障维修 &nbsp; E-其它异常
            </div>
          </Card>
        </Col>

        <Col span={13}>
          <Row gutter={16}>
            <Col span={12}>
              <DefectMatrixCard title="③-a 来料不良分类记录" matrix={incomingDefectMatrix} />
            </Col>
            <Col span={12}>
              <DefectMatrixCard title="③-b 制程不良分类记录" matrix={processDefectMatrix} />
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ============ 4. 其它说明 ============ */}
      <Card size="small" title="④ 其它说明" style={{ marginTop: 16 }} bodyStyle={{ padding: 12 }}>
        <div style={{ minHeight: 60, color: '#bbb', fontSize: 13 }}>暂不关联</div>
      </Card>
    </div>
  )
}

/* ========================= 小组件 ========================= */

function Th({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <th colSpan={colSpan} style={{ border: '1px solid #f0f0f0', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ border: '1px solid #f0f0f0', padding: '5px 8px', textAlign: 'center', ...style }}>{children}</td>
}

function StopCodeBadge({ code }: { code: string }) {
  const label = STOP_CODE_LABEL[code] || '其它异常'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
      background: code === 'D' ? '#fff2f0' : code === 'A' ? '#e6f7ff' : '#f5f5f5',
      color: code === 'D' ? '#ff4d4f' : code === 'A' ? '#1890ff' : '#666',
      fontWeight: 600,
    }}>{code} · {label}</span>
  )
}

function InputEditable({ value }: { value: string | null }) {
  // production_batch 允许编辑但先存前端状态（后端字段目前全 NULL，后续可接保存接口）
  return <span style={{ color: value ? '#262626' : '#bfbfbf', borderBottom: value ? 'none' : '1px dashed #d9d9d9', paddingBottom: 2 }}>{value || '（空）'}</span>
}

function DefectMatrixCard({ title, matrix }: { title: string; matrix: DefectMatrix }) {
  const { rows, cols, cells, colSubtotals } = matrix
  return (
    <Card size="small" title={title} bodyStyle={{ padding: 0, maxHeight: 280, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0 }}>
          <tr style={{ background: '#fafafa', fontWeight: 600 }}>
            <Th style={{ textAlign: 'left' }}>不良描述</Th>
            <Th>序号</Th>
            {cols.map((c, i) => (
              <Th key={c.reportOrderId}>{i + 1}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length + 2} style={{ textAlign: 'center', padding: 20, color: '#999' }}>无不良记录</td></tr>
          ) : rows.map((r, ri) => (
            <tr key={r.defect_id} style={{ borderTop: '1px solid #f0f0f0' }}>
              <Td style={{ textAlign: 'left' }}>{r.defectName}</Td>
              <Td>{ri + 1}</Td>
              {cols.map((_, ci) => (
                <Td key={ci}>{cells[ri]?.[ci] > 0 ? cells[ri][ci] : ''}</Td>
              ))}
            </tr>
          ))}
          {rows.length > 0 && (
            <tr style={{ background: '#fffbe6', fontWeight: 600 }}>
              <Td>小计</Td><Td>—</Td>
              {colSubtotals.map((v, i) => (
                <Td key={i} style={{ color: '#d48806' }}>{v > 0 ? v : ''}</Td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
