import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Toast, Dialog, Button, Stepper, Input, TextArea, Selector, DatePicker, Switch } from 'antd-mobile'
import { AddOutline, DeleteOutline, CheckOutline, PictureOutline, DownOutline, CloseOutline } from 'antd-mobile-icons'
import api from '../../../utils/api'
import { formatFilmVersion, formatDateTime, formatTime } from '../../../utils'
import dayjs from 'dayjs'
import './report-detail.css'
import DefectTab from './components/DefectTab'
import MaterialTab from './components/MaterialTab'
import ScrapTab from './components/ScrapTab'
import ExceptionTab from './components/ExceptionTab'
import ManpowerTab from './components/ManpowerTab'

const TABS = [
  { key: 'defect', title: '不良记录', needProcess: true },
  { key: 'material', title: '物料记录', needProcess: true },
  { key: 'scrap', title: '检验报废', needProcess: false },
  { key: 'exception', title: '工时记录', needProcess: false },
  { key: 'manpower', title: '人员记录', needProcess: false },
]

const genTempId = () => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

// 可编辑筛选下拉组件：支持输入文本快速筛选，下拉显示编码+项目，选中后只显示编码

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
  const [closing, setClosing] = useState(false)

  const [defectTypes, setDefectTypes] = useState([])
  const [materials, setMaterials] = useState([])
  const [devices, setDevices] = useState([])

  const [prodDefectList, setProdDefectList] = useState([])
  const [scrapList, setScrapList] = useState([])
  const [materialList, setMaterialList] = useState([])
  const [exceptionList, setExceptionList] = useState([])
  const [manpowerList, setManpowerList] = useState([])

  const [dirtyIds, setDirtyIds] = useState(new Set())

  const markDirty = (id) => {
    if (!id) return
    setDirtyIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const clearDirty = (ids) => {
    setDirtyIds(prev => {
      const next = new Set(prev)
      ;(ids || []).forEach(id => next.delete(id))
      return next
    })
  }

  const isEditable = report?.status === 0 || report?.status === '0' || report?.status === '开工'
  const currentTabNeedProcess = TABS.find(t => t.key === activeTab)?.needProcess

  // 计算投入数量（第一道工序物料投入总数 - 退回总数）
  const inputQty = (() => {
    if (!report) return 0
    const procs = (report.report_processes || []).slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    if (procs.length === 0) return 0
    const firstProcId = procs[0].process_id
    const mats = (report.process_materials || []).filter(m => m.process_id === firstProcId)
    const inputTotal = mats.filter(m => m.material_type === '领' || m.material_type === '投入').reduce((sum, m) => sum + Number(m.quantity || 0), 0)
    const returnTotal = mats.filter(m => m.material_type === '退' || m.material_type === '退回').reduce((sum, m) => sum + Number(m.quantity || 0), 0)
    return Math.floor(inputTotal - returnTotal)
  })()

  // 计算预计产出/合格数量 = 投入 - 不良 - 检验报废
  const expectedOutput = (() => {
    if (!report) return 0
    const getDefectType = (d: any) => {
      if (typeof d.defect_type === 'string') return d.defect_type
      if (d.defect_type?.defect_type) return d.defect_type.defect_type
      return ''
    }
    const defectTotal = (report.process_defects || [])
      .filter(d => getDefectType(d) !== '检验报废')
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0)
    const scrapTotal = scrapList
      .reduce((sum, d) => sum + Number(d.defect_qty || d.quantity || 0), 0)
    return Math.floor(inputQty - defectTotal - scrapTotal)
  })()

  // 来料不良汇总
  const incomingDefectQty = (() => {
    if (!report) return 0
    const getDefectType = (d: any) => {
      if (typeof d.defect_type === 'string') return d.defect_type
      if (d.defect_type?.defect_type) return d.defect_type.defect_type
      return ''
    }
    return (report.process_defects || [])
      .filter(d => getDefectType(d) === '来料不良')
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0)
  })()

  // 制程不良汇总
  const processDefectQty = (() => {
    if (!report) return 0
    const getDefectType = (d: any) => {
      if (typeof d.defect_type === 'string') return d.defect_type
      if (d.defect_type?.defect_type) return d.defect_type.defect_type
      return ''
    }
    return (report.process_defects || [])
      .filter(d => getDefectType(d) === '制程不良')
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0)
  })()

  // 检验报废汇总
  const scrapQty = (() => {
    return scrapList
      .reduce((sum, d) => sum + Number(d.defect_qty || d.quantity || 0), 0)
  })()

  // 异常工时汇总（无结束时间时取当前时间计算）
  const exceptionHours = (() => {
    if (!report) return 0
    const now = Date.now()
    return (report.process_exceptions || [])
      .reduce((sum, e) => {
        const start = e.start_time ? new Date(e.start_time).getTime() : 0
        const end = e.end_time ? new Date(e.end_time).getTime() : now
        if (start > 0 && end > start) {
          return sum + (end - start) / 3600000
        }
        return sum + (Number(e.duration) || 0)
      }, 0)
  })()

  // 人工工时汇总（与PC端一致：优先使用本地manpowerList以实现保存后立即更新，其次使用report.manpower_records）
  const manpowerHours = (() => {
    if (!report) return 0
    const reportStart = report.report_time
    // 优先使用本地manpowerList（保存后立即更新），其次使用report.manpower_records
    const allManpowers = (manpowerList && manpowerList.length > 0)
      ? manpowerList
      : (report.manpower_records || [])
    if (!reportStart || allManpowers.length === 0) return 0
    const start = dayjs(reportStart)
    const end = (report.status === '完工' || report.status === 1) && report.finish_time
      ? dayjs(report.finish_time)
      : dayjs()
    const diffMs = end.valueOf() - start.valueOf()
    const hours = diffMs > 0 ? Number((diffMs / 3600000).toFixed(2)) : 0
    return allManpowers.reduce((sum, m) => {
      const sk = Number(m.skilled_count) || 0
      const gn = Number(m.general_count) || 0
      const lb = Number(m.labor_count) || 0
      const ot = Number(m.other_count) || 0
      const total_people = sk + gn + lb + ot
      return sum + Number((hours * total_people).toFixed(2))
    }, 0)
  })()

  // 检查是否有未保存的记录
  const hasUnsavedChanges = (() => {
    if (!isEditable) return false
    if (dirtyIds.size > 0) return true
    if (activeTab === 'defect') {
      return prodDefectList.some(d => String(d.id).startsWith('tmp_'))
    }
    if (activeTab === 'material') {
      return materialList.some(m => String(m.id).startsWith('tmp_'))
    }
    if (activeTab === 'scrap') {
      return scrapList.some(d => String(d.id).startsWith('tmp_'))
    }
    if (activeTab === 'exception') {
      return exceptionList.some(e => String(e.id).startsWith('tmp_'))
    }
    return false
  })()

  // 监听浏览器关闭/刷新（仅在有未保存记录时提示）
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // 切换页签前若有未保存记录则提示
  const handleTabChange = async (newTab) => {
    if (!hasUnsavedChanges || newTab === activeTab) {
      setActiveTab(newTab)
      return
    }
    const confirmed = await Dialog.confirm({
      title: '存在未保存的记录',
      content: '当前页签有未保存的记录，离开将丢失这些数据。是否确认离开？',
      confirmText: '确认离开',
      cancelText: '继续编辑',
    })
    if (confirmed) {
      setActiveTab(newTab)
    }
  }

  const handleFinish = async () => {
    if (!report) return
    const confirmed = await Dialog.confirm({
      title: '确认完工',
      content: '确认完工该报工单？完工后数据将变为只读',
    })
    if (!confirmed) return
    setFinishing(true)
    try {
      await api.post(`/production/report-orders/${report.report_order_id}/finish`)
      Toast.show({ icon: 'success', content: '报工单已完工' })
      fetchReport()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '完工失败' })
    } finally {
      setFinishing(false)
    }
  }

  const handleClose = async () => {
    if (!report) return
    const confirmed = await Dialog.confirm({
      title: '确认关闭',
      content: '确认关闭该报工单？关闭前需无不良记录、无物料使用记录、无检验报废记录',
    })
    if (!confirmed) return
    setClosing(true)
    try {
      await api.post(`/production/report-orders/${report.report_order_id}/close`)
      Toast.show({ icon: 'success', content: '报工单已关闭' })
      fetchReport()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '关闭失败' })
    } finally {
      setClosing(false)
    }
  }

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
      setProdDefectList((defectRes.data || []).map(d => ({ ...d, id: d.defect_id || genTempId(), defect_qty: d.defect_qty ? Math.floor(Number(d.defect_qty)) : 0 })))
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.material_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
    }
  }

  const fetchGlobalData = async () => {
    if (!id) return
    try {
      const [scrapRes, exceptionRes, manpowerRes] = await Promise.all([
        api.get('/production/scrap-defects', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { report_order_id: id, page: 1, pageSize: 1000 } }),
      ])
      setScrapList((scrapRes.data || []).filter(d => d.defect_type === '检验报废').map(d => ({ ...d, id: d.scrap_id || genTempId(), defect_qty: d.defect_qty ? Math.floor(Number(d.defect_qty)) : 0 })))
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id || genTempId() })))
      setManpowerList((manpowerRes.data || []).map(m => ({ ...m, id: m.record_id || genTempId() })))
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
    }
  }

  const refreshAllData = useCallback(async () => {
    setDirtyIds(new Set())
    await Promise.all([fetchReport(), fetchGlobalData()])
  }, [id])

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
            {(report.status === 0 || report.status === '开工') && (
              <div className="rd-header-actions">
                <Button
                  color="primary"
                  size="mini"
                  loading={finishing}
                  onClick={handleFinish}
                  style={{ borderRadius: 6, '--padding-left': '10px', '--padding-right': '10px', height: 28 }}
                >
                  完工
                </Button>
                <Button
                  color="danger"
                  size="mini"
                  loading={closing}
                  onClick={handleClose}
                  style={{ borderRadius: 6, '--padding-left': '10px', '--padding-right': '10px', height: 28 }}
                >
                  关闭
                </Button>
              </div>
            )}
          </div>
          <div className="rd-header-row">
            <span className="rd-label">料号</span>
            <span className="rd-value">
              {report.material_code || '-'}
              {formatFilmVersion(report.order?.film_version, report.order?.version_no) && (
                <span className="rd-film-version">（菲林版本：{formatFilmVersion(report.order?.film_version, report.order?.version_no)}）</span>
              )}
            </span>
            <span className={`rd-status-tag ${report.status === 0 || report.status === '开工' ? 'started' : 'done'}`}>
              {report.status === 0 || report.status === '开工' ? '开工' : '完工'}
            </span>
          </div>
          <div className="rd-header-row">
            <span className="rd-label">料品名称</span>
            <span className="rd-value rd-material-name">{report.material_name || '-'}</span>
          </div>
          <div className="rd-header-row rd-qty-row">
            <div className="rd-qty-item">
              <span className="rd-label">报工数量</span>
              <span className="rd-qty" style={{ color: '#1677ff' }}>{Math.floor(Number(report.report_qty) || 0)}</span>
            </div>
            <div className="rd-qty-item">
              <span className="rd-label">投入数量</span>
              <span className="rd-qty" style={{ color: '#52c41a' }}>{inputQty}</span>
            </div>
            <div className="rd-qty-item">
              <span className="rd-label">{report.status === 0 || report.status === '开工' ? '预计产出' : '合格数量'}</span>
              <span className="rd-qty" style={{ color: '#fa8c16' }}>{expectedOutput}</span>
            </div>
          </div>
          <div className="rd-header-row rd-qty-row">
            <div className="rd-qty-item">
              <span className="rd-label">来料不良</span>
              <span className="rd-qty" style={{ color: '#ff4d4f' }}>{incomingDefectQty}</span>
            </div>
            <div className="rd-qty-item">
              <span className="rd-label">制程不良</span>
              <span className="rd-qty" style={{ color: '#faad14' }}>{processDefectQty}</span>
            </div>
            <div className="rd-qty-item">
              <span className="rd-label">检验报废</span>
              <span className="rd-qty" style={{ color: '#722ed1' }}>{scrapQty}</span>
            </div>
          </div>
          <div className="rd-header-row rd-qty-row">
            <div className="rd-qty-item">
              <span className="rd-label">异常工时</span>
              <span className="rd-qty" style={{ color: '#eb2f96' }}>{exceptionHours.toFixed(1)}h</span>
            </div>
            <div className="rd-qty-item">
              <span className="rd-label">人工工时</span>
              <span className="rd-qty" style={{ color: '#13c2c2' }}>{manpowerHours.toFixed(1)}h</span>
            </div>
            <div className="rd-qty-item" />
          </div>
        </div>
      </div>

      <div className="mobile-tabs" style={{ marginTop: 8 }}>
        {TABS.map(t => (
          <div
            key={t.key}
            className={`mobile-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}
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
            onDataSaved={refreshAllData}
            onDirty={markDirty}
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
            onDataSaved={refreshAllData}
            onDirty={markDirty}
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
            onDataSaved={refreshAllData}
            onDirty={markDirty}
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
            onDataSaved={refreshAllData}
            onDirty={markDirty}
          />
        )}

        {activeTab === 'manpower' && (
          <ManpowerTab
            list={manpowerList}
            setList={setManpowerList}
            isEditable={isEditable}
            reportOrderId={id}
            reportTime={report.report_time}
            reportStatus={report.status}
            reportFinishTime={report.finish_time}
            onDataSaved={refreshAllData}
            onDirty={markDirty}
          />
        )}
      </div>
    </div>
  )
}
