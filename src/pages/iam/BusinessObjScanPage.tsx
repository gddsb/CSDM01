import { useState } from 'react'
import { Button, Space, Table, Tag, message, Divider, Alert } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function BusinessObjScanPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await api.get('/iam/audit/business-objects')
      setReport(res.data)
      message.success(`扫描完成，发现 ${res.data.total} 项差异`)
    } catch (e: any) { message.error(e?.message) } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>业务对象扫描</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>扫描后端所有 dataScope({'{businessObj}'}) / bizStatusCheck({'{businessObj, operateKey}'}) 引用，与 sys_business_object / sys_biz_status_rule 字典比对。</p>
      <Alert style={{ marginBottom: 12 }} type="info" showIcon
        message="🚫 本扫描器只报告差异 — 不会自动新增 sys_business_object 字典记录，必须由开发者手动确认业务模块后再创建。" />

      <Space>
        <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={run}>运行扫描</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setReport(null)}>清空</Button>
      </Space>

      {report && (
        <>
          <Divider />
          <Alert style={{ marginBottom: 12 }}
            message={`扫描完成 · 发现 ${report.total} 项差异 · 生成时间 ${new Date(report.generatedAt).toLocaleString()}`}
            type={report.total === 0 ? 'success' : 'warning'} showIcon />

          <Table size="small" rowKey={(r, i) => i}
            columns={[
              { title: '类型', dataIndex: 'type', width: 100,
                render: (v) => v === 'missing' ? <Tag color="red">缺失</Tag> : <Tag color="orange">警告</Tag> },
              { title: '字段', width: 200, render: (_: any, r: any) => r.obj_code ? <code>{r.obj_code}</code> : r.dim_code ? <code>{r.dim_code}</code> : r.perm_code },
              { title: '代码位置', width: 300, render: (_: any, r: any) => r.file ? <code>{r.file}:{r.line}</code> : '-' },
              { title: '详细信息', dataIndex: 'message' },
            ]}
            dataSource={report.diffs} pagination={false} scroll={{ x: 'max-content', y: 400 }} />
        </>
      )}
    </div>
  )
}
