/**
 * DailyReport.tsx — 制罐车间生产日报
 *
 * 后端：GET /api/daily-report?date=&line=&shift=
 * 结构：PDF 表格原样还原（表头 + 生产记录 + 停机记录 + 不良分类交叉表）
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { DatePicker, Select, Button, Space, Spin, Card, Row, Col, Divider, Modal, Tooltip } from 'antd'
import { ReloadOutlined, PrinterOutlined, FullscreenOutlined } from '@ant-design/icons'
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

/** 打印专用 CSS — 独立注入新 window（不依赖 @media print） */
const PRINT_CSS = `
  @page { size: A4 landscape; margin: 4mm; }
  html, body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px; line-height: 1.4; color: #000; background: #fff;
  }
  body > div { padding: 0 !important; margin: 0 !important; background: #fff !important; }
  .report-page { page-break-inside: avoid; break-inside: avoid; margin: 0 0 6mm 0 !important; padding: 0 !important; }
  .ant-row, .ant-row-flex { margin-left: -6px !important; margin-right: -6px !important; padding: 0 !important; }
  .ant-col { padding-left: 6px !important; padding-right: 6px !important; }
  .ant-card {
    margin: 0 0 12px 0 !important; padding: 0 !important;
    border: 1px solid #000 !important; border-radius: 0 !important;
    box-shadow: none !important; overflow: visible !important; background: #fff !important;
  }
  .ant-card-head {
    margin: 0 !important; padding: 2px 6px !important;
    border-bottom: 1px solid #000 !important;
    min-height: auto !important; font-size: 12px !important; font-weight: 400 !important;
    background: #fafafa !important; color: #000 !important;
  }
  .ant-card-head-title { padding: 0 !important; font-size: 12px !important; }
  .ant-card-extra { display: none !important; }
  .ant-card-body { padding: 0 !important; margin: 0 !important; overflow: visible !important; max-height: none !important; }
  table { border-collapse: collapse; border-spacing: 0; width: 100% !important; max-width: 100% !important; table-layout: auto; font-size: 12px; margin: 0 !important; }
  th, td { border: 1px solid #000 !important; padding: 4px 2px !important; text-align: center; white-space: nowrap; box-sizing: border-box !important; overflow: visible !important; font-weight: 400 !important; }
  th { background: #fafafa; }
  .col-wrap { white-space: normal !important; word-wrap: break-word !important; word-break: break-all !important; }
  input, span, div { background: transparent !important; }
  .print-footer { text-align: right; font-size: 10px; border-top: 1px solid #000; padding-top: 3px; margin: 6px 0 0 0; display: flex; justify-content: flex-end; gap: 16px; color: #000 !important; background: transparent !important; }
  .report-page > div:first-child > div:first-child { font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 6px; letter-spacing: 2px; }
  .header-info { text-align: left; font-size: 12px; color: #000; margin-bottom: 8px; position: relative; }
  .page-indicator { position: absolute; right: 0; top: 0; font-weight: 400; color: #000; }
`

/** 单页生产记录条数 — PDF 标准 4 条 */
const PROD_ROWS_PER_PAGE = 4
/** 停机 + 不良矩阵统一补到 10 行 — 底部齐平 */
const MIN_PAD_ROWS = 10

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
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  /** DatePicker 面板蓝点标记 — 当前月份有完工报工单的日期 */
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/daily-report', { params: { date } })
      setData(r.data?.data || r.data || null)
    } catch (e) {
      console.error('[DailyReport] load err', e)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  /** DatePicker 面板月份切换时，拉当月有完工报工单的日期做蓝点标记 */
  const refreshMarkedMonth = useCallback(async (year: number, month: number) => {
    try {
      const r = await api.get('/daily-report/dates', { params: { year, month } })
      const list: string[] = r.data?.data || r.data || []
      setMarkedDates(new Set(list))
    } catch { /* 静默失败 */ }
  }, [])

  /** 选中日期变化 — 顺带刷新标记（切换到新月份时） */
  useEffect(() => {
    const d = dayjs(date)
    refreshMarkedMonth(d.year(), d.month() + 1)
  }, [date, refreshMarkedMonth])

  const hasData = !!data && data.productionRows.length > 0

  /** 打印：未完工拦截 + 新开 window 写 HTML + window.print() */
  const handlePrint = useCallback(() => {
    const unfinished = data?.productionRows.filter(r => !r.endTime)
    if (unfinished && unfinished.length > 0) {
      Modal.warning({ title: '禁止打印', content: '有未完工报工单，禁止打印输出日报' })
      return
    }
    const src = document.querySelector('.print-source') as HTMLElement | null
    if (!src) return
    const printWin = window.open('', '_blank', 'width=1280,height=900')
    if (!printWin) return
    const title = `${date.replace(/-/g, '')}制罐车间生产日报表`
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${title}</title>
      <style>${PRINT_CSS}</style>
      </head><body>${src.innerHTML}<div class="print-footer">打印人：&nbsp;&nbsp;打印时间：${dayjs().format('YYYY-MM-DD HH:mm')}</div></body></html>`)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => { try { printWin.print() } catch { /* 用户取消 */ } }, 300)
  }, [data, date])

  return (
    <>
      {/* ============ 打印专用 CSS — 覆盖 ThreeSectionPage 导航/按钮 ============ */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 4mm; }
          html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; background: #fff !important; font-size: 10px !important; line-height: 1.25 !important; }
          .ant-app, .ant-layout.app-layout { display: block !important; width: 100% !important; max-width: 100% !important; height: auto !important; }
          .ant-layout-content { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; display: block !important; }
          .ant-layout-sider, .ant-layout-header, .ant-layout-footer, .ant-page-header, .ant-breadcrumb,
          .section-info, .section-info-header, .stats-row, .section-filter,
          button, .ant-btn, .ant-btn-link, .ant-affix, .ant-tooltip,
          .ant-spin-nested-loading > div:first-child,
          .ant-modal-root, .ant-modal-mask, .ant-modal-wrap { display: none !important; }
          .three-section-page, .section-table, .section-table > div, .print-source, .print-source > div {
            width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important;
            background: #fff !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; overflow: visible !important;
          }
          .ant-row, .ant-row-flex { margin: 0 !important; }
          .ant-col { padding: 0 !important; }
          [data-print-hide] { display: none !important; }
        }
      `}</style>

      <ThreeSectionPage
        title="制罐车间生产日报"
        breadcrumbs="报表中心 / 生产日报"
        filter={
          <Space wrap size={[8, 0]} align="start">
            <span style={{ color: '#888', fontSize: 13, lineHeight: '32px', whiteSpace: 'nowrap' }}>日期：</span>
            <DatePicker
              value={useMemo(() => dayjs(date), [date])}
              onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
              onPanelChange={(v) => {
                if (v) refreshMarkedMonth(v.year(), v.month() + 1)
              }}
              disabledDate={(d) => d.isAfter(dayjs())}
              allowClear={false}
              style={{ width: 180 }}
              cellRender={(current, info) => {
                const d = current.format('YYYY-MM-DD')
                if (info.type === 'date' && markedDates.has(d)) {
                  return (
                    <span style={{ position: 'relative' }}>
                      {current.date()}
                      <span style={{
                        position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                        width: 5, height: 5, borderRadius: '50%', background: '#1890ff',
                      }} />
                    </span>
                  )
                }
                return current.date()
              }}
            />
          </Space>
        }
        actions={
          <Space size={8}>
            <Tooltip title="全屏预览">
              <Button icon={<FullscreenOutlined />} onClick={() => setFullscreenOpen(true)} disabled={!hasData}>全屏</Button>
            </Tooltip>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!hasData}>打印</Button>
          </Space>
        }
        table={
          <div className="print-source">
            <Spin spinning={loading}>
              {!data ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
              ) : (
                <DailyReportView data={data} />
              )}
            </Spin>
          </div>
        }
      />

      {/* ============ 全屏预览 Modal ============ */}
      <Modal
        title={null}
        open={fullscreenOpen}
        onCancel={() => setFullscreenOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setFullscreenOpen(false)}>关闭</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
          </Space>
        }
        width="96vw"
        style={{ top: 16 }}
        styles={{ body: { padding: 0, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' } }}
        maskClosable={false}
        destroyOnClose
      >
        {hasData && (
          <div className="print-source">
            <DailyReportView data={data!} />
          </div>
        )}
      </Modal>
    </>
  )
}

/** 纯展示组件 — 按 PDF 表格结构渲染，超过 4 条生产记录自动分页 */
function DailyReportView({ data }: { data: DailyReportData }) {
  const { header, productionRows, downtime, incomingDefectMatrix, processDefectMatrix } = data

  // 停机记录补齐到 MIN_PAD_ROWS 行
  const downtimePadded: (DowntimeRow | null)[] = downtime.slice()
  while (downtimePadded.length < MIN_PAD_ROWS) downtimePadded.push(null)

  // 分页：每页 4 条生产记录
  const pageCount = Math.max(1, Math.ceil(productionRows.length / PROD_ROWS_PER_PAGE))
  const showPageNum = pageCount > 1
  const pages: JSX.Element[] = []

  for (let p = 0; p < pageCount; p++) {
    const start = p * PROD_ROWS_PER_PAGE
    const pageRows = productionRows.slice(start, start + PROD_ROWS_PER_PAGE)
    const prodPadded: (ProductionRow | null)[] = pageRows.slice()
    while (prodPadded.length < PROD_ROWS_PER_PAGE) prodPadded.push(null)

    const isFirstPage = p === 0
    const isLastPage = p === pageCount - 1

    pages.push(
      <div
        key={p}
        className="report-page"
        style={{
          background: '#fff', padding: 0, borderRadius: 0,
          pageBreakAfter: isLastPage ? 'auto' : 'always', breakAfter: isLastPage ? 'auto' : 'page',
          marginBottom: isLastPage ? 0 : 16,
        }}
      >
        {/* ============ 每页都有：表头 ============ */}
        <div style={{ marginBottom: 8, position: 'relative' }}>
          <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 6, letterSpacing: 2 }}>
            制罐车间生产日报表
          </div>
          <div className="header-info" style={{ color: '#333', fontSize: 12 }}>
            日期：{header.date} &nbsp;|&nbsp; 生产线：{header.line || '—'} &nbsp;|&nbsp; 班次：{header.shift || '—'}
            {showPageNum && (
              <span className="page-indicator" style={{ position: 'absolute', right: 0, top: 0, fontWeight: 600 }}>
                第 {p + 1} / {pageCount} 页
              </span>
            )}
          </div>
        </div>

        {/* ============ 每页都有：① 生产记录 ============ */}
        <Card
          size="small"
          title={`① 生产记录${showPageNum ? `（第 ${p + 1} 页）` : ''}`}
          style={{ marginBottom: 8 }}
          bodyStyle={{ padding: 0 }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                <Th rowSpan={2}>序号</Th>
                <Th colSpan={2}>生产时间</Th>
                <Th colSpan={4}>基本信息</Th>
                <Th colSpan={2}>投入产出</Th>
                <Th colSpan={2}>来料不良</Th>
                <Th colSpan={2}>制程不良(汇总)</Th>
                <Th>废品合计</Th>
                <Th>料边(kg)</Th>
                <Th colSpan={6}>工时汇总</Th>
              </tr>
              <tr style={{ background: '#fafafa', fontSize: 12, color: '#666' }}>
                <Th>开始</Th><Th>结束</Th>
                <Th>生产批号</Th><Th className="col-wrap" style={{ textAlign: 'left' }}>产品名称</Th><Th>规格</Th><Th>印铁批号</Th>
                <Th>投入</Th><Th>入库</Th>
                <Th>小张</Th><Th>带盖</Th>
                <Th>制程</Th><Th>检验</Th>
                <Th>合计</Th>
                <Th>kg</Th>
                <Th>技工</Th><Th>普工</Th><Th>劳务</Th><Th>其它</Th>
                <Th>异常(h)</Th><Th>合计(h)</Th>
              </tr>
            </thead>
            <tbody>
              {prodPadded.map((r, i) => (
                r === null ? (
                  <tr key={`blank-${i}`}>
                    {Array.from({ length: 22 }).map((_, ci) => <Td key={ci}>&nbsp;</Td>)}
                  </tr>
                ) : (
                  <tr key={r.reportOrderId} style={{ borderTop: '1px solid #eee' }}>
                    <Td>{(p * PROD_ROWS_PER_PAGE) + i + 1}</Td>
                    <Td>{fmtTime(r.startTime)}</Td>
                    <Td>{fmtTime(r.endTime)}</Td>
                    <Td><InputEditable value={r.productionBatch} /></Td>
                    <Td className="col-wrap" style={{ textAlign: 'left' }}>{r.materialName}</Td>
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
                    <Td>{fmtNum(r.abnormalHours, 1)}</Td>
                    <Td style={{ fontWeight: 600 }}>{fmtNum(r.totalHours, 1)}</Td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </Card>

        {/* ============ 只在第一页：② 停机记录 + ③ 不良分类 ============ */}
        {isFirstPage && (
          <Row gutter={16}>
            <Col span={11}>
              <Card size="small" title="② 停机记录" bodyStyle={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                      <Th>批号</Th><Th>停机时间</Th><Th>代码</Th><Th className="col-wrap" style={{ textAlign: 'left' }}>故障描述</Th><Th>修复时间</Th><Th>确认人</Th><Th>时长(h)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimePadded.map((d, i) => (
                      d === null ? (
                        <tr key={`blank-${i}`}>
                          {Array.from({ length: 7 }).map((_, ci) => <Td key={ci}>&nbsp;</Td>)}
                        </tr>
                      ) : (
                        <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                          <Td>{d.productionBatch || '—'}</Td>
                          <Td>{fmtTime(d.startTime)}</Td>
                          <Td><StopCodeBadge code={d.stopCode} /></Td>
                          <Td className="col-wrap" style={{ textAlign: 'left' }}>{d.description || '—'}</Td>
                          <Td>{fmtTime(d.endTime)}</Td>
                          <Td>{d.confirmUser || '—'}</Td>
                          <Td>{fmtNum(d.durationHours, 2)}</Td>
                        </tr>
                      )
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
                  <DefectMatrixCard title="③-a 来料不良分类记录" matrix={incomingDefectMatrix} minRows={MIN_PAD_ROWS} />
                </Col>
                <Col span={12}>
                  <DefectMatrixCard title="③-b 制程不良分类记录" matrix={processDefectMatrix} minRows={MIN_PAD_ROWS} />
                </Col>
              </Row>
            </Col>
          </Row>
        )}
      </div>
    )
  }

  return <div style={{ background: '#fff', padding: 8, borderRadius: 0 }}>{pages}</div>
}

/* ========================= 小组件 ========================= */

function Th({ children, colSpan, rowSpan, style }: { children: React.ReactNode; colSpan?: number; rowSpan?: number; style?: React.CSSProperties }) {
  return <th colSpan={colSpan} rowSpan={rowSpan} style={{ border: '1px solid #f0f0f0', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', ...style }}>{children}</th>
}
function Td({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return <td className={className} style={{ border: '1px solid #f0f0f0', padding: '5px 8px', textAlign: 'center', ...style }}>{children}</td>
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
  return <span style={{ color: value ? '#262626' : '#bfbfbf', borderBottom: value ? 'none' : '1px dashed #d9d9d9', paddingBottom: 2 }}>{value || '（空）'}</span>
}

/** 不良分类交叉表 — 两行表头 + rowSpan=2 + 空行补齐 + 底部小计 */
function DefectMatrixCard({ title, matrix, minRows }: { title: string; matrix: DefectMatrix; minRows: number }) {
  const { rows, cols, cells, colSubtotals } = matrix

  const paddedRows: (DefectCell | null)[] = rows.slice()
  while (paddedRows.length < minRows) paddedRows.push(null)

  const colCount = cols.length + 2
  return (
    <Card size="small" title={title} bodyStyle={{ padding: 0, maxHeight: 280, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead style={{ position: 'sticky', top: 0 }}>
          <tr style={{ background: '#fafafa', fontWeight: 600 }}>
            <Th rowSpan={2} className="col-wrap" style={{ textAlign: 'left', width: '50%' }}>不良描述</Th>
            <Th rowSpan={2} style={{ width: '15%' }}>序号</Th>
            <Th colSpan={cols.length}>报工单序号</Th>
          </tr>
          <tr style={{ background: '#fafafa', fontWeight: 600 }}>
            {cols.map((c, i) => (
              <Th key={c.reportOrderId}>{i + 1}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddedRows.map((r, ri) => (
            r === null ? (
              <tr key={`blank-${ri}`}>
                {Array.from({ length: colCount }).map((_, ci) => <Td key={ci}>&nbsp;</Td>)}
              </tr>
            ) : (
              <tr key={r.defectId} style={{ borderTop: '1px solid #f0f0f0' }}>
                <Td className="col-wrap" style={{ textAlign: 'left' }}>{r.defectName}</Td>
                <Td>{ri + 1}</Td>
                {cols.map((_, ci) => (
                  <Td key={ci}>{cells[ri]?.[ci] > 0 ? cells[ri][ci] : ''}</Td>
                ))}
              </tr>
            )
          ))}
          {rows.length > 0 && (
            <tr style={{ background: '#fffbe6', fontWeight: 600 }}>
              <Td style={{ textAlign: 'left', fontWeight: 600 }}>小计</Td><Td>&nbsp;</Td>
              {colSubtotals.map((v, i) => (
                <Td key={i} style={{ color: '#d48806', fontWeight: 600 }}>{v > 0 ? v : ''}</Td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
