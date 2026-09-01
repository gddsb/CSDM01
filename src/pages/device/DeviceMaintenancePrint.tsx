import React, { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Select, Space, Spin, message, Typography } from 'antd'
import { PrinterOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography

interface MatrixRecord {
  record_id: number
  status: string
  result: string
  actual_value: string
  executor: string
  start_time: string
  end_time: string
  duration_min: number
  abnormal_desc: string
}

interface MatrixItem {
  standard_id: number
  item_name: string
  mechanism: string | null
  component: string | null
  location: string | null
  maintenance_method: string | null
  judge_type: string | null
  standard_value: string | null
  unit: string | null
  point_count: number
  time_per_point: number
  maintenance_content?: string | null
  monthly_plan?: unknown
  sort_order: number
  records: Record<string, MatrixRecord | null>
}

interface MatrixResp {
  device_id: number
  device_code: string | null
  device_name: string | null
  year_month: string
  year: number
  month: number
  days_in_month: number
  week_keys: string[]
  daily: { items: MatrixItem[] }
  weekly: { items: MatrixItem[] }
  monthly: { items: MatrixItem[] }
  summary: Record<string, any>
}

const STATUS_MARK: Record<string, { text: string; cls: string }> = {
  待执行: { text: '—', cls: 'cell-pending' },
  执行中: { text: '◐', cls: 'cell-progress' },
  已完成: { text: '✓', cls: 'cell-done' },
  已挂起: { text: '×', cls: 'cell-skip' },
}

function cellValue(rec: MatrixRecord | null) {
  if (!rec) return { text: '', cls: 'cell-empty' }
  if (rec.result === '异常') return { text: '异常', cls: 'cell-abnormal' }
  const m = STATUS_MARK[rec.status]
  if (m) return m
  return { text: rec.actual_value || '✓', cls: 'cell-done' }
}

export default function DeviceMaintenancePrint() {
  const params = new URLSearchParams(window.location.search)
  const initDevice = Number(params.get('device_id') || 0) || undefined
  const initYm: Dayjs | undefined = params.get('year_month')
    ? dayjs(params.get('year_month')!, 'YYYY-MM')
    : dayjs()

  const [devices, setDevices] = useState<any[]>([])
  const [deviceId, setDeviceId] = useState<number | undefined>(initDevice)
  const [ym, setYm] = useState<Dayjs>(initYm!)
  const [data, setData] = useState<MatrixResp | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/basic/devices', { params: { page_size: 500 } })
      .then((res: any) => setDevices(res?.rows || []))
      .catch(() => {})
  }, [])

  const load = () => {
    if (!deviceId) { message.warning('请先选择设备'); return }
    setLoading(true)
    api.get('/basic/device-records/matrix', {
      params: {
        device_id: deviceId,
        year_month: ym.format('YYYY-MM'),
      },
    }).then((res: any) => {
      setData(res as MatrixResp)
    }).catch((err: any) => {
      message.error(err?.message || '加载失败')
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (deviceId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  const allPeriods = useMemo(() => {
    if (!data) return { dailyDates: [] as string[], weekKeys: [] as string[] }
    const dailyDates = Array.from({ length: data.days_in_month }, (_, i) =>
      `${data.year}-${String(data.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
    )
    return { dailyDates, weekKeys: data.week_keys }
  }, [data])

  return (
    <div className="print-page-root">
      {/* ===== 操作栏（不打印） ===== */}
      <div className="print-toolbar no-print">
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => history.back()}>返回</Button>
          <Select
            placeholder="选择设备" allowClear showSearch
            style={{ width: 260 }}
            value={deviceId}
            onChange={setDeviceId}
            options={devices.map(d => ({
              label: `${d.device_code || ''} ${d.device_name || ''}`.trim(),
              value: d.device_id,
            }))}
            filterOption={(input, option) =>
              String(option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <DatePicker
            picker="month"
            value={ym}
            onChange={(d) => d && setYm(d)}
            style={{ width: 150 }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>加载</Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
            disabled={!data}
          >打印</Button>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            {data ? `共 ${data.daily.items.length + data.weekly.items.length + data.monthly.items.length} 条保养项` : ''}
          </Text>
        </Space>
      </div>

      {/* ===== 打印区 ===== */}
      <Spin spinning={loading}>
        {data ? (
          <div className="print-area">
            <div className="print-header">
              <Title level={3} style={{ textAlign: 'center', margin: 0 }}>
                设备点检/维保记录表
              </Title>
              <div className="print-header-meta">
                <div>设备编号：<b>{data.device_code || '-'}</b></div>
                <div>设备名称：<b>{data.device_name || '-'}</b></div>
                <div>年月：<b>{data.year_month}</b></div>
              </div>
            </div>

            {/* ========== 每日点检矩阵 ========== */}
            {data.daily.items.length > 0 && (
              <section className="print-section">
                <Title level={5} className="section-title">一、每日点检（{data.daily.items.length} 项）</Title>
                <div className="print-table-wrap">
                  <table className="print-table daily-table">
                    <thead>
                      <tr>
                        <th className="col-seq">序号</th>
                        <th className="col-item">保养项目</th>
                        <th className="col-meta">部位</th>
                        <th className="col-meta">组件</th>
                        <th className="col-meta">位置</th>
                        <th className="col-meta">方法</th>
                        <th className="col-judge">判定基准</th>
                        {allPeriods.dailyDates.map(d => (
                          <th key={d} className="col-day">{Number(d.slice(8, 10))}</th>
                        ))}
                        <th className="col-executor">执行人员</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.items.map((it, idx) => (
                        <tr key={it.standard_id}>
                          <td className="text-center">{idx + 1}</td>
                          <td>{it.item_name}</td>
                          <td>{it.mechanism || '-'}</td>
                          <td>{it.component || '-'}</td>
                          <td>{it.location || '-'}</td>
                          <td>{it.maintenance_method || '-'}</td>
                          <td>{it.standard_value || '-'}</td>
                          {allPeriods.dailyDates.map(d => {
                            const cell = cellValue(it.records?.[d] || null)
                            return (
                              <td key={d} className={`cell-result ${cell.cls}`}>
                                <span className="mark">{cell.text}</span>
                                {it.records?.[d]?.executor && (
                                  <span className="mini-executor">{it.records[d]!.executor}</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="col-executor-list">
                            {executorList(it.records)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ========== 每周保养矩阵 ========== */}
            {data.weekly.items.length > 0 && (
              <section className="print-section">
                <Title level={5} className="section-title">二、每周保养（{data.weekly.items.length} 项）</Title>
                <div className="print-table-wrap">
                  <table className="print-table weekly-table">
                    <thead>
                      <tr>
                        <th className="col-seq">序号</th>
                        <th className="col-item">保养项目</th>
                        <th className="col-meta">部位</th>
                        <th className="col-meta">组件</th>
                        <th className="col-judge">判定基准</th>
                        <th className="col-meta">点位×时间</th>
                        {allPeriods.weekKeys.map(wk => (
                          <th key={wk} className="col-week">{wk.replace(/^\d{4}-/, '')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.weekly.items.map((it, idx) => (
                        <tr key={it.standard_id}>
                          <td className="text-center">{idx + 1}</td>
                          <td>{it.item_name}</td>
                          <td>{it.mechanism || '-'}</td>
                          <td>{it.component || '-'}</td>
                          <td>{it.standard_value || '-'}</td>
                          <td className="text-center">
                            {it.point_count || 1} × {it.time_per_point || 0}分
                          </td>
                          {allPeriods.weekKeys.map(wk => {
                            const cell = cellValue(it.records?.[wk] || null)
                            return (
                              <td key={wk} className={`cell-result ${cell.cls}`}>
                                <span className="mark">{cell.text}</span>
                                {it.records?.[wk]?.executor && (
                                  <span className="mini-executor">{it.records[wk]!.executor}</span>
                                )}
                                {it.records?.[wk]?.abnormal_desc && (
                                  <span className="mini-note">⚠ 异常</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ========== 每月保养矩阵 ========== */}
            {data.monthly.items.length > 0 && (
              <section className="print-section">
                <Title level={5} className="section-title">三、每月保养（{data.monthly.items.length} 项）</Title>
                <div className="print-table-wrap">
                  <table className="print-table monthly-table">
                    <thead>
                      <tr>
                        <th className="col-seq">序号</th>
                        <th className="col-item">保养项目</th>
                        <th className="col-meta">部位/组件</th>
                        <th className="col-judge">判定基准</th>
                        <th className="col-judge">保养内容</th>
                        <th className="col-judge">执行结果</th>
                        <th className="col-meta">执行人</th>
                        <th className="col-meta">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.items.map((it, idx) => {
                        const rec = it.records?.[data.year_month]
                        return (
                          <tr key={it.standard_id}>
                            <td className="text-center">{idx + 1}</td>
                            <td>{it.item_name}</td>
                            <td>{[it.mechanism, it.component].filter(Boolean).join(' / ') || '-'}</td>
                            <td>{it.standard_value || '-'}</td>
                            <td>{it.maintenance_content || '-'}</td>
                            <td className={`cell-result ${cellValue(rec || null).cls}`}>
                              <div>
                                状态：{rec?.status || '未生成'} · 结果：{rec?.result || '-'}
                                {rec?.actual_value && ` · 实测：${rec.actual_value}${it.unit || ''}`}
                              </div>
                              {rec?.abnormal_desc && (
                                <div className="mini-note">异常说明：{rec.abnormal_desc}</div>
                              )}
                            </td>
                            <td className="text-center">{rec?.executor || '-'}</td>
                            <td className="text-center">
                              {rec?.start_time ? dayjs(rec.start_time).format('MM-DD HH:mm') : '-'}
                              {rec?.duration_min ? `（${rec.duration_min}分）` : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ========== 汇总 & 签名 ========== */}
            <section className="print-section">
              <Title level={5} className="section-title">四、执行汇总</Title>
              <div className="summary-box">
                <div className="summary-grid">
                  <div><b>每日点检完成率：</b>{data.summary.daily_completed || 0} / {data.summary.daily_total || 0}
                    （{data.summary.daily_rate ?? 0}%）</div>
                  <div><b>每周保养完成率：</b>{data.summary.weekly_completed || 0} / {data.summary.weekly_total || 0}
                    （{data.summary.weekly_rate ?? 0}%）</div>
                  <div><b>每月保养完成率：</b>{data.summary.monthly_completed || 0} / {data.summary.monthly_total || 0}
                    （{data.summary.monthly_rate ?? 0}%）</div>
                  <div className="span-3"><b>异常项数：</b>{data.summary.abnormal_count || 0}</div>
                </div>
              </div>
              <div className="sign-box">
                <div>设备负责人：</div>
                <div>执行人：</div>
                <div>审核人：</div>
                <div>日期：</div>
              </div>
            </section>
          </div>
        ) : (
          <div className="print-empty">请选择设备后点击 <b>加载</b> 以获取打印数据</div>
        )}
      </Spin>

      <style>{`
        .print-page-root { padding: 16px 20px 40px; background: #f5f5f5; min-height: 100vh; }
        .print-toolbar {
          position: sticky; top: 0; z-index: 10;
          background: #fff; padding: 12px 16px;
          border: 1px solid #e8e8e8; border-radius: 6px;
          margin-bottom: 16px; box-shadow: 0 2px 6px rgba(0,0,0,.04);
        }
        .print-area { background: #fff; padding: 28px 32px; border-radius: 6px; }
        .print-empty { padding: 100px 0; text-align: center; color: #999; }
        .print-header { margin-bottom: 18px; }
        .print-header-meta {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 8px; margin-top: 14px; font-size: 13px;
          padding: 10px 14px; background: #fafafa; border: 1px solid #eee; border-radius: 4px;
        }
        .section-title {
          margin: 18px 0 10px !important;
          padding: 4px 10px;
          border-left: 4px solid #1677ff;
          background: #f5f9ff;
        }
        .print-table-wrap { overflow-x: auto; }
        .print-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 12px;
          color: #222;
        }
        .print-table th, .print-table td {
          border: 1px solid #bbb;
          padding: 4px 6px;
          vertical-align: middle;
          text-align: left;
          background: #fff;
        }
        .print-table thead th {
          background: #eef3f8;
          text-align: center;
          font-weight: 600;
          white-space: nowrap;
          position: sticky; top: 0;
        }
        .print-table tbody td.text-center { text-align: center; }
        .col-seq { width: 44px; text-align: center !important; }
        .col-item { min-width: 160px; }
        .col-meta { min-width: 80px; }
        .col-judge { min-width: 160px; }
        .col-day, .col-week { width: 38px !important; padding: 2px 0 !important; text-align: center !important; }
        .col-week { width: 58px !important; }
        .col-executor { min-width: 120px; }
        .cell-result {
          position: relative;
          text-align: center;
          padding: 2px 2px !important;
        }
        .cell-result .mark {
          display: inline-block; font-weight: 600;
          min-width: 14px; min-height: 14px; line-height: 14px;
        }
        .cell-empty .mark { color: #ccc; }
        .cell-pending .mark { color: #faad14; }
        .cell-progress .mark { color: #1677ff; }
        .cell-done { background: #eaffef !important; }
        .cell-done .mark { color: #19a11f; }
        .cell-skip { background: #fafafa !important; color: #888; }
        .cell-abnormal { background: #ffecec !important; color: #cf1322; font-weight: 600; }
        .mini-executor, .mini-note {
          display: block;
          font-size: 10px; color: #666;
          margin-top: 2px; line-height: 1.2;
        }
        .mini-note { color: #cf1322; font-weight: 600; }
        .col-executor-list {
          font-size: 11px;
          color: #555;
          white-space: pre-wrap;
          line-height: 1.5;
        }
        .summary-box {
          padding: 12px 16px;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 4px;
          margin-bottom: 14px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          line-height: 1.8;
        }
        .summary-grid > .span-3 { grid-column: span 3; }
        .sign-box {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-top: 10px;
          padding: 18px 8px;
          font-size: 13px;
          border-top: 1px dashed #ccc;
        }
        .sign-box div {
          padding: 4px 8px 18px 0;
          border-bottom: 1px solid #222;
          text-align: left;
        }
        /* ===== 打印样式 ===== */
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body { background: #fff !important; }
          .print-page-root { padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .print-area { padding: 0; border-radius: 0; }
          .print-table { font-size: 11px; }
          .col-day, .col-week { padding: 1px 0 !important; font-size: 10px; }
          .section-title { break-after: avoid; }
          .print-section { break-inside: avoid; }
          .print-table thead th { position: initial; }
        }
      `}</style>
    </div>
  )
}

function executorList(records?: Record<string, MatrixRecord | null>): string {
  if (!records) return ''
  const set = new Set<string>()
  Object.values(records).forEach(r => { if (r?.executor) set.add(r.executor) })
  return Array.from(set).join('、')
}
