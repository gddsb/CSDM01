import React, { useState } from 'react'
import { genTempId } from './shared'
import { Button, Input, Dialog, Toast } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import api from '../../../../utils/api'
import { formatTime } from '../../../../utils'

export default function ExceptionTab({ list, setList, devices, isEditable, reportOrderId, reportNo, reportTime, onDataSaved, onDirty }) {
  const [saving, setSaving] = useState(false)
  const exceptionCategories = ['故障维修', '来料异常', '停机待料', '其它异常']

  const handleAdd = async () => {
    await handleSave()
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      exception_type: '',
      start_time: null,
      end_time: null,
      description: '',
      images: [],
    }])
  }

  const handleSave = async () => {
    if (!isEditable) return
    const valid = list.filter(e => e.exception_type && e.start_time)
    if (valid.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录' })
      return
    }
    setSaving(true)
    try {
      for (const e of valid) {
        const payload = {
          report_order_id: e.report_order_id,
          exception_type: e.exception_type,
          device_id: e.device_id || null,
          start_time: e.start_time,
          end_time: e.end_time,
          description: e.description || '',
          exception_images: e.images || [],
        }
        if (e.exception_id) {
          await api.put(`/production/process-exceptions/${e.exception_id}`, payload)
        } else {
          await api.post('/production/process-exceptions', payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get('/production/process-exceptions', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(e => {
        let imgs = []
        try { imgs = e.exception_images ? (Array.isArray(e.exception_images) ? e.exception_images : JSON.parse(e.exception_images)) : [] } catch {}
        return { ...e, id: e.exception_id || genTempId(), images: imgs }
      }))
      onDataSaved && onDataSaved()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e) => {
    const confirmed = await Dialog.confirm({ content: '确认删除该记录？' })
    if (!confirmed) return
    try {
      if (e.exception_id) {
        await api.delete(`/production/process-exceptions/${e.exception_id}`)
      }
      setList(prev => prev.filter(x => x.id !== e.id))
      Toast.show({ icon: 'success', content: '已删除' })
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '删除失败' })
    }
  }

  const handleChange = (recordId, field, value) => {
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      if (field === 'exception_type' && value !== '故障维修') {
        next.device_id = null
      }
      return next
    }))
  }

  const handleImageUpload = async (recordId) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])
      if (files.length === 0) return
      if (!reportNo) {
        Toast.show({ icon: 'fail', content: '报工单号不存在，无法上传' })
        return
      }
      try {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        const res = await api.post(`/production/report-images/${reportNo}/exception/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const uploaded = res.data || []
        if (uploaded.length > 0) {
          onDirty && onDirty(recordId)
          setList(prev => prev.map(item => {
            if (item.id !== recordId) return item
            return { ...item, images: [...(item.images || []), ...uploaded] }
          }))
          Toast.show({ icon: 'success', content: res.message || `已上传 ${uploaded.length} 张图片` })
        }
      } catch (err) {
        Toast.show({ icon: 'fail', content: err.message || '图片上传失败' })
      }
    }
    input.click()
  }

  const handleRemoveImage = (recordId, imageIndex) => {
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const images = [...(item.images || [])]
      images.splice(imageIndex, 1)
      return { ...item, images }
    }))
  }

  const handleTimeChange = (recordId, field, value) => {
    if (!value) {
      handleChange(recordId, field, null)
      return
    }
    const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    const timeStr = dayjs(value).format('HH:mm:ss')
    const newTime = `${baseDate}T${timeStr}`

    if (dayjs(newTime).isAfter(dayjs())) {
      Toast.show({ icon: 'fail', content: '不能选择未来时间' })
      return
    }

    if (field === 'start_time' && reportTime && dayjs(newTime).isBefore(dayjs(reportTime))) {
      Toast.show({ icon: 'fail', content: '开始时间不能早于报工时间' })
      return
    }

    const record = list.find(r => r.id === recordId)
    if (field === 'start_time' && record?.end_time && dayjs(newTime).isAfter(dayjs(record.end_time))) {
      Toast.show({ icon: 'fail', content: '开始时间不能晚于结束时间' })
      return
    }
    if (field === 'end_time' && record?.start_time && dayjs(newTime).isBefore(dayjs(record.start_time))) {
      Toast.show({ icon: 'fail', content: '结束时间不能早于开始时间' })
      return
    }

    const overlap = list.some(e => {
      if (String(e.id) === String(recordId)) return false
      if (!e.start_time) return false
      const eStart = dayjs(e.start_time)
      const eEnd = e.end_time ? dayjs(e.end_time) : null
      const newStart = dayjs(field === 'start_time' ? newTime : (record?.start_time || newTime))
      const newEnd = dayjs(field === 'end_time' ? newTime : (record?.end_time || newStart))
      if (eEnd) {
        return newStart.isBefore(eEnd) && newEnd.isAfter(eStart)
      }
      return newEnd.isAfter(eStart) || newStart.isSame(eStart)
    })
    if (overlap) {
      Toast.show({ icon: 'fail', content: '时间区间与已有记录重叠' })
      return
    }

    handleChange(recordId, field, newTime)
  }

  return (
    <div>
      {isEditable && (
        <div className="rd-toolbar">
          <div className="rd-toolbar-btns" style={{ marginLeft: 'auto' }}>
            <Button fill="outline" size="small" onClick={handleSave} loading={saving}>
              <CheckOutline /> 保存
            </Button>
            <Button color="primary" size="small" onClick={handleAdd}>
              <AddOutline /> 添加
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => (
        <div key={record.id} className="rd-list-item">
          <div className="rd-list-item-header">
            <span className="rd-list-item-title">
              {record.exception_type || '新增记录'}
            </span>
            {isEditable && (
              <div className="rd-list-item-actions">
                <PictureOutline color="#2196F3" onClick={() => handleImageUpload(record.id)} fontSize={18} />
                <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} fontSize={16} />
              </div>
            )}
          </div>

          {isEditable ? (
            <div className="rd-list-item-body">
              <div className="rd-form-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">异常类型</label>
                  <select
                    className="rd-form-input"
                    value={record.exception_type || ''}
                    onChange={(e) => handleChange(record.id, 'exception_type', e.target.value)}
                  >
                    <option value="">请选择</option>
                    {exceptionCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">设备</label>
                  <select
                    className="rd-form-input"
                    value={record.device_id || ''}
                    onChange={(e) => handleChange(record.id, 'device_id', e.target.value ? Number(e.target.value) : null)}
                    disabled={record.exception_type !== '故障维修'}
                    style={record.exception_type !== '故障维修' ? { opacity: 0.5, backgroundColor: '#f5f5f5' } : {}}
                  >
                    <option value="">无</option>
                    {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.device_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="rd-form-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">开始时间</label>
                  <input
                    type="time"
                    className="rd-form-input"
                    value={record.start_time ? dayjs(record.start_time).format('HH:mm') : ''}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number)
                      const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
                      handleTimeChange(record.id, 'start_time', new Date(`${baseDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`))
                    }}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">结束时间</label>
                  <input
                    type="time"
                    className="rd-form-input"
                    value={record.end_time ? dayjs(record.end_time).format('HH:mm') : ''}
                    onChange={(e) => {
                      if (!e.target.value) {
                        handleChange(record.id, 'end_time', null)
                        return
                      }
                      const [h, m] = e.target.value.split(':').map(Number)
                      const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
                      handleTimeChange(record.id, 'end_time', new Date(`${baseDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`))
                    }}
                  />
                </div>
              </div>
              <div className="rd-form-item">
                <label className="rd-form-label">异常描述</label>
                <textarea
                  className="rd-form-input"
                  style={{ height: 48, paddingTop: 6 }}
                  value={record.description || ''}
                  onChange={(e) => handleChange(record.id, 'description', e.target.value)}
                />
              </div>
              {(record.images || []).length > 0 && (
                <div className="rd-image-list" style={{ marginTop: 8 }}>
                  {(record.images || []).map((img, idx) => (
                    <div key={idx} className="rd-image-item">
                      <img src={img} alt="" className="rd-image" />
                      <DeleteOutline color="#fff" fontSize={12} onClick={() => handleRemoveImage(record.id, idx)} className="rd-image-delete" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rd-list-item-body">
              <div className="rd-list-row">
                <span className="rd-list-label">时间</span>
                <span className="rd-list-value">
                  {formatTime(record.start_time)} ~ {formatTime(record.end_time)}
                </span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">时长</span>
                <span className="rd-list-value">{record.duration || 0} 小时</span>
              </div>
              {record.description && (
                <div className="rd-list-row">
                  <span className="rd-list-label">描述</span>
                  <span className="rd-list-value">{record.description}</span>
                </div>
              )}
              {(record.images || []).length > 0 && (
                <div className="rd-image-list" style={{ marginTop: 8 }}>
                  {(record.images || []).map((img, idx) => (
                    <div key={idx} className="rd-image-item">
                      <img src={img} alt="" className="rd-image" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
