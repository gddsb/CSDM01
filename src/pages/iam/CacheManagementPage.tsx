import { useState, useEffect } from 'react'
import { Button, Space, Card, Row, Col, Statistic, Tag, message, Alert } from 'antd'
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function CacheManagementPage() {
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/iam/cache/stats')
      setStats(res.data ?? {})
    } catch (e: any) { message.error(e?.message) } finally { setLoading(false) }
  }

  const clearAll = async () => {
    try {
      const res = await api.post('/iam/cache/clear')
      message.success(res.data?.message ?? '缓存已清除')
      load()
    } catch (e: any) { message.error(e?.message) }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h2 style={{ marginBottom: 8 }}>权限引擎缓存管理</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        权限引擎所有查询（功能权限、数据权限规则、业务对象字典、业务状态规则）均走内存缓存。修改 sys_*_data_scope / sys_business_object / sys_biz_status_rule 等后会自动失效；但批量脚本或手动改数据库时需要手动清除。
      </p>

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="缓存策略：当前用 Node.js 内存 Map 实现（process 重启即清空）；生产如需多进程/多节点共享，替换 permissionCache.ts 内部为 Redis 即可，上层代码无需改动。" />

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新状态</Button>
        <Button danger icon={<ClearOutlined />} onClick={clearAll}>全部清除</Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card><Statistic title="内存缓存条目数" value={stats.totalKeys ?? 0} suffix="条" /></Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card><Statistic title="命中 / 总请求" value={(stats.hitRate ?? 0).toFixed(1)} suffix="%" /></Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card><Statistic title="最后清除时间" value={stats.lastCleared ?? '—'} /></Card>
        </Col>
      </Row>

      {stats.keys && stats.keys.length > 0 && (
        <Card title="当前缓存 Key 清单 (前 50)" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.keys.slice(0, 50).map((k: string) => <Tag key={k} color="blue">{k}</Tag>)}
            {stats.keys.length > 50 && <Tag>+{stats.keys.length - 50} 更多…</Tag>}
          </div>
        </Card>
      )}
    </div>
  )
}
