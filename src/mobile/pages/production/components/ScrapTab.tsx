import React, { useState } from 'react'
import { genTempId } from './shared'
import { Button, Dialog, Toast } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline } from 'antd-mobile-icons'
import api from '../../../../utils/api'
import DefectSelect from './DefectSelect'

export default function ScrapTab({ list, setList, options, isEditable, category, reportOrderId, reportNo, onDataSaved, onDirty }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    await handleSave()
    setList(prev => [{
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      defect_type_id: null,
      defect_qty: 0,
      defect_unit: '',
    }, ...prev])
  }

  const handleSave = async () => {
    if (!isEditable) return
    const valid = list.filter(d => d.defect_type_id && d.defect_qty > 0)
    if (valid.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录' })
      return
    }
    setSaving(true)
    try {
      const url = '/production/scrap-defects'
      for (const d of valid) {
        const payload = {
          report_order_id: d.report_order_id,
          defect_type_id: d.defect_type_id,
          defect_qty: Math.floor(Number(d.defect_qty)),
          defect_unit: d.defect_unit || '',
        }
        if (d.scrap_id) {
          await api.put(`${url}/${d.scrap_id}`, payload)
        } else {
          await api.post(url, payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get(url, { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(d => ({ ...d, id: d.scrap_id || genTempId() })))
      onDataSaved && onDataSaved()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (d) => {
    const confirmed = await Dialog.confirm({ content: '确认删除该记录？' })
    if (!confirmed) return
    try {
      if (d.scrap_id) {
        await api.delete(`/production/scrap-defects/${d.scrap_id}`)
      }
      setList(prev => prev.filter(x => x.id !== d.id))
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
      if (field === 'defect_type_id') {
        const opt = options.find(o => o.value === value)
        if (opt) {
          next.defect_unit = opt.defect_unit || ''
          next.available_units = opt.available_units || []
          next.defect_code = opt.defect_code
          next.defect_name = opt.defect_name
          next.defect_type = opt.defect_type
        }
      }
      return next
    }))
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
              {record.defect_code ? `${record.defect_code} ${record.defect_name || ''}` : '新增记录'}
            </span>
            {isEditable && (
              <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} fontSize={16} />
            )}
          </div>

          {isEditable ? (
            <div className="rd-list-item-body">
              <div className="rd-form-row">
                <div className="rd-form-item rd-form-item-code">
                  <label className="rd-form-label">报废编码</label>
                  <DefectSelect
                    value={record.defect_type_id}
                    onChange={(val) => handleChange(record.id, 'defect_type_id', val)}
                    options={options}
                    placeholder="请选择"
                    codeField="defect_code"
                    autoWidth={true}
                    excludeValues={list.filter(r => r.id !== record.id).map(r => r.defect_type_id).filter(Boolean)}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">数量</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={Math.floor(Number(record.defect_qty) || 0)}
                    onChange={(e) => handleChange(record.id, 'defect_qty', Math.floor(Number(e.target.value)) || 0)}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">单位</label>
                  <select
                    className="rd-form-input"
                    value={record.defect_unit || ''}
                    onChange={(e) => handleChange(record.id, 'defect_unit', e.target.value)}
                  >
                    <option value="">请选择</option>
                    {(record.available_units || []).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="rd-list-item-body">
              <div className="rd-list-row">
                <span className="rd-list-label">报废编码</span>
                <span className="rd-list-value">{record.defect_code || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">数量</span>
                <span className="rd-list-value">{record.defect_qty ? Math.floor(Number(record.defect_qty)) : 0} {record.defect_unit || ''}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">单位</span>
                <span className="rd-list-value">{record.defect_unit || '-'}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
