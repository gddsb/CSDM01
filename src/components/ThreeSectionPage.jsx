import { Space, Button, Input, Select, DatePicker, Row, Col } from 'antd'
import { SearchOutlined, ReloadOutlined, PlusOutlined, ExportOutlined } from '@ant-design/icons'
import React from 'react'

const { RangePicker } = DatePicker

// 三段式页面通用组件
export default function ThreeSectionPage({ title, breadcrumbs, stats, filters, actions, table, compact = true }) {
  return (
    <div className="three-section-page">
      {/* 上部：页面信息区 */}
      <div className="section-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: stats ? 16 : 0 }}>
          <div>
            {breadcrumbs && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{breadcrumbs}</div>}
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          </div>
          {actions && <Space>{actions}</Space>}
        </div>
        {stats && (
          <Row gutter={12}>
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

      {/* 中部：筛选功能区 */}
      {filters && (
        <div className="section-filter">
          <Row gutter={[12, 8]}>
            {filters.map((f, i) => (
              <Col key={i} {...(f.col || { span: 6 })}>
                {f.type === 'input' && (
                  <Input placeholder={f.placeholder} allowClear prefix={f.icon} />
                )}
                {f.type === 'select' && (
                  <Select placeholder={f.placeholder} allowClear style={{ width: '100%' }} options={f.options} />
                )}
                {f.type === 'rangepicker' && (
                  <RangePicker style={{ width: '100%' }} />
                )}
              </Col>
            ))}
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                <Button icon={<ReloadOutlined />}>重置</Button>
              </Space>
            </Col>
          </Row>
        </div>
      )}

      {/* 下部：列表区 */}
      <div className="section-table compact-table">
        {table}
      </div>
    </div>
  )
}

// 通用操作按钮组
export function ActionButtons({ hasAdd = true, hasExport = true, extra = [], onAdd, addText = '新增' }) {
  return (
    <>
      {hasAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{addText}</Button>}
      {hasExport && <Button icon={<ExportOutlined />}>导出</Button>}
      {extra}
    </>
  )
}
