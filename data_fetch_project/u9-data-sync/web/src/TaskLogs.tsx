import { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, Input, Select, DatePicker, Typography, Space } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { callApi, api, TaskDTO, TaskType, TaskStatus, TaskProgressStep } from './api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const TYPE_LABEL: Record<TaskType, string> = {
  items: '料品数据',
  customers: '客户数据',
  env_monitor: '环境监测',
  weather: '气象信息',
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  duplicate_rejected: 'warning',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  duplicate_rejected: '重复拦截',
};

export default function TaskLogs() {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<any>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      let url = '/tasks?limit=200';
      if (typeFilter !== 'all') url += `&type=${typeFilter}`;
      const r = await callApi<TaskDTO[]>(api.get(url));
      if (r.success && r.data) setTasks(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [typeFilter]);

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (keyword && !(t.taskId.includes(keyword) || (t.currentStep || '').includes(keyword))) return false;
    if (dateRange && dateRange.length === 2) {
      const d = dayjs(t.createdAt);
      if (d.isBefore(dateRange[0]) || d.isAfter(dateRange[1].endOf('day'))) return false;
    }
    return true;
  });

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 200,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: TaskType) => <Tag color={v === 'items' ? 'blue' : v === 'customers' ? 'green' : v === 'env_monitor' ? 'purple' : 'cyan'}>{TYPE_LABEL[v]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: TaskStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 80,
      render: (v: number, r: TaskDTO) => {
        if (r.status === 'completed') return <Tag color="success">100%</Tag>;
        if (r.status === 'failed') return <Tag color="error">{v}%</Tag>;
        return <span>{v}%</span>;
      },
    },
    {
      title: '当前步骤',
      dataIndex: 'currentStep',
      key: 'currentStep',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '记录数',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      width: 90,
      render: (v: number) => v ?? '-',
    },
    {
      title: '步骤数',
      key: 'stepCount',
      width: 80,
      render: (_: any, r: TaskDTO) => (r.steps?.length || 0),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '完成时间',
      dataIndex: 'endedAt',
      key: 'endedAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  const expandedRowRender = (record: TaskDTO) => (
    <div style={{ padding: '8px 16px' }}>
      <Title level={5} style={{ marginBottom: 8 }}>执行步骤日志</Title>
      {record.steps && record.steps.length > 0 ? (
        <div style={{ maxHeight: 300, overflow: 'auto', background: '#fafafa', padding: 12, borderRadius: 4 }}>
          {record.steps.map((s: TaskProgressStep, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: 13 }}>
              <Text type="secondary" style={{ minWidth: 80 }}>
                {dayjs(s.time).format('HH:mm:ss')}
              </Text>
              <span style={{
                flex: 1,
                padding: '2px 8px',
                background: s.percent >= 100 ? '#f6ffed' : s.percent > 0 ? '#e6f4ff' : '#f5f5f5',
                borderRadius: 4,
              }}>
                {s.message}
              </span>
              <Tag color={s.percent >= 100 ? 'success' : 'blue'}>{s.percent}%</Tag>
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary">暂无步骤日志</Text>
      )}
      {record.errorMsg && (
        <div style={{ marginTop: 12 }}>
          <Text type="danger">错误信息: {record.errorMsg}</Text>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <FileTextOutlined /> 任务日志
      </Title>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <Text strong>筛选</Text>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 120 }}
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'items', label: '料品数据' },
                { value: 'customers', label: '客户数据' },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '等待中' },
                { value: 'running', label: '执行中' },
                { value: 'completed', label: '已完成' },
                { value: 'failed', label: '失败' },
                { value: 'duplicate_rejected', label: '重复拦截' },
              ]}
            />
            <Input.Search
              placeholder="搜索任务ID或步骤..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={(v) => setKeyword(v)}
              style={{ width: 240 }}
            />
            <RangePicker
              showTime
              onChange={(dates) => setDateRange(dates)}
              placeholder={['开始时间', '结束时间']}
            />
          </Space>
        }
        extra={<Text type="secondary">共 {filtered.length} 条记录</Text>}
      >
        <Spin spinning={loading}>
          <Table
            size="small"
            columns={columns}
            dataSource={filtered}
            rowKey="taskId"
            expandable={{
              expandedRowRender,
              expandedRowKeys: undefined,
            }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (n) => `共 ${n} 条` }}
            locale={{ emptyText: <Empty description="暂无任务记录" /> }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>
    </div>
  );
}
