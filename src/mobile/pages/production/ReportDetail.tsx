import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Toast, Dialog, Button, Stepper, Input, TextArea, Selector, DatePicker, Switch } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline } from 'antd-mobile-icons'
import api from '../../../utils/api'
import dayjs from 'dayjs'
import './report-detail.css'

// 5 大页签
const TABS = [
  { key: 'defect', title: '制程不良' },
  { key: 'scrap', title: '检验报废' },
  { key: 'material', title: '生产物料' },
  { key: 'exception', title: '异常工时' },
  { key: 'manpower', title: '人员工时' },
]

const genTempId = () => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

export default function ReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [processes, setProcesses] = useState([])
  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [activeTab, setActiveTab] = useState('defect')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // 基础数据
  const [defectTypes, setDefectTypes] = useState([])
  const [materials, setMaterials] = useState([])
  const [devices, setDevices] = useState([])

  // 5 大页签列表数据
  const [prodDefectList, setProdDefectList] = useState([])
  const [scrapList, setScrapList] = useState([])
  const [materialList, setMaterialList] = useState([])
  const [exceptionList, setExceptionList] = useState([])
  const [manpowerList, setManpowerList] = useState([])

  const isEditable = report?.status === 0 || report?.status === '0' || report?.status === '开工'

  // 加载基础数据
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

  const fetchAllData = async () => {
    if (!id || !selectedProcessId) return
    try {
      const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: id, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_order_id: id, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
      ])
      setProdDefectList((defectRes.data || []).map(d => ({ ...d, id: d.defect_id || genTempId() })))
      setScrapList((scrapRes.data || []).map(d => ({ ...d, id: d.scrap_id || genTempId() })))
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id || genTempId() })))
      setManpowerList((manpowerRes.data || []).map(m => ({ ...m, id: m.record_id || genTempId() })))
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.material_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
    }
  }

  useEffect(() => {
    fetchReport()
    fetchProcesses()
  }, [id])

  useEffect(() => {
    if (id && selectedProcessId) fetchAllData()
  }, [id, selectedProcessId])

  // 完工
  const handleFinish = async () => {
    const confirmed = await Dialog.confirm({
      title: '确认完工',
      content: '完工后数据将变为只读，确认完工？',
    })
    if (!confirmed) return
    setFinishing(true)
    try {
      await api.post(`/production/report-orders/${id}/finish`)
      Toast.show({ icon: 'success', content: '已完工' })
      fetchReport()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '完工失败' })
    } finally {
      setFinishing(false)
    }
  }

  // 下拉数据：制程不良（制程不良/来料不良）
  const defectOptions = defectTypes
    .filter(d => (d.category_name === '制程检验类' || d.category_name === '制程检验类型')
      && (d.defect_type === '制程不良' || d.defect_type === '来料不良')
      && d.status === '启用' && d.display !== false && d.display !== 0)
    .map(d => ({ label: `${d.defect_code} ${d.defect_name}`, value: d.defect_id, ...d }))

  const scrapOptions = defectTypes
    .filter(d => (d.category_name === '制程检验类' || d.category_name === '制程检验类型')
      && d.defect_type === '检验报废'
      && d.status === '启用' && d.display !== false && d.display !== 0)
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
      {/* 顶部返回栏 */}
      <div className="mobile-sub-header">
        <div className="mobile-sub-back" onClick={() => navigate(-1)}>‹</div>
        <div className="mobile-sub-title">报工单详情</div>
      </div>

      {/* 报工单基本信息 */}
      <div className="mobile-page" style={{ paddingBottom: 0 }}>
        <div className="mobile-detail-grid">
          <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#212121' }}>{report.report_no}</div>
            <span className={`mobile-status-tag ${report.status === 0 || report.status === '开工' ? 'started' : 'done'}`}
              style={{
                background: report.status === 0 || report.status === '开工' ? '#f6ffed' : '#f0f0f0',
                color: report.status === 0 || report.status === '开工' ? '#52c41a' : '#595959',
              }}>
              {report.status === 0 || report.status === '开工' ? '开工' : '完工'}
            </span>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">订单号</div>
            <div className="mobile-detail-value">{report.order_no || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">料品</div>
            <div className="mobile-detail-value">{report.material_name || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">报工数</div>
            <div className="mobile-detail-value" style={{ fontWeight: 600, color: '#2196F3' }}>{report.report_qty || 0}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">产线</div>
            <div className="mobile-detail-value">{report.line_name || '-'}</div>
          </div>
        </div>

        {/* 工序选择 */}
        {processes.length > 0 && (
          <div className="mobile-filter-chips" style={{ background: '#fff', padding: '8px 12px', margin: 0 }}>
            {processes.map(p => (
              <div
                key={p.process_id}
                className={`mobile-filter-chip ${String(selectedProcessId) === String(p.process_id) ? 'active' : ''}`}
                onClick={() => setSelectedProcessId(p.process_id)}
              >
                {p.process_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5 大页签 */}
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
        {/* 制程不良记录 */}
        {activeTab === 'defect' && (
          <DefectTab
            list={prodDefectList}
            setList={setProdDefectList}
            options={defectOptions}
            isEditable={isEditable}
            category="defect"
            reportOrderId={id}
            processId={selectedProcessId}
          />
        )}

        {/* 检验报废记录 */}
        {activeTab === 'scrap' && (
          <DefectTab
            list={scrapList}
            setList={setScrapList}
            options={scrapOptions}
            isEditable={isEditable}
            category="scrap"
            reportOrderId={id}
            processId={selectedProcessId}
          />
        )}

        {/* 生产物料记录 */}
        {activeTab === 'material' && (
          <MaterialTab
            list={materialList}
            setList={setMaterialList}
            options={materialOptions}
            isEditable={isEditable}
            reportOrderId={id}
            processId={selectedProcessId}
          />
        )}

        {/* 异常工时记录 */}
        {activeTab === 'exception' && (
          <ExceptionTab
            list={exceptionList}
            setList={setExceptionList}
            devices={devices}
            isEditable={isEditable}
            reportOrderId={id}
            reportTime={report.report_time}
          />
        )}

        {/* 人员工时记录 */}
        {activeTab === 'manpower' && (
          <ManpowerTab
            list={manpowerList}
            setList={setManpowerList}
            isEditable={isEditable}
            reportOrderId={id}
            report={report}
          />
        )}
      </div>

      {/* 底部完工按钮 */}
      {isEditable && (
        <div style={{ padding: '12px 16px 24px', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
          <Button
            block
            color="primary"
            size="large"
            loading={finishing}
            onClick={handleFinish}
            style={{ borderRadius: 8, height: 44 }}
          >
            完工
          </Button>
        </div>
      )}
    </div>
  )
}

/* ====================== 制程不良 / 检验报废 共用组件 ====================== */
function DefectTab({ list, setList, options, isEditable, category, reportOrderId, processId }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    // 添加前先保存
    await handleSave()
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      defect_type_id: null,
      defect_qty: 0,
      defect_unit: '',
      description: '',
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
      const url = category === 'defect' ? '/production/process-defects' : '/production/scrap-defects'
      for (const d of valid) {
        const payload = {
          report_order_id: d.report_order_id,
          process_id: d.process_id,
          defect_type_id: d.defect_type_id,
          defect_qty: d.defect_qty,
          defect_unit: d.defect_unit || '',
          description: d.description || '',
        }
        if (d.defect_id) {
          await api.put(`${url}/${d.defect_id}`, payload)
        } else {
          await api.post(url, payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      // 重新加载
      const res = await api.get(url, { params: { report_order_id: reportOrderId, process_id: processId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(d => ({ ...d, id: d.defect_id || d.scrap_id || genTempId() })))
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

  const handleChange = (recordId, field, value) => {
    setList(prev => prev.map(item => {
      if (item.id !== recordId) return item
      const next = { ...item, [field]: value }
      // 选择不良项目时自动填充单位
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button block color="primary" fill="outline" size="small" onClick={handleSave} loading={saving}>
            <CheckOutline /> 保存
          </Button>
          <Button block color="primary" size="small" onClick={handleAdd}>
            <AddOutline /> 添加
          </Button>
        </div>
      )}

      {list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => (
        <div key={record.id} className="mobile-card">
          <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#424242' }}>
              {record.defect_code ? `${record.defect_code} ${record.defect_name || ''}` : '新增记录'}
            </span>
            {isEditable && (
              <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} />
            )}
          </div>

          {isEditable ? (
            <>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">不良项目</label>
                <select
                  className="mobile-form-input"
                  value={record.defect_type_id || ''}
                  onChange={(e) => handleChange(record.id, 'defect_type_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">请选择</option>
                  {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">数量</label>
                <input
                  type="number"
                  className="mobile-form-input"
                  value={record.defect_qty || 0}
                  onChange={(e) => handleChange(record.id, 'defect_qty', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label">单位</label>
                <input
                  className="mobile-form-input"
                  value={record.defect_unit || ''}
                  onChange={(e) => handleChange(record.id, 'defect_unit', e.target.value)}
                />
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label">备注</label>
                <textarea
                  className="mobile-form-input"
                  style={{ height: 60, paddingTop: 8 }}
                  value={record.description || ''}
                  onChange={(e) => handleChange(record.id, 'description', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mobile-card-row">
                <span className="mobile-card-label">数量</span>
                <span className="mobile-card-value">{record.defect_qty || 0} {record.defect_unit || ''}</span>
              </div>
              {record.description && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">备注</span>
                  <span className="mobile-card-value">{record.description}</span>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/* ====================== 生产物料组件 ====================== */
function MaterialTab({ list, setList, options, isEditable, reportOrderId, processId }) {
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    await handleSave()
    setList(prev => [...prev, {
      id: genTempId(),
      report_order_id: Number(reportOrderId),
      process_id: processId,
      bas_material_id: null,
      material_batch: '',
      quantity: 0,
    }])
  }

  const handleSave = async () => {
    if (!isEditable) return
    const valid = list.filter(m => m.bas_material_id && m.material_batch && m.quantity > 0)
    if (valid.length === 0) {
      Toast.show({ icon: 'fail', content: '没有需要保存的记录，请填写料号/批号/数量' })
      return
    }
    setSaving(true)
    try {
      for (const m of valid) {
        const payload = {
          report_order_id: m.report_order_id,
          process_id: m.process_id,
          bas_material_id: m.bas_material_id,
          material_batch: m.material_batch,
          quantity: m.quantity,
        }
        if (m.material_id) {
          await api.put(`/production/process-materials/${m.material_id}`, payload)
        } else {
          await api.post('/production/process-materials', payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get('/production/process-materials', { params: { report_order_id: reportOrderId, process_id: processId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(m => ({ ...m, id: m.material_id || genTempId() })))
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

  const handleChange = (recordId, field, value) => {
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
      {isEditable && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button block color="primary" fill="outline" size="small" onClick={handleSave} loading={saving}>
            <CheckOutline /> 保存
          </Button>
          <Button block color="primary" size="small" onClick={handleAdd}>
            <AddOutline /> 添加
          </Button>
        </div>
      )}

      {list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => (
        <div key={record.id} className="mobile-card">
          <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#424242' }}>
              {record.material_code ? `${record.material_code} ${record.material_name || ''}` : '新增记录'}
            </span>
            {isEditable && <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} />}
          </div>

          {isEditable ? (
            <>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">料号</label>
                <select
                  className="mobile-form-input"
                  value={record.bas_material_id || ''}
                  onChange={(e) => handleChange(record.id, 'bas_material_id', e.target.value || null)}
                >
                  <option value="">请选择</option>
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">批号</label>
                <input
                  className="mobile-form-input"
                  value={record.material_batch || ''}
                  onChange={(e) => handleChange(record.id, 'material_batch', e.target.value)}
                />
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">数量</label>
                <input
                  type="number"
                  className="mobile-form-input"
                  value={record.quantity || 0}
                  onChange={(e) => handleChange(record.id, 'quantity', Number(e.target.value))}
                  min={1}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mobile-card-row">
                <span className="mobile-card-label">料品主键</span>
                <span className="mobile-card-value" style={{ whiteSpace: 'nowrap' }}>{record.bas_material_id || '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">批号</span>
                <span className="mobile-card-value">{record.material_batch || '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">数量</span>
                <span className="mobile-card-value">{record.quantity || 0}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/* ====================== 异常工时组件 ====================== */
function ExceptionTab({ list, setList, devices, isEditable, reportOrderId, reportTime }) {
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
        }
        if (e.exception_id) {
          await api.put(`/production/process-exceptions/${e.exception_id}`, payload)
        } else {
          await api.post('/production/process-exceptions', payload)
        }
      }
      Toast.show({ icon: 'success', content: `已保存 ${valid.length} 条记录` })
      const res = await api.get('/production/process-exceptions', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(e => ({ ...e, id: e.exception_id || genTempId() })))
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
    setList(prev => prev.map(item => item.id === recordId ? { ...item, [field]: value } : item))
  }

  const handleTimeChange = (recordId, field, value) => {
    if (!value) {
      handleChange(recordId, field, null)
      return
    }
    // 用报工时间的日期 + 用户选择的时分，避免跨天错乱
    const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    const timeStr = dayjs(value).format('HH:mm:ss')
    const newTime = `${baseDate}T${timeStr}`

    // 禁止未来时间
    if (dayjs(newTime).isAfter(dayjs())) {
      Toast.show({ icon: 'fail', content: '不能选择未来时间' })
      return
    }

    // 区间校验
    const record = list.find(r => r.id === recordId)
    if (field === 'start_time' && record?.end_time && dayjs(newTime).isAfter(dayjs(record.end_time))) {
      Toast.show({ icon: 'fail', content: '开始时间不能晚于结束时间' })
      return
    }
    if (field === 'end_time' && record?.start_time && dayjs(newTime).isBefore(dayjs(record.start_time))) {
      Toast.show({ icon: 'fail', content: '结束时间不能早于开始时间' })
      return
    }

    // 区间重叠校验
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button block color="primary" fill="outline" size="small" onClick={handleSave} loading={saving}>
            <CheckOutline /> 保存
          </Button>
          <Button block color="primary" size="small" onClick={handleAdd}>
            <AddOutline /> 添加
          </Button>
        </div>
      )}

      {list.length === 0 && <div className="mobile-empty">暂无记录</div>}

      {list.map(record => (
        <div key={record.id} className="mobile-card">
          <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#424242' }}>
              {record.exception_type || '新增记录'}
            </span>
            {isEditable && <DeleteOutline color="#f5222d" onClick={() => handleDelete(record)} />}
          </div>

          {isEditable ? (
            <>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">异常类型</label>
                <select
                  className="mobile-form-input"
                  value={record.exception_type || ''}
                  onChange={(e) => handleChange(record.id, 'exception_type', e.target.value)}
                >
                  <option value="">请选择</option>
                  {exceptionCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label">设备</label>
                <select
                  className="mobile-form-input"
                  value={record.device_id || ''}
                  onChange={(e) => handleChange(record.id, 'device_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">无</option>
                  {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.device_name}</option>)}
                </select>
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label required">开始时间</label>
                <input
                  type="time"
                  className="mobile-form-input"
                  value={record.start_time ? dayjs(record.start_time).format('HH:mm') : ''}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
                    handleTimeChange(record.id, 'start_time', new Date(`${baseDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`))
                  }}
                />
              </div>
              <div className="mobile-form-item">
                <label className="mobile-form-label">结束时间</label>
                <input
                  type="time"
                  className="mobile-form-input"
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
              <div className="mobile-form-item">
                <label className="mobile-form-label">异常描述</label>
                <textarea
                  className="mobile-form-input"
                  style={{ height: 60, paddingTop: 8 }}
                  value={record.description || ''}
                  onChange={(e) => handleChange(record.id, 'description', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mobile-card-row">
                <span className="mobile-card-label">开始时间</span>
                <span className="mobile-card-value">{record.start_time ? dayjs(record.start_time).format('MM-DD HH:mm') : '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">结束时间</span>
                <span className="mobile-card-value">{record.end_time ? dayjs(record.end_time).format('MM-DD HH:mm') : '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">时长(小时)</span>
                <span className="mobile-card-value">{record.duration || 0}</span>
              </div>
              {record.description && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">描述</span>
                  <span className="mobile-card-value">{record.description}</span>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/* ====================== 人员工时组件 ====================== */
function ManpowerTab({ list, setList, isEditable, reportOrderId, report }) {
  const [saving, setSaving] = useState(false)

  // 开工状态：结束时间用当前时间；完工状态：用 finish_time
  const isFinished = !(report?.status === 0 || report?.status === '0' || report?.status === '开工')
  const endTime = isFinished ? report?.finish_time : new Date()
  const startTime = report?.report_time
  const hours = startTime && endTime
    ? Number(((dayjs(endTime).valueOf() - dayjs(startTime).valueOf()) / 3600000).toFixed(2))
    : 0

  const record = list[0] // 每个报工单只有一条人员工时记录
  const totalPeople = record
    ? (Number(record.skilled_count) || 0) + (Number(record.general_count) || 0) + (Number(record.labor_count) || 0) + (Number(record.other_count) || 0)
    : 0
  const manHours = Number((hours * totalPeople).toFixed(2))

  const handleChange = (field, value) => {
    if (!record) return
    setList(prev => prev.map(item => item.id === record.id ? { ...item, [field]: value } : item))
  }

  const handleSave = async () => {
    if (!record) return
    if (!record.record_id) {
      Toast.show({ icon: 'fail', content: '记录不存在' })
      return
    }
    setSaving(true)
    try {
      await api.put(`/production/manpower-records/${record.record_id}`, {
        skilled_count: record.skilled_count || 0,
        general_count: record.general_count || 0,
        labor_count: record.labor_count || 0,
        other_count: record.other_count || 0,
        shift: record.shift || '白班',
      })
      Toast.show({ icon: 'success', content: '保存成功' })
      const res = await api.get('/production/manpower-records', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } })
      setList((res.data || []).map(m => ({ ...m, id: m.record_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  if (!record) {
    return <div className="mobile-empty">暂无人员工时记录</div>
  }

  return (
    <div>
      {/* 工时信息（自动计算） */}
      <div className="mobile-card" style={{ background: '#e6f4ff', borderColor: '#91caff' }}>
        <div className="mobile-card-row">
          <span className="mobile-card-label">开始时间</span>
          <span className="mobile-card-value">{startTime ? dayjs(startTime).format('MM-DD HH:mm') : '-'}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">结束时间</span>
          <span className="mobile-card-value">
            {isFinished
              ? (endTime ? dayjs(endTime).format('MM-DD HH:mm') : '-')
              : <span style={{ color: '#52c41a' }}>进行中</span>}
          </span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">已投入工时</span>
          <span className="mobile-card-value" style={{ fontWeight: 600, color: '#2196F3' }}>{hours} 小时</span>
        </div>
      </div>

      {/* 人员录入 */}
      <div className="mobile-card">
        <div className="mobile-form-item">
          <label className="mobile-form-label">班次</label>
          <select
            className="mobile-form-input"
            value={record.shift || '白班'}
            onChange={(e) => handleChange('shift', e.target.value)}
            disabled={!isEditable}
          >
            <option value="白班">白班</option>
            <option value="夜班">夜班</option>
          </select>
        </div>
        <div className="mobile-form-item">
          <label className="mobile-form-label">技工人数</label>
          <input
            type="number"
            className="mobile-form-input"
            value={record.skilled_count || 0}
            onChange={(e) => handleChange('skilled_count', Number(e.target.value))}
            min={0}
            disabled={!isEditable}
          />
        </div>
        <div className="mobile-form-item">
          <label className="mobile-form-label">普工人数</label>
          <input
            type="number"
            className="mobile-form-input"
            value={record.general_count || 0}
            onChange={(e) => handleChange('general_count', Number(e.target.value))}
            min={0}
            disabled={!isEditable}
          />
        </div>
        <div className="mobile-form-item">
          <label className="mobile-form-label">劳务工人数</label>
          <input
            type="number"
            className="mobile-form-input"
            value={record.labor_count || 0}
            onChange={(e) => handleChange('labor_count', Number(e.target.value))}
            min={0}
            disabled={!isEditable}
          />
        </div>
        <div className="mobile-form-item">
          <label className="mobile-form-label">其他人数</label>
          <input
            type="number"
            className="mobile-form-input"
            value={record.other_count || 0}
            onChange={(e) => handleChange('other_count', Number(e.target.value))}
            min={0}
            disabled={!isEditable}
          />
        </div>

        <div style={{
          background: '#f5f6f8', borderRadius: 6, padding: 10, marginTop: 8,
          display: 'flex', justifyContent: 'space-between', fontSize: 13,
        }}>
          <span style={{ color: '#757575' }}>总人数 / 总工时</span>
          <span style={{ fontWeight: 600, color: '#2196F3' }}>
            {totalPeople} 人 / {manHours} 工时
          </span>
        </div>
      </div>

      {isEditable && (
        <Button
          block
          color="primary"
          size="large"
          loading={saving}
          onClick={handleSave}
          style={{ borderRadius: 8, height: 44, marginTop: 12 }}
        >
          保存
        </Button>
      )}
    </div>
  )
}
