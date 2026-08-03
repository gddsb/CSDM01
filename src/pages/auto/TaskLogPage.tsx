import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Select, Tag, Space, Card, Row, Col, Progress, Descriptions, Modal, Popconfirm } from 'antd'
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'

interface SyncTask {
  task_id: number
  task_biz_id: string
  task_type: string
  status: string
  progress: number
  current_step: string
  steps: any[]
  total_records: number
  error_msg: string
  started_at: string
  ended_at: string
  created_at: string
}

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  running: { color: 'processing', text: '执行中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
}

const TYPE_LABELS: Record<string, string> = {
  items: '料品数据',
  customers: '客户数据',
  env_monitor: '环境监测',
  weather: '气象信息',
}

export default function TaskLogPage() {
  const message = useMessage()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SyncTask[]>([])
  const [taskType, setTaskType] = useState<string>('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<SyncTask | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/auto/sync-tasks', { params: { taskType, limit: 100 } })
      setData(res.data || [])
    } catch (err: any) {
      message.error(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [taskType])

  const showDetail = async (record: SyncTask) => {
    try {
      const res = await api.get(`/auto/sync-tasks/${record.task_biz_id || record.task_id}`)
      setDetail(res.data)
      setDetailOpen(true)
    } catch (err: any) {
      message.error(err.message || '加载详情失败')
    }
  }

  const handleDelete = async (record: SyncTask) => {
    try {
      await api.delete(`/auto/sync-tasks/${record.task_biz_id || record.task_id}`)
      message.success('删除成功')
      loadData()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '任务ID', dataIndex: 'task_biz_id', key: 'task_biz_id', width: 220, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '类型', dataIndex: 'task_type', key: 'task_type', width: 100, render: (t: string) => <Tag>{TYPE_LABELS[t] || t}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => {
      const m = STATUS_MAP[s] || { color: 'default', text: s }
      return <Tag color={m.color}>{m.text}</Tag>
    }},
    { title: '进度', dataIndex: 'progress', key: 'progress', width: 180, render: (p: number) => <Progress percent={p} size="small" status={p === 100 ? 'success' : undefined} /> },
    { title: '当前步骤', dataIndex: 'current_step', key: 'current_step', width: 200, ellipsis: true },
    { title: '记录数', dataIndex: 'total_records', key: 'total_records', width: 80, align: 'center' as const },
    { title: '开始时间', dataIndex: 'started_at', key: 'started_at', width: 170, render: (v: string) => v ? formatDateTime(v) : '-' },
    { title: '操作', key: 'action', width: 140, fixed: 'right' as const, render: (_: any, r: SyncTask) => (
      <Space>
        <Button type="link" onClick={() => showDetail(r)}>详情</Button>
        {r.status === 'failed' && (
          <Popconfirm
            title="确定删除此任务日志？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(r)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        )}
      </Space>
    )},
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <ClockCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>任务日志</span>
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                style={{ width: 150 }}
                placeholder="筛选类型"
                allowClear
                value={taskType || undefined}
                onChange={setTaskType}
                options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Table
        rowKey="task_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1200 }}
      />
      <Modal
        title="任务详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        {detail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="任务ID" span={2}><code>{detail.task_biz_id}</code></Descriptions.Item>
            <Descriptions.Item label="类型">{TYPE_LABELS[detail.task_type] || detail.task_type}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => { const m = STATUS_MAP[detail.status] || { color: 'default', text: detail.status }; return <Tag color={m.color}>{m.text}</Tag> })()}
            </Descriptions.Item>
            <Descriptions.Item label="进度" span={2}>
              <Progress percent={detail.progress} />
            </Descriptions.Item>
            <Descriptions.Item label="记录数">{detail.total_records || 0}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{detail.started_at ? formatDateTime(detail.started_at) : '-'}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{detail.ended_at ? formatDateTime(detail.ended_at) : '-'}</Descriptions.Item>
            {detail.error_msg && (
              <Descriptions.Item label="错误信息" span={2}><span style={{ color: '#ff4d4f' }}>{detail.error_msg}</span></Descriptions.Item>
            )}
            {detail.steps && detail.steps.length > 0 && (
              <Descriptions.Item label="执行步骤" span={2}>
                <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {detail.steps.map((s: any, i: number) => (
                    <div key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#999' }}>[{s.time}]</span> {s.message}
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
