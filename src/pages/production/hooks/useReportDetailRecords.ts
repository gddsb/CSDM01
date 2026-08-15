import { useCallback, useMemo, useState } from 'react'
import api from '../../../utils/api'
import { DefectRecord, MaterialRecord, ExceptionRecord, ManpowerRecord } from '../types'

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

interface SelectedReportLike {
  report_order_id: number
  status: string | number
  report_time: string
  finish_time?: string
  order_id?: number
  [key: string]: unknown
}

interface Options {
  selectedReport: SelectedReportLike | null
  isEditable: boolean
  selectedProcessId: number | null
  lineProcesses: Array<{ process_id: number; process_name: string }>
  openImageDrawer: (label: string, images: any[], context: any) => void
  message: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void }
}

/**
 * 工序报工：5 类明细记录（制程不良/报废不良/物料/异常/人员）的状态与 CRUD 逻辑。
 * 主组件只负责初始加载（调用 replace 方法）和提交校验。
 */
export function useReportDetailRecords(opts: Options) {
  const { selectedReport, isEditable, selectedProcessId, lineProcesses, openImageDrawer, message: msg } = opts

  const [prodDefectList, setProdDefectList] = useState<DefectRecord[]>([])
  const [scrapDefectList, setScrapDefectList] = useState<DefectRecord[]>([])
  const [materialList, setMaterialList] = useState<MaterialRecord[]>([])
  const [exceptionList, setExceptionList] = useState<ExceptionRecord[]>([])
  const [manpowerList, setManpowerList] = useState<ManpowerRecord[]>([])

  const dirtyIds = useMemo(() => {
    const all = [...prodDefectList, ...scrapDefectList, ...materialList, ...exceptionList]
    return new Set(all.filter(r => r._dirty).map(r => String(r.id)))
  }, [prodDefectList, scrapDefectList, materialList, exceptionList])

  const hasUnsavedChanges = useMemo(() => {
    return [prodDefectList, scrapDefectList, materialList, exceptionList].some(list => list.some((r: any) => r._dirty))
  }, [prodDefectList, scrapDefectList, materialList, exceptionList])

  // ---------- 制程不良 ----------
  const handleAddProdDefectRow = useCallback(() => {
    if (!isEditable) { msg.warning('请先开工报工单'); return }
    if (!selectedProcessId) { msg.warning('请选择工序'); return }
    const row: DefectRecord = {
      id: genId('pd'), defect_name: '', defect_quantity: 0, defect_unit: 'PCS',
      status: 'pending', _dirty: true, process_id: selectedProcessId,
      process_step_id: lineProcesses.find(p => p.process_id === selectedProcessId)?.process_id,
      report_order_id: selectedReport?.report_order_id,
    }
    setProdDefectList(prev => [row, ...prev])
  }, [isEditable, selectedProcessId, lineProcesses, selectedReport, msg])

  const handleDeleteProdDefect = useCallback(async (id: string | number) => {
    if (!String(id).startsWith('tmp_')) {
      try { await api.delete(`/production/process-defects/${id}`); msg.success('删除成功') }
      catch { msg.error('删除失败') }
    }
    setProdDefectList(prev => prev.filter(r => r.id !== id))
  }, [msg])

  const handleProdDefectChange = useCallback((id: string | number, field: string, value: unknown) => {
    setProdDefectList(prev => prev.map(r => r.id === id ? { ...r, [field]: value, _dirty: true } : r))
  }, [])

  const saveProdDefectItem = useCallback(async (item: DefectRecord) => {
    const { _deleting, _dirty, id, ...payload } = item as any
    if (!payload.defect_type_id) { msg.error('请选择不良类型'); throw new Error('missing defect type') }
    if (!payload.defect_quantity || Number(payload.defect_quantity) <= 0) { msg.error('不良数量必须大于0'); throw new Error('qty') }
    if (String(id).startsWith('tmp_')) {
      const res = await api.post('/production/process-defects', payload)
      setProdDefectList(prev => prev.map(r => r.id === id ? { ...res.data, _dirty: false } : r))
    } else {
      await api.put(`/production/process-defects/${id}`, payload)
      setProdDefectList(prev => prev.map(r => r.id === id ? { ...r, _dirty: false } : r))
    }
  }, [msg])

  const handleSaveAllProdDefects = useCallback(async () => {
    const toSave = prodDefectList.filter((r: any) => r._dirty)
    if (!toSave.length) { msg.warning('没有需要保存的记录'); return }
    let ok = 0
    for (const r of toSave) {
      try { await saveProdDefectItem(r); ok++ } catch { /* error already shown */ }
    }
    if (ok) msg.success(`已保存 ${ok} 条记录`)
  }, [prodDefectList, saveProdDefectItem, msg])

  // ---------- 报废不良 ----------
  const handleAddScrapDefectRow = useCallback(() => {
    if (!isEditable) { msg.warning('请先开工报工单'); return }
    if (!selectedProcessId) { msg.warning('请选择工序'); return }
    const row: DefectRecord = {
      id: genId('sc'), defect_name: '', defect_quantity: 0, defect_unit: 'PCS',
      status: 'pending', _dirty: true, process_id: selectedProcessId,
      process_step_id: lineProcesses.find(p => p.process_id === selectedProcessId)?.process_id,
      report_order_id: selectedReport?.report_order_id,
    }
    setScrapDefectList(prev => [row, ...prev])
  }, [isEditable, selectedProcessId, lineProcesses, selectedReport, msg])

  const handleDeleteScrapDefect = useCallback(async (id: string | number) => {
    if (!String(id).startsWith('tmp_')) {
      try { await api.delete(`/production/process-defects/${id}`); msg.success('删除成功') }
      catch { msg.error('删除失败') }
    }
    setScrapDefectList(prev => prev.filter(r => r.id !== id))
  }, [msg])

  const handleScrapDefectChange = useCallback((id: string | number, field: string, value: unknown) => {
    setScrapDefectList(prev => prev.map(r => r.id === id ? { ...r, [field]: value, _dirty: true } : r))
  }, [])

  const saveScrapDefectItem = useCallback(async (item: DefectRecord) => {
    const { _deleting, _dirty, id, ...payload } = item as any
    if (!payload.defect_type_id) { msg.error('请选择不良类型'); throw new Error('missing') }
    if (!payload.defect_quantity || Number(payload.defect_quantity) <= 0) { msg.error('报废数量必须大于0'); throw new Error('qty') }
    payload.scrap_flag = 1
    if (String(id).startsWith('tmp_')) {
      const res = await api.post('/production/process-defects', payload)
      setScrapDefectList(prev => prev.map(r => r.id === id ? { ...res.data, _dirty: false } : r))
    } else {
      await api.put(`/production/process-defects/${id}`, payload)
      setScrapDefectList(prev => prev.map(r => r.id === id ? { ...r, _dirty: false } : r))
    }
  }, [msg])

  const handleSaveAllScrapDefects = useCallback(async () => {
    const toSave = scrapDefectList.filter((r: any) => r._dirty)
    if (!toSave.length) { msg.warning('没有需要保存的记录'); return }
    let ok = 0
    for (const r of toSave) { try { await saveScrapDefectItem(r); ok++ } catch {} }
    if (ok) msg.success(`已保存 ${ok} 条记录`)
  }, [scrapDefectList, saveScrapDefectItem, msg])

  // ---------- 物料 ----------
  const handleAddMaterialRow = useCallback(() => {
    if (!isEditable) { msg.warning('请先开工报工单'); return }
    if (!selectedProcessId) { msg.warning('请选择工序'); return }
    const row: MaterialRecord = {
      id: genId('ma'), material_name: '', quantity: 0, unit: 'PCS',
      _dirty: true, process_id: selectedProcessId,
      process_step_id: lineProcesses.find(p => p.process_id === selectedProcessId)?.process_id,
      report_order_id: selectedReport?.report_order_id,
    }
    setMaterialList(prev => [row, ...prev])
  }, [isEditable, selectedProcessId, lineProcesses, selectedReport, msg])

  const handleDeleteMaterial = useCallback(async (id: string | number) => {
    if (!String(id).startsWith('tmp_')) {
      try { await api.delete(`/production/process-materials/${id}`); msg.success('删除成功') }
      catch { msg.error('删除失败') }
    }
    setMaterialList(prev => prev.filter(r => r.id !== id))
  }, [msg])

  const handleMaterialChange = useCallback((id: string | number, field: string, value: unknown) => {
    setMaterialList(prev => prev.map(r => r.id === id ? { ...r, [field]: value, _dirty: true } : r))
  }, [])

  const saveMaterialItem = useCallback(async (item: MaterialRecord) => {
    const { _deleting, _dirty, id, material_id, ...payload } = item as any
    if (!payload.bas_material_id) { msg.error('请选择物料'); throw new Error('material') }
    if (!payload.quantity || Number(payload.quantity) <= 0) { msg.error('数量必须大于0'); throw new Error('qty') }
    if (String(id).startsWith('tmp_')) {
      const res = await api.post('/production/process-materials', payload)
      setMaterialList(prev => prev.map(r => r.id === id ? { ...res.data, _dirty: false } : r))
    } else {
      await api.put(`/production/process-materials/${material_id || id}`, payload)
      setMaterialList(prev => prev.map(r => r.id === id ? { ...r, _dirty: false } : r))
    }
  }, [msg])

  const handleSaveAllMaterials = useCallback(async () => {
    const toSave = materialList.filter((r: any) => r._dirty)
    if (!toSave.length) { msg.warning('没有需要保存的记录'); return }
    let ok = 0
    for (const r of toSave) { try { await saveMaterialItem(r); ok++ } catch {} }
    if (ok) msg.success(`已保存 ${ok} 条记录`)
  }, [materialList, saveMaterialItem, msg])

  // ---------- 异常 ----------
  const handleAddExceptionRow = useCallback(() => {
    if (!isEditable) { msg.warning('请先开工报工单'); return }
    if (!selectedReport) { msg.warning('请先选择报工单'); return }
    const now = new Date().toISOString()
    const row: ExceptionRecord = {
      id: genId('ex'), exception_type: '设备异常', exception_category: '停机',
      start_time: now, end_time: now, duration: 0, description: '',
      _dirty: true, report_order_id: selectedReport.report_order_id,
    }
    setExceptionList(prev => [row, ...prev])
  }, [isEditable, selectedReport, msg])

  const handleDeleteException = useCallback(async (id: string | number) => {
    if (!String(id).startsWith('tmp_')) {
      try { await api.delete(`/production/process-exceptions/${id}`); msg.success('删除成功') }
      catch { msg.error('删除失败') }
    }
    setExceptionList(prev => prev.filter(r => r.id !== id))
  }, [msg])

  const handleExceptionChange = useCallback((id: string | number, field: string, value: unknown) => {
    setExceptionList(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: value, _dirty: true }
      if (field === 'start_time' || field === 'end_time') {
        const start = new Date((field === 'start_time' ? value : r.start_time) as string | number | Date).getTime()
        const end = new Date((field === 'end_time' ? value : r.end_time) as string | number | Date).getTime()
        if (!isNaN(start) && !isNaN(end) && end > start) updated.duration = Math.round((end - start) / 60000)
      }
      return updated
    }))
  }, [])

  const saveExceptionItem = useCallback(async (item: ExceptionRecord) => {
    const { _deleting, _dirty, id, exception_id, ...payload } = item as any
    if (!payload.start_time) { msg.error('请选择开始时间'); throw new Error('start') }
    if (!payload.end_time) { msg.error('请选择结束时间'); throw new Error('end') }
    if (String(id).startsWith('tmp_')) {
      const res = await api.post('/production/process-exceptions', payload)
      setExceptionList(prev => prev.map(r => r.id === id ? { ...res.data, _dirty: false } : r))
    } else {
      await api.put(`/production/process-exceptions/${exception_id || id}`, payload)
      setExceptionList(prev => prev.map(r => r.id === id ? { ...r, _dirty: false } : r))
    }
  }, [msg])

  const handleSaveAllExceptions = useCallback(async () => {
    const toSave = exceptionList.filter((r: any) => r._dirty)
    if (!toSave.length) { msg.warning('没有需要保存的记录'); return }
    let ok = 0
    for (const r of toSave) { try { await saveExceptionItem(r); ok++ } catch {} }
    if (ok) msg.success(`已保存 ${ok} 条记录`)
  }, [exceptionList, saveExceptionItem, msg])

  // ---------- 人员 ----------
  const handleManpowerChange = useCallback((id: string | number, field: string, value: unknown) => {
    setManpowerList(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: value, _dirty: true }
      if (field === 'worker_count' && selectedReport) {
        const start = new Date(selectedReport.report_time).getTime()
        const end = new Date(selectedReport.finish_time || Date.now()).getTime()
        if (!isNaN(start) && !isNaN(end) && end > start) {
          const hours = (end - start) / 3600000
          const workers = Number((value as number) || 0)
          updated.man_hours = Math.round(workers * hours * 100) / 100
        }
      }
      return updated
    }))
  }, [selectedReport])

  const handleSaveAllManpowers = useCallback(async () => {
    if (!selectedReport) return
    const toSave = manpowerList.filter((r: any) => r._dirty)
    if (!toSave.length) { msg.warning('没有需要保存的记录'); return }
    let ok = 0
    for (const r of toSave) {
      const { _dirty, id, manpower_id, ...payload } = r as any
      try {
        if (String(id).startsWith('tmp_')) {
          const res = await api.post('/production/process-manpowers', payload)
          setManpowerList(prev => prev.map(x => x.id === id ? { ...res.data, _dirty: false } : x))
        } else {
          await api.put(`/production/process-manpowers/${manpower_id || id}`, payload)
          setManpowerList(prev => prev.map(x => x.id === id ? { ...x, _dirty: false } : x))
        }
        ok++
      } catch (err: any) {
        msg.error(err.message || '保存失败')
      }
    }
    if (ok) msg.success(`已保存 ${ok} 条记录`)
  }, [manpowerList, selectedReport, msg])

  // ---------- 汇总统计（基于当前明细）----------
  const processStats = useMemo(() => {
    if (!selectedProcessId) return { inputQty: 0, qualifiedQty: 0, processDefectQty: 0, materialDefectQty: 0 }
    const inputQty = 0
    const qualifiedQty = 0
    const processDefectQty = prodDefectList
      .filter(r => r.process_id === selectedProcessId && !(r as any)._deleting)
      .reduce((sum, r) => sum + (Number(r.defect_quantity) || 0), 0)
    const materialDefectQty = materialList
      .filter(r => r.process_id === selectedProcessId && !(r as any)._deleting)
      .reduce((sum, r) => sum + (Number(r.defect_quantity) || 0), 0)
    return { inputQty, qualifiedQty, processDefectQty, materialDefectQty }
  }, [selectedProcessId, prodDefectList, materialList])

  return {
    // states
    prodDefectList, scrapDefectList, materialList, exceptionList, manpowerList,
    setProdDefectList, setScrapDefectList, setMaterialList, setExceptionList, setManpowerList,
    // derived
    dirtyIds, hasUnsavedChanges, processStats,
    // defect
    handleAddProdDefectRow, handleDeleteProdDefect, handleProdDefectChange, handleSaveAllProdDefects,
    // scrap
    handleAddScrapDefectRow, handleDeleteScrapDefect, handleScrapDefectChange, handleSaveAllScrapDefects,
    // material
    handleAddMaterialRow, handleDeleteMaterial, handleMaterialChange, handleSaveAllMaterials,
    // exception
    handleAddExceptionRow, handleDeleteException, handleExceptionChange, handleSaveAllExceptions,
    // manpower
    handleManpowerChange, handleSaveAllManpowers,
  }
}
