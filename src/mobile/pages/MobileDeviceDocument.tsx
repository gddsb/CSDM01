/**
 * 电子档案移动版 — 扫码设备 → 按 DOC_TYPE 分组 → 上传 / 下载 / 删除
 *
 * 对齐 PC DeviceDocument.tsx：
 *   GET  /basic/device-documents/by-device/:deviceId        按设备查文档
 *   POST /basic/device-documents                            multipart form-data（files, device_id, doc_type, doc_name, version...）
 *   GET  /basic/device-documents/:id/download               下载（带 token header）
 *   DELETE /basic/device-documents/:id                      删除
 *
 * 移动下载策略：fetch → blob → objectUrl → a.click() 触发下载
 */
import { useEffect, useState } from 'react'
import { Button, List, SearchBar, Toast, Dialog, Tabs, PullToRefresh, Input } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'

const API_PREFIX = '/api'

const DOC_TYPE_MAP: Record<string, string> = {
  'factory': '出厂资料',
  'acceptance': '验收资料',
  'external_repair': '外保记录',
  'internal_repair': '内部维修',
  'modification': '改造记录',
}

interface DeviceRow { device_id: number; device_code?: string; device_name?: string }
interface DocRow {
  doc_id: number; device_id: number; device_code?: string; device_name?: string
  doc_type: string; doc_type_name?: string; doc_name: string; version?: string
  file_path: string; file_format?: string; file_size?: number; file_size_text?: string
  related_order?: string; valid_until?: string
}

export default function MobileDeviceDocument() {
  const { scan } = useBarcode()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 上传表单
  const [form, setForm] = useState({
    doc_type: 'factory', doc_name: '', version: 'v1',
    related_order: '', valid_until: '', remarks: '',
  })
  const [fileList, setFileList] = useState<File[]>([])
  const fileInputRef = useState(() => document.createElement('input'))[0]

  // ===== 拉设备 =====
  const loadDevices = async (kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 200 }
      if (kw) params.device_code = kw
      const r: any = await api.get('/basic/devices', { params })
      setDevices(r.success ? (r.data?.list || r.data || []) : [])
    } catch { setDevices([]) } finally { setLoading(false) }
  }
  useEffect(() => { loadDevices() }, [])

  // ===== 扫码 =====
  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code)
    const list = await loadDevices(r.code)
    const match = devices.find((d) => d.device_code === r.code)
    if (match) {
      setSelectedDevice(match); await loadDocs(match.device_id)
    } else {
      Toast.show({ content: '未找到设备', position: 'bottom' })
    }
  }

  const onSearchDevice = async () => {
    const list = await loadDevices(keyword.trim())
    if (list.length === 1) {
      setSelectedDevice(list[0]); await loadDocs(list[0].device_id)
    } else if (list.length > 1) {
      Toast.show({ content: `命中 ${list.length} 条，请手动选`, position: 'bottom' })
    } else {
      Toast.show({ content: '未找到设备', position: 'bottom' })
    }
  }

  // ===== 拉文档 =====
  const loadDocs = async (deviceId: number) => {
    setLoading(true)
    try {
      const r: any = await api.get(`/basic/device-documents/by-device/${deviceId}`)
      setDocs(r.success ? (r.data || []) : [])
    } catch { setDocs([]) } finally { setLoading(false) }
  }

  // ===== 按类型分组 =====
  const filteredDocs = activeTab === 'all' ? docs : docs.filter((d) => d.doc_type === activeTab)

  // ===== 下载 =====
  const downloadDoc = async (d: DocRow) => {
    try {
      const token = localStorage.getItem('mes_token')
      const url = `${API_PREFIX}/basic/device-documents/${d.doc_id}/download`
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!resp.ok) { Toast.show({ content: `下载失败 ${resp.status}`, position: 'bottom' }); return }
      const blob = await resp.blob()
      const name = `${d.doc_name || 'document'}${d.file_format ? '.' + d.file_format : ''}`
      const urlObj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj; a.download = name
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(urlObj)
      Toast.show({ content: `已下载 ${name}`, icon: 'success', position: 'bottom' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '下载失败', position: 'bottom' })
    }
  }

  // ===== 删除 =====
  const onDelete = async (d: DocRow) => {
    const ok = await Dialog.confirm({
      content: `删除文档 "${d.doc_name}"？`, confirmText: '删除',
      confirmColor: '#F44336', cancelText: '取消',
    })
    if (!ok) return
    try {
      await api.delete(`/basic/device-documents/${d.doc_id}`)
      Toast.show({ content: '已删除', icon: 'success', position: 'bottom' })
      if (selectedDevice) await loadDocs(selectedDevice.device_id)
    } catch (e: any) { Toast.show({ content: e?.message || '删除失败', position: 'bottom' }) }
  }

  // ===== 上传 =====
  const openUpload = () => {
    if (!selectedDevice) { Toast.show({ content: '请先选设备', position: 'bottom' }); return }
    setShowUpload(true)
    setForm({ doc_type: 'factory', doc_name: '', version: 'v1', related_order: '', valid_until: '', remarks: '' })
    setFileList([])
  }

  const onPickFiles = () => {
    const el = document.createElement('input')
    el.type = 'file'; el.multiple = true
    el.onchange = (e) => {
      const arr = Array.from((e.target as HTMLInputElement).files || [])
      setFileList(arr)
      if (arr.length > 0 && !form.doc_name) setForm({ ...form, doc_name: arr[0].name.replace(/\.[^.]+$/, '') })
    }
    el.click()
  }

  const submitUpload = async () => {
    if (!selectedDevice) return
    if (!form.doc_name.trim()) { Toast.show({ content: '请填文档名称', position: 'bottom' }); return }
    if (fileList.length === 0) { Toast.show({ content: '请选至少 1 个文件', position: 'bottom' }); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('device_id', String(selectedDevice.device_id))
      fd.append('doc_type', form.doc_type)
      fd.append('doc_name', form.doc_name)
      fd.append('version', form.version)
      if (form.valid_until) fd.append('valid_until', form.valid_until)
      if (form.related_order) fd.append('related_order', form.related_order)
      if (form.remarks) fd.append('remarks', form.remarks)
      fileList.forEach((f) => fd.append('files', f))
      const r: any = await api.post('/basic/device-documents', fd, { timeout: 120000 })
      if (r.success !== false) {
        Toast.show({ content: `成功上传 ${fileList.length} 个文件`, icon: 'success', position: 'bottom' })
        setShowUpload(false)
        await loadDocs(selectedDevice.device_id)
      } else {
        Toast.show({ content: r.message || '上传失败', position: 'bottom' })
      }
    } catch (e: any) { Toast.show({ content: e?.message || '上传失败', position: 'bottom' }) }
    finally { setUploading(false) }
  }

  // ===== 渲染 =====
  if (!selectedDevice) {
    // 设备选择 Step
    return (
      <div className="mobile-page" style={{ paddingTop: 12 }}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 10, padding: '0 4px' }}>
          扫码或选设备 → 查看该设备的全部电子档案
        </div>
        <SearchBar placeholder="扫/输设备编号" value={keyword} onChange={setKeyword}
          onSearch={onSearchDevice} onRightIconClick={onScan}
          right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
          style={{ marginBottom: 12 }} />
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            暂无设备<br /><span style={{ fontSize: 12 }}>请先在 PC 端创建设备档案</span>
          </div>
        ) : (
          <PullToRefresh onRefresh={() => loadDevices()}>
            <List>
              {devices.map((d) => (
                <List.Item key={d.device_id} arrow onClick={async () => {
                  setSelectedDevice(d); await loadDocs(d.device_id)
                }} description={
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{d.device_code}</div>
                }>
                  {d.device_name}
                </List.Item>
              ))}
            </List>
          </PullToRefresh>
        )}
      </div>
    )
  }

  // 文档详情 Step
  return (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 30 }}>
      {/* 设备卡 */}
      <div style={{
        background: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedDevice.device_name}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{selectedDevice.device_code}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="mini" color="primary" fill="outline" onClick={openUpload}>⬆️ 上传</Button>
          <Button size="mini" fill="outline" onClick={() => { setSelectedDevice(null); setDocs([]); setActiveTab('all') }}>换设备</Button>
        </div>
      </div>

      {/* 类型 Tab */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 8px', marginBottom: 10 }}>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k)}>
          <Tabs.Tab title={`全部(${docs.length})`} key="all" />
          {Object.entries(DOC_TYPE_MAP).map(([k, v]) => (
            <Tabs.Tab title={`${v}(${docs.filter((d) => d.doc_type === k).length})`} key={k} />
          ))}
        </Tabs>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          暂无{activeTab === 'all' ? '' : DOC_TYPE_MAP[activeTab]}文档
          <div style={{ fontSize: 12, marginTop: 6 }}>点右上角 ⬆️ 上传</div>
        </div>
      ) : (
        <PullToRefresh onRefresh={() => loadDocs(selectedDevice.device_id)}>
          <List>
            {filteredDocs.map((d) => <DocCard key={d.doc_id} doc={d}
              onDownload={() => downloadDoc(d)}
              onDelete={() => onDelete(d)} />)}
          </List>
        </PullToRefresh>
      )}

      {/* ===== 上传 Dialog ===== */}
      {showUpload && (
        <Dialog visible content={
          <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '6px 2px' }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>⬆️ 上传电子档案</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>设备</div>
            <div style={{ padding: 6, background: '#f0f7ff', borderRadius: 6, fontSize: 12 }}>
              {selectedDevice.device_name} ({selectedDevice.device_code})
            </div>

            <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>文档类型</div>
            <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} style={selStyle}>
              {Object.entries(DOC_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>文档名称 *</div>
            <Input value={form.doc_name} onChange={(v) => setForm({ ...form, doc_name: v })} placeholder="如：使用说明书、合格证" />

            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>版本号</div>
                <Input value={form.version} onChange={(v) => setForm({ ...form, version: v })} placeholder="v1" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>关联工单</div>
                <Input value={form.related_order} onChange={(v) => setForm({ ...form, related_order: v })} placeholder="可选" />
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>有效期至（可选）</div>
            <Input type="date" value={form.valid_until} onChange={(v) => setForm({ ...form, valid_until: v })} />

            <div style={{ fontSize: 11, color: '#888', margin: '10px 0 4px' }}>选择文件（可多选，≤10）</div>
            <Button size="mini" fill="outline" block onClick={onPickFiles}>
              📁 {fileList.length > 0 ? `已选 ${fileList.length} 个` : '点此选择'}
            </Button>
            {fileList.length > 0 && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                {fileList.map((f) => <div key={f.name}>· {f.name} ({(f.size / 1024).toFixed(1)} KB)</div>)}
              </div>
            )}
          </div>
        }
          actions={[
            { key: 'cancel', text: '取消', onClick: () => setShowUpload(false) },
            { key: 'ok', text: uploading ? '上传中...' : '确认上传', primary: true, onClick: submitUpload },
          ]}
        />
      )}
    </div>
  )
}

// ========== 子组件 ==========

function DocCard({ doc, onDownload, onDelete }: {
  doc: DocRow; onDownload: () => void; onDelete: () => void
}) {
  const icon = doc.file_format?.match(/pdf/i) ? '📕'
    : doc.file_format?.match(/doc|docx/i) ? '📘'
    : doc.file_format?.match(/xls|xlsx/i) ? '📗'
    : doc.file_format?.match(/png|jpe?g|gif|bmp/i) ? '🖼️'
    : '📄'
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 10, marginBottom: 8,
      border: '1px solid #eef0f3',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {doc.doc_name}
            {doc.version && <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>v{doc.version}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {doc.doc_type_name || DOC_TYPE_MAP[doc.doc_type] || doc.doc_type}
            {doc.file_format ? ` · ${doc.file_format.toUpperCase()}` : ''}
            {doc.file_size_text ? ` · ${doc.file_size_text}` : ''}
          </div>
          {doc.related_order && (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>工单: {doc.related_order}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Button size="mini" color="primary" onClick={onDownload}>⬇️ 下载</Button>
        <Button size="mini" fill="outline" onClick={onDelete}>🗑️ 删除</Button>
      </div>
    </div>
  )
}

const selStyle: React.CSSProperties = { padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%', background: '#fff' }
