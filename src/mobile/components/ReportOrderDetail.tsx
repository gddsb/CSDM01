/**
 * 报工单详情 — 7 个子 Tab（工序 / 不良 / 报废 / 异常 / 人工 / 投料 / 图片）
 *
 * 对齐 PC ProcessReporting.tsx 的嵌套接口：
 *   GET  /production/report-orders/:id/processes
 *   POST /production/process-defects        (per process)
 *   POST /production/scrap-defects
 *   POST /production/process-exceptions
 *   POST /production/manpower-records        + PUT
 *   POST /production/process-materials
 *   POST /production/report-images/:report_no/:category/upload  (multipart)
 *   POST /production/report-orders/:id/close
 *
 * 作为独立组件：可在 MobileProcessReporting 历史列表和 MobileOrderManagement 下属报工单中复用
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Tabs, Toast, Dialog, Input, TextArea, List, ImageUploader } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../utils/api'
import { offlinePost, offlinePut } from '../offline/offlineApi'

type TabKey = 'process' | 'defect' | 'scrap' | 'exception' | 'manpower' | 'material' | 'image'

export interface ReportOrderMeta {
  report_order_id: number
  report_no?: string
  order_id?: number
  order_no?: string
  line_name?: string
  material_code?: string
  material_name?: string
  report_qty?: number
  status?: string
}

interface ProcessRow { process_id: number; process_name?: string; sort_order?: number }

interface DefectForm { process_id: number; process_name: string; defect_type_id: number | null; defect_type_name: string; quantity: number; unit: string; defect_desc: string }
interface ScrapForm { process_id: number | null; quantity: number; reason: string }
interface ExceptionForm { process_id: number | null; exception_type: string; duration_hours: number; reason: string }
interface ManpowerForm { worker_name: string; work_hours: number }
interface MaterialForm { material_id: number | null; material_name: string; process_id: number | null; quantity: number }

interface Props {
  meta: ReportOrderMeta
  onClose?: () => void
}

// ========== 主组件 ==========

export function ReportOrderDetail({ meta, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('process')
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [defectTypes, setDefectTypes] = useState<any[]>([])

  useEffect(() => {
    api.get(`/production/report-orders/${meta.report_order_id}/processes`).then((r: any) => {
      const list: ProcessRow[] = r.success ? (r.data || []) : []
      list.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      setProcesses(list)
    }).catch(() => {})
    api.get('/basic/defect-types', { params: { page: 1, page_size: 100 } }).then((r: any) => {
      const list: any[] = r.success ? (r.data?.list || r.data || []) : []
      setDefectTypes(list)
    }).catch(() => {})
  }, [meta.report_order_id])

  const [defectList, setDefectList] = useState<any[]>([])
  const [scrapList, setScrapList] = useState<any[]>([])
  const [exceptionList, setExceptionList] = useState<any[]>([])
  const [manpowerList, setManpowerList] = useState<any[]>([])
  const [materialList, setMaterialList] = useState<any[]>([])
  const [imageList, setImageList] = useState<ImageUploadItem[]>([])

  const refreshAll = useCallback(async () => {
    const r = meta.report_order_id
    const [defects, scraps, exceptions, manpower, materials] = await Promise.all([
      api.get('/production/process-defects', { params: { report_order_id: r, page: 1, pageSize: 1000 } }).then((x: any) => x.success ? (x.data?.list || x.data || []) : []).catch(() => []),
      api.get('/production/scrap-defects', { params: { report_order_id: r, page: 1, pageSize: 1000 } }).then((x: any) => x.success ? (x.data?.list || x.data || []) : []).catch(() => []),
      api.get('/production/process-exceptions', { params: { report_order_id: r, page: 1, pageSize: 1000 } }).then((x: any) => x.success ? (x.data?.list || x.data || []) : []).catch(() => []),
      api.get('/production/manpower-records', { params: { report_order_id: r, page: 1, pageSize: 1000 } }).then((x: any) => x.success ? (x.data?.list || x.data || []) : []).catch(() => []),
      api.get('/production/process-materials', { params: { report_order_id: r, page: 1, pageSize: 1000 } }).then((x: any) => x.success ? (x.data?.list || x.data || []) : []).catch(() => []),
    ])
    setDefectList(defects); setScrapList(scraps); setExceptionList(exceptions); setManpowerList(manpower); setMaterialList(materials)
  }, [meta.report_order_id])

  useEffect(() => { refreshAll() }, [refreshAll])

  // ========== 关闭报工单 ==========
  const onCloseReport = async () => {
    const ok = await Dialog.confirm({
      content: `确认关闭报工单 ${meta.report_no}？关闭后不可再添加数据。`,
      confirmText: '确认关闭', cancelText: '取消',
    })
    if (!ok) return
    try {
      const r: any = await offlinePost(`/production/report-orders/${meta.report_order_id}/close`, {}, { source: 'production-report' })
      Toast.show({ content: r.message || '已关闭', icon: 'success', position: 'bottom' })
      onClose?.()
    } catch (e: any) { Toast.show({ content: e?.message || '关闭失败', position: 'bottom' }) }
  }

  const isClosed = /已完工|已关闭|closed|finished/i.test(meta.status || '')

  return (
    <div style={{ maxHeight: '75vh', overflow: 'auto', padding: '6px 2px' }}>
      {/* 头 */}
      <div style={{ padding: 10, background: '#E3F2FD', borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.report_no}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
          {meta.order_no} · {meta.material_code} {meta.material_name?.slice(0, 16)} · ×{meta.report_qty}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: '#fff', color: '#1565C0' }}>
            {meta.status}
          </span>
          {!isClosed && (
            <Button size="mini" color="danger" fill="outline" onClick={onCloseReport}>关闭报工单</Button>
          )}
        </div>
      </div>

      <Tabs activeKey={tab} onChange={(k) => setTab(k as TabKey)} style={{ marginBottom: 10 }}>
        <Tabs.Tab title={`工序(${processes.length})`} key="process" />
        <Tabs.Tab title={`不良(${defectList.length})`} key="defect" />
        <Tabs.Tab title={`报废(${scrapList.length})`} key="scrap" />
        <Tabs.Tab title={`异常(${exceptionList.length})`} key="exception" />
        <Tabs.Tab title={`人工(${manpowerList.length})`} key="manpower" />
        <Tabs.Tab title={`投料(${materialList.length})`} key="material" />
        <Tabs.Tab title="图片" key="image" />
      </Tabs>

      {tab === 'process' && <ProcessPanel processes={processes} />}
      {tab === 'defect' && <DefectPanel reportId={meta.report_order_id} processes={processes}
        defectTypes={defectTypes} list={defectList} onChange={refreshAll} disabled={isClosed} />}
      {tab === 'scrap' && <ScrapPanel reportId={meta.report_order_id} processes={processes}
        list={scrapList} onChange={refreshAll} disabled={isClosed} />}
      {tab === 'exception' && <ExceptionPanel reportId={meta.report_order_id} processes={processes}
        list={exceptionList} onChange={refreshAll} disabled={isClosed} />}
      {tab === 'manpower' && <ManpowerPanel reportId={meta.report_order_id}
        list={manpowerList} onChange={refreshAll} disabled={isClosed} />}
      {tab === 'material' && <MaterialPanel reportId={meta.report_order_id} processes={processes}
        list={materialList} onChange={refreshAll} disabled={isClosed} />}
      {tab === 'image' && <ImagePanel reportNo={meta.report_no!} images={imageList} setImages={setImageList} />}

      <Button block fill="outline" style={{ marginTop: 10 }} onClick={onClose}>返回</Button>
    </div>
  )
}

// ========== 各子 Panel ==========

function ProcessPanel({ processes }: { processes: ProcessRow[] }) {
  if (processes.length === 0) return <div style={{ fontSize: 12, color: '#999', padding: 20, textAlign: 'center' }}>无工序数据</div>
  return (
    <List>
      {processes.map((p, i) => (
        <List.Item key={p.process_id} description={`工序 #${i + 1} · 排序 ${p.sort_order ?? '—'}`}>
          {p.process_name || `工序 ${p.process_id}`}
        </List.Item>
      ))}
    </List>
  )
}

function DefectPanel({ reportId, processes, defectTypes, list, onChange, disabled }: {
  reportId: number; processes: ProcessRow[]; defectTypes: any[]; list: any[]; onChange: () => void; disabled?: boolean
}) {
  const [form, setForm] = useState<DefectForm>({
    process_id: processes[0]?.process_id || 0,
    process_name: processes[0]?.process_name || '',
    defect_type_id: null, defect_type_name: '',
    quantity: 0, unit: '件', defect_desc: '',
  })
  useEffect(() => {
    if (processes.length > 0 && !form.process_id) {
      setForm((f) => ({ ...f, process_id: processes[0].process_id, process_name: processes[0].process_name || '' }))
    }
  }, [processes])

  const add = async () => {
    if (!form.defect_type_id) { Toast.show({ content: '请选择不良类型', position: 'bottom' }); return }
    if (form.quantity <= 0) { Toast.show({ content: '数量必须 > 0', position: 'bottom' }); return }
    try {
      await offlinePost('/production/process-defects', {
        report_order_id: reportId,
        process_id: form.process_id,
        defect_type_id: form.defect_type_id,
        defect_type_name: form.defect_type_name,
        quantity: form.quantity,
        unit: form.unit,
        defect_desc: form.defect_desc,
      }, { source: 'production-defect' })
      Toast.show({ content: '已添加', icon: 'success', position: 'bottom' })
      setForm({ ...form, quantity: 0, defect_desc: '' })
      onChange()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  return (
    <Panel>
      {list.length > 0 && (
        <List.Item>
          <div style={{ width: '100%', fontSize: 12 }}>
            {list.map((d: any) => (
              <div key={d.id || d.defect_id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>{d.defect_type_name || d.defect_type} · {d.quantity}{d.unit || ''}
                  <span style={{ marginLeft: 8, color: '#aaa' }}>
                    {d.defect_desc?.slice(0, 30)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </List.Item>
      )}
      {!disabled && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>工序</div>
          <select value={form.process_id} onChange={(e) => {
            const pid = Number(e.target.value)
            const proc = processes.find((p) => p.process_id === pid)
            setForm({ ...form, process_id: pid, process_name: proc?.process_name || '' })
          }} style={selStyle}>
            <option value={0}>选择工序</option>
            {processes.map((p) => <option key={p.process_id} value={p.process_id}>{p.process_name}</option>)}
          </select>

          <div style={{ fontSize: 11, color: '#888', marginTop: 6, marginBottom: 4 }}>不良类型</div>
          <select value={form.defect_type_id || ''} onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            const t = defectTypes.find((x) => (x.id ?? x.defect_type_id) === id)
            setForm({ ...form, defect_type_id: id, defect_type_name: t?.defect_name || t?.name || '' })
          }} style={selStyle}>
            <option value="">选择不良类型</option>
            {defectTypes.map((t) => (
              <option key={t.id || t.defect_type_id} value={t.id || t.defect_type_id}>
                {t.defect_name || t.name || t.type_name}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <Input type="number" value={String(form.quantity)} onChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} placeholder="数量" style={{ flex: 1 }} />
            <Input value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="单位" style={{ flex: 1 }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <TextArea value={form.defect_desc} onChange={(v) => setForm({ ...form, defect_desc: v })} rows={2} placeholder="缺陷描述（可选）" />
          </div>
          <Button block color="primary" size="mini" style={{ marginTop: 8 }} onClick={add}>添加不良</Button>
        </>
      )}
    </Panel>
  )
}

function ScrapPanel({ reportId, processes, list, onChange, disabled }: {
  reportId: number; processes: ProcessRow[]; list: any[]; onChange: () => void; disabled?: boolean
}) {
  const [f, setF] = useState<ScrapForm>({ process_id: processes[0]?.process_id || null, quantity: 0, reason: '' })
  useEffect(() => { if (processes.length > 0 && !f.process_id) setF({ ...f, process_id: processes[0].process_id }) }, [processes])
  const add = async () => {
    if (f.quantity <= 0) { Toast.show({ content: '数量必须 > 0', position: 'bottom' }); return }
    try {
      await offlinePost('/production/scrap-defects', { ...f, report_order_id: reportId }, { source: 'production-scrap' })
      Toast.show({ content: '已添加', icon: 'success', position: 'bottom' })
      setF({ ...f, quantity: 0, reason: '' })
      onChange()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }
  return (
    <Panel>
      {list.length > 0 && list.map((s: any) => (
        <List.Item key={s.id || s.scrap_id} description={`${s.reason || ''}`}>
          报废 {s.quantity} · {s.process_name || ''}
        </List.Item>
      ))}
      {!disabled && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={f.process_id || ''} onChange={(e) => setF({ ...f, process_id: e.target.value ? Number(e.target.value) : null })} style={selStyle}>
              <option value="">工序(可选)</option>
              {processes.map((p) => <option key={p.process_id} value={p.process_id}>{p.process_name}</option>)}
            </select>
            <Input type="number" value={String(f.quantity)} onChange={(v) => setF({ ...f, quantity: Number(v) || 0 })} placeholder="数量" style={{ flex: 1 }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <TextArea value={f.reason} onChange={(v) => setF({ ...f, reason: v })} rows={2} placeholder="报废原因" />
          </div>
          <Button block color="primary" size="mini" style={{ marginTop: 8 }} onClick={add}>添加报废</Button>
        </>
      )}
    </Panel>
  )
}

function ExceptionPanel({ reportId, processes, list, onChange, disabled }: {
  reportId: number; processes: ProcessRow[]; list: any[]; onChange: () => void; disabled?: boolean
}) {
  const [f, setF] = useState<ExceptionForm>({ process_id: processes[0]?.process_id || null, exception_type: '设备故障', duration_hours: 1, reason: '' })
  useEffect(() => { if (processes.length > 0 && !f.process_id) setF({ ...f, process_id: processes[0].process_id }) }, [processes])
  const add = async () => {
    try {
      await offlinePost('/production/process-exceptions', { ...f, report_order_id: reportId }, { source: 'production-exception' })
      Toast.show({ content: '已记录', icon: 'success', position: 'bottom' })
      onChange()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }
  return (
    <Panel>
      {list.length > 0 && list.map((e: any) => (
        <List.Item key={e.id || e.exception_id} description={`${e.duration_hours}h · ${e.reason || ''}`}>
          {e.exception_type} · {e.process_name || ''}
        </List.Item>
      ))}
      {!disabled && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={f.process_id || ''} onChange={(e) => setF({ ...f, process_id: e.target.value ? Number(e.target.value) : null })} style={selStyle}>
              <option value="">工序(可选)</option>
              {processes.map((p) => <option key={p.process_id} value={p.process_id}>{p.process_name}</option>)}
            </select>
            <Input value={f.exception_type} onChange={(v) => setF({ ...f, exception_type: v })} placeholder="类型" style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <Input type="number" value={String(f.duration_hours)} onChange={(v) => setF({ ...f, duration_hours: Number(v) || 0 })} placeholder="工时(h)" style={{ flex: 1 }} />
            <Input value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder="原因" style={{ flex: 1 }} />
          </div>
          <Button block color="primary" size="mini" style={{ marginTop: 8 }} onClick={add}>记录异常</Button>
        </>
      )}
    </Panel>
  )
}

function ManpowerPanel({ reportId, list, onChange, disabled }: {
  reportId: number; list: any[]; onChange: () => void; disabled?: boolean
}) {
  const [f, setF] = useState<ManpowerForm>({ worker_name: '', work_hours: 1 })
  const add = async () => {
    if (!f.worker_name.trim()) { Toast.show({ content: '请填工人姓名', position: 'bottom' }); return }
    try {
      await offlinePost('/production/manpower-records', { ...f, report_order_id: reportId }, { source: 'production-manpower' })
      Toast.show({ content: '已添加', icon: 'success', position: 'bottom' })
      setF({ worker_name: '', work_hours: 1 })
      onChange()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }
  return (
    <Panel>
      {list.length > 0 && list.map((m: any) => (
        <List.Item key={m.record_id || m.id} description={`${m.work_hours}h`}>
          {m.worker_name || m.username || '—'}
        </List.Item>
      ))}
      {!disabled && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={f.worker_name} onChange={(v) => setF({ ...f, worker_name: v })} placeholder="工人姓名" style={{ flex: 1 }} />
            <Input type="number" value={String(f.work_hours)} onChange={(v) => setF({ ...f, work_hours: Number(v) || 0 })} placeholder="工时" style={{ flex: 0.7 }} />
          </div>
          <Button block color="primary" size="mini" style={{ marginTop: 8 }} onClick={add}>添加人工记录</Button>
        </>
      )}
    </Panel>
  )
}

function MaterialPanel({ reportId, processes, list, onChange, disabled }: {
  reportId: number; processes: ProcessRow[]; list: any[]; onChange: () => void; disabled?: boolean
}) {
  const [f, setF] = useState<MaterialForm>({ material_id: null, material_name: '', process_id: null, quantity: 0 })
  const add = async () => {
    if (!f.material_id || f.quantity <= 0) { Toast.show({ content: '请选物料并填数量', position: 'bottom' }); return }
    try {
      await offlinePost('/production/process-materials', { ...f, report_order_id: reportId }, { source: 'production-material' })
      Toast.show({ content: '已添加', icon: 'success', position: 'bottom' })
      setF({ ...f, material_id: null, material_name: '', quantity: 0 })
      onChange()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }
  return (
    <Panel>
      {list.length > 0 && list.map((m: any) => (
        <List.Item key={m.id || m.material_id} description={`工序 ${m.process_name || ''}`}>
          {m.material_code} {m.material_name?.slice(0, 14)} · ×{m.quantity}
        </List.Item>
      ))}
      {!disabled && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>工序</div>
          <select value={f.process_id || ''} onChange={(e) => setF({ ...f, process_id: e.target.value ? Number(e.target.value) : null })} style={selStyle}>
            <option value="">选择工序</option>
            {processes.map((p) => <option key={p.process_id} value={p.process_id}>{p.process_name}</option>)}
          </select>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6, marginBottom: 4 }}>物料 ID</div>
          <Input type="number" value={String(f.material_id || '')} onChange={(v) => setF({ ...f, material_id: v ? Number(v) : null })} placeholder="物料 ID" />
          <div style={{ fontSize: 11, color: '#888', marginTop: 6, marginBottom: 4 }}>数量</div>
          <Input type="number" value={String(f.quantity)} onChange={(v) => setF({ ...f, quantity: Number(v) || 0 })} placeholder="投料数量" />
          <Button block color="primary" size="mini" style={{ marginTop: 8 }} onClick={add}>添加投料</Button>
        </>
      )}
    </Panel>
  )
}

function ImagePanel({ reportNo, images, setImages }: { reportNo: string; images: ImageUploadItem[]; setImages: (v: ImageUploadItem[]) => void }) {
  const upload = async (file: File) => {
    const fd = new FormData(); fd.append('files', file)
    const r: any = await api.post(`/production/report-images/${reportNo}/inspection/upload`, fd, { timeout: 60000 })
    if (r.success) Toast.show({ content: '图片已上传', icon: 'success', position: 'bottom' })
    return { url: URL.createObjectURL(file) }
  }
  return (
    <Panel>
      <ImageUploader value={images} onChange={setImages} upload={upload} maxCount={10} />
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>上传后自动关联到报工单 inspection 分类</div>
    </Panel>
  )
}

// ========== 小工具 ==========

function Panel({ children }: { children: any }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 10,
      border: '1px solid #eef0f3', marginBottom: 10,
    }}>{children}</div>
  )
}

const selStyle: React.CSSProperties = {
  padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%', background: '#fff',
}
