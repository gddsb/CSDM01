/**
 * 批次与标签 — 移动端
 *
 * 生产批号 Input + ProcessImageUploader × 2（首张/末张合格证）
 * ProcessImageUploader 内部走 /production/report-images/:report_no/:category/upload
 *   → 复用不良记录的命名规则 / MD5 去重 / 落盘目录 / 客户端水印+压缩
 * 保存走 PUT /production/report-orders/:id 把 URL 回写主表冗余字段
 */
import { useCallback, useEffect, useState } from 'react'
import React from 'react'
import { Button, Input, Toast } from 'antd-mobile'
import { ProcessImageUploader } from './ProcessImageUploader'
import { ReportOrder } from './types'
import api from '../../../utils/api'

interface Props {
  report: ReportOrder
  editable: boolean
  onSaved: (patch: { production_batch?: string; image_first?: string | null; image_last?: string | null }) => void
}

export function BatchTagPanel({ report, editable, onSaved }: Props) {
  const [batch, setBatch] = useState(report.production_batch || '')
  const [firstUrl, setFirstUrl] = useState<string[]>(report.image_first ? [report.image_first] : [])
  const [lastUrl, setLastUrl] = useState<string[]>(report.image_last ? [report.image_last] : [])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setBatch(report.production_batch || '') }, [report.production_batch])
  useEffect(() => { setFirstUrl(report.image_first ? [report.image_first] : []) }, [report.image_first])
  useEffect(() => { setLastUrl(report.image_last ? [report.image_last] : []) }, [report.image_last])

  const dirty =
    batch !== (report.production_batch || '') ||
    firstUrl[0] !== (report.image_first || null) ||
    lastUrl[0] !== (report.image_last || null)

  const handleSave = useCallback(async () => {
    const trimmed = batch.trim()
    if (!trimmed) { Toast.show({ content: '请填写生产批号', icon: 'fail', position: 'bottom' }); return }
    setSaving(true)
    try {
      await api.put(`/production/report-orders/${report.report_order_id}`, {
        production_batch: trimmed,
        image_first: firstUrl[0] || null,
        image_last: lastUrl[0] || null,
      })
      Toast.show({ content: '已保存', icon: 'success' })
      onSaved({
        production_batch: trimmed,
        image_first: firstUrl[0] || null,
        image_last: lastUrl[0] || null,
      })
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail', position: 'bottom' })
    } finally {
      setSaving(false)
    }
  }, [batch, firstUrl, lastUrl, report.report_order_id, onSaved])

  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--m-text-3)', marginBottom: 4 }
  const boxStyle: React.CSSProperties = {
    padding: 12, marginBottom: 12,
    background: 'var(--m-surface-2)', borderRadius: 10, border: '1px solid #eee',
  }

  return (
    <div>
      {/* 生产批号 */}
      <div style={boxStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          🏷️ 生产批号 <span style={{ color: '#ff4d4f', fontSize: 12 }}>*</span>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginLeft: 6 }}>完工必填</span>
        </div>
        <Input
          placeholder="例如：PB-20261021-001"
          value={batch}
          onChange={(v) => setBatch(v)}
          disabled={!editable}
          maxLength={100}
          style={{ fontSize: 14 }}
        />
      </div>

      {/* 首张合格证 */}
      <div style={boxStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📄 首张合格证</div>
        <div style={labelStyle}>与不良记录规格一致 · 客户端水印 + 压缩 · 后端 MD5 去重</div>
        <ProcessImageUploader
          reportNo={report.report_no}
          category="batch-first"
          value={firstUrl}
          onChange={setFirstUrl}
          maxCount={1}
          label="首张合格证"
        />
      </div>

      {/* 末张合格证 */}
      <div style={boxStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📄 末张合格证</div>
        <div style={labelStyle}>与不良记录规格一致 · 客户端水印 + 压缩 · 后端 MD5 去重</div>
        <ProcessImageUploader
          reportNo={report.report_no}
          category="batch-last"
          value={lastUrl}
          onChange={setLastUrl}
          maxCount={1}
          label="末张合格证"
        />
      </div>

      {/* 保存按钮 */}
      {editable && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button color="primary" fill="solid" loading={saving} onClick={handleSave} disabled={!dirty} style={{ borderRadius: 8 }}>
            💾 保存批次与标签
          </Button>
          {dirty && <span style={{ color: '#fa8c16', fontSize: 11, alignSelf: 'center' }}>※ 有未保存的修改</span>}
        </div>
      )}
    </div>
  )
}
