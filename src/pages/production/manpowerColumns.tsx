import React from 'react'
import { InputNumber, Select, Tag } from 'antd'
import { ColumnsType } from 'antd/es/table'
import { formatDateTime } from '../../utils'
import { ManpowerRecord, ReportItem } from './types'

interface BuildManpowerColumnsParams {
  isEditable: boolean
  selectedReport?: ReportItem | null
  onChange: (id: number | string, field: string, value: unknown) => void
}

export function buildManpowerColumns(params: BuildManpowerColumnsParams): ColumnsType<ManpowerRecord> {
  const { isEditable, selectedReport, onChange } = params
  return [
    {
      title: '班次', dataIndex: 'shift', key: 'shift', width: 100,
      render: (val) => isEditable ? (
        <Select
          value={val || '白班'}
          disabled
          options={[
            { label: '白班', value: '白班' },
            { label: '夜班', value: '夜班' },
          ]}
          style={{ width: '100%' }}
          size="small"
          popupClassName="mes-select-dropdown"
        />
      ) : val || '-',
    },
    {
      title: '开始时间', dataIndex: 'report_start_time', key: 'report_start_time', width: 150,
      render: () => formatDateTime(selectedReport?.report_time as string | Date | undefined),
    },
    {
      title: '结束时间', dataIndex: 'report_end_time', key: 'report_end_time', width: 150,
      render: () => {
        if (selectedReport?.status === '完工') {
          return formatDateTime(selectedReport.finish_time as string | Date | undefined)
        }
        return <Tag color="processing">进行中</Tag>
      },
    },
    { title: '工时(小时)', dataIndex: 'hours', key: 'hours', width: 100 },
    {
      title: '技工', dataIndex: 'skilled_count', key: 'skilled_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber min={0} value={val} onChange={(v) => onChange(record.id, 'skilled_count', v || 0)} style={{ width: '100%' }} size="small" />
      ) : val,
    },
    {
      title: '普工', dataIndex: 'general_count', key: 'general_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber min={0} value={val} onChange={(v) => onChange(record.id, 'general_count', v || 0)} style={{ width: '100%' }} size="small" />
      ) : val,
    },
    {
      title: '劳务工', dataIndex: 'labor_count', key: 'labor_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber min={0} value={val} onChange={(v) => onChange(record.id, 'labor_count', v || 0)} style={{ width: '100%' }} size="small" />
      ) : val,
    },
    {
      title: '其他', dataIndex: 'other_count', key: 'other_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber min={0} value={val} onChange={(v) => onChange(record.id, 'other_count', v || 0)} style={{ width: '100%' }} size="small" />
      ) : val,
    },
    { title: '总人数', dataIndex: 'total_people', key: 'total_people', width: 80 },
    { title: '总工时', dataIndex: 'man_hours', key: 'man_hours', width: 100 },
  ]
}
