import React from 'react'
import dayjs from 'dayjs'
import { Button, Input, Select, Popconfirm, message } from 'antd'
import { DeleteOutlined, PictureOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
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
  onStart: (record: ExceptionRecord) => void
  onFinish: (record: ExceptionRecord) => void
  openImageDrawer: (title: string, images: unknown[], context: Record<string, unknown>) => void
}

export function buildExceptionColumns(params: BuildExceptionColumnsParams): ColumnsType<ExceptionRecord> {
  const { isEditable, deviceOptions, exceptionCategories, onChange, onDelete, onStart, onFinish, openImageDrawer } = params

  // 规则：已结束（end_time 非空）→ 不可编辑、不可删除
  //       已保存未结束 → 可编辑、可删除
  const isFinished = (record: any): boolean => !!record.end_time
  const canEdit = (record: any): boolean => !isFinished(record)
  const canDelete = (record: any): boolean => !isFinished(record)
  const isAutoCreated = (record: any): boolean =>
    record.exception_type === '换型换线' || (record.description && String(record.description).includes('自动生成'))

  return [
    {
      title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 120,
      render: (val, record) => {
        if (!isEditable || !canEdit(record)) return val || '-'
        return (
          <Select
            placeholder="请选择"
            value={val || undefined}
            onChange={(v) => onChange(record.id, 'exception_type', v)}
            options={exceptionCategories}
            style={{ width: '100%' }}
            size="small"
            popupClassName="mes-select-dropdown"
          />
        )
      },
    },
    {
      title: '设备', dataIndex: 'device_name', key: 'device_name', width: 150,
      render: (_, record) => {
        if (!isEditable || !canEdit(record)) return record.device_name || '-'
        return (
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
        )
      },
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 180,
      render: (val, record) => {
        // 不可编辑或已结束 → 只读显示
        if (!isEditable || !canEdit(record)) return formatDateTime(val)
        // 可编辑 + 未结束 + 还没有 start_time → 显示"▶ 开始异常"按钮
        if (!val) {
          return (
            <Button type="primary" size="small" ghost icon={<PlayCircleOutlined />}
              onClick={() => onStart(record)}>▶ 开始异常</Button>
          )
        }
        // 有 start_time → 只读显示完整日期时间
        return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDateTime(val)}</span>
      },
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 180,
      render: (val, record) => {
        // 不可编辑或已结束 → 只读显示
        if (!isEditable || !canEdit(record)) return formatDateTime(val)
        // 可编辑 + 未结束 + 还没有 end_time → 显示"✓ 结束"按钮
        if (!val) {
          return (
            <Button type="primary" size="small" icon={<CheckCircleOutlined />}
              onClick={() => onFinish(record)}>✓ 结束</Button>
          )
        }
        // 有 end_time → 只读显示完整日期时间
        return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDateTime(val)}</span>
      },
    },
    { title: '时长(分钟)', dataIndex: 'duration', key: 'duration', width: 100, align: 'right',
      render: (v: any) => <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{Math.round(Number(v || 0) * 60)}</span>,
    },
    {
      title: '异常描述', dataIndex: 'description', key: 'description', width: 240,
      render: (val, record) => {
        if (!isEditable || !canEdit(record)) {
          return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>{val || '-'}</span>
        }
        return (
          <Input.TextArea
            placeholder="请输入异常描述"
            value={val || ''}
            onChange={(e) => onChange(record.id, 'description', e.target.value)}
            size="small"
            maxLength={200}
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
        )
      },
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
      title: '状态', key: 'status', width: 100,
      render: (_, record) => {
        if (isFinished(record)) {
          return <span style={{ color: 'var(--color-success)', fontSize: 12 }}><CheckCircleOutlined /> 已结束</span>
        }
        return <span style={{ color: 'var(--color-error)', fontSize: 12 }}>进行中</span>
      },
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => {
        if (!isEditable) return null
        const actions: React.ReactNode[] = []
        if (!isFinished(record)) {
          actions.push(
            <Button key="finish" type="link" size="small" icon={<CheckCircleOutlined />}
              onClick={() => onFinish(record)}>结束</Button>,
          )
        }
        if (canDelete(record) && !isAutoCreated(record)) {
          actions.push(
            <Popconfirm key="del" title="确认删除？" onConfirm={() => onDelete(record)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>,
          )
        }
        return <div style={{ display: 'flex', gap: 4 }}>{actions}</div>
      },
    },
  ]
}
