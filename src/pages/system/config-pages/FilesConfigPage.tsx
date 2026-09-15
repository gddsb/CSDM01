import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, Modal, Button, Typography } from 'antd'
import api from '../../../utils/api'
import FilesTab from '../config-tabs/FilesTab'
import { buildFileColumns, type FileItem } from '../config-tabs/fileColumns'

export default function FilesConfigPage() {
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void } } }).antd?.message
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const [fileCurrentDir, setFileCurrentDir] = useState('')
  const [fileBreadcrumbs, setFileBreadcrumbs] = useState<{ name: string; path: string }[]>([])
  const [fileLoading, setFileLoading] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)

  const showError = (msg: string) => message?.error(msg)

  const loadFileDirectory = useCallback(async (dir: string) => {
    setFileLoading(true)
    try {
      const res = await api.get('/system/files', { params: { dir: dir || '' } })
      const data = res.data || {}
      setFileItems(data.items || [])
      setFileCurrentDir(data.currentDir || '/')
      const pathParts = (data.currentDir && data.currentDir !== '/') ? data.currentDir.split('/').filter(Boolean) : []
      const crumbs = [{ name: 'uploads', path: '' }]
      let accPath = ''
      for (const part of pathParts) {
        accPath = accPath ? accPath + '/' + part : part
        crumbs.push({ name: part, path: accPath })
      }
      setFileBreadcrumbs(crumbs)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '获取文件列表失败')
      setFileItems([])
    } finally {
      setFileLoading(false)
    }
  }, [])

  const handleFileGoBack = () => {
    if (fileCurrentDir && fileCurrentDir !== '/') {
      const parent = fileCurrentDir.substring(0, fileCurrentDir.lastIndexOf('/'))
      loadFileDirectory(parent === '/' ? '' : parent)
    }
  }

  const handleFilePreview = (item: FileItem) => {
    if (!item.isDirectory) {
      const url = '/uploads/' + item.path
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(item.name)
      if (isImage) {
        setPreviewFile({ url, name: item.name })
      } else {
        window.open(url, '_blank')
      }
    }
  }

  const handleFileDownload = async (item: FileItem) => {
    if (item.isDirectory) return
    const url = '/uploads/' + item.path
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`下载失败 (HTTP ${resp.status})`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = item.name || url.split('/').pop() || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err: unknown) {
      const a = document.createElement('a')
      a.href = url
      a.download = item.name || ''
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      showError(err instanceof Error ? err.message : '下载失败')
    }
  }

  const fileColumns = useMemo(() => buildFileColumns({
    onPreview: handleFilePreview,
    onDownload: handleFileDownload,
  }), [fileCurrentDir])

  useEffect(() => {
    loadFileDirectory('')
  }, [loadFileDirectory])

  return (
    <>
      <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
        <FilesTab
          filesLoading={fileLoading}
          fileData={{ current: fileCurrentDir, separator: '/', files: fileItems, breadcrumbs: fileBreadcrumbs }}
          fileColumns={fileColumns}
          handleFileOpen={(r) => r.isDirectory ? loadFileDirectory(r.path) : handleFilePreview(r)}
          handleFileBreadcrumb={loadFileDirectory}
          handleFileGoBack={handleFileGoBack}
        />
      </Card>

      <Modal
        open={!!previewFile}
        title={previewFile?.name}
        onCancel={() => setPreviewFile(null)}
        footer={null}
        width={720}
        centered
        destroyOnClose
      >
        {previewFile && <ImagePreview url={previewFile.url} name={previewFile.name} />}
      </Modal>
    </>
  )
}

function ImagePreview({ url, name }: { url: string; name: string }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const MIN_SCALE = 0.2
  const MAX_SCALE = 5

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }) }
  const cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default'

  return (
    <div style={{ position: 'relative', height: 500, overflow: 'hidden', background: '#000', borderRadius: 4 }}>
      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor, userSelect: 'none',
        }}
      >
        <img
          src={url}
          alt={name}
          draggable={false}
          onDoubleClick={reset}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            maxWidth: '100%',
            maxHeight: 500,
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
        {Math.round(scale * 100)}%
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6 }}>
        <Button size="small" onClick={() => setScale(s => Math.min(MAX_SCALE, +(s + 0.2).toFixed(2)))}>+</Button>
        <Button size="small" onClick={() => setScale(s => Math.max(MIN_SCALE, +(s - 0.2).toFixed(2)))}>−</Button>
        <Button size="small" onClick={reset} disabled={scale === 1 && offset.x === 0 && offset.y === 0}>重置</Button>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 12, color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
        滚轮缩放 · {scale > 1 ? '拖动移动 · ' : ''}双击重置
      </div>
    </div>
  )
}
