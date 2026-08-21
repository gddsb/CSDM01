import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast, Button, PullToRefresh, Selector, DatePicker, ImageViewer } from 'antd-mobile'
import { CloseOutline, PictureOutline, CameraOutline, SearchOutline, RightOutline } from 'antd-mobile-icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useApp } from '../../contexts/AppContext'

// ============ 类型定义 ============
interface Device {
  device_id: number
  device_code?: string
  device_name?: string
}

interface FaultImage {
  image_id?: number
  image_url?: string
  thumbnail_url?: string
  image_name?: string
  image_type?: string
}

interface DeviceFault {
  fault_id: number
  fault_no: string
  device_id: number
  device_code?: string
  device_name?: string
  fault_level: '一般' | '严重' | '紧急'
  fault_desc?: string
  fault_time: string
  impact_desc?: string
  reporter_name?: string
  repair_person_name?: string
  status: '待派工' | '维修中' | '待审批' | '已关闭' | '已挂起'
  fault_cause?: string
  repair_solution?: string
  repair_time?: string
  approve_time?: string
  approve_result?: string
  close_time?: string
  created_at?: string
}

type Mode = 'list' | 'create' | 'detail'

const LEVEL_OPTIONS = [
  { label: '一般', value: '一般' },
  { label: '严重', value: '严重' },
  { label: '紧急', value: '紧急' },
]

// 等级颜色
const levelColor: Record<string, { bg: string; color: string; cls: string }> = {
  '一般': { bg: '#e6f4ff', color: '#2196F3', cls: 'level-normal' },
  '严重': { bg: '#fff7e6', color: '#fa8c16', cls: 'level-serious' },
  '紧急': { bg: '#fff1f0', color: '#f5222d', cls: 'level-urgent' },
}

// 状态颜色
const statusColor: Record<string, { bg: string; color: string; cls: string }> = {
  '待派工': { bg: '#f0f0f0', color: '#595959', cls: 'st-pending' },
  '维修中': { bg: '#e6f4ff', color: '#2196F3', cls: 'st-repairing' },
  '待审批': { bg: '#fff7e6', color: '#fa8c16', cls: 'st-approving' },
  '已关闭': { bg: '#f6ffed', color: '#52c41a', cls: 'st-closed' },
  '已挂起': { bg: '#fff1f0', color: '#f5222d', cls: 'st-hang' },
}

export default function MobileDeviceFault() {
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const [mode, setMode] = useState<Mode>('list')

  // 列表
  const [list, setList] = useState<DeviceFault[]>([])
  const [loading, setLoading] = useState(false)

  // 设备下拉
  const [devices, setDevices] = useState<Device[]>([])
  const [devicePickerVisible, setDevicePickerVisible] = useState(false)
  const [deviceKeyword, setDeviceKeyword] = useState('')

  // 上报表单
  const [form, setForm] = useState({
    device_id: '' as string | number,
    fault_level: '一般' as '一般' | '严重' | '紧急',
    fault_desc: '',
    fault_time: dayjs() as Dayjs,
    impact_desc: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState<{ file: File; url: string }[]>([])
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // 详情
  const [selectedFault, setSelectedFault] = useState<DeviceFault | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [faultImages, setFaultImages] = useState<FaultImage[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  // ============ 加载设备下拉 ============
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get('/basic/devices', { params: { page: 1, page_size: 500 } })
      if (res.success !== false) {
        const list: Device[] = res.data?.list || res.data || []
        setDevices(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  // ============ 获取历史故障 ============
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: 1, page_size: 50 }
      if (currentUser?.user_id) params.reporter_id = currentUser.user_id
      const res = await api.get('/basic/device-faults', { params })
      if (res.success !== false) {
        const data: DeviceFault[] = res.data?.list || res.data || []
        setList(Array.isArray(data) ? data : [])
      } else {
        setList([])
        Toast.show({ icon: 'fail', content: res.message || '查询失败' })
      }
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '获取故障列表失败' })
      setList([])
    } finally {
      setLoading(false)
    }
  }, [currentUser?.user_id])

  useEffect(() => {
    loadDevices()
    fetchList()
  }, [loadDevices, fetchList])

  const filteredDevices = devices.filter(d => {
    if (!deviceKeyword.trim()) return true
    const kw = deviceKeyword.trim().toLowerCase()
    return (
      (d.device_name || '').toLowerCase().includes(kw) ||
      (d.device_code || '').toLowerCase().includes(kw)
    )
  })

  const selectedDevice = devices.find(d => String(d.device_id) === String(form.device_id))

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

  // ============ 提交故障 ============
  const handleSubmit = async () => {
    if (!form.device_id) {
      Toast.show({ icon: 'fail', content: '请选择故障设备' })
      return
    }
    if (!form.fault_desc.trim()) {
      Toast.show({ icon: 'fail', content: '请描述故障现象' })
      return
    }
    if (!form.fault_time) {
      Toast.show({ icon: 'fail', content: '请选择故障发生时间' })
      return
    }
    setSubmitting(true)
    try {
      const payload: any = {
        device_id: Number(form.device_id),
        device_name: selectedDevice?.device_name,
        device_code: selectedDevice?.device_code,
        fault_level: form.fault_level,
        fault_desc: form.fault_desc.trim(),
        fault_time: form.fault_time.format('YYYY-MM-DD HH:mm:ss'),
        impact_desc: form.impact_desc.trim(),
      }
      const res = await api.post('/basic/device-faults', payload)
      if (res.success === false) {
        Toast.show({ icon: 'fail', content: res.message || '上报失败' })
        return
      }
      const newId = res.data?.fault_id
      if (newId && images.length > 0) {
        try {
          const formData = new FormData()
          images.forEach(img => formData.append('images', img.file))
          formData.append('image_type', 'fault')
          await api.post(`/basic/device-faults/${newId}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch (err: any) {
          Toast.show({ icon: 'fail', content: err.message || '图片上传失败，但故障已上报' })
        }
      }
      Toast.show({ icon: 'success', content: res.message || '故障上报成功' })
      // 重置表单
      setForm({
        device_id: '',
        fault_level: '一般',
        fault_desc: '',
        fault_time: dayjs(),
        impact_desc: '',
      })
      setImages([])
      setMode('list')
      fetchList()
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '上报失败' })
    } finally {
      setSubmitting(false)
    }
  }

  // ============ 查看故障详情 ============
  const openDetail = async (fault: DeviceFault) => {
    setSelectedFault(fault)
    setFaultImages([])
    setMode('detail')
    setDetailLoading(true)
    try {
      const [detailRes, imgRes] = await Promise.all([
        api.get(`/basic/device-faults/${fault.fault_id}`),
        api.get(`/basic/device-faults/${fault.fault_id}/images`),
      ])
      if (detailRes.success !== false && detailRes.data) {
        setSelectedFault(detailRes.data)
      }
      if (imgRes.success !== false) {
        const imgs: FaultImage[] = imgRes.data?.list || imgRes.data || []
        setFaultImages(Array.isArray(imgs) ? imgs : [])
      }
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '加载详情失败' })
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 渲染：历史故障列表 ============
  const renderList = () => {
    const pendingCount = list.filter(f => f.status === '待派工').length
    const repairingCount = list.filter(f => f.status === '维修中').length
    return (
      <div className="mobile-page">
        {/* 统计概览 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#9e9e9e' }}>{list.length}</div>
            <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>合计</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>{pendingCount}</div>
            <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>待派工</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2196F3' }}>{repairingCount}</div>
            <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>维修中</div>
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
            <div className="mobile-empty">暂无故障上报记录</div>
          )}

          {list.map(fault => {
            const lv = levelColor[fault.fault_level] || levelColor['一般']
            const st = statusColor[fault.status] || statusColor['待派工']
            return (
              <div
                key={fault.fault_id}
                className="mobile-list-item"
                onClick={() => openDetail(fault)}
                style={{ borderLeft: `3px solid ${lv.color}` }}
              >
                <div className="mobile-list-item-header">
                  <div className="mobile-list-item-title">{fault.fault_no}</div>
                  <span className="mobile-status-tag" style={{ background: lv.bg, color: lv.color }}>
                    {fault.fault_level}
                  </span>
                </div>
                <div className="mobile-list-item-body">
                  <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                    <span style={{ color: '#757575' }}>设备名称</span>
                    <span style={{ maxWidth: '60%', textAlign: 'right' }}>
                      {fault.device_name || '-'}
                    </span>
                  </div>
                  <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                    <span style={{ color: '#757575' }}>故障时间</span>
                    <span style={{ fontSize: 12 }}>{formatDateTime(fault.fault_time)}</span>
                  </div>
                  {fault.fault_desc && (
                    <div style={{ fontSize: 12, color: '#9e9e9e', margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fault.fault_desc}
                    </div>
                  )}
                  <div className="mobile-flex-between">
                    <span style={{ color: '#757575' }}>状态</span>
                    <span className="mobile-status-tag" style={{ background: st.bg, color: st.color }}>
                      {fault.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </PullToRefresh>
      </div>
    )
  }

  // ============ 渲染：故障上报表单 ============
  const renderCreate = () => {
    return (
      <div className="mobile-page" style={{ paddingBottom: 80 }}>
        {/* 设备选择 */}
        <div className="mobile-section-title">选择设备</div>
        <div className="mobile-detail-grid">
          <div
            onClick={() => {
              setDeviceKeyword('')
              setDevicePickerVisible(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 38,
              padding: '0 10px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              fontSize: 14,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: selectedDevice ? '#212121' : '#bbb' }}>
              {selectedDevice
                ? `${selectedDevice.device_name || ''} ${selectedDevice.device_code ? '(' + selectedDevice.device_code + ')' : ''}`
                : '请选择故障设备'}
            </span>
            <RightOutline fontSize={14} color="#9e9e9e" />
          </div>
        </div>

        {/* 故障等级 */}
        <div className="mobile-section-title">故障等级</div>
        <div className="mobile-detail-grid">
          <Selector
            options={LEVEL_OPTIONS}
            value={[form.fault_level]}
            onChange={(v) => {
              const val = v[0] as '一般' | '严重' | '紧急' | undefined
              if (val) setForm(prev => ({ ...prev, fault_level: val }))
            }}
          />
          {form.fault_level === '紧急' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f5222d', fontWeight: 500 }}>
              ⚠ 紧急故障，请同步通知维修人员电话处理
            </div>
          )}
        </div>

        {/* 故障现象描述 */}
        <div className="mobile-section-title">故障现象描述 <span style={{ color: '#f5222d' }}>*</span></div>
        <div className="mobile-detail-grid">
          <textarea
            style={{
              width: '100%',
              minHeight: 80,
              padding: '8px 10px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'none',
            }}
            placeholder="请描述故障现象（声音、报警、停机等）"
            value={form.fault_desc}
            onChange={(e) => setForm(prev => ({ ...prev, fault_desc: e.target.value }))}
          />
        </div>

        {/* 故障发生时间 */}
        <div className="mobile-section-title">故障发生时间 <span style={{ color: '#f5222d' }}>*</span></div>
        <div className="mobile-detail-grid">
          <DatePicker
            visible={pickerVisible}
            precision="minute"
            value={form.fault_time ? form.fault_time.toDate() : new Date()}
            max={new Date()}
            onClose={() => setPickerVisible(false)}
            onConfirm={(val) => {
              setForm(prev => ({ ...prev, fault_time: dayjs(val) }))
            }}
          >
            {(value) => (
              <div
                onClick={() => setPickerVisible(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 38,
                  padding: '0 10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: '#212121' }}>
                  {value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '请选择故障发生时间'}
                </span>
                <RightOutline fontSize={14} color="#9e9e9e" />
              </div>
            )}
          </DatePicker>
        </div>

        {/* 影响描述 */}
        <div className="mobile-section-title">影响描述</div>
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
            placeholder="请描述故障对生产的影响"
            value={form.impact_desc}
            onChange={(e) => setForm(prev => ({ ...prev, impact_desc: e.target.value }))}
          />
        </div>

        {/* 故障照片 */}
        <div className="mobile-section-title">故障照片</div>
        <div className="mobile-detail-grid">
          <div className="rd-image-list">
            {images.map((img, idx) => (
              <div key={idx} className="rd-image-item">
                <img
                  className="rd-image"
                  src={img.url}
                  alt=""
                  onClick={() => {
                    setPreviewIndex(idx)
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
            支持拍照或选择图片，最多 9 张，上报后自动上传
          </div>
        </div>

        <ImageViewer.Multi
          images={images.map(i => i.url)}
          visible={previewVisible}
          defaultIndex={previewIndex}
          onClose={() => setPreviewVisible(false)}
        />
      </div>
    )
  }

  // ============ 渲染：故障详情 ============
  const renderDetail = () => {
    const fault = selectedFault
    const lv = fault ? (levelColor[fault.fault_level] || levelColor['一般']) : null
    const st = fault ? (statusColor[fault.status] || statusColor['待派工']) : null
    return (
      <div className="mobile-page">
        {detailLoading && (
          <div className="mobile-empty">加载中...</div>
        )}
        {!detailLoading && fault && lv && st && (
          <>
            <div className="mobile-detail-grid">
              <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#212121' }}>
                  {fault.fault_no}
                </div>
                <span className="mobile-status-tag" style={{ background: st.bg, color: st.color }}>
                  {fault.status}
                </span>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">设备编号</div>
                <div className="mobile-detail-value">{fault.device_code || '-'}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">设备名称</div>
                <div className="mobile-detail-value">{fault.device_name || '-'}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">故障等级</div>
                <div className="mobile-detail-value">
                  <span className="mobile-status-tag" style={{ background: lv.bg, color: lv.color }}>
                    {fault.fault_level}
                  </span>
                </div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">故障时间</div>
                <div className="mobile-detail-value">{formatDateTime(fault.fault_time)}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">上报人</div>
                <div className="mobile-detail-value">{fault.reporter_name || '-'}</div>
              </div>
              <div className="mobile-detail-row">
                <div className="mobile-detail-label">维修人</div>
                <div className="mobile-detail-value">{fault.repair_person_name || '-'}</div>
              </div>
            </div>

            <div className="mobile-section-title">故障现象</div>
            <div className="mobile-detail-grid">
              <div style={{ fontSize: 13, color: '#212121', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {fault.fault_desc || '-'}
              </div>
            </div>

            {fault.impact_desc && (
              <>
                <div className="mobile-section-title">影响描述</div>
                <div className="mobile-detail-grid">
                  <div style={{ fontSize: 13, color: '#212121', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {fault.impact_desc}
                  </div>
                </div>
              </>
            )}

            {fault.fault_cause && (
              <>
                <div className="mobile-section-title">故障原因</div>
                <div className="mobile-detail-grid">
                  <div style={{ fontSize: 13, color: '#212121', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {fault.fault_cause}
                  </div>
                </div>
              </>
            )}

            {fault.repair_solution && (
              <>
                <div className="mobile-section-title">维修方案</div>
                <div className="mobile-detail-grid">
                  <div style={{ fontSize: 13, color: '#212121', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {fault.repair_solution}
                  </div>
                </div>
              </>
            )}

            <div className="mobile-section-title">故障照片</div>
            {faultImages.length === 0 ? (
              <div className="mobile-empty" style={{ padding: '20px' }}>暂无故障照片</div>
            ) : (
              <div className="mobile-detail-grid">
                <div className="rd-image-list">
                  {faultImages.map((img, idx) => (
                    <div key={img.image_id || idx} className="rd-image-item">
                      <img
                        className="rd-image"
                        src={img.image_url}
                        alt=""
                        onClick={() => {
                          setPreviewIndex(idx)
                          setPreviewVisible(true)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ImageViewer.Multi
              images={faultImages.map(i => i.image_url || '')}
              visible={previewVisible}
              defaultIndex={previewIndex}
              onClose={() => setPreviewVisible(false)}
            />
          </>
        )}
      </div>
    )
  }

  // ============ 主渲染 ============
  const showCreateTab = mode === 'create'
  return (
    <div>
      <div className="mobile-sub-header">
        <div className="mobile-sub-back" onClick={() => {
          if (mode === 'list') navigate(-1)
          else { setMode('list'); setSelectedFault(null) }
        }}>‹</div>
        <div className="mobile-sub-title">
          {mode === 'create' ? '故障上报' : mode === 'detail' ? '故障详情' : '故障管理'}
        </div>
      </div>

      {mode === 'list' && (
        <div className="mobile-tabs">
          <div
            className={`mobile-tab ${!showCreateTab ? 'active' : ''}`}
            onClick={() => setMode('list')}
          >
            历史故障
          </div>
          <div
            className={`mobile-tab ${showCreateTab ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            新建上报
          </div>
        </div>
      )}

      {mode === 'list' && renderList()}
      {mode === 'create' && renderCreate()}
      {mode === 'detail' && renderDetail()}

      {/* 提交按钮（固定底部，仅新建模式） */}
      {mode === 'create' && (
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
            onClick={handleSubmit}
            style={{ borderRadius: 8, height: 44 }}
          >
            提交故障
          </Button>
        </div>
      )}

      {/* 设备选择器 Popup */}
      {devicePickerVisible && (
        <div className="rd-img-modal-mask" onClick={() => setDevicePickerVisible(false)}>
          <div className="rd-img-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rd-img-modal-header">
              <span className="rd-img-modal-title">选择故障设备</span>
              <CloseOutline className="rd-img-modal-close" onClick={() => setDevicePickerVisible(false)} fontSize={20} />
            </div>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <SearchOutline fontSize={14} color="#9e9e9e" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px 0 32px',
                    border: '1px solid #e0e0e0',
                    borderRadius: 6,
                    fontSize: 13,
                    background: '#f5f6f8',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="搜索设备名称 / 编号"
                  value={deviceKeyword}
                  autoFocus
                  onChange={(e) => setDeviceKeyword(e.target.value)}
                />
              </div>
            </div>
            <div className="rd-img-modal-body" style={{ maxHeight: '50vh' }}>
              {filteredDevices.length === 0 && (
                <div className="rd-img-empty">未找到设备</div>
              )}
              {filteredDevices.map(d => (
                <div
                  key={d.device_id}
                  className="rd-defect-select-option"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 10px',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setForm(prev => ({ ...prev, device_id: d.device_id }))
                    setDevicePickerVisible(false)
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#212121' }}>
                      {d.device_name || '-'}
                    </div>
                    {d.device_code && (
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 2 }}>
                        编号：{d.device_code}
                      </div>
                    )}
                  </div>
                  {String(d.device_id) === String(form.device_id) && (
                    <span style={{ color: '#2196F3', fontSize: 16 }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
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
