import { Space, Button, Input, Select, DatePicker, Row, Col, Segmented, Checkbox } from 'antd'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, ExportOutlined,
  DownOutlined, UpOutlined
} from '@ant-design/icons'
import React, { useState } from 'react'

const { RangePicker } = DatePicker

// 快速筛选项定义
const QUICK_FILTER_OPTIONS = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本年', value: 'year' },
]

/**
 * 三段式页面通用组件
 * 规范：
 *   - 上部页面信息区 (15%-20%)：标题/面包屑/统计卡片/快速筛选/主要操作按钮，主背景色，常规间距
 *   - 中部筛选功能区 (10%-15%)：查询条件/查询重置按钮/展开收起，卡片背景色，小行间距，默认一行
 *   - 下部列表区     (65%-75%)：数据表格/分页器，卡片背景色，小行间距，默认每页30条
 *
 * 新增特性：
 *   - quickFilter / defaultQuickFilter / onQuickFilterChange：今天/本周/本月/本年快速筛选，统计卡片随之联动
 *   - collapsible / defaultCollapsed：筛选区可折叠
 *   - onFilterChange：筛选内容变化触发查询
 *   - 表格列宽拖拽（ResizeContext）、列显隐设置
 *   - defaultPageSize：默认每页 30 条
 */
export default function ThreeSectionPage({
  title,
  breadcrumbs,
  stats,
  filters,
  actions,
  table,
  compact = true,
  onSearch,
  onReset,
  // 快速筛选
  quickFilter = true,
  defaultQuickFilter = 'month',
  onQuickFilterChange,
  // 筛选区折叠
  collapsible = true,
  defaultCollapsed = false,
  // 内容变化触发查询
  onFilterChange,
  // 列显隐配置
  columnsConfigurable = true,
}) {
  const [quickValue, setQuickValue] = useState(defaultQuickFilter)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // 处理快速筛选变化
  const handleQuickChange = (val) => {
    setQuickValue(val)
    onQuickFilterChange?.(val)
  }

  // 渲染单个筛选项
  const renderFilterItem = (f) => {
    if (!f) return null
    // 内容变化触发查询
    const handleChange = (v) => {
      f.onChange?.(v)
      onFilterChange?.(f.field, v)
    }
    if (f.type === 'input') {
      return (
        <Input
          placeholder={f.placeholder}
          allowClear
          prefix={f.icon}
          value={f.value}
          onChange={(e) => {
            f.onChange?.(e)
            onFilterChange?.(f.field, e.target.value)
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
        />
      )
    }
    if (f.type === 'rangepicker') {
      return (
        <RangePicker
          style={{ width: '100%' }}
          value={f.value}
          onChange={handleChange}
        />
      )
    }
    return null
  }

  return (
    <div className="three-section-page">
      {/* ============ 上部：页面信息区 ============ */}
      <div className="section-info">
        <div className="section-info-header">
          <div className="section-info-title">
            {breadcrumbs && <div className="section-breadcrumbs">{breadcrumbs}</div>}
            <div className="section-title-text">{title}</div>
          </div>
          <Space className="section-info-actions">{actions}</Space>
        </div>

        {/* 快速筛选：今天/本周/本月/本年，默认本月 */}
        {quickFilter && (
          <div className="quick-filter-bar">
            <Segmented
              options={QUICK_FILTER_OPTIONS}
              value={quickValue}
              onChange={handleQuickChange}
              size="small"
            />
          </div>
        )}

        {/* 统计卡片：跟随快速筛选联动 */}
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

      {/* ============ 中部：筛选功能区 ============ */}
      {filters && (
        <div className="section-filter">
          <div className={`section-filter-body ${collapsed ? 'filter-collapsed' : ''}`}>
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
                  {collapsible && (
                    <Button type="link" size="small" onClick={() => setCollapsed(c => !c)}>
                      {collapsed ? '展开更多' : '收起'}
                      {collapsed ? <DownOutlined /> : <UpOutlined />}
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </div>
        </div>
      )}

      {/* ============ 下部：列表区 ============ */}
      <div className="section-table compact-table">
        {table}
      </div>
    </div>
  )
}

/**
 * 通用操作按钮组
 */
export function ActionButtons({ hasAdd = true, hasExport = true, extra = [], onAdd, addText = '新增' }) {
  return (
    <>
      {hasAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{addText}</Button>}
      {hasExport && <Button icon={<ExportOutlined />}>导出</Button>}
      {extra}
    </>
  )
}

/**
 * 表格列显隐设置下拉
 * 用法：<Dropdown overlay={<ColumnSettings columns={columns} visibleKeys={visible} onChange={setVisible} />}><Button icon={<SettingOutlined />} /></Dropdown>
 */
export function ColumnSettings({ columns, visibleKeys, onChange }) {
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

/**
 * 计算操作列宽度的工具函数
 * 规范：1-3个功能 80px，4个功能 100px
 */
export function getActionColumnWidth(actionCount) {
  return actionCount >= 4 ? 100 : 80
}

/**
 * 料品名称列的默认配置
 * 规范：列宽默认最小200，自动换行
 */
export const materialNameColumn = {
  width: 200,
  render: (text) => (
    <div style={{ wordBreak: 'break-word', whiteSpace: 'normal', minWidth: 200 }}>
      {text}
    </div>
  ),
}
