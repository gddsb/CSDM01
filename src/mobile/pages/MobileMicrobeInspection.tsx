/**
 * 微生物检验移动端（Phase 3 · Microbe）
 *
 * 3 步流程：
 *   Step 0: 选/扫关联单据（在制品报工单 / 成品检验单）或直接指定检验对象类型
 *   Step 1: 填微生物检验项目（大肠菌群/菌落总数/霉菌...）
 *   Step 2: 提交 → POST /api/basic/microbe-inspections → 展示单号
 *
 * 后端接口：
 *   POST /api/basic/microbe-inspections   创建
 *   GET  /api/basic/microbe-inspections   列表（历史可扩展）
 */
import { useEffect, useState } from 'react'
import {Button, List, SearchBar, Toast, Dialog, Radio, Picker, TextArea, PullToRefresh, Input } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

interface RelatedRow {
  id: number
  no: string
  material_code?: string
  material_name?: string
  report_time?: string
}

type Step = 0 | 1 | 2

// 预设微生物项目（现场常用）
const DEFAULT_ITEMS = [
  '菌落总数',
  '大肠菌群',
  '霉菌数',
  '酵母数',
  '金黄色葡萄球菌',
  '沙门氏菌',
  '蜡样芽孢杆菌',
]

const OBJECT_TYPES = [
  { label: '过程检验（在制品）', value: '过程检验' },
  { label: '成品检验', value: '成品检验' },
  { label: '环境监测', value: '环境监测' },
  { label: '人员手部', value: '人员手部' },
  { label: '工器具表面', value: '工器具表面' },
]

function nowLocalInput() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function MobileMicrobeInspection() {
  const { scan } = useBarcode()

  const [step, setStep] = useState<Step>(0)
  const [loadMode, setLoadMode] = useState<'report' | 'product' | 'none'>('report')
  const [list, setList] = useState<RelatedRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<RelatedRow | null>(null)
  const [objectType, setObjectType] = useState('过程检验')

  // Step 1 表单
  const [items, setItems] = useState<{ name: string; value: string; unit: string; result: '合格' | '不合格' | '' }[]>(
    DEFAULT_ITEMS.map((n) => ({ name: n, value: '', unit: 'CFU/g', result: '' }))
  )
  const [inspectionTime, setInspectionTime] = useState(nowLocalInput())
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const endpoint = loadMode === 'report'
    ? '/production/report-orders'
    : loadMode === 'product'
    ? '/basic/product-inspections'
    : ''

  const loadRelated = async (kw?: string): Promise<RelatedRow[]> => {
    if (!endpoint) return []
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 30 }
      const k = kw ?? keyword
      if (k) {
        if (loadMode === 'report') params.report_no = k
        else params.inspection_no = k
      }
      const r: any = await api.get(endpoint, { params })
      const raw: any[] = r.success ? (r.data?.list || r.data?.rows || r.data || []) : []
      const mapped: RelatedRow[] = raw.map((x) => ({
        id: x.report_order_id ?? x.inspection_id ?? x.id,
        no: x.report_no ?? x.inspection_no ?? x.order_no ?? String(x.id),
        material_code: x.material_code,
        material_name: x.material_name || x.product_name,
        report_time: x.report_time || x.created_at,
      }))
      setList(mapped)
      return mapped
    } catch {
      return []
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (loadMode !== 'none') loadRelated()
    else { setList([]) }
  }, [loadMode])

  const handleScan = async () => {
    if (loadMode === 'none') {
      Toast.show({ content: '请先选择关联单据类型', position: 'bottom' }); return
    }
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list2 = await loadRelated(r.code)
    if (list2.length === 1) { setSelected(list2[0]); setStep(1) }
    else if (list2.length > 1) Toast.show({ content: `命中 ${list2.length} 条，请手动选择`, position: 'bottom' })
    else Toast.show({ content: '未找到匹配单据', position: 'bottom' })
  }

  const onPickObjectType = async () => {
    const ok = await Picker.prompt({ columns: [OBJECT_TYPES] })
    if (ok && ok[0]) {
      setObjectType(ok[0] as string)
      // 跟着调 loadMode
      const v = ok[0] as string
      if (v === '过程检验') setLoadMode('report')
      else if (v === '成品检验') setLoadMode('product')
      else setLoadMode('none')
    }
  }

  const updateItem = (idx: number, field: keyof typeof items[0], val: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)))
  }

  const allFilled = items.every((it) => it.result)

  const onSubmit = async () => {
    if (!allFilled) {
      Toast.show({ content: '请完成所有检验项目的判定', position: 'bottom' }); return
    }

    const ok = await Dialog.confirm({
      content: `确认提交${objectType}微生物检验？`,
      confirmText: '提交', cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      const payload: any = {
        inspection_type: '正常',
        object_type: objectType,
        trigger_type: '移动端',
        remarks,
        items: items.map((it) => ({
          item_name: it.name,
          value: it.value,
          unit: it.unit,
          result: it.result,
        })),
      }
      if (selected) {
        if (loadMode === 'report') payload.report_order_id = selected.id
        else if (loadMode === 'product') payload.order_id = selected.id
      }

      const r: any = await offlinePost('/basic/microbe-inspections', payload, { source: 'microbe-inspection' })
      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' }); return
      }

      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom', duration: 1500 })
      }

      setSuccessNo(r.data?.inspection_no || String(r.data?.inspection_id || ''))
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null); setKeyword(''); setSuccessNo('')
    setItems(DEFAULT_ITEMS.map((n) => ({ name: n, value: '', unit: 'CFU/g', result: '' })))
    setRemarks(''); setInspectionTime(nowLocalInput())
    if (loadMode !== 'none') loadRelated()
  }

  // ========== Render ==========

  if (step === 2) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>🔬</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>微生物检验提交成功</div>
        {successNo && <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 4 }}>单号：{successNo}</div>}
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {objectType} {selected ? `· ${selected.no}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => reset()}>继续检验</Button>
          <Button block color="primary" onClick={() => reset()}>返回首页</Button>
        </div>
      </div>
    )
  }

  return (
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          {/* 对象类型 + 关联单据类型 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 12 }}>
            <List.Item onClick={onPickObjectType} extra={objectType} arrow>检验对象类型</List.Item>
          </div>

          {/* 关联单据选择（搜索+扫码） */}
          {loadMode !== 'none' && (
            <>
              <SearchBar
                placeholder={`扫/搜${loadMode === 'report' ? '在制品报工单号' : '成品检验单号'}`}
                value={keyword}
                onChange={setKeyword}
                onSearch={() => loadRelated(keyword.trim())}
              />
              <Button size="mini" onClick={handleScan} style={{marginTop:8}}>扫码</Button>
            </>
          )}
        </div>
        <div className="mobile-page-scroll-list">
          {loadMode !== 'none' && (
            <>
              {loading ? <EmptyHint text="加载中..." /> : list.length === 0 ? (
                <EmptyHint text="未找到关联单据" sub="请先在 PC 端创建报工单或成品检验单" />
              ) : (
                <PullToRefresh onRefresh={async () => { await loadRelated(keyword.trim() || undefined) }}>
                  <List>
                    {list.map((r) => (
                      <List.Item
                        key={r.id}
                        onClick={() => { setSelected(r); setStep(1) }}
                        arrow
                        description={
                          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                            {r.material_code} {r.material_name?.slice(0, 20) || ''}
                          </div>
                        }
                      >
                        <div style={{ fontWeight: 500 }}>{r.no}</div>
                      </List.Item>
                    ))}
                  </List>
                </PullToRefresh>
              )}
            </>
          )}

          {loadMode === 'none' && (
            <div style={{
              background: 'var(--m-surface)', borderRadius: 10, padding: 24, textAlign: 'center',
              border: '1px solid #eef0f3', color: '#888', fontSize: 13,
            }}>
              当前选择"{objectType}"无需关联单据，下一步直接填检验项目
              <div style={{ marginTop: 16 }}>
                <Button color="primary" onClick={() => setStep(1)}>下一步：填项目</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {step === 1 && (
        <>
          {/* 关联单据信息卡 */}
          {selected && (
            <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>关联单据</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.no}</div>
              <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginTop: 4 }}>
                {selected.material_code} {selected.material_name || ''}
              </div>
            </div>
          )}

          {/* 检验项目 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-text-2)', marginBottom: 10 }}>微生物检验项目</div>
            {items.map((it, idx) => (
              <div key={idx} style={{ padding: '10px 0', borderBottom: idx < items.length - 1 ? '1px dashed #f0f0f0' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{it.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <Input
                    placeholder="数值"
                    value={it.value}
                    onChange={(v) => updateItem(idx, 'value', v)}
                    style={{ flex: 1, fontSize: 13, background: 'var(--m-surface-2)', borderRadius: 6, padding: '4px 8px' }}
                  />
                  <Input
                    placeholder="单位"
                    value={it.unit}
                    onChange={(v) => updateItem(idx, 'unit', v)}
                    style={{ width: 80, fontSize: 13, background: 'var(--m-surface-2)', borderRadius: 6, padding: '4px 8px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
<Radio.Group value={it.result} onChange={(v) => updateItem(idx, 'result', v as any)}>

                  <Radio value="合格" style={{ color: 'var(--brand-color-success)' }}>合格</Radio>
                  <Radio value="不合格" style={{ color: 'var(--brand-color-danger)' }}>不合格</Radio>
                </Radio.Group>                </div>

              </div>
            ))}
          </div>

          {/* 检验时间 + 备注 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 8 }}>检验时间</div>
            <input
              type="datetime-local"
              value={inspectionTime}
              onChange={(e) => setInspectionTime(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #eef0f3', borderRadius: 8 }}
            />
            <div style={{ fontSize: 13, color: 'var(--m-text-2)', margin: '10px 0 6px' }}>备注</div>
            <TextArea
              placeholder="选填：异常描述、处理建议..."
              value={remarks}
              onChange={setRemarks}
              rows={2}
              style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>
              提交检验
            </Button>
          </div>
        </>
      )}
    </div>
    )
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
