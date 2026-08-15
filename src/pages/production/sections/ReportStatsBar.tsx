import React from 'react'
import { Col, Row, Space } from 'antd'

export interface ReportStatItem {
  label: string
  value: number | string
  color: string
  dynamicLabel?: string
}

interface ReportStatsBarProps {
  items: ReportStatItem[]
}

export function ReportStatsBar({ items }: ReportStatsBarProps) {
  return (
    <>
      <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#333' }}>报工单统计（当前报工单汇总）</div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {items.map((item) => (
          <Col key={item.label} flex="1 1 0">
            <Space size={4} align="baseline" wrap={false}>
              <span style={{ color: '#666' }}>{item.dynamicLabel ?? item.label}</span>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: item.color, whiteSpace: 'nowrap' }}>{item.value}</span>
            </Space>
          </Col>
        ))}
      </Row>
    </>
  )
}
