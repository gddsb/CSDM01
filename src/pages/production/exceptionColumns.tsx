import React from 'react'
import dayjs from 'dayjs'
import { Button, Input, Select, TimePicker, Popconfirm, message } from 'antd'
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { ColumnsType } from 'antd/es/table'
import { formatDateTime } from '../../utils'
import { ExceptionRecord } from './types'

interface BuildExceptionColumnsParams {
  isEditable: boolean
  deviceOptions: Array<{ label: string; value: number | string }>
  exceptionCategories: Array<{ label: string; value: string }>
  exceptionList: ExceptionRecord[]
  reportTime?: string | Date | null
  onChange: (id: number | string, field: string, value: unknown) => void
  onDelete: (record: ExceptionRecord) => void
  openImageDrawer: (title: string, images: unknown[], context: Record<string, unknown>) => void
}

export function buildExceptionColumns(params: BuildExceptionColumnsParams): ColumnsType<ExceptionRecord> {
  const { isEditable, deviceOptions, exceptionCategories, exceptionList, reportTime, onChange, onDelete, openImageDrawer } = params
  const disabledTime = () => {
    const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    if (baseDate !== today) return {}
    const current = dayjs()
    return {
      disabledHours: () => Array.from({ length: 24 }, (_, i) => i).filter(h => h > current.hour()),
      disabledMinutes: (selHour: number) => {
        if (selHour < current.hour()) return []
        return Array.from({ length: 60 }, (_, i) => i).filter(m => m > current.minute())
      },
    }
  }

  const buildTime = (d: dayjs.Dayjs): string => {
    const baseDate = reportTime ? dayjs(reportTime).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
    return `${baseDate}T${d.format('HH:mm:ss')}`
  }

  return [
    {
      title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 120,
      render: (val, record) => isEditable ? (
        <Select
          placeholder="请选择"
          value={val || undefined}
          onChange={(v) => onChange(record.id, 'exception_type', v)}
          options={exceptionCategories}
          style={{ width: '100%' }}
          size="small"
          popupClassName="mes-select-dropdown"
        />
      ) : val || '-',
    },
    {
      title: '设备', dataIndex: 'device_name', key: 'device_name', width: 150,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择设备"
          value={record.device_id || undefined}
          onChange={(v) => onChange(record.id, 'device_id', v)}
          options={deviceOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          size="small"
          allowClear
          popupClassName="mes-select-dropdown"
        />
      ) : record.device_name || '-',
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const newTime = buildTime(d)
              if (reportTime && dayjs(newTime).isBefore(dayjs(reportTime))) {
                message.warning('开始时间不能早于报工时间')
                return
              }
              if (dayjs(newTime).isAfter(dayjs())) {
                message.warning('开始时间不能晚于当前时间')
                return
              }
              const overlap = exceptionList.some(e => {
                if (String(e.id) === String(record.id)) return false
                if (!e.start_time) return false
                const eStart = dayjs(e.start_time as string | number | Date)
                const eEnd = e.end_time ? dayjs(e.end_time as string | number | Date) : null
                const newStart = dayjs(newTime)
                const newEnd = record.end_time ? dayjs(record.end_time as string | number | Date) : newStart
                if (eEnd) return newStart.isBefore(eEnd) && newEnd.isAfter(eStart)
                return newEnd.isAfter(eStart) || newStart.isSame(eStart)
              })
              if (overlap) {
                message.warning('开始时间与已有异常记录的时间区间重叠')
                return
              }
              onChange(record.id, 'start_time', newTime)
            } else {
              onChange(record.id, 'start_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
          disabledTime={disabledTime}
        />
      ) : formatDateTime(val),
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const newTime = buildTime(d)
              if (record.start_time && dayjs(newTime).isBefore(dayjs(record.start_time as string | number | Date))) {
                message.warning('结束时间不能小于开始时间')
                return
              }
              if (dayjs(newTime).isAfter(dayjs())) {
                message.warning('结束时间不能晚于当前时间')
                return
              }
              if (record.start_time) {
                const overlap = exceptionList.some(e => {
                  if (String(e.id) === String(record.id)) return false
                  if (!e.start_time) return false
                  const eStart = dayjs(e.start_time as string | number | Date)
                  const eEnd = e.end_time ? dayjs(e.end_time as string | number | Date) : null
                  const newStart = dayjs(record.start_time as string | number | Date)
                  const newEnd = dayjs(newTime)
                  if (eEnd) return newStart.isBefore(eEnd) && newEnd.isAfter(eStart)
                  return newEnd.isAfter(eStart)
                })
                if (overlap) {
                  message.warning('结束时间与已有异常记录的时间区间重叠')
                  return
                }
              }
              onChange(record.id, 'end_time', newTime)
            } else {
              onChange(record.id, 'end_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
          disabledTime={disabledTime}
        />
      ) : formatDateTime(val),
    },
    { title: '时长(小时)', dataIndex: 'duration', key: 'duration', width: 100 },
    {
      title: '异常描述', dataIndex: 'description', key: 'description', width: 240,
      render: (val, record) => isEditable ? (
        <Input.TextArea
          placeholder="请输入异常描述"
          value={val || ''}
          onChange={(e) => onChange(record.id, 'description', e.target.value)}
          size="small"
          maxLength={200}
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
      ) : (
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>{val || '-'}</span>
      ),
    },
    {
      title: '图片', dataIndex: 'exception_images', key: 'exception_images', width: 100,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('异常图片', val || [], { listType: 'exception', recordId: record.id, field: 'exception_images', category: 'exception' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => onDelete(record)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]
}
