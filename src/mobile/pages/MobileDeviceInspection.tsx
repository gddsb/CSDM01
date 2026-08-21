import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast, Dialog, Button, PullToRefresh, Selector, ImageViewer } from 'antd-mobile'
import { CloseOutline, PictureOutline, CameraOutline } from 'antd-mobile-icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'
import dayjs from 'dayjs'
import { useApp } from '../../contexts/AppContext'

// ============ 类型定义 ============
interface InspectionRecord {
  record_id?: number
  standard_id?: number
  item_name: string
  standard_value?: string
  judge_type?: '定性' | '定量'
  unit?: string
  sort_order?: number
  actual_value?: string
  result?: '正常' | '异常' | null
  abnormal_desc?: string
}

interface InspectionImage {
  image_id?: number
  file_path?: string
  file_name?: string
}

interface InspectionPlan {
  plan_id: number
  plan_date: string
  device_id: number
  device_code?: string
  device_name?: string
  inspector_id?: number
  inspector_name?: string
  status: '待检' | '已完成' | '漏检'
  inspection_time?: string
  abnormal_count?: number
  result?: '正常' | '异常'
  remarks?: string
  records?: InspectionRecord[]
  inspection_images?: InspectionImage[]
}

interface InspectionStandardItem {
  standard_id: number
  item_name: string
  standard_value?: string
  judge_type?: '定性' | '定量'
  unit?: string
  sort_order?: number
  status?: number
}

interface InspectionEntryItem {
  key: string
  standard_id?: number
  item_name: string
  standard_value?: string
  judge_type?: '定性' | '定量'
  unit?: string
  sort_order?: number
  actual_value: string
  result: '正常' | '异常' | null
  abnormal_desc?: string
}

// ============ 工具函数 ============
const uid = () => Math.random().toString(36).slice(2, 10)

interface StandardRule {
  op?: '<=' | '>=' | '<' | '>' | 'range' | '='
  min?: number
  max?: number
  value?: number
}

function parseStandardRule(standard: string | undefined | null): StandardRule {
  if (!standard) return {}
  const s = String(standard).trim()
  let m = s.match(/^(≤|<=)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '<=', max: Number(m[2]) }
  m = s.match(/^(≥|>=)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '>=', min: Number(m[2]) }
  m = s.match(/^(<)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '<', max: Number(m[2]) }
  m = s.match(/^(>)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '>', min: Number(m[2]) }
  m = s.match(/^(-?\d+(\.\d+)?)\s*[-~]\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: 'range', min: Number(m[1]), max: Number(m[3]) }
  m = s.match(/^(=)?\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '=', value: Number(m[2]) }
  return {}
}

function judgeQuantitative(
  standard: string | undefined | null,
  actual: number | null | undefined
): '正常' | '异常' | null {
  if (actual === null || actual === undefined || Number.isNaN(actual)) return null
  const r = parseStandardRule(standard)
  if (!r.op) return null
  switch (r.op) {
    case '<=': return r.max !== undefined && actual <= r.max ? '正常' : '异常'
    case '>=': return r.min !== undefined && actual >= r.min ? '正常' : '异常'
    case '<': return r.max !== undefined && actual < r.max ? '正常' : '异常'
    case '>': return r.min !== undefined && actual > r.min ? '正常' : '异常'
    case 'range': return r.min !== undefined && r.max !== undefined && actual >= r.min && actual <= r.max ? '正常' : '异常'
    case '=': return r.value !== undefined && actual === r.value ? '正常' : '异常'
    default: return null
  }
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case '待检': return { bg: '#fff7e6', color: '#fa8c16', cls: 'released' }
    case '已完成': return { bg: '#f6ffed', color: '#52c41a', cls: 'started' }
    case '漏检': return { bg: '#fff1f0', color: '#cf1322', cls: 'closed' }
    default: return { bg: '#f0f0f0', color: '#595959', cls: 'done' }
  }
}

type Mode = 'list' | 'detail'

export default function MobileDeviceInspection() {
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const [mode, setMode] = useState<Mode>('list')
  const [list, setList] = useState<InspectionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<InspectionPlan | null>(null)

  // 详情/录入状态
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [entryItems, setEntryItems] = useState<InspectionEntryItem[]>([])
  const [entryRemarks, setEntryRemarks] = useState('')
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [existingImages, setExistingImages] = useState<InspectionImage[]>([])
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const today = dayjs().format('YYYY-MM-DD')

  // ============ 获取今日点检任务 ============
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { plan_date: today }
      if (currentUser?.user_id) params.inspector_id = currentUser.user_id
      const res = await api.get('/basic/device-inspection-plans', { params })
      const data = res.data
      const items: InspectionPlan[] = Array.isArray(data)
        ? data
        : (data?.list || [])
      setList(items)
      if (res.success === false) {
        Toast.show({ icon: 'fail', content: res.message || '获取点检任务失败' })
      }
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '获取点检任务失败' })
      setList([])
    } finally {
      setLoading(false)
    }
  }, [today, currentUser?.user_id])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // ============ 进入点检详情/录入 ============
  const openDetail = async (plan: InspectionPlan) => {
    setSelectedPlan(plan)
    setMode('detail')
    setEntryItems([])
    setEntryRemarks(plan.remarks || '')
    setImages([])
    setExistingImages(plan.inspection_images || [])
    setDetailLoading(true)
    try {
      const detailRes = await api.get(`/basic/device-inspection-plans/${plan.plan_id}`)
      const detail = detailRes.success !== false ? detailRes.data : null
      const deviceId = detail?.device_id || plan.device_id
      const existingRecords: InspectionRecord[] = detail?.records || []

      let items: InspectionEntryItem[]
      if (existingRecords.length > 0) {
        items = existingRecords.map((it, idx) => ({
          key: uid(),
          standard_id: it.standard_id,
          item_name: it.item_name || '',
          standard_value: it.standard_value || '',
          judge_type: (it.judge_type as '定性' | '定量') || '定性',
          unit: it.unit || '',
          sort_order: it.sort_order !== undefined ? it.sort_order : idx,
          actual_value: it.actual_value || '',
          result: it.result === '正常' || it.result === '异常' ? it.result : null,
          abnormal_desc: it.abnormal_desc || '',
        }))
      } else {
        const stdRes = await api.get('/basic/device-inspection-standards', {
          params: { device_id: deviceId, status: 1 },
        })
        const stdList: InspectionStandardItem[] = stdRes.success !== false
          ? (stdRes.data?.list || stdRes.data || [])
          : []
        items = stdList.map((s, idx) => ({
          key: uid(),
          standard_id: s.standard_id,
          item_name: s.item_name || '',
          standard_value: s.standard_value || '',
          judge_type: (s.judge_type as '定性' | '定量') || '定性',
          unit: s.unit || '',
          sort_order: s.sort_order !== undefined ? s.sort_order : idx,
          actual_value: '',
          result: null,
          abnormal_desc: '',
        }))
      }
      setEntryItems(items)
      setExistingImages(detail?.inspection_images || plan.inspection_images || [])
      if (detail) setSelectedPlan(detail)
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '加载点检项目失败' })
    } finally {
      setDetailLoading(false)
    }
  }

  const updateEntryItem = (key: string, patch: Partial<InspectionEntryItem>) => {
    setEntryItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }

  const handleActualValueChange = (item: InspectionEntryItem, value: string) => {
    const patch: Partial<InspectionEntryItem> = { actual_value: value }
    if (item.judge_type === '定量') {
      const num = Number(value)
      const judged = judgeQuantitative(item.standard_value, Number.isNaN(num) ? null : num)
      if (judged) patch.result = judged
      if (judged === '正常') patch.abnormal_desc = ''
    }
    updateEntryItem(item.key, patch)
  }

  // ============ 图片处理 ============
  const handleImageFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    if (fileArr.length === 0) return
    const remaining = 9 - images.length
    if (remaining <= 0) {
      Toast.show({ icon: 'fail', content: '最多上传9张图片' })
      return
    }
    const toAdd = fileArr.slice(0, remaining)
    const newImages = toAdd.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImages])
  }

  const removeImage = (idx: number) => {
    setImages(prev => {
      const item = prev[idx]
      if (item?.url) URL.revokeObjectURL(item.url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const allPreviewImages = [
    ...existingImages.map(i => i.file_path || ''),
    ...images.map(i => i.url),
  ].filter(Boolean)

  // ============ 提交点检 ============
  const handleSubmit = async () => {
    if (!selectedPlan) return
    const invalid = entryItems.find(it => !it.result)
    if (invalid) {
      Toast.show({ icon: 'fail', content: `请完成判定：${invalid.item_name}` })
      return
    }
    const confirmed = await Dialog.confirm({
      title: '提交点检',
      content: '确认提交本次点检结果？',
    })
    if (!confirmed) return
    setSubmitting(true)
    try {
      const payload = {
        items: entryItems.map((it, idx) => ({
          standard_id: it.standard_id || null,
          item_name: it.item_name,
          standard_value: it.standard_value || '',
          actual_value: it.actual_value || '',
          judge_type: it.judge_type || '定性',
          unit: it.unit || '',
          result: it.result,
          abnormal_desc: it.result === '异常' ? (it.abnormal_desc || '') : '',
          sort_order: it.sort_order !== undefined ? it.sort_order : idx,
        })),
        remarks: entryRemarks,
      }
      const res = await api.put(`/basic/device-inspection-plans/${selectedPlan.plan_id}/submit`, payload)
      if (res.success === false) {
        Toast.show({ icon: 'fail', content: res.message || '提交失败' })
        return
      }
      // 提交成功后上传图片
      if (images.length > 0) {
        try {
          const formData = new FormData()
          images.forEach(img => formData.append('images', img.file))
          await api.post(`/basic/device-inspection-plans/${selectedPlan.plan_id}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch (err: any) {
          Toast.show({ icon: 'fail', content: err.message || '图片上传失败，但点检已提交' })
        }
      }
      Toast.show({ icon: 'success', content: res.message || '提交成功' })
      setMode('list')
      fetchList()
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '提交失败' })
    } finally {
      setSubmitting(false)
    }
  }

  const backToList = () => {
    setMode('list')
    setSelectedPlan(null)
    setEntryItems([])
    setImages([])
    setExistingImages([])
  }

  // ============ 列表视图 ============
  if (mode === 'list') {
    const pendingCount = list.filter(p => p.status === '待检').length
    const completedCount = list.filter(p => p.status === '已完成').length

    return (
      <div>
        <div className="mobile-sub-header">
          <div className="mobile-sub-back" onClick={() => navigate(-1)}>‹</div>
          <div className="mobile-sub-title">设备点检</div>
        </div>

        <div className="mobile-page">
          {/* 统计概览 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>{pendingCount}</div>
              <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>待检</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{completedCount}</div>
              <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>已完成</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2196F3' }}>{list.length}</div>
              <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>合计</div>
            </div>
          </div>

          <PullToRefresh
            onRefresh={async () => {
              await fetchList()
            }}
          >
            {loading && list.length === 0 && (
              <div className="mobile-empty">加载中...</div>
            )}
            {!loading && list.length === 0 && (
              <div className="mobile-empty">今日暂无点检任务</div>
            )}

            {list.map(plan => {
              const s = getStatusStyle(plan.status)
              return (
                <div
                  key={plan.plan_id}
                  className="mobile-list-item"
                  onClick={() => openDetail(plan)}
                >
                  <div className="mobile-list-item-header">
                    <div className="mobile-list-item-title">{plan.device_name || '-'}</div>
                    <span className={`mobile-status-tag ${s.cls}`} style={{ background: s.bg, color: s.color }}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="mobile-list-item-body">
                    <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                      <span style={{ color: '#757575' }}>设备编号</span>
                      <span>{plan.device_code || '-'}</span>
                    </div>
                    <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                      <span style={{ color: '#757575' }}>点检日期</span>
                      <span>{plan.plan_date || '-'}</span>
                    </div>
                    {plan.status === '已完成' && (
                      <>
                        <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                          <span style={{ color: '#757575' }}>点检结果</span>
                          <span style={{
                            color: plan.result === '异常' ? '#f5222d' : '#52c41a',
                            fontWeight: 600,
                          }}>
                            {plan.result || '-'}
                          </span>
                        </div>
                        <div className="mobile-flex-between">
                          <span style={{ color: '#757575' }}>异常项数</span>
                          <span>{Number(plan.abnormal_count) || 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </PullToRefresh>
        </div>
      </div>
    )
  }

  // ============ 详情/录入视图 ============
  const plan = selectedPlan
  const isCompleted = plan?.status === '已完成'

  return (
    <div>
      <div className="mobile-sub-header">
        <div className="mobile-sub-back" onClick={backToList}>‹</div>
        <div className="mobile-sub-title">点检详情</div>
      </div>

      <div className="mobile-page" style={{ paddingBottom: 80 }}>
        {detailLoading && (
          <div className="mobile-empty">加载中...</div>
        )}

        {!detailLoading && plan && (
          <>
            {/* 设备信息 */}
            <div className="mobile-detail-grid">
              <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#212121' }}>
                  {plan.device_name || '-'}
                </div>
                {(() => {
                  const s = getStatusStyle(plan.status)
                  return (
                    <span className={`mobile-status-tag ${s.cls}`} style={{ background: s.bg, color: s.color }}>
                      {plan.status}
                    </span>
                  )
                })()}
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">设备编号</div>
                <div className="mobile-detail-value">{plan.device_code || '-'}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">点检日期</div>
                <div className="mobile-detail-value">{plan.plan_date || '-'}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">点检人</div>
                <div className="mobile-detail-value">{plan.inspector_name || '-'}</div>
              </div>
              {plan.inspection_time && (
                <div className="mobile-detail-row">
                  <div className="mobile-detail-label">点检时间</div>
                  <div className="mobile-detail-value">{formatDateTime(plan.inspection_time)}</div>
                </div>
              )}
              {isCompleted && plan.result && (
                <div className="mobile-detail-row">
                  <div className="mobile-detail-label">点检结果</div>
                  <div className="mobile-detail-value" style={{
                    color: plan.result === '异常' ? '#f5222d' : '#52c41a',
                    fontWeight: 600,
                  }}>
                    {plan.result}
                  </div>
                </div>
              )}
            </div>

            {/* 点检项目 */}
            <div className="mobile-section-title">点检项目（{entryItems.length}）</div>
            {entryItems.length === 0 ? (
              <div className="mobile-empty" style={{ padding: '20px' }}>
                该设备暂无点检标准，请先维护点检标准
              </div>
            ) : (
              entryItems.map((item, idx) => {
                const isAbnormal = item.result === '异常'
                return (
                  <div
                    key={item.key}
                    className="mobile-list-item"
                    style={{ borderLeft: isAbnormal ? '3px solid #f5222d' : '3px solid transparent' }}
                  >
                    <div className="mobile-flex-between" style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#212121', flex: 1 }}>
                        {idx + 1}. {item.item_name}
                      </div>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: item.judge_type === '定量' ? '#e6f4ff' : '#f5f5f5',
                        color: item.judge_type === '定量' ? '#2196F3' : '#9e9e9e',
                        flexShrink: 0,
                      }}>
                        {item.judge_type || '定性'}
                      </span>
                    </div>

                    {item.standard_value && (
                      <div style={{ fontSize: 12, color: '#757575', marginBottom: 8 }}>
                        标准值：{item.standard_value}{item.unit ? ` ${item.unit}` : ''}
                      </div>
                    )}

                    {/* 输入区域 */}
                    {item.judge_type === '定量' ? (
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            className="mobile-form-input"
                            style={{ flex: 1, height: 36, padding: '0 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14 }}
                            placeholder="输入数值"
                            value={item.actual_value}
                            disabled={isCompleted}
                            onChange={(e) => handleActualValueChange(item, e.target.value)}
                          />
                          {item.unit && (
                            <span style={{ fontSize: 12, color: '#9e9e9e', flexShrink: 0 }}>{item.unit}</span>
                          )}
                        </div>
                        {item.result && (
                          <div style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: item.result === '正常' ? '#52c41a' : '#f5222d',
                            fontWeight: 500,
                          }}>
                            自动判定：{item.result}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Selector
                        options={[
                          { label: '正常', value: '正常' },
                          { label: '异常', value: '异常' },
                        ]}
                        value={item.result ? [item.result] : []}
                        disabled={isCompleted}
                        onChange={(v) => {
                          const val = v[0] as '正常' | '异常' | undefined
                          if (val) {
                            updateEntryItem(item.key, {
                              result: val,
                              actual_value: val,
                              abnormal_desc: val === '正常' ? '' : (item.abnormal_desc || ''),
                            })
                          }
                        }}
                      />
                    )}

                    {/* 异常描述 */}
                    {isAbnormal && !isCompleted && (
                      <div style={{ marginTop: 8 }}>
                        <textarea
                          style={{
                            width: '100%',
                            minHeight: 60,
                            padding: '8px 10px',
                            border: '1px solid #ffa39e',
                            borderRadius: 6,
                            fontSize: 13,
                            background: '#fff1f0',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                          placeholder="请描述异常情况"
                          value={item.abnormal_desc || ''}
                          onChange={(e) => updateEntryItem(item.key, { abnormal_desc: e.target.value })}
                        />
                      </div>
                    )}
                    {isAbnormal && isCompleted && item.abnormal_desc && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#f5222d', background: '#fff1f0', padding: '6px 10px', borderRadius: 6 }}>
                        异常描述：{item.abnormal_desc}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* 已有图片 */}
            {isCompleted && existingImages.length > 0 && (
              <>
                <div className="mobile-section-title">点检图片</div>
                <div className="rd-image-list">
                  {existingImages.map((img, idx) => (
                    <div key={img.image_id || idx} className="rd-image-item">
                      <img
                        className="rd-image"
                        src={img.file_path}
                        alt=""
                        onClick={() => {
                          setPreviewIndex(idx)
                          setPreviewVisible(true)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 新增图片上传（待检/重新录入时） */}
            {!isCompleted && (
              <>
                <div className="mobile-section-title">点检图片</div>
                <div className="rd-image-list">
                  {images.map((img, idx) => (
                    <div key={idx} className="rd-image-item">
                      <img
                        className="rd-image"
                        src={img.url}
                        alt=""
                        onClick={() => {
                          setPreviewIndex(existingImages.length + idx)
                          setPreviewVisible(true)
                        }}
                      />
                      <div className="rd-image-delete" onClick={() => removeImage(idx)}>
                        <CloseOutline fontSize={12} color="#fff" />
                      </div>
                    </div>
                  ))}
                  {images.length < 9 && (
                    <div
                      className="rd-image-item"
                      style={{
                        background: '#fafafa',
                        border: '1px dashed #d9d9d9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowImagePicker(true)}
                    >
                      <PictureOutline fontSize={20} color="#9e9e9e" />
                    </div>
                  )}
                </div>
                <div style={{ color: '#9e9e9e', fontSize: 11, marginTop: 6 }}>
                  支持多图上传，最多 9 张，提交后自动上传至服务器
                </div>

                {/* 备注 */}
                <div className="mobile-section-title">备注</div>
                <div className="mobile-detail-grid">
                  <textarea
                    style={{
                      width: '100%',
                      minHeight: 70,
                      padding: '8px 10px',
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                      resize: 'none',
                    }}
                    placeholder="可填写点检备注"
                    value={entryRemarks}
                    onChange={(e) => setEntryRemarks(e.target.value)}
                  />
                </div>
              </>
            )}
          </>
        )}

        <ImageViewer.Multi
          images={allPreviewImages}
          visible={previewVisible}
          defaultIndex={previewIndex}
          onClose={() => setPreviewVisible(false)}
        />
      </div>

      {/* 提交按钮（固定底部） */}
      {!detailLoading && plan && !isCompleted && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          padding: '10px 12px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          zIndex: 100,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
        }}>
          <Button
            block
            color="primary"
            size="large"
            loading={submitting}
            disabled={entryItems.length === 0}
            onClick={handleSubmit}
            style={{ borderRadius: 8, height: 44 }}
          >
            提交点检
          </Button>
        </div>
      )}

      {/* 图片选择 ActionSheet */}
      {showImagePicker && (
        <div className="rd-actionsheet-mask" onClick={() => setShowImagePicker(false)}>
          <div className="rd-actionsheet" onClick={(e) => e.stopPropagation()}>
            <div className="rd-actionsheet-item" onClick={() => {
              setShowImagePicker(false)
              cameraInputRef.current?.click()
            }}>
              <CameraOutline fontSize={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              拍照上传
            </div>
            <div className="rd-actionsheet-item" onClick={() => {
              setShowImagePicker(false)
              fileInputRef.current?.click()
            }}>
              <PictureOutline fontSize={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              从相册选择
            </div>
            <div className="rd-actionsheet-item rd-actionsheet-cancel" onClick={() => setShowImagePicker(false)}>
              取消
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleImageFiles(e.target.files)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleImageFiles(e.target.files)
          if (cameraInputRef.current) cameraInputRef.current.value = ''
        }}
      />
    </div>
  )
}
