import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography, Timeline } from 'antd'
import {
  MessageOutlined, ClockCircleOutlined, CheckCircleOutlined,
  MailOutlined, EyeOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { complaints } from '../../mock/data'

const { Text, Title } = Typography

// 处理记录时间线 mock 数据（按客诉id分组）
const timelineMap = {
  cp1: [
    { stage: '调查', time: '2026-06-25 11:00:00', user: '质量管理员', content: '确认投诉批次 WO20260620001，调取生产及检验记录' },
    { stage: '处理', time: '2026-06-26 09:30:00', user: '质量管理员', content: '对库存批次进行全检，隔离疑似问题批次' },
    { stage: '原因分析', time: '2026-06-26 15:00:00', user: '质量管理员', content: '色差原因为油墨批次波动，划痕为包装运输所致' },
    { stage: '回复客户', time: '2026-06-27 10:00:00', user: '质量管理员', content: '向伊利乳业提交8D报告及改善对策' },
    { stage: '客户反馈', time: '2026-06-28 16:00:00', user: '质量管理员', content: '客户认可处理方案，客诉关闭' },
  ],
  cp2: [
    { stage: '调查', time: '2026-06-28 15:00:00', user: '质量管理员', content: '联系蒙牛乳业李工获取问题样品' },
    { stage: '处理', time: '2026-06-29 10:00:00', user: '质量管理员', content: '安排密封性复测，初步确认为封口工序参数偏差' },
    { stage: '原因分析', time: '2026-06-29 16:00:00', user: '质量管理员', content: '封口温度偏低导致部分罐体密封不严，已调整工艺参数' },
  ],
}

const stageColor = { '调查': 'blue', '处理': 'orange', '原因分析': 'purple', '回复客户': 'cyan', '客户反馈': 'green' }
const statusColor = { '已关闭': 'success', '处理中': 'processing' }

export default function ComplaintManagement() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const processingCount = complaints.filter(c => c.status === '处理中').length
  const closedCount = complaints.filter(c => c.status === '已关闭').length
  const replyCount = complaints.filter(c => c.require_reply === 1).length

  const stats = [
    { label: '总客诉数', value: complaints.length, icon: <MessageOutlined />, color: '#2196F3' },
    { label: '处理中', value: processingCount, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '要求回复数', value: replyCount, icon: <MailOutlined />, color: '#00BCD4' },
  ]

  const filters = [
    { type: 'input', placeholder: '客诉编号', icon: <SearchOutlined /> },
    { type: 'input', placeholder: '客户名称' },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '处理中', value: '处理中' },
        { label: '已关闭', value: '已关闭' },
      ]
    },
  ]

  const showDetail = (record) => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const columns = [
    { title: '客诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 130, fixed: 'left' },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 110 },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 130 },
    { title: '批号/工单', dataIndex: 'batch_no', key: 'batch_no', width: 150 },
    { title: '投诉问题分类', dataIndex: 'complaint_type', key: 'complaint_type', width: 110 },
    { title: '投诉时间', dataIndex: 'complaint_time', key: 'complaint_time', width: 160 },
    { title: '投诉方式', dataIndex: 'complaint_method', key: 'complaint_method', width: 90 },
    {
      title: '要求回复', dataIndex: 'require_reply', key: 'require_reply', width: 90,
      render: v => v === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>
    },
    { title: '回复截止', dataIndex: 'reply_deadline', key: 'reply_deadline', width: 110 },
    { title: '处理方向', dataIndex: 'handle_direction', key: 'handle_direction', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>查看详情</Button>
      )
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="客诉管理"
        breadcrumbs="质量管理 / 客诉管理"
        stats={stats}
        filters={filters}
        actions={<ActionButtons />}
        table={
          <Table
            columns={columns}
            dataSource={complaints}
            rowKey="complaint_id"
            size="small"
            scroll={{ x: 1700 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Drawer
        title="客诉详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        destroyOnClose
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="客诉编号">{current.complaint_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{current.source}</Descriptions.Item>
              <Descriptions.Item label="投诉方式">{current.complaint_method}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{current.customer_name}</Descriptions.Item>
              <Descriptions.Item label="联系人">{current.contact_person}</Descriptions.Item>
              <Descriptions.Item label="料品名称">{current.material_name}</Descriptions.Item>
              <Descriptions.Item label="批号/工单">{current.batch_no}</Descriptions.Item>
              <Descriptions.Item label="投诉问题分类">{current.complaint_type}</Descriptions.Item>
              <Descriptions.Item label="要求回复">
                {current.require_reply === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="投诉时间">{current.complaint_time}</Descriptions.Item>
              <Descriptions.Item label="回复截止">{current.reply_deadline}</Descriptions.Item>
              <Descriptions.Item label="处理方向" span={2}>{current.handle_direction}</Descriptions.Item>
              <Descriptions.Item label="投诉描述" span={2}>{current.complaint_desc}</Descriptions.Item>
              <Descriptions.Item label="登记人">{current.registered_by_name}</Descriptions.Item>
            </Descriptions>
            <Title level={5}>处理记录时间线</Title>
            <Timeline
              mode="left"
              items={(timelineMap[current.complaint_id] || []).map(item => ({
                color: stageColor[item.stage] || 'gray',
                label: item.time,
                children: (
                  <div>
                    <div>
                      <Tag color={stageColor[item.stage] || 'default'}>{item.stage}</Tag>
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{item.user}</Text>
                    </div>
                    <div style={{ marginTop: 4 }}>{item.content}</div>
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
