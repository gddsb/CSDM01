import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Row, Col, Card, Statistic, Tag, List, Table, Space, Button, Empty, Spin, Progress } from 'antd'
import { EnvironmentOutlined, AlertOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'

interface FactorData {
  monitor_id: number
  factor_id: string
  factor_name: string
  device_name: string
  value: number
  unit: string
  device_status: string
  collect_time: string
}

interface AlarmData {
  alarm_id: number
  factor_name: string
  device_name: string
  alarm_info: string
  alarm_level: number
  current_value: number
  alarm_range: string
  unit: string
  alarm_time: string
  is_handled: number
}

export default function EnvironmentBigScreen() {
  const message = useMessage()
  const [loading, setLoading] = useState(false)
  const [factors, setFactors] = useState<FactorData[]>([])
  const [alarms, setAlarms] = useState<{ total: number; unhandled: number; today: number; recent: AlarmData[] }>({ total: 0, unhandled: 0, today: 0, recent: [] })
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/auto/dashboard/overview')
      setFactors(res.data?.factors || [])
      setAlarms(res.data?.alarms || { total: 0, unhandled: 0, today: 0, recent: [] })
      setLastUpdate(res.data?.lastUpdate || '')
    } catch (err: any) {
      message.error(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const getAreaColor = (factorName: string) => {
    if (factorName.includes('车间')) return '#ff7a45'
    if (factorName.includes('仓库')) return '#1890ff'
    return '#52c41a'
  }

  const getValueColor = (factorName: string, value: number) => {
    const isTemp = factorName.includes('温度')
    const isHum = factorName.includes('湿度')
    if (isTemp) {
      if (value > 30) return '#ff4d4f'
      if (value > 26) return '#fa8c16'
      return '#52c41a'
    }
    if (isHum) {
      if (value > 75) return '#ff4d4f'
      if (value > 65) return '#fa8c16'
      return '#52c41a'
    }
    return '#1890ff'
  }

  const alarmColumns = [
    { title: '因子', dataIndex: 'factor_name', key: 'factor_name', width: 140 },
    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 140 },
    { title: '报警信息', dataIndex: 'alarm_info', key: 'alarm_info', ellipsis: true },
    { title: '级别', dataIndex: 'alarm_level', key: 'alarm_level', width: 70, align: 'center' as const, render: (v: number) => <Tag color={v >= 3 ? 'red' : v >= 2 ? 'orange' : 'yellow'}>{v}</Tag> },
    { title: '当前值', dataIndex: 'current_value', key: 'current_value', width: 80, render: (v: number, r: any) => `${v} ${r.unit || ''}` },
    { title: '报警时间', dataIndex: 'alarm_time', key: 'alarm_time', width: 150, render: (v: string) => formatDateTime(v) },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="监测因子"
              value={factors.length}
              prefix={<EnvironmentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总报警数"
              value={alarms.total}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未处理报警"
              value={alarms.unhandled}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日报警"
              value={alarms.today}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            {lastUpdate && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>更新：{formatDateTime(lastUpdate)}</div>}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card
            title={<Space><EnvironmentOutlined />实时监测数据</Space>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>}
          >
            <Spin spinning={loading}>
              {factors.length === 0 ? (
                <Empty description="暂无监测数据" />
              ) : (
                <Row gutter={[12, 12]}>
                  {factors.map((f) => (
                    <Col span={8} key={f.monitor_id || f.factor_id}>
                      <Card size="small" style={{ borderLeft: `4px solid ${getAreaColor(f.factor_name)}` }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{f.factor_name}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 24, fontWeight: 600, color: getValueColor(f.factor_name, f.value) }}>{f.value}</span>
                          <span style={{ fontSize: 13, color: '#999' }}>{f.unit}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>{f.device_name || '-'}</div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Spin>
          </Card>
        </Col>
        <Col span={10}>
          <Card title={<Space><AlertOutlined />最近报警</Space>} style={{ height: '100%' }}>
            <Table
              rowKey="alarm_id"
              columns={alarmColumns}
              dataSource={alarms.recent}
              size="small"
              pagination={false}
              scroll={{ x: 700, y: 480 }}
              locale={{ emptyText: '暂无报警记录' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
