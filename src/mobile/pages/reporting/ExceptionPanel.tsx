/**
 * 工单工时（异常）记录面板
 * —— 工单级（不分工序），Tab: 工时
 *
 * 规则：
 *   - 换型换线由系统"开工"时自动生成，前端不提供选项，后端强拒
 *   - 同时只允许 1 条未结束（end_time 为空）的记录
 *   - 设备故障必须选设备（必填 + 支持搜索）
 *   - duration DB 存**小时**，前端展示换算分钟 × 60
 *   - description = 停机描述（DB 列名），前端原错叫 remark
 *
 * 后端接口：
 *   GET  /production/process-exceptions?report_order_id=xxx
 *   POST /production/process-exceptions
 *   PUT  /production/process-exceptions/:id
 *   DEL  /production/process-exceptions/:id
 *   GET  /basic/devices               （设备列表，预拉）
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { fmtLocalDateTime, nowLocalStr } from '../../../utils/localTime'
import type { ExceptionRow, ReportOrder } from './types'

/** 用户可选异常类型（换型换线不在此，由开工自动生成） */
const EXCEPTION_TYPES = ['设备故障', '质量异常', '待料', '工装调整', '其他']

interface DeviceOption {
  device_id: number
  device_code: string
  device_name: string
}

interface Props {
  report: ReportOrder
  editable: boolean
  rows: ExceptionRow[]
  setRows: (updater: (prev: ExceptionRow[]) => ExceptionRow[]) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function ExceptionPanel({ report, editable, rows, setRows, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<ExceptionRow>({})
  const [devices, setDevices] = useState<DeviceOption[]>([])
  const [deviceKw, setDeviceKw] = useState('')
  const [deviceOpen, setDeviceOpen] = useState(false)

  // 预拉设备列表（搜索 + 设备故障必填 共用）
  useEffect(() => {
    api.get('/basic/devices', { params: { pageSize: 500 } })
      .then(r => setDevices((r.data?.rows || r.data || []) as DeviceOption[]))
      .catch(() => setDevices([]))
  }, [])

  // dirty：新增区有内容 / 已有行被改(__dirty) 任一即为脏
  const dirty = useMemo(() => {
    const hasNew = Object.values(draft).some(v => v !== undefined && v !== '' && v !== null)
    const hasModified = rows.some((r: any) => r.__dirty)
    return hasNew || hasModified
  }, [draft, rows])

  useEffect(() => { onDirtyChange?.(dirty); return () => { onDirtyChange?.(false) } }, [dirty, onDirtyChange])

  // 当前是否存在未结束记录 —— 用于禁用「添加工时」
  const unfinishedRow = useMemo(
    () => rows.find(r => !r.end_time),
    [rows],
  )
  const hasUnfinished = !!unfinishedRow

  // 设备搜索（按 device_code / device_name）
  const filteredDevices = useMemo(() => {
    const kw = deviceKw.trim().toLowerCase()
    if (!kw) return devices
    return devices.filter(d =>
      d.device_code?.toLowerCase().includes(kw) ||
      d.device_name?.toLowerCase().includes(kw),
    )
  }, [devices, deviceKw])

  const handleAdd = useCallback(async () => {
    if (!draft.exception_type) { Toast.show({ content: '请选异常类型', icon: 'fail' }); return }
    if (draft.exception_type === '设备故障' && !draft.device_id) {
      Toast.show({ content: '请选择故障设备', icon: 'fail' })
      return
    }
    if (hasUnfinished) {
      Toast.show({ content: `存在未结束的工时记录（${unfinishedRow?.exception_type || '—'}），请先结束`, icon: 'fail' })
      return
    }
    try {
      const payload: any = {
        report_order_id: report.report_order_id,
        exception_type: draft.exception_type,
        device_id: draft.device_id || null,
        device_code: draft.device_code || null,
        device_name: draft.device_name || null,
        start_time: draft.start_time || nowLocalStr(),
        end_time: draft.end_time || null,
        description: draft.description || null,
      }
      // 前端不算 duration —— 后端 create 时 validateTimeRange 自动算（小时）
      const r: any = await api.post('/production/process-exceptions', payload)
      if (!r.success) throw new Error(r.message || '保存失败')
      setRows(prev => [...prev, r.data])
      Toast.show({ content: '已添加', icon: 'success' })
      setDraft({})
      setDeviceKw('')
      onDirtyChange?.(false)
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, hasUnfinished, unfinishedRow?.exception_type, report.report_order_id, setRows, onDirtyChange])

  const handleFinish = useCallback(async (row: ExceptionRow) => {
    const endTime = nowLocalStr()
    try {
      // 只发 end_time —— 后端 update 时 validateTimeRange 自动重算 duration（小时）
      const r: any = await api.put(`/production/process-exceptions/${row.exception_id}`, { end_time: endTime })
      if (!r.success) throw new Error(r.message || '结束失败')
      const saved = r.data as any
      setRows(prev => prev.map(r =>
        (r.exception_id ?? r.id) === (row.exception_id ?? row.id)
          ? { ...r, ...saved }   // 完全信任后端返回
          : r,
      ))
      const mins = Math.round(Number(saved?.duration ?? 0) * 60)
      Toast.show({ content: `已结束（${mins} 分钟）`, icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '结束失败', icon: 'fail' })
    }
  }, [setRows])

  const handleDel = useCallback(async (row: ExceptionRow) => {
    // 系统自动生成的换型换线记录不允许删除
    const isAutoChangeover = row.exception_type === '换型换线' && row.description?.includes('自动')
    if (isAutoChangeover) {
      Toast.show({ content: '系统自动生成的换型换线记录不允许删除', icon: 'fail', position: 'bottom' })
      return
    }
    const ok = await Dialog.confirm({ content: '删除该工时记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.exception_id) await api.delete(`/production/process-exceptions/${row.exception_id}`)
      setRows(prev => prev.filter(r => (r.exception_id ?? r.id) !== (row.exception_id ?? row.id)))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '删除失败', icon: 'fail' })
    }
  }, [setRows])

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--m-border)', fontSize: 14,
  }
  const selStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--m-border)', fontSize: 14, background: 'var(--m-surface)',
  }

  return (
    <div>
      {/* 列表 */}
      {rows.length > 0 && rows.map((row) => {
        const isUnfinished = !row.end_time
        const durationMins = Math.round(Number(row.duration ?? 0) * 60)
        return (
          <div key={String(row.id)} style={{ padding: '10px 0', borderTop: '1px solid #f0f0f0' }}>
            {/* 第一行：异常类型 + 设备 chip + 时长 + 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: isUnfinished ? '#f5222d' : 'var(--m-text)' }}>
                {row.exception_type || '—'}
                {isUnfinished && <span style={{ fontSize: 11, color: 'var(--brand-color-danger)' }}>进行中</span>}
                {row.exception_type === '设备故障' && row.device_name && (
                  <span style={{ fontSize: 11, color: '#1890ff', background: '#e6f7ff', padding: '1px 6px', borderRadius: 4 }}>
                    📡 {row.device_name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ color: 'var(--brand-color-warning)', fontWeight: 600, fontSize: 13 }}>
                  {isUnfinished ? '—' : `${durationMins}分钟`}
                </span>
                {editable && isUnfinished && (
                  <Button size="mini" color="primary" onClick={() => handleFinish(row)}>结束</Button>
                )}
                {editable && isUnfinished && !(row.exception_type === '换型换线' && row.description?.includes('自动')) && (
                  <Button size="mini" fill="outline" onClick={() => handleDel(row)}>删</Button>
                )}
              </div>
            </div>
            {/* 第二行：时间范围 */}
            <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 3 }}>
              {row.start_time ? fmtLocalDateTime(row.start_time).slice(5, 16) : '—'}
              <span style={{ margin: '0 4px', opacity: 0.5 }}>→</span>
              {row.end_time ? fmtLocalDateTime(row.end_time).slice(5, 16) : '至今'}
            </div>
            {/* 第三行：停机描述 */}
            {row.description && (
              <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>📝 {row.description}</div>
            )}
          </div>
        )
      })}
      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>— 暂无工时记录 —</div>
      )}

      {/* 新增 */}
      {editable && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 6 }}>➕ 新加工时</div>
          {hasUnfinished && (
            <div style={{ color: 'var(--brand-color-danger)', fontSize: 11, marginBottom: 6 }}>
              ⚠️ 存在未结束的工时记录，请先点「结束」
            </div>
          )}

          {/* 异常类型 */}
          <select
            value={draft.exception_type || ''}
            onChange={(e) => {
              const val = e.target.value
              setDraft(d => ({ ...d, exception_type: val }))
              // 切换非设备故障 → 清空已选设备
              if (val !== '设备故障') setDraft(d => ({ ...d, device_id: undefined, device_code: undefined, device_name: undefined }))
            }}
            style={selStyle}
            disabled={hasUnfinished}
          >
            <option value="">请选择异常类型</option>
            {EXCEPTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* 设备故障 → 设备选择（搜索 + 下拉 + 箭头） */}
          {draft.exception_type === '设备故障' && !hasUnfinished && (
            <div style={{ marginTop: 8 }}>
              {/* 已选设备展示行（带开关箭头） */}
              <div
                onClick={() => setDeviceOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', border: '1px solid #e6e6e6', borderRadius: 8,
                  background: draft.device_id ? '#e6f7ff' : '#fafafa', cursor: 'pointer', fontSize: 13,
                }}
              >
                <div>
                  {draft.device_id
                    ? <span style={{ color: '#1890ff' }}>📡 {draft.device_name}（{draft.device_code}）</span>
                    : <span style={{ color: '#999' }}>请选择故障设备 *</span>}
                </div>
                <span style={{
                  color: '#999', fontSize: 16,
                  transition: 'transform .2s',
                  transform: deviceOpen ? 'rotate(180deg)' : 'none',
                  display: 'inline-block',
                }}>▾</span>
              </div>

              {/* 展开区：搜索 + 下拉列表 */}
              {deviceOpen && (
                <>
                  <input
                    type="text" placeholder="搜索设备编号/名称" value={deviceKw}
                    onChange={(e) => setDeviceKw(e.target.value)}
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginTop: 4 }}>
                    {filteredDevices.map(d => (
                      <div
                        key={d.device_id}
                        onClick={() => {
                          setDraft(v => ({ ...v, device_id: d.device_id, device_code: d.device_code, device_name: d.device_name }))
                          setDeviceOpen(false)   // 选后自动关闭
                          setDeviceKw('')
                        }}
                        style={{
                          padding: '8px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                          background: draft.device_id === d.device_id ? '#e6f7ff' : 'white',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>{d.device_name}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{d.device_code}</div>
                      </div>
                    ))}
                    {filteredDevices.length === 0 && (
                      <div style={{ padding: 10, color: '#999', fontSize: 12, textAlign: 'center' }}>
                        {devices.length === 0 ? '设备列表加载失败' : '无匹配设备'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 时间输入 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="datetime-local" value={draft.start_time || ''} onChange={(e) => setDraft(d => ({ ...d, start_time: e.target.value }))} style={inputStyle} placeholder="开始时间" disabled={hasUnfinished} />
            <input type="datetime-local" value={draft.end_time || ''} onChange={(e) => setDraft(d => ({ ...d, end_time: e.target.value }))} style={inputStyle} placeholder="结束时间（可选）" disabled={hasUnfinished} />
          </div>

          {/* 停机描述 */}
          <input
            type="text" placeholder="停机描述（可选）" value={draft.description || ''}
            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            style={{ ...inputStyle, width: '100%', marginTop: 8 }}
            disabled={hasUnfinished}
          />

          {/* 保存 */}
          <div style={{ marginTop: 10 }}>
            <Button size="mini" color="primary" onClick={handleAdd} disabled={hasUnfinished || !dirty}>💾 保存工时记录</Button>
          </div>
        </div>
      )}
    </div>
  )
}
