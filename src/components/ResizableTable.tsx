import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Table } from 'antd'
import type { TableProps } from 'antd'
import api from '../utils/api'

const STORAGE_PREFIX = 'table_col_width_'

function useDebouncedSave() {
  const timerRef = useRef<number | null>(null)
  const queueRef = useRef<Record<string, any>>({})

  const flush = useCallback(async () => {
    const settings = queueRef.current
    queueRef.current = {}
    if (Object.keys(settings).length === 0) return
    try {
      await api.put('/system/user-settings/batch', { settings, setting_group: 'table' })
    } catch (e) {
      // ignore
    }
  }, [])

  const save = useCallback((key: string, value: any) => {
    queueRef.current[key] = value
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => flush(), 1000)
  }, [flush])

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    flush()
  }, [flush])

  return { save }
}

export interface ResizableTableProps<RecordType = any> extends TableProps<RecordType> {
  tableKey: string
  autoWidth?: boolean
}

function ResizableTable<RecordType extends object = any>(props: ResizableTableProps<RecordType>) {
  const { tableKey, columns: rawColumns = [], autoWidth = false, ...rest } = props
  const { save } = useDebouncedSave()
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get<Record<string, any>>('/system/user-settings', { params: { group: 'table' } })
        if (cancelled) return
        const all = res.data || {}
        const key = `${STORAGE_PREFIX}${tableKey}`
        const saved = all[key] || {}
        setColWidths(typeof saved === 'object' ? saved : {})
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [tableKey])

  const colInfo = useMemo(() => {
    const cols: Array<{ key: string; index: number; fixed?: string | boolean; isAction: boolean }> = []
    rawColumns.forEach((col: any, index: number) => {
      const key = String(col.key || col.dataIndex || '')
      const isAction = key === 'action' || col.key === 'action'
      cols.push({ key, index, fixed: col.fixed, isAction })
    })
    return cols
  }, [rawColumns])

  const elasticColKeys = useMemo(() => {
    const keys: string[] = []
    let actionIndex = -1
    colInfo.forEach((c, i) => {
      if (c.isAction) actionIndex = i
    })
    if (actionIndex >= 0) {
      const actionCol = colInfo[actionIndex]
      if (actionCol.key) keys.push(actionCol.key)
      const leftNeighbor = actionIndex > 0 ? colInfo[actionIndex - 1] : null
      if (leftNeighbor && leftNeighbor.key) keys.push(leftNeighbor.key)
    }
    return keys
  }, [colInfo])

  const handleResize = useCallback((key: React.Key) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const targetKey = String(key)
    const targetCol = rawColumns.find(c => String(c.key || c.dataIndex) === targetKey)
    const startWidth = colWidths[targetKey] || (targetCol?.width as number) || 150

    const elasticKeys = elasticColKeys.filter(k => k !== targetKey)

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX
      const newWidth = Math.max(60, startWidth + diff)
      const actualDiff = newWidth - startWidth

      setColWidths(prev => {
        const next: Record<string, number> = { ...prev, [targetKey]: newWidth }

        if (elasticKeys.length > 0 && actualDiff !== 0) {
          const perCol = actualDiff / elasticKeys.length
          let remaining = actualDiff
          elasticKeys.forEach((k, idx) => {
            const currentKWidth = prev[k] || (rawColumns.find(c => String(c.key || c.dataIndex) === k)?.width as number) || 150
            if (idx === elasticKeys.length - 1) {
              next[k] = Math.max(60, currentKWidth - remaining)
            } else {
              const adjust = Math.min(perCol, currentKWidth - 60)
              next[k] = currentKWidth - adjust
              remaining -= adjust
            }
          })
        }

        return next
      })
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      setColWidths(prev => {
        const allWidths = { ...prev }
        save(`${STORAGE_PREFIX}${tableKey}`, allWidths)
        return prev
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths, rawColumns, tableKey, save, elasticColKeys])

  const columns = useMemo(() => {
    if (autoWidth) {
      return rawColumns.map(col => {
        const { width: _w, ...restCol } = col as any
        return { ...restCol }
      })
    }
    return rawColumns.map(col => {
      const key = String(col.key || col.dataIndex || '')
      const width = colWidths[key] || col.width || 150
      if (!key) return { ...col, width }
      return {
        ...col,
        width,
        onHeaderCell: (column: any) => ({
          width: column.width,
          onMouseDown: handleResize(key),
          style: { position: 'relative', userSelect: 'none' },
          className: (column.className || '') + ' resizable-col-header',
        }),
      }
    })
  }, [rawColumns, colWidths, handleResize, autoWidth])

  return (
    <div className="resizable-table-wrapper">
      <style>{`
        .resizable-col-header::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          z-index: 10;
        }
        .resizable-col-header:hover::after {
          background: var(--color-primary, #1890ff);
          opacity: 0.4;
        }
        .resizable-table-wrapper table {
          table-layout: ${autoWidth ? 'auto' : 'fixed'} !important;
        }
        .resizable-table-wrapper .ant-table-thead > tr > th,
        .resizable-table-wrapper .ant-table-tbody > tr > td {
          ${autoWidth ? 'white-space: nowrap;' : 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'}
        }
      `}</style>
      <Table<RecordType> columns={columns} tableLayout={autoWidth ? 'auto' : 'fixed'} {...rest} />
    </div>
  )
}

export default ResizableTable
