import { Space, Button, Input, Select, DatePicker, Row, Col, Checkbox } from 'antd'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, ExportOutlined, SettingOutlined
} from '@ant-design/icons'
import React from 'react'

const { RangePicker } = DatePicker

/**
 * 三段式页面通用组件
 *
 * 规范：
 *   - 上部页面信息区 (15%-20%)：标题/面包屑/统计卡片/主要操作按钮(新增/导出/配置)，主背景色，常规间距
 *   - 中部筛选功能区 (10%-15%)：查询条件/查询重置按钮，卡片背景色，小行间距(4-8px)，默认一行
 *   - 下部列表区     (65%-75%)：数据表格/分页器/总计记录数，卡片背景色，小行间距，默认每页30条
 *
 * 交互特性：
 *   - 中部筛选区默认显示3-4行常用筛选条件，支持编辑框、下拉框内容变化触发查询
 *   - 列表区表格支持列宽拖拽、列排序、列显隐设置
 *   - 上部统计卡片数据跟随中部筛选条件联动更新
 *
 * 列宽规范：
 *   - 料品名称列宽默认最小200px，自动换行
 *   - 操作列：1-3个功能 80px，4个功能 100px
 */
export default function ThreeSectionPage({
  title,
  breadcrumbs,
  stats,
  filters,
  actions,
  table,
  onSearch,
  onReset,
  // 内容变化触发查询
  onFilterChange,
}) {
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
          mode={f.mode}
          disabled={f.disabled}
        />
      )
    }
    if (f.type === 'checkbox-group') {
      return (
        <Checkbox.Group
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

        {/* 统计卡片：跟随中部筛选条件联动更新 */}
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

      {/* ============ 下部：列表区 ============ */}
      <div className="section-table compact-table">
        {table}
      </div>
    </div>
  )
}

/**
 * 通用操作按钮组
 * 配色规范：
 *   - 新增按钮 (btn-add)：主色渐变 (primary → secondary)
 *   - 导出按钮 (btn-export)：成功色渐变
 *   - 配置按钮 (btn-config)：强调色渐变
 */
export function ActionButtons({ hasAdd = true, hasExport = true, hasConfig = false, extra = [], onAdd, onExport, onConfig, addText = '新增' }) {
  return (
    <div className="action-buttons-group">
      {hasAdd && <Button type="primary" className="btn-add" icon={<PlusOutlined />} onClick={onAdd}>{addText}</Button>}
      {hasExport && <Button className="btn-export" icon={<ExportOutlined />} onClick={onExport}>导出</Button>}
      {hasConfig && <Button className="btn-config" icon={<SettingOutlined />} onClick={onConfig}>配置</Button>}
      {extra}
    </div>
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
