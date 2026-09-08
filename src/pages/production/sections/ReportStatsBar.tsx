import React from 'react'

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
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {items.map((item) => (
          <div key={item.label} style={{ flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ color: '#666', fontSize: 13 }}>{item.dynamicLabel ?? item.label}</span>
            <span style={{ fontSize: 18, fontWeight: 'bold', color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>
    </>
  )
}
