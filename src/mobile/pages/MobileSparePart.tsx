/**
 * 备件管理移动版 — 3 Tab + 入库/出库/盘点 3 动作
 *
 * 对齐 PC DeviceSparePart.tsx：
 *   GET    /basic/device-spare-parts                  台账
 *   GET    /basic/device-spare-parts/low-stock/list   低库存预警
 *   POST   /basic/device-spare-parts/:id/stock-in     入库 (quantity/unit_price/purchase_no/supplier/related_order/remarks)
 *   POST   /basic/device-spare-parts/:id/stock-out    出库 (quantity/unit_price/related_order/remarks)
 *   POST   /basic/device-spare-parts/:id/adjust       盘点调整 (actual_stock/remarks)
 *   GET    /basic/device-spare-part-logs              出入库流水 (log_type/part_id/page)
 *   DELETE /basic/device-spare-parts/:id              删除备件
 *   POST   /basic/device-spare-parts                  新建备件
 */
import { useEffect, useState } from 'react'
import { Button, List, SearchBar, Toast, Dialog, Tabs, PullToRefresh, Input, Radio, Space } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost, offlineDelete } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

type TabKey = 'all' | 'low' | 'log'
const TAB_LIST: { key: TabKey; label: string }[] = [
  { key: 'all', label: '📦 台账' },
  { key: 'low', label: '⚠️ 低库存' },
  { key: 'log', label: '📜 流水' },
]

interface SpareRow {
  part_id: number; part_code?: string; part_name?: string
  specification?: string; unit?: string; category?: string
  current_stock?: number; safety_stock_min?: number; safety_stock_max?: number
  unit_price?: number; warehouse?: string; shelf?: string; layer?: string
}

interface LogRow {
  id?: number | string; part_id?: number; part_code?: string; part_name?: string
  log_type?: 'in' | 'out' | 'adjust'; quantity?: number; unit_price?: number
  total_price?: number; related_order?: string; remarks?: string; created_at?: string
}

// ========== 主组件 ==========

export default function MobileSparePart() {
  const { scan } = useBarcode()
  const [tab, setTab] = useState<TabKey>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [parts, setParts] = useState<SpareRow[]>([])
  const [lowParts, setLowParts] = useState<SpareRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [selected, setSelected] = useState<SpareRow | null>(null)

  // 抽屉表单
  const [formType, setFormType] = useState<'in' | 'out' | 'adjust' | 'create' | null>(null)
  const [qty, setQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [purchaseNo, setPurchaseNo] = useState('')
  const [supplier, setSupplier] = useState('')
  const [relatedOrder, setRelatedOrder] = useState('')
  const [remarks, setRemarks] = useState('')
  const [actualStock, setActualStock] = useState('')

  const [createForm, setCreateForm] = useState({
    part_code: '', part_name: '', specification: '', unit: '个', category: '机械',
    current_stock: 0, safety_stock_min: 0, safety_stock_max: 0, unit_price: 0,
    warehouse: '', shelf: '', layer: '',
  })

  const loadAll = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 100 }
      if (keyword) params.part_code = keyword
      const [r1, r2] = await Promise.all([
        api.get('/basic/device-spare-parts', { params }),
        api.get('/basic/device-spare-parts/low-stock/list', { params: { page: 1, page_size: 100 } }),
      ])
      setParts(r1.success ? (r1.data?.list || r1.data || []) : [])
      setLowParts(r2.success ? (r2.data?.list || r2.data || []) : [])
    } catch { setParts([]); setLowParts([]) } finally { setLoading(false) }
  }
  const loadLogs = async () => {
    setLoading(true)
    try {
      const r: any = await api.get('/basic/device-spare-part-logs', { params: { page: 1, page_size: 100 } })
      setLogs(r.success ? (r.data?.list || r.data || []) : [])
    } catch { setLogs([]) } finally { setLoading(false) }
  }
  useEffect(() => {
    if (tab === 'log') loadLogs(); else loadAll()
  }, [tab])

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code); await loadAll()
  }

  const refresh = async () => {
    if (tab === 'log') await loadLogs(); else await loadAll()
  }

  // ====== 行内按钮 ======
  const openForm = (part: SpareRow, type: 'in' | 'out' | 'adjust') => {
    setSelected(part); setFormType(type)
    setQty('1'); setUnitPrice(String(part.unit_price || ''))
    setPurchaseNo(''); setSupplier(''); setRelatedOrder(''); setRemarks('')
    setActualStock(String(part.current_stock || 0))
  }

  const submitForm = async () => {
    if (!selected || !formType) return
    const q = Number(qty) || 0
    if ((formType === 'in' || formType === 'out') && q <= 0) { Toast.show({ content: '数量必须 > 0', position: 'bottom' }); return }
    if (formType === 'adjust') {
      const a = Number(actualStock)
      if (Number.isNaN(a)) { Toast.show({ content: '请填实际库存', position: 'bottom' }); return }
    }
    try {
      let r: any
      if (formType === 'in') {
        r = await offlinePost(`/basic/device-spare-parts/${selected.part_id}/stock-in`, {
          quantity: q, unit_price: unitPrice ? Number(unitPrice) : undefined,
          purchase_no: purchaseNo, supplier, related_order: relatedOrder, remarks,
        }, { source: 'spare-part' })
      } else if (formType === 'out') {
        r = await offlinePost(`/basic/device-spare-parts/${selected.part_id}/stock-out`, {
          quantity: q, unit_price: unitPrice ? Number(unitPrice) : undefined,
          related_order: relatedOrder, remarks: remarks || '领用出库',
        }, { source: 'spare-part' })
      } else {
        r = await offlinePost(`/basic/device-spare-parts/${selected.part_id}/adjust`, {
          actual_stock: Number(actualStock), remarks,
        }, { source: 'spare-part' })
      }
      Toast.show({ content: r.message || '成功', icon: 'success', position: 'bottom' })
      setFormType(null); setSelected(null)
      await refresh()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  const submitCreate = async () => {
    if (!createForm.part_name.trim()) { Toast.show({ content: '请填备件名称', position: 'bottom' }); return }
    try {
      const r: any = await offlinePost('/basic/device-spare-parts', createForm, { source: 'spare-part' })
      Toast.show({ content: r.message || '已创建', icon: 'success', position: 'bottom' })
      setFormType(null); setCreateForm({
        part_code: '', part_name: '', specification: '', unit: '个', category: '机械',
        current_stock: 0, safety_stock_min: 0, safety_stock_max: 0, unit_price: 0,
        warehouse: '', shelf: '', layer: '',
      })
      await refresh()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  const onDelete = async (part: SpareRow) => {
    const ok = await Dialog.confirm({ content: `删除备件 ${part.part_name}？`, confirmText: '删除', confirmColor: '#F44336', cancelText: '取消' })
    if (!ok) return
    try {
      await offlineDelete(`/basic/device-spare-parts/${part.part_id}`, { source: 'spare-part' })
      Toast.show({ content: '已删除', icon: 'success', position: 'bottom' })
      await refresh()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  // ====== 渲染 ======
  return (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 30 }}>
      {/* 搜索 + 新建 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <SearchBar placeholder="扫/输备件编号" value={keyword} onChange={setKeyword}
            onSearch={() => refresh()} onRightIconClick={onScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>} />
        </div>
        <Button color="primary" onClick={() => setFormType('create')} style={{ height: 40, marginTop: 2 }}>+ 新建</Button>
      </div>

      {/* Tab */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 8px', marginBottom: 10 }}>
        <Tabs activeKey={tab} onChange={(k) => setTab(k as TabKey)}>
          {TAB_LIST.map((t) => <Tabs.Tab title={t.label} key={t.key} />)}
        </Tabs>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>}

      {/* ==== 台账 ==== */}
      {tab === 'all' && !loading && (
        <PullToRefresh onRefresh={loadAll}>
          {parts.length === 0 ? (
            <Empty text="暂无备件" sub="点 + 新建" />
          ) : (
            parts.map((p) => <PartCard key={p.part_id} part={p}
              low={Number(p.current_stock ?? 0) < Number(p.safety_stock_min ?? 0)}
              onIn={() => openForm(p, 'in')}
              onOut={() => openForm(p, 'out')}
              onAdjust={() => openForm(p, 'adjust')}
              onDelete={() => onDelete(p)} />)
          )}
        </PullToRefresh>
      )}

      {/* ==== 低库存 ==== */}
      {tab === 'low' && !loading && (
        <PullToRefresh onRefresh={loadAll}>
          {lowParts.length === 0 ? (
            <Empty text="🎉 库存充足" sub="无低于安全下限的备件" />
          ) : (
            lowParts.map((p) => <PartCard key={p.part_id} part={p}
              low
              onIn={() => openForm(p, 'in')}
              onOut={() => openForm(p, 'out')}
              onAdjust={() => openForm(p, 'adjust')}
              onDelete={() => onDelete(p)} />)
          )}
        </PullToRefresh>
      )}

      {/* ==== 流水 ==== */}
      {tab === 'log' && !loading && (
        <PullToRefresh onRefresh={loadLogs}>
          {logs.length === 0 ? (
            <Empty text="暂无流水" />
          ) : (
            logs.map((l, i) => (
              <LogCard key={l.id || i} log={l} />
            ))
          )}
        </PullToRefresh>
      )}

      {/* ======= 表单 Dialog ======= */}
      {formType && formType !== 'create' && selected && (
        <Dialog visible content={
          <FormPanel title={
            formType === 'in' ? `📥 入库 · ${selected.part_name}`
              : formType === 'out' ? `📤 出库 · ${selected.part_name}`
                : `📝 盘点调整 · ${selected.part_name}`
          }>
            {formType !== 'adjust' && (
              <>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>数量 *</div>
                <Input type="number" value={qty} onChange={setQty} />
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>单价（元，可选）</div>
                <Input type="number" value={unitPrice} onChange={setUnitPrice} />
              </>
            )}
            {formType === 'adjust' && (
              <>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>当前系统库存: {selected.current_stock ?? 0}</div>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>实际库存 *</div>
                <Input type="number" value={actualStock} onChange={setActualStock} />
              </>
            )}
            {formType === 'in' && (
              <>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>采购单号</div>
                <Input value={purchaseNo} onChange={setPurchaseNo} />
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>供应商</div>
                <Input value={supplier} onChange={setSupplier} />
              </>
            )}
            {formType === 'out' && (
              <>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>关联工单（维护/维修）</div>
                <Input value={relatedOrder} onChange={setRelatedOrder} placeholder="维护工单或维修单号" />
              </>
            )}
            {(formType === 'in' || formType === 'adjust') && (
              <>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>关联工单（可选）</div>
                <Input value={relatedOrder} onChange={setRelatedOrder} />
              </>
            )}
            <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>备注{formType === 'out' ? '（用途必填）' : '（可选）'}</div>
            <Input type="textarea" rows={2} value={remarks} onChange={setRemarks} placeholder={formType === 'out' ? '请填用途，如：5#空压机保养领用' : ''} />
          </FormPanel>
        }
          actions={[
            { key: 'cancel', text: '取消', onClick: () => { setFormType(null); setSelected(null) } },
            { key: 'ok', text: formType === 'in' ? '确认入库' : formType === 'out' ? '确认出库' : '确认调整', primary: true, onClick: submitForm },
          ]}
        />
      )}

      {/* ======= 新建 Dialog ======= */}
      {formType === 'create' && (
        <Dialog visible content={
          <FormPanel title="➕ 新建备件">
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>备件编号</div>
            <Input value={createForm.part_code} onChange={(v) => setCreateForm({ ...createForm, part_code: v })} />
            <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>备件名称 *</div>
            <Input value={createForm.part_name} onChange={(v) => setCreateForm({ ...createForm, part_name: v })} />
            <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>规格型号</div>
            <Input value={createForm.specification} onChange={(v) => setCreateForm({ ...createForm, specification: v })} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>单位</div>
                <Input value={createForm.unit} onChange={(v) => setCreateForm({ ...createForm, unit: v })} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>分类</div>
                <select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })} style={selStyle}>
                  {['机械', '电气', '液压', '气动', '电子', '其他'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>当前库存</div>
                <Input type="number" value={String(createForm.current_stock)} onChange={(v) => setCreateForm({ ...createForm, current_stock: Number(v) || 0 })} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>安全下限</div>
                <Input type="number" value={String(createForm.safety_stock_min)} onChange={(v) => setCreateForm({ ...createForm, safety_stock_min: Number(v) || 0 })} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#888', margin: '8px 0 4px' }}>单价（元）</div>
            <Input type="number" value={String(createForm.unit_price)} onChange={(v) => setCreateForm({ ...createForm, unit_price: Number(v) || 0 })} />
          </FormPanel>
        }
          actions={[
            { key: 'cancel', text: '取消', onClick: () => setFormType(null) },
            { key: 'ok', text: '创建', primary: true, onClick: submitCreate },
          ]}
        />
      )}
    </div>
  )
}

// ========== 子组件 ==========

function PartCard({ part, low, onIn, onOut, onAdjust, onDelete }: {
  part: SpareRow; low: boolean
  onIn: () => void; onOut: () => void; onAdjust: () => void; onDelete: () => void
}) {
  return (
    <div style={{
      background: low ? '#fff5f5' : '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
      border: '1px solid ' + (low ? '#ffccc7' : '#eef0f3'),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{part.part_name}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {part.part_code} · {part.specification || ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: low ? '#F44336' : '#333' }}>
            {part.current_stock ?? 0}
          </div>
          <div style={{ fontSize: 10, color: low ? '#F44336' : '#aaa' }}>
            下限 {part.safety_stock_min ?? 0}{part.unit ? ` ${part.unit}` : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Button size="mini" color="primary" onClick={onIn}>📥 入库</Button>
        <Button size="mini" fill="outline" onClick={onOut}>📤 出库</Button>
        <Button size="mini" fill="outline" onClick={onAdjust}>📝 调整</Button>
        <Button size="mini" fill="outline" onClick={onDelete}>🗑️</Button>
      </div>
    </div>
  )
}

function LogCard({ log }: { log: LogRow }) {
  const map = { in: { c: '#4CAF50', t: '入库' }, out: { c: '#FF9800', t: '出库' }, adjust: { c: '#2196F3', t: '调整' } }
  const info = map[(log.log_type as keyof typeof map) || 'adjust']
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 10, marginBottom: 8,
      border: '1px solid #eef0f3',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {log.part_code || ''} {log.part_name || ''}
        </div>
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: info.c + '22', color: info.c }}>
          {info.t}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        数量 {log.quantity ?? 0} · 单价 {log.unit_price ?? 0} · 合计 ¥{log.total_price ?? 0}
      </div>
      {(log.related_order || log.remarks) && (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
          {log.related_order ? `工单: ${log.related_order}` : ''}{log.remarks ? ` ${log.remarks}` : ''}
        </div>
      )}
      {log.created_at && (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{new Date(log.created_at).toLocaleString('zh-CN')}</div>
      )}
    </div>
  )
}

function FormPanel({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '6px 2px' }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
      {text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const selStyle: React.CSSProperties = { padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%', background: '#fff' }
