import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input, Dialog, Toast } from 'antd-mobile'
import { CloseOutline, PictureOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import api from '../../../../utils/api'
import { formatFilmVersion } from '../../../../utils'

export default function ImageManagerModal({ visible, onClose, images, onUpload, onRemove, title, reportNo, category }) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [showActionSheet, setShowActionSheet] = useState(false)

  const handleUploadClick = () => {
    setShowActionSheet(true)
  }

  const handleSelectAlbum = () => {
    setShowActionSheet(false)
    fileInputRef.current?.click()
  }

  const handleSelectCamera = () => {
    setShowActionSheet(false)
    cameraInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (!reportNo) {
      Toast.show({ icon: 'fail', content: '报工单号不存在，无法上传' })
      return
    }
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const res = await api.post(`/production/report-images/${reportNo}/${category}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const uploaded = res.data || []
      if (uploaded.length > 0) {
        onUpload && onUpload(uploaded)
        Toast.show({ icon: 'success', content: res.message || `已上传 ${uploaded.length} 张图片` })
      }
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '图片上传失败' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  const handlePreview = (img) => {
    const imgs = Array.isArray(images) ? images : []
    const defaultIndex = Math.max(0, imgs.indexOf(img))
    if (typeof window !== 'undefined' && (window).ImageViewer) {
      (window).ImageViewer.show({ images: imgs, defaultIndex })
    } else {
      window.open(img, '_blank')
    }
  }

  if (!visible) return null

  return (
    <div className="rd-img-modal-mask" onClick={onClose}>
      <div className="rd-img-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rd-img-modal-header">
          <span className="rd-img-modal-title">{title || '图片管理'}</span>
          <CloseOutline className="rd-img-modal-close" onClick={onClose} fontSize={20} />
        </div>
        <div className="rd-img-modal-body">
          {images.length === 0 && (
            <div className="rd-img-empty">暂无图片，点击下方按钮上传</div>
          )}
          {images.length > 0 && (
            <div className="rd-img-grid">
              {images.map((img, idx) => (
                <div key={idx} className="rd-img-grid-item">
                  <img src={img} alt="" className="rd-img-thumb" onClick={() => handlePreview(img)} />
                  <div className="rd-img-grid-remove" onClick={() => onRemove && onRemove(idx)}>
                    <CloseOutline fontSize={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rd-img-modal-footer">
          <Button block color="primary" size="large" onClick={handleUploadClick} style={{ borderRadius: 8 }}>
            <PictureOutline /> 上传图片 ({images.length})
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {showActionSheet && (
          <div className="rd-actionsheet-mask" onClick={() => setShowActionSheet(false)}>
            <div className="rd-actionsheet" onClick={(e) => e.stopPropagation()}>
              <div className="rd-actionsheet-item" onClick={handleSelectCamera}>
                拍照上传
              </div>
              <div className="rd-actionsheet-item" onClick={handleSelectAlbum}>
                从相册选择
              </div>
              <div className="rd-actionsheet-item rd-actionsheet-cancel" onClick={() => setShowActionSheet(false)}>
                取消
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
