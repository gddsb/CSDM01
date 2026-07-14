import { Space, Button, Input, Select, DatePicker, Row, Col, Checkbox, Dropdown } from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, ExportOutlined, SettingOutlined
} from '@ant-design/icons'
import React from 'react'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

type RangeValueType = RangePickerProps['value']

interface FilterItem {
  type: 'input' | 'select' | 'checkbox-group' | 'rangepicker'
  placeholder?: string
  icon?: React.ReactNode
  value?: string | number | boolean | (string | number)[] | RangeValueType
  onChange?: (value: unknown) => void
  field?: string
  options?: { label: string; value: string | number }[]
  col?: { span: number }
  mode?: 'multiple'
  disabled?: boolean
}

interface StatItem {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}

interface ThreeSectionPageProps {
  title: string
  breadcrumbs: string
  stats?: StatItem[]
  filters?: FilterItem[]
  actions?: React.ReactNode
  table: React.ReactNode
  onSearch?: () => void
  onReset?: () => void
  onFilterChange?: (field: string, value: unknown) => void
}

export default function ThreeSectionPage({
  title,
  breadcrumbs,
  stats,
  filters,
  actions,
  table,
  onSearch,
  onReset,
  onFilterChange,
}: ThreeSectionPageProps) {
  const renderFilterItem = (f: FilterItem) => {
    if (!f) return null
    const handleChange = (v: unknown) => {
      f.onChange?.(v)
      onFilterChange?.(f.field || '', v)
    }
    if (f.type === 'input') {
      return (
        <Input
          placeholder={f.placeholder}
          allowClear
          prefix={f.icon}
          value={f.value as string}
          onChange={(e) => {
            f.onChange?.(e)
            onFilterChange?.(f.field || '', e.target.value)
          }}
          onPressEnter={onSearch}
        />
      )
    }
    if (f.type === 'select') {
      return (
        <Select
          placeholder={f.placeholder}
          allowClear
          showSearch
          style={{ width: '100%' }}
          options={f.options}
          value={f.value}
          onChange={handleChange}
          mode={f.mode}
          disabled={f.disabled}
        />
      )
    }
    if (f.type === 'checkbox-group') {
      return (
        <Checkbox.Group
          options={f.options}
          value={f.value as (string | number)[]}
          onChange={handleChange}
        />
      )
    }
    if (f.type === 'rangepicker') {
      return (
        <RangePicker
          style={{ width: '100%' }}
          value={f.value as RangeValueType}
          onChange={handleChange}
        />
      )
    }
    return null
  }

  return (
    <div className="three-section-page">
      <div className="section-info">
        <div className="section-info-header">
          <div className="section-info-title">
            {breadcrumbs && <div className="section-breadcrumbs">{breadcrumbs}</div>}
            <div className="section-title-text">{title}</div>
          </div>
          <Space className="section-info-actions">{actions}</Space>
        </div>

        {stats && stats.length > 0 && (
          <Row gutter={12} className="stats-row">
            {stats.map((s, i) => (
              <Col key={i} span={Math.floor(24 / stats.length)}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: s.color || 'var(--color-primary)' }}>
                    {s.icon}
                  </div>
                  <div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {filters && (
        <div className="section-filter">
          <div className="section-filter-body">
            <Row gutter={[8, 4]}>
              {filters.map((f, i) => (
                <Col key={i} {...(f.col || { span: 6 })}>
                  {renderFilterItem(f)}
                </Col>
              ))}
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
                </Space>
              </Col>
            </Row>
          </div>
        </div>
      )}

      <div className="section-table compact-table">
        {table}
      </div>
    </div>
  )
}

interface ActionButtonsProps {
  hasAdd?: boolean
  hasExport?: boolean
  hasConfig?: boolean
  extra?: React.ReactNode[]
  onAdd?: () => void
  onExport?: () => void
  onConfig?: () => void
  addText?: string
}

export function ActionButtons({ hasAdd = true, hasExport = true, hasConfig = false, extra = [], onAdd, onExport, onConfig, addText = '新增' }: ActionButtonsProps) {
  return (
    <div className="action-buttons-group">
      {hasAdd && <Button type="primary" className="btn-add" icon={<PlusOutlined />} onClick={onAdd}>{addText}</Button>}
      {hasExport && <Button className="btn-export" icon={<ExportOutlined />} onClick={onExport}>导出</Button>}
      {hasConfig && <Button className="btn-config" icon={<SettingOutlined />} onClick={onConfig}>配置</Button>}
      {extra}
    </div>
  )
}

interface ColumnSettingsProps {
  columns: { dataIndex?: string; key?: string; title: string }[]
  visibleKeys: string[]
  onChange: (keys: string[]) => void
}

export function ColumnSettings({ columns, visibleKeys, onChange }: ColumnSettingsProps) {
  const items = columns
    .filter(c => c.dataIndex || c.key)
    .map(c => ({
      key: c.dataIndex || c.key,
      label: c.title,
    }))
  return (
    <div style={{ padding: 8, maxHeight: 300, overflow: 'auto', minWidth: 160 }}>
      <Checkbox.Group
        value={visibleKeys}
        onChange={onChange}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {items.map(it => (
          <Checkbox key={it.key} value={it.key}>{it.label}</Checkbox>
        ))}
      </Checkbox.Group>
    </div>
  )
}

export function getActionColumnWidth(actionCount: number): number {
  return actionCount >= 4 ? 100 : 80
}

export const materialNameColumn = {
  width: 200,
  render: (text: string) => (
    <div style={{ wordBreak: 'break-word', whiteSpace: 'normal', minWidth: 200 }}>
      {text}
    </div>
  ),
}
