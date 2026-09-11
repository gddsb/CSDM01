import React from 'react'
import { Tag, Button, Space, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { formatVersionNo, formatDate } from '../../../utils'
import type { ColumnsType } from 'antd/es/table'

export const statusColorMap = {
  '开立': 'default',
  '下发': 'processing',
  '开工': 'processing',
  '完工': 'success',
  '关闭': 'error',
}

export const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '下发', value: '下发' },
  { label: '开工', value: '开工' },
  { label: '完工', value: '完工' },
  { label: '关闭', value: '关闭' },
]

interface BuildColumnsArgs {
  onView: (record: any) => void
  onEdit: (record: any) => void
  onRelease?: (record: any) => void
  onStart?: (record: any) => void
  onFinish?: (record: any) => void
  onClose?: (record: any) => void
  canEdit: boolean
  canRelease?: boolean
  canFinish?: boolean
  canClose?: boolean
}

export function buildOrderColumns({
  onView, onEdit, onRelease, onStart, onFinish, onClose,
  canEdit, canRelease, canFinish, canClose,
}: BuildColumnsArgs): ColumnsType<any> {
  const renderActions = (r: any) => {
    if (r.status === '开立') {
      return (
        <Space size={0}>
          {canRelease && onRelease && (
            <Button type="link" size="small" onClick={() => onRelease(r)}>下发</Button>
          )}
          {canEdit && (
            <Button type="link" size="small" onClick={() => onEdit(r)}>编辑</Button>
          )}
          <Button type="link" size="small" onClick={() => onView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '下发') {
      return (
        <Space size={0}>
          {onStart && (
            <Button type="link" size="small" onClick={() => onStart(r)}>开工</Button>
          )}
          {canClose && onClose && (
            <Button type="link" size="small" danger onClick={() => onClose(r)}>关闭</Button>
          )}
          <Button type="link" size="small" onClick={() => onView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '开工') {
      return (
        <Space size={0}>
          {canFinish && onFinish && (
            <Button type="link" size="small" onClick={() => onFinish(r)}>完工</Button>
          )}
          {canClose && onClose && (
            <Button type="link" size="small" danger onClick={() => onClose(r)}>关闭</Button>
          )}
          <Button type="link" size="small" onClick={() => onView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '完工') {
      return (
        <Space size={0}>
          {canClose && onClose && (
            <Button type="link" size="small" danger onClick={() => onClose(r)}>关闭</Button>
          )}
          <Button type="link" size="small" onClick={() => onView(r)}>查看</Button>
        </Space>
      )
    }
    // 关闭或其他状态：仅查看
    return (
      <Space size={0}>
        <Button type="link" size="small" onClick={() => onView(r)}>查看</Button>
      </Space>
    )
  }

  return [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 160, fixed: 'left' as const },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130, fixed: 'left' as const },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 200, render: (text) => <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{text}</div> },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120, ellipsis: true },
    { title: '菲林编号', dataIndex: 'film_version', key: 'film_version', width: 120 },
    { title: '版本', dataIndex: 'version_no', key: 'version_no', width: 60, render: v => formatVersionNo(v) },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => {
        const val = v || 0
        return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{val.toLocaleString()}</span>
      }
    },
    { title: 'U9合格数', dataIndex: 'u9_qualified', key: 'u9_qualified', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '计划时间', key: 'plan_time', width: 160,
      render: (_, r) => <span style={{ fontSize: 12 }}>{formatDate(r.plan_start_time)}<br />~ {formatDate(r.plan_end_time)}</span>,
    },
    { title: 'U9状态', dataIndex: 'u9_status', key: 'u9_status', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 220, render: (_, r) => renderActions(r) },
  ]
}
