import { useState } from 'react'
import { Button, Space, Table, Tag, message, Divider, Alert, Tooltip, Progress } from 'antd'
import { SearchOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function PermissionAuditPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const run = async (mode: 'report' | 'sync' = 'report') => {
    setLoading(true)
    try {
      const res = await api.get(`/iam/audit/permission${mode === 'sync' ? '/sync' : ''}`)
      const r = res.data
      setReport(r)
      if (mode === 'sync') message.success(`自动同步完成，共 ${r.diffs?.length ?? 0} 项`)
      else message.success(`审查完成，发现 ${r.total} 项差异`)
    } catch (e: any) { message.error(e?.message) } finally { setLoading(false) }
  }

  const missing = report?.diffs?.filter((d: any) => d.type === 'missing') ?? []
  const extra = report?.diffs?.filter((d: any) => d.type === 'extra') ?? []

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>功能权限审查</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>扫描后端所有 requirePerm() / permissionRequired() 权限码引用，与 sys_permission 字典比对，输出缺失/多余节点。</p>

      <Space>
        <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => run('report')}>运行审查 (仅报告)</Button>
        <Tooltip title="自动把缺失的权限码插入 sys_permission (type=api, visible=0) — 谨慎使用">
          <Button danger icon={<SyncOutlined />} loading={loading} onClick={() => run('sync')}>自动同步到权限池</Button>
        </Tooltip>
        <Button icon={<ReloadOutlined />} onClick={() => setReport(null)}>清空结果</Button>
      </Space>

      {report && (
        <>
          <Divider />
          <Alert style={{ marginBottom: 12 }}
            message={`审查完成 · 发现 ${report.total} 项差异 · 生成时间 ${new Date(report.generatedAt).toLocaleString()}`}
            type={report.total === 0 ? 'success' : 'warning'} showIcon />
          <Space size="large" style={{ marginBottom: 16 }}>
            <Tag color="red">缺失 {missing.length} (后端引用但字典不存在)</Tag>
            <Tag color="orange">多余 {extra.length} (字典存在但后端未引用)</Tag>
          </Space>

          {missing.length > 0 && (
            <>
              <h3 style={{ color: '#cf1322' }}>⚠️ 缺失 — 后端引用但字典不存在（需要手动去权限资源池页面补）</h3>
              <Table size="small" rowKey="perm_code"
                columns={[
                  { title: '类型', dataIndex: 'type', width: 80, render: () => <Tag color="red">missing</Tag> },
                  { title: '缺失的权限码', dataIndex: 'perm_code', width: 300, render: (v) => <code>{v}</code> },
                  { title: '调用位置', width: 300, render: (_: any, r: any) => <code>{r.file}:{r.line}</code> },
                  { title: '详细信息', dataIndex: 'message' },
                ]}
                dataSource={missing} pagination={false} scroll={{ y: 300 }} />
              <Divider />
            </>
          )}

          {extra.length > 0 && (
            <>
              <h3 style={{ color: '#d48806' }}>ℹ️ 多余 — 字典存在但后端未直接引用（可能是前端路由/菜单节点，不需删除）</h3>
              <Table size="small" rowKey="perm_code"
                columns={[
                  { title: '类型', dataIndex: 'type', width: 80, render: () => <Tag color="orange">extra</Tag> },
                  { title: '权限码', dataIndex: 'perm_code', width: 300, render: (v) => <code>{v}</code> },
                  { title: '详细信息', dataIndex: 'message' },
                ]}
                dataSource={extra} pagination={false} scroll={{ y: 300 }} />
            </>
          )}
        </>
      )}
    </div>
  )
}
