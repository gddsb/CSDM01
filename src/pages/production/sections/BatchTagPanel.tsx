/**
 * 批次与标签 Tab — PC 端
 *
 * 生产批号 + 首张/末张合格证图片
 * 图片上传统一走 /production/report-images/:report_no/:category/upload
 *   → 复用不良记录的命名规则 / MD5 去重 / 落盘目录
 *   → 水印 & 压缩 由客户端完成（此处未加，PC 端不良记录也未加）
 *   → 保存后 PUT /production/report-orders/:id 把 URL 回写主表冗余字段
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Input, Button, Space, Upload, Image, message } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import api from '../../../utils/api'

interface Props {
  reportNo: string
  reportOrderId: number
  initialBatch?: string | null
  initialImageFirst?: string | null
  initialImageLast?: string | null
  editable: boolean
  onSaved: (patch: { production_batch?: string; image_first?: string | null; image_last?: string | null }) => void
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_MB = 5

export default function BatchTagPanel({
  reportNo, reportOrderId, initialBatch, initialImageFirst, initialImageLast, editable, onSaved,
}: Props) {
  const [productionBatch, setProductionBatch] = useState(initialBatch || '')
  const [imageFirst, setImageFirst] = useState<string | null>(initialImageFirst || null)
  const [imageLast, setImageLast] = useState<string | null>(initialImageLast || null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setProductionBatch(initialBatch || '') }, [initialBatch])
  useEffect(() => { setImageFirst(initialImageFirst || null) }, [initialImageFirst])
  useEffect(() => { setImageLast(initialImageLast || null) }, [initialImageLast])

  const dirty =
    productionBatch !== (initialBatch || '') ||
    imageFirst !== (initialImageFirst || null) ||
    imageLast !== (initialImageLast || null)

  const uploadImage = useCallback(async (file: File, category: 'batch-first' | 'batch-last'): Promise<string | null> => {
    if (!reportNo) { message.error('报工单号缺失'); return null }
    if (file.size > MAX_MB * 1024 * 1024) { message.error(`图片不能超过 ${MAX_MB}MB`); return null }
    const fd = new FormData()
    fd.append('files', file)
    try {
      const r: any = await api.post(`/production/report-images/${reportNo}/${category}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (r.success && Array.isArray(r.data) && r.data.length > 0) return r.data[0]
      message.error(r.message || '上传失败')
      return null
    } catch (e: any) {
      message.error(e?.message || '上传失败')
      return null
    }
  }, [reportNo])

  const handleUploadFirst = async (file: File) => {
    const url = await uploadImage(file, 'batch-first')
    if (url) setImageFirst(url)
    return false // antd Upload 阻止默认上传
  }
  const handleUploadLast = async (file: File) => {
    const url = await uploadImage(file, 'batch-last')
    if (url) setImageLast(url)
    return false
  }

  const handleRemoveFirst = async () => {
    if (imageFirst) {
      try { await api.delete(`/production/report-images/by-url`, { params: { url: imageFirst } }) } catch {}
    }
    setImageFirst(null)
  }
  const handleRemoveLast = async () => {
    if (imageLast) {
      try { await api.delete(`/production/report-images/by-url`, { params: { url: imageLast } }) } catch {}
    }
    setImageLast(null)
  }

  const handleSave = async () => {
    if (!productionBatch.trim()) { message.error('请填写生产批号'); return }
    setSaving(true)
    try {
      const r: any = await api.put(`/production/report-orders/${reportOrderId}`, {
        production_batch: productionBatch.trim(),
        image_first: imageFirst,
        image_last: imageLast,
      })
      message.success('已保存批次与标签')
      onSaved({
        production_batch: productionBatch.trim(),
        image_first: imageFirst,
        image_last: imageLast,
      })
      return r
    } catch (e: any) {
      message.error(e?.message || '保存失败')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const imgStyle: React.CSSProperties = {
    width: 120, height: 120, objectFit: 'cover',
    border: '1px dashed var(--border-color, #d9d9d9)',
    borderRadius: 6, background: '#fafafa',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  }
  const uploadBtnStyle: React.CSSProperties = {
    width: 120, height: 120, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: '1px dashed var(--brand-color, #1890ff)', borderRadius: 6,
    flexDirection: 'column', gap: 6, cursor: editable ? 'pointer' : 'not-allowed',
    color: editable ? 'var(--brand-color, #1890ff)' : '#bbb', background: '#fafafa',
  }

  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid var(--border-color, #f0f0f0)' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          生产批号 <span style={{ color: '#ff4d4f' }}>*</span>
          <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal', marginLeft: 8 }}>
            完工时必填
          </span>
        </div>
        <Input
          placeholder="例如：PB-20261021-001"
          value={productionBatch}
          disabled={!editable}
          maxLength={100}
          onChange={(e) => setProductionBatch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>合格证图片</div>
        <Space size={24} align="start" wrap>
          <ImageUploadSlot
            label="首张合格证"
            url={imageFirst}
            editable={editable}
            onUpload={handleUploadFirst}
            onRemove={handleRemoveFirst}
            accept={ACCEPT}
            maxMB={MAX_MB}
            imgStyle={imgStyle}
            uploadBtnStyle={uploadBtnStyle}
          />
          <ImageUploadSlot
            label="末张合格证"
            url={imageLast}
            editable={editable}
            onUpload={handleUploadLast}
            onRemove={handleRemoveLast}
            accept={ACCEPT}
            maxMB={MAX_MB}
            imgStyle={imgStyle}
            uploadBtnStyle={uploadBtnStyle}
          />
        </Space>
        <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          图片规格（与不良记录一致）：{MAX_MB}MB 以内 · {ACCEPT.replace(/image\//g, '').toUpperCase()} · 命名 / MD5 去重 / 落盘目录与不良记录共用
        </div>
      </div>

      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={handleSave} disabled={!dirty}>
            💾 保存批次与标签
          </Button>
          {dirty && <span style={{ color: '#fa8c16', fontSize: 12 }}>※ 有未保存的修改</span>}
        </div>
      )}
    </div>
  )
}

/** 单张图片槽位 */
function ImageUploadSlot({
  label, url, editable, onUpload, onRemove, accept, maxMB, imgStyle, uploadBtnStyle,
}: {
  label: string
  url: string | null
  editable: boolean
  onUpload: (file: File) => boolean | Promise<boolean>
  onRemove: () => void
  accept: string
  maxMB: number
  imgStyle: React.CSSProperties
  uploadBtnStyle: React.CSSProperties
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const imgUrl = url?.startsWith('http') ? url : (url ? `${import.meta.env.VITE_API_BASE || ''}${url}` : '')
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      {url ? (
        <div style={{ position: 'relative', ...imgStyle }}>
          <Image
            src={imgUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
            preview={{ visible: previewOpen, onVisibleChange: setPreviewOpen }}
          />
          {editable && (
            <div
              role="button" aria-label="删除"
              style={{
                position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer',
              }}
              onClick={onRemove}
            >
              <DeleteOutlined />
            </div>
          )}
        </div>
      ) : editable ? (
        <Upload
          accept={accept}
          showUploadList={false}
          beforeUpload={onUpload}
        >
          <div style={uploadBtnStyle}>
            <UploadOutlined style={{ fontSize: 24 }} />
            <span style={{ fontSize: 12 }}>点击上传</span>
            <span style={{ fontSize: 10, color: '#bbb' }}>{maxMB}MB</span>
          </div>
        </Upload>
      ) : (
        <div style={{ ...uploadBtnStyle, borderStyle: 'solid', borderColor: '#eee', color: '#bbb' }}>
          无图片
        </div>
      )}
    </div>
  )
}
