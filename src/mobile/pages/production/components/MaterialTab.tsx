import React, { useState } from 'react'
import { genTempId } from './shared'
import { Button, Dialog, Toast } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline } from 'antd-mobile-icons'
import api from '../../../../utils/api'
import DefectSelect from './DefectSelect'
import ImageManagerModal from './ImageManagerModal'

export default function MaterialTab({ list, setList, options, isEditable, reportOrderId, reportNo, processId, processes, onProcessChange, showProcess, onDataSaved, onDirty }) {
  const [saving, setSaving] = useState(false)
  const [imgModal, setImgModal] = useState({ visible: false, recordId: null })

  const currentProcess = processes.find(p => p.process_id === processId)
  const hasMaterial = currentProcess ? (currentProcess.has_material === 1 || currentProcess.has_material === true) : true
  const currentProcessCode = currentProcess?.process_code || ''

  const MATERIAL_PREFIX_RULES = {
    'P-01': ['T', 'Y20', 'D1'],
    'P-06': ['P2', 'P', 'P4'],
    'P-10': ['B'],
  }

  const filterOptionsByProcess = (opts, procCode) => {
    const prefixes = MATERIAL_PREFIX_RULES[procCode]
    if (!prefixes || prefixes.length === 0) return opts
    return opts.filter(o => {
      const code = o.material_code || ''
      return prefixes.some(p => code.startsWith(p))
    })
  }

  const filteredOptions = filterOptionsByProcess(options, currentProcessCode)

  const handleAdd = () => {
    if (!hasMaterial) {
      Toast.show({ icon: 'fail', content: '当前工序不允许引入物料' })
      return
    }
    setList(prev => [{
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      material_type: '投入',
      bas_material_id: null,
      material_batch: '',
      package_no: '',
      quantity: '',
      images: [],
    }, ...prev])
  }

  const handleSave = async () => {
    if (!isEditable) return
    const hasEmpty = list.some(m => !m.bas_material_id && !m.material_batch && !m.quantity && (!m.images || m.images.length === 0))
    if (hasEmpty) {
      Toast.show({ icon: 'fail', content: '存在空白记录，请填写或删除后保存' })
      return
    }
    const invalidMaterial = list.filter(m => (m.material_batch || m.quantity || (m.images && m.images.length > 0)) ? !m.bas_material_id : false)
    if (invalidMaterial.length > 0) {
      Toast.show({ icon: 'fail', content: `有 ${invalidMaterial.length} 条记录请选择料号` })
      return
    }
    const invalidBatch = list.filter(m => m.bas_material_id && !m.material_batch)
    if (invalidBatch.length > 0) {
      Toast.show({ icon: 'fail', content: `有 ${invalidBatch.length} 条记录批号不能为空` })
      return
    }
    const invalidQty = list.filter(m => m.bas_material_id && (!m.quantity || Number(m.quantity) <= 0))
    if (invalidQty.length > 0) {
      Toast.show({ icon: 'fail', content: `有 ${invalidQty.length} 条记录数量必须大于0` })
      return
    }
    const valid = list.filter(m => m.bas_material_id && m.material_batch && m.quantity && Number(m.quantity) > 0)
    if (valid.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录' })
      return
    }
    setSaving(true)
    try {
      for (const m of valid) {
        const payload = {
          report_order_id: m.report_order_id,
          process_id: m.process_id,
          material_type: m.material_type || '投入',
          bas_material_id: m.bas_material_id,
          material_batch: m.material_batch,
          package_no: m.package_no || '',
          quantity: Math.floor(Number(m.quantity)),
          images: m.images || [],
        }
        if (m.material_id) {
          await api.put(`/production/process-materials/${m.material_id}`, payload)
        } else {
          await api.post('/production/process-materials', payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get('/production/process-materials', { params: { report_order_id: reportOrderId, process_id: processId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(m => ({ ...m, id: m.material_id || genTempId(), images: m.images || [] })))
      onDataSaved && onDataSaved()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m) => {
    const confirmed = await Dialog.confirm({ content: '确认删除该记录？' })
    if (!confirmed) return
    try {
      if (m.material_id) {
        await api.delete(`/production/process-materials/${m.material_id}`)
      }
      setList(prev => prev.filter(x => x.id !== m.id))
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

  const handleChangeMaterial = (recordId, field, value) => {
    onDirty && onDirty(recordId)
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      if (field === 'bas_material_id') {
        const opt = filteredOptions.find(o => o.value === value)
        if (opt) {
          next.material_code = opt.material_code
          next.material_name = opt.material_name
          next.specification = opt.specification
          next.unit_name = opt.unit_name || ''
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
            {hasMaterial && (
              <Button color="primary" size="small" onClick={handleAdd}>
                <AddOutline /> 添加
              </Button>
            )}
          </div>
        )}
      </div>

      {!hasMaterial && <div className="mobile-empty">当前工序不允许引入物料</div>}
      {hasMaterial && list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => {
        const isReturn = record.material_type === '退回' || record.material_type === '退'
        return (
        <div key={record.id} className={`rd-list-item ${isReturn ? 'rd-mat-return' : 'rd-mat-input'}`}>
          <div className="rd-list-item-header">
            <span className="rd-list-item-title">
              {record.material_code ? `${record.material_code} ${record.material_name || ''}` : '新增记录'}
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
              <div className="rd-form-row rd-material-row-1">
                <div className="rd-form-item rd-form-item-type-5">
                  <label className="rd-form-label">类型</label>
                  <select
                    className="rd-form-input"
                    value={record.material_type || '投入'}
                    onChange={(e) => handleChangeMaterial(record.id, 'material_type', e.target.value)}
                  >
                    <option value="投入">投入</option>
                    <option value="退回">退回</option>
                  </select>
                </div>
                <div className="rd-form-item rd-form-item-code-auto">
                  <label className="rd-form-label">料号</label>
                  <DefectSelect
                    value={record.bas_material_id}
                    onChange={(val) => handleChangeMaterial(record.id, 'bas_material_id', val)}
                    options={filteredOptions}
                    placeholder="请选择"
                    codeField="material_code"
                    nameField="material_name"
                    autoWidth={true}
                  />
                </div>
                <div className="rd-form-item rd-form-item-unit-mat">
                  <label className="rd-form-label">单位</label>
                  <input
                    className="rd-form-input"
                    value={record.unit_name || ''}
                    readOnly
                    placeholder="-"
                  />
                </div>
              </div>
              <div className="rd-form-row rd-material-row-2">
                <div className="rd-form-item">
                  <label className="rd-form-label">批号</label>
                  <input
                    className="rd-form-input"
                    value={record.material_batch || ''}
                    onChange={(e) => handleChangeMaterial(record.id, 'material_batch', e.target.value)}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">包号</label>
                  <input
                    className="rd-form-input"
                    value={record.package_no || ''}
                    onChange={(e) => handleChangeMaterial(record.id, 'package_no', e.target.value)}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">数量</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={record.quantity || ''}
                    onChange={(e) => handleChangeMaterial(record.id, 'quantity', e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null)}
                    min={1}
                    step={1}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rd-list-item-body">
              <div className="rd-list-row">
                <span className="rd-list-label">类型</span>
                <span className="rd-list-value">{record.material_type || '投入'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">料号</span>
                <span className="rd-list-value">{record.material_code || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">单位</span>
                <span className="rd-list-value">{record.unit_name || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">批号</span>
                <span className="rd-list-value">{record.material_batch || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">包号</span>
                <span className="rd-list-value">{record.package_no || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">数量</span>
                <span className="rd-list-value">{record.quantity ? Math.floor(Number(record.quantity)) : 0}</span>
              </div>
            </div>
          )}
        </div>
      )})}

      <ImageManagerModal
        visible={imgModal.visible}
        onClose={closeImgModal}
        images={currentImages}
        onUpload={handleModalUpload}
        onRemove={handleModalRemove}
        title="物料记录图片"
        reportNo={reportNo}
        category="material"
      />
    </div>
  )
}
