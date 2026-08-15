import React, { useState } from 'react'
import { genTempId } from './shared'
import { Button, Dialog, Toast } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline } from 'antd-mobile-icons'
import api from '../../../../utils/api'
import DefectSelect from './DefectSelect'
import ImageManagerModal from './ImageManagerModal'

export default function DefectTab({ list, setList, options, isEditable, category, reportOrderId, reportNo, processId, processes, onProcessChange, showProcess, onDataSaved, onDirty }) {
  const [saving, setSaving] = useState(false)
  const [imgModal, setImgModal] = useState({ visible: false, recordId: null })

  const handleAdd = () => {
    setList(prev => [{
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      defect_type_id: null,
      defect_qty: '',
      defect_unit: '',
      images: [],
    }, ...prev])
  }

  const handleSave = async () => {
    if (!isEditable) return
    const hasEmpty = list.some(d => !d.defect_type_id && !d.defect_qty && !d.defect_unit && (!d.images || d.images.length === 0))
    if (hasEmpty) {
      Toast.show({ icon: 'fail', content: '存在空白记录，请填写或删除后保存' })
      return
    }
    const invalidType = list.filter(d => d.defect_qty || d.defect_unit || (d.images && d.images.length > 0) ? !d.defect_type_id : false)
    if (invalidType.length > 0) {
      Toast.show({ icon: 'fail', content: `有 ${invalidType.length} 条记录请选择不良项目` })
      return
    }
    const invalidQty = list.filter(d => d.defect_type_id && (!d.defect_qty || Number(d.defect_qty) <= 0))
    if (invalidQty.length > 0) {
      Toast.show({ icon: 'fail', content: `有 ${invalidQty.length} 条记录数量必须大于0` })
      return
    }
    const valid = list.filter(d => d.defect_type_id && d.defect_qty && Number(d.defect_qty) > 0)
    if (valid.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录' })
      return
    }
    setSaving(true)
    try {
      const url = category === 'defect' ? '/production/process-defects' : '/production/scrap-defects'
      for (const d of valid) {
        const payload = {
          report_order_id: d.report_order_id,
          process_id: d.process_id,
          defect_type_id: d.defect_type_id,
          defect_qty: Number(d.defect_qty),
          defect_unit: d.defect_unit || '',
          images: d.images || [],
        }
        if (d.defect_id) {
          await api.put(`${url}/${d.defect_id}`, payload)
        } else {
          await api.post(url, payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get(url, { params: { report_order_id: reportOrderId, process_id: processId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(d => ({ ...d, id: d.defect_id || genTempId(), images: d.images || [] })))
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
      if (d.defect_id) {
        const url = category === 'defect' ? '/production/process-defects' : '/production/scrap-defects'
        await api.delete(`${url}/${d.defect_id}`)
      }
      setList(prev => prev.filter(x => x.id !== d.id))
      Toast.show({ icon: 'success', content: '已删除' })
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '删除失败' })
    }
  }

  const openImgModal = (recordId) => {
    setImgModal({ visible: true, recordId })
  }

  const closeImgModal = () => {
    setImgModal({ visible: false, recordId: null })
  }

  const handleModalUpload = (uploaded) => {
    const recordId = imgModal.recordId
    if (!recordId) return
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      return { ...item, images: [...(item.images || []), ...uploaded] }
    }))
  }

  const handleModalRemove = (imageIndex) => {
    const recordId = imgModal.recordId
    if (!recordId) return
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const images = [...(item.images || [])]
      images.splice(imageIndex, 1)
      return { ...item, images }
    }))
  }

  const currentRecord = list.find(r => r.id === imgModal.recordId)
  const currentImages = currentRecord?.images || []

  const handleChangeDefect = (recordId, field, value) => {
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
      <div className="rd-toolbar">
        {showProcess && (
          <select
            className="rd-process-select"
            value={processId || ''}
            onChange={(e) => onProcessChange && onProcessChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">请选择工序</option>
            {processes.map(p => (
              <option key={p.process_id} value={p.process_id}>{p.process_name}</option>
            ))}
          </select>
        )}
        {isEditable && (
          <div className="rd-toolbar-btns">
            <Button fill="outline" size="small" onClick={handleSave} loading={saving}>
              <CheckOutline /> 保存
            </Button>
            <Button color="primary" size="small" onClick={handleAdd}>
              <AddOutline /> 添加
            </Button>
          </div>
        )}
      </div>

      {list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => (
        <div key={record.id} className="rd-list-item">
          <div className="rd-list-item-header">
            <span className="rd-list-item-title">
              {record.defect_code ? `${record.defect_code} ${record.defect_name || ''}` : '新增记录'}
            </span>
            {isEditable && (
              <div className="rd-list-item-actions">
                <div className="rd-img-btn" onClick={() => openImgModal(record.id)}>
                  <PictureOutline color="#2196F3" fontSize={18} />
                  {(record.images || []).length > 0 && (
                    <span className="rd-img-badge">{(record.images || []).length}</span>
                  )}
                </div>
                <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} fontSize={16} />
              </div>
            )}
            {!isEditable && (record.images || []).length > 0 && (
              <div className="rd-img-btn" onClick={() => openImgModal(record.id)}>
                <PictureOutline color="#2196F3" fontSize={18} />
                <span className="rd-img-badge">{(record.images || []).length}</span>
              </div>
            )}
          </div>

          {isEditable ? (
            <div className="rd-list-item-body">
              <div className="rd-form-row">
                <div className="rd-form-item rd-form-item-code">
                  <label className="rd-form-label">不良编码</label>
                  <DefectSelect
                    value={record.defect_type_id}
                    onChange={(val) => handleChangeDefect(record.id, 'defect_type_id', val)}
                    options={options}
                    placeholder="请选择"
                    codeField="defect_code"
                    autoWidth={true}
                    excludeValues={list.filter(r => r.id !== record.id).map(r => r.defect_type_id).filter(Boolean)}
                  />
                </div>
                <div className="rd-form-item rd-form-item-qty">
                  <label className="rd-form-label">数量</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={record.defect_qty ? Math.floor(Number(record.defect_qty)) : ''}
                    onChange={(e) => handleChangeDefect(record.id, 'defect_qty', e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null)}
                    min={1}
                    step={1}
                  />
                </div>
                <div className="rd-form-item rd-form-item-unit">
                  <label className="rd-form-label">单位</label>
                  <select
                    className="rd-form-input"
                    value={record.defect_unit || ''}
                    onChange={(e) => handleChangeDefect(record.id, 'defect_unit', e.target.value)}
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
                <span className="rd-list-label">不良编号</span>
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

      <ImageManagerModal
        visible={imgModal.visible}
        onClose={closeImgModal}
        images={currentImages}
        onUpload={handleModalUpload}
        onRemove={handleModalRemove}
        title="不良记录图片"
        reportNo={reportNo}
        category={category}
      />
    </div>
  )
}
