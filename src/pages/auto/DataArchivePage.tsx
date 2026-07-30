import React, { useState, useEffect } from 'react'
import { useMessage } from '../../contexts/AppContext'
import { Table, Button, Input, Select, Tag, Space, Card, Row, Col, Tabs, Form, Modal, Popconfirm } from 'antd'
import { DatabaseOutlined, ReloadOutlined, SearchOutlined, CheckCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import { formatDateTime } from '../../utils'

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  items: { label: '料品档案', icon: '📦' },
  customers: { label: '客户档案', icon: '🏢' },
  env_monitor: { label: '环境监测', icon: '🌡️' },
  env_alarm: { label: '报警记录', icon: '🚨' },
  weather: { label: '气象信息', icon: '☀️' },
}

export default function DataArchivePage() {
  const message = useMessage()
  const [activeType, setActiveType] = useState('items')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [keyword, setKeyword] = useState('')
  const [handleModalOpen, setHandleModalOpen] = useState(false)
  const [handleForm] = Form.useForm()
  const [handlingAlarm, setHandlingAlarm] = useState<any>(null)

  const buildColumns = (type: string) => {
    const base = []
    if (type === 'items') {
      base.push(
        { title: '料号', dataIndex: 'item_code', key: 'item_code', width: 150 },
        { title: '品名', dataIndex: 'item_name', key: 'item_name', width: 200 },
        { title: '主分类', dataIndex: 'main_category_code', key: 'main_category_code', width: 120 },
        { title: '分类名称', dataIndex: 'category_name', key: 'category_name', width: 150 },
        { title: '规格', dataIndex: 'specification', key: 'specification', width: 180 },
        { title: '单位', dataIndex: 'unit_name', key: 'unit_name', width: 80 },
        { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80, align: 'center' as const, render: (v: number) => v === 1 ? <Tag color="success">生效</Tag> : <Tag color="default">失效</Tag> },
      )
    } else if (type === 'customers') {
      base.push(
        { title: '客户编码', dataIndex: 'customer_code', key: 'customer_code', width: 150 },
        { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 200 },
        { title: '简称', dataIndex: 'short_name', key: 'short_name', width: 150 },
        { title: '分类', dataIndex: 'category_name', key: 'category_name', width: 120 },
        { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80, align: 'center' as const, render: (v: number) => v === 1 ? <Tag color="success">生效</Tag> : <Tag color="default">失效</Tag> },
        { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 120 },
      )
    } else if (type === 'env_monitor') {
      base.push(
        { title: '因子ID', dataIndex: 'factor_id', key: 'factor_id', width: 120 },
        { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 180 },
        { title: '因子名称', dataIndex: 'factor_name', key: 'factor_name', width: 180 },
        { title: '当前值', dataIndex: 'value', key: 'value', width: 100, render: (v: number) => <span style={{ fontWeight: 600, color: '#1890ff' }}>{v}</span> },
        { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
        { title: '设备状态', dataIndex: 'device_status', key: 'device_status', width: 100 },
        { title: '采集时间', dataIndex: 'collect_time', key: 'collect_time', width: 160, render: (v: string) => formatDateTime(v) },
      )
    } else if (type === 'env_alarm') {
      base.push(
        { title: '因子名称', dataIndex: 'factor_name', key: 'factor_name', width: 150 },
        { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150 },
        { title: '报警信息', dataIndex: 'alarm_info', key: 'alarm_info', width: 200 },
        { title: '报警级别', dataIndex: 'alarm_level', key: 'alarm_level', width: 90, align: 'center' as const, render: (v: number) => <Tag color={v >= 3 ? 'red' : v >= 2 ? 'orange' : 'yellow'}>级别 {v}</Tag> },
        { title: '当前值', dataIndex: 'current_value', key: 'current_value', width: 100 },
        { title: '限值', dataIndex: 'alarm_range', key: 'alarm_range', width: 120 },
        { title: '报警时间', dataIndex: 'alarm_time', key: 'alarm_time', width: 160, render: (v: string) => formatDateTime(v) },
        { title: '状态', dataIndex: 'is_handled', key: 'is_handled', width: 100, align: 'center' as const, render: (v: number) => v === 1 ? <Tag icon={<CheckCircleOutlined />} color="success">已处理</Tag> : <Tag color="red">未处理</Tag> },
        { title: '操作', key: 'action', width: 100, fixed: 'right' as const, render: (_: any, record: any) => (
          !record.is_handled ? <Button type="link" onClick={() => { setHandlingAlarm(record); handleForm.resetFields(); setHandleModalOpen(true) }}>处理</Button> : null
        )},
      )
    } else if (type === 'weather') {
      base.push(
        { title: '城市', dataIndex: 'city', key: 'city', width: 120 },
        { title: '温度(℃)', dataIndex: 'temperature', key: 'temperature', width: 100, align: 'center' as const },
        { title: '湿度(%)', dataIndex: 'humidity', key: 'humidity', width: 100, align: 'center' as const },
        { title: '大气压(hPa)', dataIndex: 'pressure', key: 'pressure', width: 120, align: 'center' as const },
        { title: '数据来源', dataIndex: 'source', key: 'source', width: 200, ellipsis: true },
        { title: '发布时间', dataIndex: 'weather_time', key: 'weather_time', width: 160, render: (v: string) => formatDateTime(v) },
      )
    }
    return base
  }

  const loadData = async (page = 1, pageSize = 20) => {
    try {
      setLoading(true)
      const res = await api.get(`/auto/archive/${activeType}`, {
        params: { page, pageSize, keyword },
      })
      setData(res.data?.list || [])
      setPagination({ current: page, pageSize, total: res.data?.pagination?.total || 0 })
    } catch (err: any) {
      message.error(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [activeType])

  const handleSearch = () => { loadData(1, pagination.pageSize) }

  const handleTableChange = (p: any) => { loadData(p.current, p.pageSize) }

  const handleAlarmSubmit = async () => {
    try {
      const values = await handleForm.validateFields()
      await api.put(`/auto/env-alarm/${handlingAlarm.alarm_id}/handle`, values)
      message.success('处理成功')
      setHandleModalOpen(false)
      loadData(pagination.current, pagination.pageSize)
    } catch (err: any) {
      message.error(err.message || '处理失败')
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>数据档案</span>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="搜索..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 250 }}
                allowClear
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeType}
          onChange={setActiveType}
          tabBarStyle={{ paddingLeft: 16, paddingRight: 16, marginBottom: 0 }}
          items={Object.entries(TYPE_CONFIG).map(([k, v]) => ({
            key: k,
            label: <Space><span>{v.icon}</span><span>{v.label}</span></Space>,
          }))}
        />
        <Table
          rowKey={(r: any) => r.item_id || r.customer_id || r.monitor_id || r.alarm_id || r.weather_id || r.id}
          columns={buildColumns(activeType)}
          dataSource={data}
          loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>
      <Modal
        title="处理报警"
        open={handleModalOpen}
        onOk={handleAlarmSubmit}
        onCancel={() => setHandleModalOpen(false)}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={handleForm} layout="vertical" preserve={false}>
          <Form.Item label="处理意见" name="handle_msg">
            <Input.TextArea rows={3} placeholder="请输入处理意见" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
