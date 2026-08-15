import React, { useState } from 'react'
import { genTempId } from './shared'
import { Button, Toast } from 'antd-mobile'
import { CheckOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import api from '../../../../utils/api'
import { formatDateTime } from '../../../../utils'

export default function ManpowerTab({ list, setList, isEditable, reportOrderId, reportTime, reportStatus, reportFinishTime, onDataSaved, onDirty }) {
  const [saving, setSaving] = useState(false)

  const calcManpowerHours = () => {
    if (!reportTime) return { start_time: null, end_time: null, hours: 0 }
    const start = dayjs(reportTime)
    const end = (reportStatus === '完工' || reportStatus === 1) && reportFinishTime
      ? dayjs(reportFinishTime)
      : dayjs()
    const diffMs = end.valueOf() - start.valueOf()
    const hours = diffMs > 0 ? Number((diffMs / 3600000).toFixed(2)) : 0
    return { start_time: reportTime, end_time: end.toISOString(), hours }
  }

  const { hours } = calcManpowerHours()

  const displayList = list.map(m => {
    const sk = Number(m.skilled_count) || 0
    const gn = Number(m.general_count) || 0
    const lb = Number(m.labor_count) || 0
    const ot = Number(m.other_count) || 0
    const total_people = sk + gn + lb + ot
    const man_hours = Number((hours * total_people).toFixed(2))
    return { ...m, hours, total_people, man_hours }
  })

  const handleChange = (recordId, field, value) => {
    if (!isEditable) return
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      return { ...item, [field]: value }
    }))
  }

  const validateRecord = (record) => {
    const sk = Number(record.skilled_count) || 0
    const gn = Number(record.general_count) || 0
    const lb = Number(record.labor_count) || 0
    const ot = Number(record.other_count) || 0
    const total = sk + gn + lb + ot
    if (total <= 0) {
      Toast.show({ icon: 'fail', content: '请填写至少一项人员数量（技工/普工/劳务/其他）' })
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!isEditable) return
    const recordsToSave = displayList.filter(m => m.record_id)
    if (recordsToSave.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录' })
      return
    }
    for (const record of recordsToSave) {
      if (!validateRecord(record)) return
    }
    setSaving(true)
    try {
      for (const record of recordsToSave) {
        const payload = {
          report_order_id: Number(reportOrderId),
          record_date: record.record_date,
          shift: record.shift,
          skilled_count: Number(record.skilled_count) || 0,
          general_count: Number(record.general_count) || 0,
          labor_count: Number(record.labor_count) || 0,
          other_count: Number(record.other_count) || 0,
          remarks: record.remarks || '',
        }
        await api.put(`/production/manpower-records/${record.record_id}`, payload)
      }
      Toast.show({ icon: 'success', content: `已保存 ${recordsToSave.length} 条记录` })
      const res = await api.get('/production/manpower-records', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(m => ({ ...m, id: m.record_id || genTempId() })))
      if (onDataSaved) await onDataSaved()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {isEditable && (
        <div className="rd-toolbar">
          <div className="rd-toolbar-btns" style={{ marginLeft: 'auto' }}>
            <Button fill="outline" size="small" onClick={handleSave} loading={saving}>
              <CheckOutline /> 保存
            </Button>
          </div>
        </div>
      )}

      {displayList.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {displayList.map(record => (
        <div key={record.id} className="rd-list-item">
          <div className="rd-list-item-header">
            <span className="rd-list-item-title">
              班次：{record.shift || '白班'}
            </span>
          </div>

          {isEditable ? (
            <div className="rd-list-item-body">
              <div className="rd-form-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">开始时间</label>
                  <input
                    className="rd-form-input"
                    value={formatDateTime(reportTime)}
                    readOnly
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">结束时间</label>
                  <input
                    className="rd-form-input"
                    value={(reportStatus === '完工' || reportStatus === 1) && reportFinishTime
                      ? formatDateTime(reportFinishTime)
                      : '进行中'}
                    readOnly
                  />
                </div>
              </div>
              <div className="rd-form-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">工时(小时)</label>
                  <input
                    className="rd-form-input"
                    value={record.hours}
                    readOnly
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">技工</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={Number(record.skilled_count) || 0}
                    onChange={(e) => handleChange(record.id, 'skilled_count', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">普工</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={Number(record.general_count) || 0}
                    onChange={(e) => handleChange(record.id, 'general_count', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    min={0}
                    step={1}
                  />
                </div>
              </div>
              <div className="rd-form-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">劳务工</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={Number(record.labor_count) || 0}
                    onChange={(e) => handleChange(record.id, 'labor_count', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">其他</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={Number(record.other_count) || 0}
                    onChange={(e) => handleChange(record.id, 'other_count', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">总人数</label>
                  <input
                    className="rd-form-input"
                    value={record.total_people}
                    readOnly
                  />
                </div>
              </div>
              <div className="rd-form-item">
                <label className="rd-form-label">总工时</label>
                <input
                  className="rd-form-input"
                  value={record.man_hours}
                  readOnly
                />
              </div>
              <div className="rd-form-item">
                <label className="rd-form-label">备注</label>
                <textarea
                  className="rd-form-input"
                  style={{ height: 48, paddingTop: 6 }}
                  value={record.remarks || ''}
                  onChange={(e) => handleChange(record.id, 'remarks', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="rd-list-item-body">
              <div className="rd-list-row">
                <span className="rd-list-label">开始时间</span>
                <span className="rd-list-value">{formatDateTime(reportTime)}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">结束时间</span>
                <span className="rd-list-value">
                  {(reportStatus === '完工' || reportStatus === 1) && reportFinishTime
                    ? formatDateTime(reportFinishTime)
                    : '进行中'}
                </span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">工时(小时)</span>
                <span className="rd-list-value">{record.hours}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">技工</span>
                <span className="rd-list-value">{Number(record.skilled_count) || 0}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">普工</span>
                <span className="rd-list-value">{Number(record.general_count) || 0}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">劳务工</span>
                <span className="rd-list-value">{Number(record.labor_count) || 0}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">其他</span>
                <span className="rd-list-value">{Number(record.other_count) || 0}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">总人数</span>
                <span className="rd-list-value">{record.total_people}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">总工时</span>
                <span className="rd-list-value">{record.man_hours}</span>
              </div>
              {record.remarks && (
                <div className="rd-list-row">
                  <span className="rd-list-label">备注</span>
                  <span className="rd-list-value">{record.remarks}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
