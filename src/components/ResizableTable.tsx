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
}

function ResizableTable<RecordType extends object = any>(props: ResizableTableProps<RecordType>) {
  const { tableKey, columns: rawColumns = [], ...rest } = props
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

  const handleResize = useCallback((key: React.Key) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[String(key)] || (rawColumns.find(c => String(c.key || c.dataIndex) === String(key))?.width as number) || 150

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX
      const newWidth = Math.max(60, startWidth + diff)
      setColWidths(prev => ({ ...prev, [String(key)]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      setColWidths(prev => {
        const finalWidth = prev[String(key)] || startWidth
        const allWidths = { ...prev }
        save(`${STORAGE_PREFIX}${tableKey}`, allWidths)
        return prev
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths, rawColumns, tableKey, save])

  const columns = useMemo(() => {
    return rawColumns.map(col => {
      const key = String(col.key || col.dataIndex || '')
      const width = colWidths[key] || col.width
      if (!key) return col
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
  }, [rawColumns, colWidths, handleResize])

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
      `}</style>
      <Table<RecordType> columns={columns} {...rest} />
    </div>
  )
}

export default ResizableTable
