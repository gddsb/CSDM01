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
import { Button, List, SearchBar, Toast, Dialog, Radio, Picker, TextArea, PullToRefresh, Input, Tabs } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'

interface RelatedRow {
  id: number
  inspection_id?: number
  inspection_no?: string
  no: string
  material_code?: string
  material_name?: string
  report_time?: string
  object_type?: string
  status?: number
  quantity?: number
}

type Step = 0 | 1 | 2
type StatusTab = '全部' | '待检' | '已完成'
const MICROBE_TABS: { key: StatusTab; label: string; color: string }[] = [
  { key: '全部',   label: '全部',   color: 'var(--m-text-3)' },
  { key: '待检',   label: '待检',   color: 'var(--brand-color-warning)' },
  { key: '已完成', label: '已完成', color: 'var(--brand-color-success)' },
]

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
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<RelatedRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<RelatedRow | null>(null)
  const [objectType, setObjectType] = useState('环境')
  const [tab, setTab] = useState<StatusTab>('全部')

  // Step 1 表单
  const [items, setItems] = useState<{ name: string; value: string; unit: string; result: '合格' | '不合格' | '' }[]>(
    DEFAULT_ITEMS.map((n) => ({ name: n, value: '', unit: 'CFU/g', result: '' }))
  )
  const [inspectionTime, setInspectionTime] = useState(nowLocalInput())
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const loadRelated = async (kw?: string, t?: StatusTab): Promise<RelatedRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 30 }
      const k = kw ?? keyword
      const tabKey = t ?? tab
      if (k) params.inspection_no = k
      if (tabKey === '待检') params.status = 0
      else if (tabKey === '已完成') params.status = 3
      const r: any = await api.get('/basic/microbe-inspections', { params })
      const raw: any[] = r.success ? (r.data?.list || r.data?.rows || r.data || []) : []
      const mapped: RelatedRow[] = raw.map((x) => ({
        id: x.inspection_id ?? x.id,
        inspection_id: x.inspection_id ?? x.id,
        inspection_no: x.inspection_no,
        no: x.inspection_no ?? x.order_no ?? String(x.inspection_id ?? x.id),
        material_code: x.material_code,
        material_name: x.material_name || x.product_name,
        report_time: x.inspection_time || x.report_time || x.created_at,
        object_type: x.object_type,
        status: x.status,
        quantity: x.quantity,
      }))
      setList(mapped)
      return mapped
    } catch {
      return []
    } finally { setLoading(false) }
  }

  useEffect(() => {
    loadRelated(keyword.trim(), tab)
  }, [tab])

  const onPickObjectType = async () => {
    const ok = await Picker.prompt({ columns: [OBJECT_TYPES] })
    if (ok && ok[0]) {
      setObjectType(ok[0] as string)
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
      const inspectionId = selected?.inspection_id ?? selected?.id
      let r: any
      if (inspectionId) {
        // 从列表进入 → 更新已有检验记录，置为已完成
        payload.status = 3
        r = await api.put(`/basic/microbe-inspections/${inspectionId}`, payload)
      } else {
        r = await offlinePost('/basic/microbe-inspections', payload, { source: 'microbe-inspection' })
      }
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
    loadRelated('', tab)
  }

  // ========== Render ==========

  if (step === 2) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>🔬</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>微生物检验提交成功</div>
        {successNo && <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 4 }}>单号：{successNo}</div>}
        <div style={{ fontSize: 13, color: 'var(--m-text-3)', marginBottom: 24 }}>
          {objectType} {selected ? `· ${selected.no}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => reset()}>继续检验</Button>
          <Button block color="primary" onClick={() => reset()}>返回首页</Button>
        </div>
      </div>
    )
  }

  // 状态徽章映射
  const statusBadge = (status?: number) => {
    if (status === 0) return { text: '待检', color: 'var(--brand-color-warning)' }
    if (status === 3 || status === 2) return { text: '已完成', color: 'var(--brand-color-success)' }
    return { text: '检验中', color: 'var(--m-text-2)' }
  }

  return (
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          {/* 新建检验按钮 */}
          <Button
            color="primary"
            fill="outline"
            style={{ marginBottom: 10, width: '100%', height: 40, borderRadius: 10 }}
            onClick={async () => {
              try {
                const r: any = await api.post('/basic/microbe-inspections', {
                  object_type: '环境',
                  trigger_type: '手工',
                })
                const id = r.success ? r.data?.inspection_id : null
                if (!id) { Toast.show({ content: r.message || '创建失败', position: 'bottom' }); return }
                Toast.show({ content: '已创建', position: 'bottom' })
                await loadRelated(keyword.trim(), tab)
              } catch (e: any) {
                Toast.show({ content: e?.message || '创建失败', position: 'bottom' })
              }
            }}
          >
            ➕ 新建检验
          </Button>

          {/* 检验对象类型选择 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 8 }}>
            <List.Item onClick={onPickObjectType} extra={objectType} arrow>检验对象类型</List.Item>
          </div>

          {/* 搜索栏 */}
          <SearchBar
            placeholder="搜索检验单号"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => loadRelated(keyword.trim(), tab)}
          />

          {/* 状态 Tab */}
          <div style={{
            background: 'var(--m-surface)', borderRadius: 12, padding: '4px 10px', marginTop: 8,
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}>
            <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
              {MICROBE_TABS.map((t) => (
                <Tabs.Tab
                  key={t.key}
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
                      {t.label}
                    </span>
                  }
                />
              ))}
            </Tabs>
          </div>
        </div>
        <div className="mobile-page-scroll-list">
          {loading ? <EmptyHint text="加载中..." /> : list.length === 0 ? (
            <EmptyHint text="暂无检验记录" sub="点击上方 + 新建检验" />
          ) : (
            <PullToRefresh onRefresh={async () => { await loadRelated(keyword.trim() || undefined, tab) }}>
              <List>
                {list.map((r) => {
                  const badge = statusBadge(r.status)
                  const isDone = r.status === 3 || r.status === 2
                  return (
                    <List.Item
                      key={r.id}
                      onClick={() => { setSelected(r); setStep(1) }}
                      arrow
                      description={
                        <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4 }}>
                          {/* 第一行：单号 + 状态徽章 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: 'var(--m-text-1)' }}>{r.no}</span>
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 8,
                              background: badge.color + '18', color: badge.color, fontWeight: 500,
                            }}>{badge.text}</span>
                          </div>
                          {/* 第二行：物料/对象 + 数量 + 操作提示 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {r.material_code ? `${r.material_code} ` : ''}
                              {r.material_name?.slice(0, 16) || r.object_type || ''}
                              {typeof r.quantity === 'number' ? ` · ${Math.round(r.quantity)}` : ''}
                            </span>
                            <span style={{
                              marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 8,
                              background: isDone ? 'var(--m-surface-2)' : 'var(--brand-color-primary)18',
                              color: isDone ? 'var(--m-text-3)' : 'var(--brand-color-primary)',
                            }}>{isDone ? '已完成' : '检验'}</span>
                          </div>
                        </div>
                      }
                    />
                  )
                })}
              </List>
            </PullToRefresh>
          )}
        </div>
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {step === 1 && (
        <>
          {/* 关联单据信息卡 */}
          {selected && (
            <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--m-text-3)', marginBottom: 4 }}>关联单据</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.no}</div>
              <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginTop: 4 }}>
                {selected.material_code} {selected.material_name || ''}
              </div>
            </div>
          )}

          {/* 检验项目 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 12 }}>
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
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 8 }}>检验时间</div>
            <input
              type="datetime-local"
              value={inspectionTime}
              onChange={(e) => setInspectionTime(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid var(--m-border)', borderRadius: 8 }}
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
