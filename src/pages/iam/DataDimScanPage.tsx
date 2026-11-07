import { useState } from 'react'
import { Button, Space, Table, Tag, message, Divider, Alert } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function DataDimScanPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await api.get('/iam/audit/data-dimensions')
      setReport(res.data)
      message.success(`扫描完成，发现 ${res.data.total} 项差异`)
    } catch (e: any) { message.error(e?.message) } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>数据维度扫描</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>扫描 sys_data_scope 规则中使用的 dim_code，对比 sys_data_dimension 字典是否存在；反之也查字典里定义但未被任何规则使用的维度。</p>

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
                render: (v) => v === 'missing' ? <Tag color="red">字典缺失</Tag> : <Tag color="orange">字典未使用</Tag> },
              { title: '维度编码', dataIndex: 'dim_code', width: 200, render: (v) => <code>{v}</code> },
              { title: '详细信息', dataIndex: 'message' },
            ]}
            dataSource={report.diffs} pagination={false} scroll={{ x: 'max-content', y: 400 }} />
        </>
      )}
    </div>
  )
}
