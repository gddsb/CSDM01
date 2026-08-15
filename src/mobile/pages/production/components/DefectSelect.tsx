import React, { useState, useEffect, useRef } from 'react'
import { DownOutline } from 'antd-mobile-icons'

export default function DefectSelect({ value, onChange, options, placeholder, codeField, nameField, autoWidth, excludeValues = [] }: { value: any; onChange: any; options: any; placeholder?: string; codeField: string; nameField?: string; autoWidth?: boolean; excludeValues?: any[] }) {
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
