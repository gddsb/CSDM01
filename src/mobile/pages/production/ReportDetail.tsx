import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Toast, Dialog, Button, Stepper, Input, TextArea, Selector, DatePicker, Switch } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline, DownOutline } from 'antd-mobile-icons'
import api from '../../../utils/api'
import dayjs from 'dayjs'
import './report-detail.css'

const TABS = [
  { key: 'defect', title: '不良记录', needProcess: true },
  { key: 'material', title: '物料记录', needProcess: true },
  { key: 'scrap', title: '检验报废', needProcess: false },
  { key: 'exception', title: '异常工时', needProcess: false },
]

const genTempId = () => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

// 可编辑筛选下拉组件：支持输入文本快速筛选，下拉显示编码+项目，选中后只显示编码
function DefectSelect({ value, onChange, options, placeholder, codeField, nameField, autoWidth, excludeValues = [] }) {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearchText('')
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current.focus(), 50)
    }
  }, [open])

  const selected = options.find(o => o.value === value)
  const codeKey = codeField || 'defect_code'
  const nameKey = nameField || 'defect_name'

  const filteredOptions = options
    .filter(o => o.value === value || !excludeValues.includes(o.value))
    .filter(o => {
      if (!searchText) return true
      const code = String(o[codeKey] || '').toLowerCase()
      const name = String(o[nameKey] || '').toLowerCase()
      const search = searchText.toLowerCase()
      return code.includes(search) || name.includes(search)
    })

  return (
    <div className="rd-defect-select" ref={ref}>
      <div
        className={`rd-defect-select-display ${!selected ? 'placeholder' : ''}`}
        onClick={() => { setOpen(!open); setSearchText('') }}
      >
        {selected ? selected[codeKey] : (placeholder || '请选择')}
        <span className="rd-defect-select-arrow"><DownOutline /></span>
      </div>
      {open && (
        <div className={`rd-defect-select-dropdown ${autoWidth ? 'auto-width' : ''}`}>
          <div className="rd-defect-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="rd-defect-select-search-input"
              placeholder="输入编码或名称筛选..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filteredOptions.length === 0 && (
            <div className="rd-defect-select-option" style={{ color: '#999' }}>无匹配项</div>
          )}
          {filteredOptions.map(o => (
            <div
              key={o.value}
              className={`rd-defect-select-option ${o.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
                setSearchText('')
              }}
            >
              <span className="rd-defect-select-option-code">{o[codeKey]}</span>
              {o.defect_type && <span className="rd-defect-select-option-type">{o.defect_type}</span>}
              <span className="rd-defect-select-option-name">{o[nameKey]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [processes, setProcesses] = useState([])
  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [activeTab, setActiveTab] = useState('defect')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [defectTypes, setDefectTypes] = useState([])
  const [materials, setMaterials] = useState([])
  const [devices, setDevices] = useState([])

  const [prodDefectList, setProdDefectList] = useState([])
  const [scrapList, setScrapList] = useState([])
  const [materialList, setMaterialList] = useState([])
  const [exceptionList, setExceptionList] = useState([])

  const isEditable = report?.status === 0 || report?.status === '0' || report?.status === '开工'
  const currentTabNeedProcess = TABS.find(t => t.key === activeTab)?.needProcess

  // 计算投入数量（第一道工序物料投入总数 - 退回总数）
  const inputQty = (() => {
    if (!report) return 0
    const procs = (report.report_processes || []).slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    if (procs.length === 0) return 0
    const firstProcId = procs[0].process_id
    const mats = (report.process_materials || []).filter(m => m.process_id === firstProcId)
    const inputTotal = mats.filter(m => m.material_type === '投入').reduce((sum, m) => sum + Number(m.quantity || 0), 0)
    const returnTotal = mats.filter(m => m.material_type === '退回').reduce((sum, m) => sum + Number(m.quantity || 0), 0)
    return Math.floor(inputTotal - returnTotal)
  })()

  useEffect(() => {
    Promise.all([
      api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
      api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } }),
      api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
    ]).then(([d, m, dev]) => {
      setDefectTypes(d.data || [])
      setMaterials(m.data || [])
      setDevices(dev.data || [])
    }).catch(() => {})
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/production/report-orders/${id}`)
      setReport(res.data || null)
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取报工单失败' })
    } finally {
      setLoading(false)
    }
  }

  const fetchProcesses = async () => {
    try {
      const res = await api.get(`/production/report-orders/${id}/processes`)
      const procs = res.data || []
      const sorted = [...procs].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      setProcesses(sorted)
      if (sorted.length > 0 && !selectedProcessId) {
        setSelectedProcessId(sorted[0].process_id)
      }
    } catch (err) {
      setProcesses([])
    }
  }

  const fetchProcessData = async () => {
    if (!id || !selectedProcessId) return
    try {
      const [defectRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: id, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_order_id: id, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
      ])
      setProdDefectList((defectRes.data || []).map(d => ({ ...d, id: d.defect_id || genTempId() })))
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.material_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
    }
  }

  const fetchGlobalData = async () => {
    if (!id) return
    try {
      const [scrapRes, exceptionRes] = await Promise.all([
        api.get('/production/scrap-defects', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
      ])
      setScrapList((scrapRes.data || []).filter(d => d.defect_type === '检验报废').map(d => ({ ...d, id: d.scrap_id || genTempId() })))
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
    }
  }

  useEffect(() => {
    fetchReport()
    fetchProcesses()
    fetchGlobalData()
  }, [id])

  useEffect(() => {
    if (id && selectedProcessId) fetchProcessData()
  }, [id, selectedProcessId])

  const defectOptions = defectTypes
    .filter(d => d.category_name === '制程检验类型'
      && d.defect_type !== '检验报废'
      && d.status === '启用')
    .filter(d => {
      const relatedProcesses = Array.isArray(d.related_processes) ? d.related_processes : []
      if (relatedProcesses.length === 0) return true
      return relatedProcesses.includes(selectedProcessId)
    })
    .map(d => ({ label: `${d.defect_code} ${d.defect_name}`, value: d.defect_id, ...d }))

  const scrapOptions = defectTypes
    .filter(d => d.category_name === '制程检验类型'
      && d.defect_type === '检验报废'
      && d.status === '启用')
    .filter(d => {
      const relatedProcesses = Array.isArray(d.related_processes) ? d.related_processes : []
      if (relatedProcesses.length === 0) return true
      return relatedProcesses.includes(selectedProcessId)
    })
    .map(d => ({ label: `${d.defect_code} ${d.defect_name}`, value: d.defect_id, ...d }))

  const materialOptions = materials.map(m => ({
    label: `${m.material_code} ${m.material_name}`,
    value: m.material_id,
    ...m,
  }))

  if (loading) {
    return <div className="mobile-empty">加载中...</div>
  }

  if (!report) {
    return <div className="mobile-empty">报工单不存在</div>
  }

  return (
    <div>
      <div className="mobile-sub-header">
        <div className="mobile-sub-back" onClick={() => navigate(-1)}>‹</div>
        <div className="mobile-sub-title">报工单详情</div>
      </div>

      <div className="mobile-page" style={{ paddingBottom: 0 }}>
        <div className="rd-header-card">
          <div className="rd-header-row">
            <span className="rd-report-no">{report.report_no}</span>
            <span className="rd-header-divider" />
            <span className="rd-label">产线</span>
            <span className="rd-value">{report.line_name || '-'}</span>
            <span className={`rd-status-tag ${report.status === 0 || report.status === '开工' ? 'started' : 'done'}`}>
              {report.status === 0 || report.status === '开工' ? '开工' : '完工'}
            </span>
          </div>
          <div className="rd-header-row">
            <span className="rd-label">料号</span>
            <span className="rd-value">{report.material_code || '-'}</span>
          </div>
          <div className="rd-header-row">
            <span className="rd-label">料品名称</span>
            <span className="rd-value">{report.material_name || '-'}</span>
          </div>
          <div className="rd-header-row rd-qty-row">
            <span className="rd-label">报工数量</span>
            <span className="rd-qty">{Math.floor(Number(report.report_qty) || 0)}</span>
            <span className="rd-label" style={{ marginLeft: 16 }}>投入数量</span>
            <span className="rd-qty">{inputQty}</span>
          </div>
        </div>
      </div>

      <div className="mobile-tabs" style={{ marginTop: 8 }}>
        {TABS.map(t => (
          <div
            key={t.key}
            className={`mobile-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.title}
          </div>
        ))}
      </div>

      <div className="mobile-page" style={{ paddingTop: 12 }}>
        {activeTab === 'defect' && (
          <DefectTab
            list={prodDefectList}
            setList={setProdDefectList}
            options={defectOptions}
            isEditable={isEditable}
            category="defect"
            reportOrderId={id}
            reportNo={report?.report_no}
            processId={selectedProcessId}
            processes={processes}
            onProcessChange={setSelectedProcessId}
            showProcess={currentTabNeedProcess && processes.length > 0}
          />
        )}

        {activeTab === 'material' && (
          <MaterialTab
            list={materialList}
            setList={setMaterialList}
            options={materialOptions}
            isEditable={isEditable}
            reportOrderId={id}
            reportNo={report?.report_no}
            processId={selectedProcessId}
            processes={processes}
            onProcessChange={setSelectedProcessId}
            showProcess={currentTabNeedProcess && processes.length > 0}
          />
        )}

        {activeTab === 'scrap' && (
          <ScrapTab
            list={scrapList}
            setList={setScrapList}
            options={scrapOptions}
            isEditable={isEditable}
            category="defect"
            reportOrderId={id}
            reportNo={report?.report_no}
          />
        )}

        {activeTab === 'exception' && (
          <ExceptionTab
            list={exceptionList}
            setList={setExceptionList}
            devices={devices}
            isEditable={isEditable}
            reportOrderId={id}
            reportNo={report?.report_no}
            reportTime={report.report_time}
          />
        )}
      </div>
    </div>
  )
}

function DefectTab({ list, setList, options, isEditable, category, reportOrderId, reportNo, processId, processes, onProcessChange, showProcess }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = () => {
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      defect_type_id: null,
      defect_qty: '',
      defect_unit: '',
      images: [],
    }])
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

  const handleImageUpload = async (recordId) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return
      if (!reportNo) {
        Toast.show({ icon: 'fail', content: '报工单号不存在，无法上传' })
        return
      }
      try {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        const res = await api.post(`/production/report-images/${reportNo}/${category}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const uploaded = res.data || []
        if (uploaded.length > 0) {
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
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const images = [...(item.images || [])]
      images.splice(imageIndex, 1)
      return { ...item, images }
    }))
  }

  const handleChangeDefect = (recordId, field, value) => {
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      if (field === 'defect_type_id') {
        const opt = options.find(o => o.value === value)
        if (opt) {
          next.defect_unit = opt.defect_unit || ''
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
                <PictureOutline color="#2196F3" onClick={() => handleImageUpload(record.id)} fontSize={18} />
                <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} fontSize={16} />
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
                    value={record.defect_qty || ''}
                    onChange={(e) => handleChangeDefect(record.id, 'defect_qty', e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                    min={1}
                    step={1}
                  />
                </div>
                <div className="rd-form-item rd-form-item-unit">
                  <label className="rd-form-label">单位</label>
                  <input
                    className="rd-form-input"
                    value={record.defect_unit || ''}
                    onChange={(e) => handleChangeDefect(record.id, 'defect_unit', e.target.value)}
                  />
                </div>
              </div>
              {(record.images || []).length > 0 && (
                <div className="rd-image-list">
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
                <span className="rd-list-label">不良编号</span>
                <span className="rd-list-value">{record.defect_code || '-'}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">数量</span>
                <span className="rd-list-value">{record.defect_qty || 0} {record.defect_unit || ''}</span>
              </div>
              <div className="rd-list-row">
                <span className="rd-list-label">单位</span>
                <span className="rd-list-value">{record.defect_unit || '-'}</span>
              </div>
              {(record.images || []).length > 0 && (
                <div className="rd-image-list">
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

function MaterialTab({ list, setList, options, isEditable, reportOrderId, reportNo, processId, processes, onProcessChange, showProcess }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = () => {
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      bas_material_id: null,
      material_batch: '',
      package_no: '',
      quantity: '',
      images: [],
    }])
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
          material_type: '投入',
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

  const handleImageUpload = async (recordId) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return
      if (!reportNo) {
        Toast.show({ icon: 'fail', content: '报工单号不存在，无法上传' })
        return
      }
      try {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        const res = await api.post(`/production/report-images/${reportNo}/label/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const uploaded = res.data || []
        if (uploaded.length > 0) {
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
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const images = [...(item.images || [])]
      images.splice(imageIndex, 1)
      return { ...item, images }
    }))
  }

  const handleChangeMaterial = (recordId, field, value) => {
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      if (field === 'bas_material_id') {
        const opt = options.find(o => o.value === value)
        if (opt) {
          next.material_code = opt.material_code
          next.material_name = opt.material_name
          next.specification = opt.specification
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
              {record.material_code ? `${record.material_code} ${record.material_name || ''}` : '新增记录'}
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
              <div className="rd-form-row rd-material-same-row">
                <div className="rd-form-item">
                  <label className="rd-form-label">料号</label>
                  <DefectSelect
                    value={record.bas_material_id}
                    onChange={(val) => handleChangeMaterial(record.id, 'bas_material_id', val)}
                    options={options}
                    placeholder="请选择"
                    codeField="material_code"
                    nameField="material_name"
                    autoWidth={true}
                  />
                </div>
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
                <div className="rd-form-item rd-form-item-qty">
                  <label className="rd-form-label">数量</label>
                  <input
                    type="number"
                    className="rd-form-input"
                    value={record.quantity || ''}
                    onChange={(e) => handleChangeMaterial(record.id, 'quantity', e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                    min={1}
                    step={1}
                  />
                </div>
              </div>
              {(record.images || []).length > 0 && (
                <div className="rd-image-list">
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
                <span className="rd-list-label">料号</span>
                <span className="rd-list-value">{record.material_code || '-'}</span>
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
              {(record.images || []).length > 0 && (
                <div className="rd-image-list">
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

function ScrapTab({ list, setList, options, isEditable, category, reportOrderId }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    await handleSave()
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      defect_type_id: null,
      defect_qty: 0,
      defect_unit: '',
    }])
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
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      if (field === 'defect_type_id') {
        const opt = options.find(o => o.value === value)
        if (opt) {
          next.defect_unit = opt.defect_unit || ''
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
                    value={record.defect_qty || 0}
                    onChange={(e) => handleChange(record.id, 'defect_qty', Math.floor(Number(e.target.value)) || 0)}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="rd-form-item">
                  <label className="rd-form-label">单位</label>
                  <input
                    className="rd-form-input"
                    value={record.defect_unit || ''}
                    onChange={(e) => handleChange(record.id, 'defect_unit', e.target.value)}
                  />
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

function ExceptionTab({ list, setList, devices, isEditable, reportOrderId, reportNo, reportTime }) {
  const [saving, setSaving] = useState(false)
  const exceptionCategories = ['换型换线', '停机待料', '故障维修', '其它停机']

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
      const files = Array.from(e.target.files || [])
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
                  {record.start_time ? dayjs(record.start_time).format('HH:mm') : '-'} ~ {record.end_time ? dayjs(record.end_time).format('HH:mm') : '-'}
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
