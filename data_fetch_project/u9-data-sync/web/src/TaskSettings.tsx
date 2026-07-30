import { useEffect, useState, useRef } from 'react';
import {
  Card, Table, Tag, Typography, Space, Spin, Empty, Switch, Modal, Input, Form, Button,
  Timeline, Progress, Badge, Descriptions, message,
} from 'antd';
import {
  DatabaseOutlined, TeamOutlined, EditOutlined, SettingOutlined, DashboardOutlined,
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { callApi, api, TaskSettingDTO, TaskDTO } from './api';

const { Title, Text } = Typography;

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  running: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  duplicate_rejected: <ClockCircleOutlined />,
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'default', running: 'processing', completed: 'success', failed: 'error', duplicate_rejected: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '等待中', running: '执行中', completed: '已完成', failed: '失败', duplicate_rejected: '延迟等待',
};

// 各任务类型的参数字段定义
const PARAM_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'password'; placeholder?: string }[]> = {
  items: [
    { key: 'loginName', label: 'U9登录用户名', type: 'text', placeholder: 'U9 ERP登录账号' },
    { key: 'password', label: 'U9登录密码', type: 'password', placeholder: 'U9 ERP登录密码' },
  ],
  customers: [
    { key: 'loginName', label: 'U9登录用户名', type: 'text', placeholder: 'U9 ERP登录账号' },
    { key: 'password', label: 'U9登录密码', type: 'password', placeholder: 'U9 ERP登录密码' },
  ],
  env_monitor: [
    { key: 'loginName', label: '平台登录用户名', type: 'text', placeholder: '0531yun登录账号' },
    { key: 'password', label: '平台登录密码', type: 'password', placeholder: '0531yun登录密码' },
  ],
};

function fmtTime(s?: string) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm:ss') : '-';
}

export default function TaskSettings() {
  const [settings, setSettings] = useState<TaskSettingDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<TaskSettingDTO | null>(null);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState<string>('');
  const [testTask, setTestTask] = useState<TaskDTO | null>(null);
  const [testTaskType, setTestTaskType] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    const r = await callApi<TaskSettingDTO[]>(api.get('/task-settings'));
    if (r.success && r.data) setSettings(r.data);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleToggleActive = async (record: TaskSettingDTO) => {
    const r = await callApi(api.put(`/task-settings/${record.taskType}`, { isActive: !record.isActive }));
    if (r.success) loadSettings();
  };

  const handleSave = async (values: any) => {
    if (!editing) return;
    const payload: any = { name: values.name, description: values.description, sourceUrl: values.sourceUrl };
    // 收集参数字段
    const paramFields = PARAM_FIELDS[editing.taskType];
    if (paramFields) {
      const params: Record<string, any> = {};
      for (const f of paramFields) {
        if (values[f.key] !== undefined && values[f.key] !== '') {
          params[f.key] = values[f.key];
        }
      }
      payload.params = params;
    }
    const r = await callApi(api.put(`/task-settings/${editing.taskType}`, payload));
    if (r.success) {
      message.success('已保存');
      setEditing(null);
      loadSettings();
    } else {
      message.error(r.message || '保存失败');
    }
  };

  const handleTest = async (record: TaskSettingDTO) => {
    setTesting(record.taskType);
    setTestTaskType(record.taskType);
    const r = await callApi<{ taskId: string; delayed: boolean; message?: string }>(
      api.post(`/task-settings/${record.taskType}/test`)
    );
    setTesting('');
    if (r.success && r.data) {
      if (r.data.delayed) {
        message.warning(r.data.message || '有进行中的任务，将延迟执行');
      } else {
        message.success('测试任务已创建');
      }
      // 开始轮询任务状态
      startPolling(record.taskType);
    } else {
      message.error(r.message || '测试失败');
    }
  };

  const startPolling = (taskType: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      const r = await callApi<TaskDTO>(api.get(`/task-settings/${taskType}/test-status`));
      if (r.success && r.data) {
        setTestTask(r.data);
        // 任务结束（完成/失败）停止轮询
        if (['completed', 'failed'].includes(r.data.status)) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  };

  const columns = [
    {
      title: '序号',
      key: 'idx',
      width: 60,
      render: (_: any, __: any, index: number) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 140,
      render: (v: string) => (
        <Space>
          <span style={{
            fontSize: 18,
            color: v === 'items' ? '#1677ff' : v === 'customers' ? '#52c41a' : v === 'env_monitor' ? '#722ed1' : '#13c2c2',
          }}>
            {v === 'items' ? <DatabaseOutlined /> : v === 'customers' ? <TeamOutlined /> : v === 'env_monitor' ? <DashboardOutlined /> : <EnvironmentOutlined />}
          </span>
          <Text strong>
            {v === 'items' ? '料品数据' : v === 'customers' ? '客户数据' : v === 'env_monitor' ? '环境监测' : '气象信息'}
          </Text>
        </Space>
      ),
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 420,
      render: (v: string) => (
        <div style={{
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          color: '#666',
        }}>{v}</div>
      ),
    },
    {
      title: '执行参数',
      key: 'params',
      width: 160,
      render: (_: any, r: TaskSettingDTO) => {
        const paramFields = PARAM_FIELDS[r.taskType] || [];
        const configured = paramFields.filter(f => r.params?.[f.key]).length;
        return (
          <Tag color={configured === paramFields.length ? 'success' : configured > 0 ? 'orange' : 'default'}>
            {configured}/{paramFields.length} 已配置
          </Tag>
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean, r: TaskSettingDTO) => (
        <Switch checked={v} onChange={() => handleToggleActive(r)} size="small" />
      ),
    },
    {
      title: '操作',
      key: 'ops',
      width: 180,
      render: (_: any, r: TaskSettingDTO) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={testing === r.taskType}
            onClick={() => handleTest(r)}
            disabled={!r.isActive}
          >
            测试
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            const vals: any = { name: r.name, description: r.description, sourceUrl: r.sourceUrl };
            const paramFields = PARAM_FIELDS[r.taskType] || [];
            for (const f of paramFields) {
              vals[f.key] = r.params?.[f.key] || '';
            }
            form.setFieldsValue(vals);
          }}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const paramFields = editing ? (PARAM_FIELDS[editing.taskType] || []) : [];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SettingOutlined /> 任务设置
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">配置数据同步任务的参数（用户名、密码等），可点击「测试」立即执行一次任务验证配置。</Text>
      </Card>

      <Spin spinning={loading}>
        <Table
          size="small"
          columns={columns}
          dataSource={settings}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无任务设置" /> }}
        />
      </Spin>

      {/* 测试任务步骤和状态 */}
      {testTask && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={
            <Space>
              <Badge status={testTask.status === 'running' ? 'processing' : testTask.status === 'completed' ? 'success' : testTask.status === 'failed' ? 'error' : 'default'} />
              <Text strong>测试任务详情</Text>
              <Tag color={STATUS_COLOR[testTask.status]} icon={STATUS_ICON[testTask.status]}>
                {STATUS_LABEL[testTask.status]}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{testTask.taskId}</Text>
            </Space>
          }
          extra={testTask.status === 'running' && <Progress percent={testTask.progress} size="small" style={{ width: 120 }} />}
        >
          <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="当前步骤">{testTask.currentStep || '-'}</Descriptions.Item>
            <Descriptions.Item label="记录数">{testTask.totalRecords ?? 0} 条</Descriptions.Item>
            <Descriptions.Item label="耗时">
              {testTask.startedAt && testTask.endedAt
                ? dayjs(testTask.endedAt).diff(dayjs(testTask.startedAt), 'second') + 's'
                : testTask.startedAt
                ? dayjs().diff(dayjs(testTask.startedAt), 'second') + 's'
                : '-'}
            </Descriptions.Item>
            {testTask.errorMsg && (
              <Descriptions.Item label="错误信息" span={3}>
                <Text type="danger">{testTask.errorMsg}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          <Title level={5} style={{ marginBottom: 8 }}>执行步骤</Title>
          <div style={{ maxHeight: 360, overflow: 'auto', paddingRight: 8 }}>
            <Timeline
              mode="left"
              items={(testTask.steps || []).slice().reverse().map((s) => ({
                color: s.percent >= 100 ? 'green' : s.percent === 0 ? 'gray' : 'blue',
                label: <Text type="secondary" style={{ fontSize: 12 }}>{fmtTime(s.time)}</Text>,
                children: (
                  <div>
                    <div style={{ wordBreak: 'break-word' }}>{s.message}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>进度 {s.percent}%</Text>
                  </div>
                ),
              }))}
            />
          </div>
        </Card>
      )}

      <Modal
        title="编辑任务设置"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sourceUrl" label="来源URL">
            <Input />
          </Form.Item>

          {paramFields.length > 0 && (
            <>
              <div style={{ marginTop: 8, marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                <Text strong>执行参数</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>密码将加密存储</Text>
              </div>
              {paramFields.map((f) => (
                <Form.Item key={f.key} name={f.key} label={f.label}>
                  {f.type === 'password' ? (
                    <Input.Password placeholder={f.placeholder || ''} visibilityToggle={false} />
                  ) : (
                    <Input placeholder={f.placeholder || ''} />
                  )}
                </Form.Item>
              ))}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
