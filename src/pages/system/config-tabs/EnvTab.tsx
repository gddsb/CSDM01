import React from 'react'
import { Button, Row, Col, Spin, Typography, Card, Statistic, Descriptions, Tag, Space, Alert } from 'antd'
import { ReloadOutlined, PoweroffOutlined, DatabaseOutlined, SafetyOutlined, CloudServerOutlined } from '@ant-design/icons'
import { formatBytes, formatUptime } from './format'
import { formatDateTime } from '../../../utils'
import type { EnvInfo } from './types'

const { Text } = Typography

interface EnvTabProps {
  envLoading: boolean
  restartLoading: boolean
  envInfo: EnvInfo | null
  loadEnv: () => void
  handleRestart: () => void
}

export default function EnvTab(props: EnvTabProps) {
  const { envLoading, envInfo, loadEnv, handleRestart, restartLoading } = props
  return (
    <Spin spinning={envLoading}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>运行环境</Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={loadEnv}>刷新</Button>
          <Button
            type="primary"
            danger
            icon={<PoweroffOutlined />}
            loading={restartLoading}
            onClick={handleRestart}
          >
            重启服务
          </Button>
        </div>
      </div>
      {envInfo && (
        <>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Node 版本" value={envInfo.node_version} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="运行环境" value={envInfo.env} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Sequelize 版本" value={envInfo.sequelize_version} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="进程 PID" value={envInfo.pid} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderColor: envInfo.frontend_server?.status === 'running' ? '#52c41a' : '#ff4d4f' }}>
                <Statistic
                  title={envInfo.frontend_server?.name || '前端服务器'}
                  value={envInfo.frontend_server?.status === 'running' ? '运行中' : envInfo.frontend_server?.status === 'offline' ? '已停止' : '未知'}
                  valueStyle={{ color: envInfo.frontend_server?.status === 'running' ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
                  suffix={<span style={{ fontSize: 13, color: '#666' }}>端口: {envInfo.frontend_server?.port}</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderColor: envInfo.backend_server?.status === 'running' ? '#52c41a' : '#ff4d4f' }}>
                <Statistic
                  title={envInfo.backend_server?.name || '后端服务器'}
                  value={envInfo.backend_server?.status === 'running' ? '运行中' : '已停止'}
                  valueStyle={{ color: envInfo.backend_server?.status === 'running' ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
                  suffix={<span style={{ fontSize: 13, color: '#666' }}>端口: {envInfo.backend_server?.port}</span>}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="进程运行时长" value={formatUptime(envInfo.uptime)} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="RSS 内存" value={envInfo.memory_rss} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="堆已用" value={envInfo.memory_heap_used} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="堆总量" value={envInfo.memory_heap_total} suffix="MB" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="CPU 核心数" value={envInfo.cpu_count || '-'} suffix="核" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="系统运行时长" value={formatUptime(envInfo.os_uptime)} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="磁盘已用" value={envInfo.disk_used_percent || 0} suffix="%" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="磁盘可用" value={formatBytes(envInfo.disk_free)} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Card size="small" title={<span><DatabaseOutlined style={{ color: '#1890ff', marginRight: 6 }} />详细信息</span>}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="操作系统版本">{envInfo.os_version || envInfo.platform}</Descriptions.Item>
                  <Descriptions.Item label="操作系统类型">{envInfo.os_type || '-'}</Descriptions.Item>
                  <Descriptions.Item label="系统内核版本">{envInfo.os_release || '-'}</Descriptions.Item>
                  <Descriptions.Item label="主机名">{envInfo.os_hostname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="CPU 型号">{envInfo.cpu_model || '-'}</Descriptions.Item>
                  <Descriptions.Item label="磁盘总容量">{formatBytes(envInfo.disk_total)}</Descriptions.Item>
                  <Descriptions.Item label="磁盘已用">{formatBytes(envInfo.disk_used)}（{envInfo.disk_used_percent || 0}%）</Descriptions.Item>
                  <Descriptions.Item label="磁盘可用">{formatBytes(envInfo.disk_free)}</Descriptions.Item>
                  <Descriptions.Item label="磁盘挂载点">{envInfo.disk_mount || '-'}</Descriptions.Item>
                  <Descriptions.Item label="工作目录">{envInfo.cwd}</Descriptions.Item>
                  <Descriptions.Item label="服务器时间">{formatDateTime(envInfo.server_time)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <span>
                    <SafetyOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                    前端技术栈
                    <Tag style={{ marginLeft: 8 }} color="blue">v{envInfo.tech_stack?.frontend?.version}</Tag>
                  </span>
                }
              >
                <Descriptions column={1} size="small">
                  {envInfo.tech_stack?.frontend?.items?.map((item, idx) => (
                    <Descriptions.Item key={idx} label={
                      <span>
                        <Tag color="blue" style={{ marginRight: 6 }}>{item.category}</Tag>
                        {item.key}
                      </span>
                    }>
                      <code>{item.version}</code>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                size="small"
                title={
                  <span>
                    <CloudServerOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                    后端技术栈
                    <Tag style={{ marginLeft: 8 }} color="green">v{envInfo.tech_stack?.backend?.version}</Tag>
                  </span>
                }
              >
                <Descriptions column={1} size="small">
                  {envInfo.tech_stack?.backend?.items?.map((item, idx) => (
                    <Descriptions.Item key={idx} label={
                      <span>
                        <Tag color="green" style={{ marginRight: 6 }}>{item.category}</Tag>
                        {item.key}
                      </span>
                    }>
                      <code>{item.version}</code>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Spin>
  
  )
}
