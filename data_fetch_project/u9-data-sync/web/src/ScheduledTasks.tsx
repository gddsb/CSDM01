import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Spin, Empty, Button, Modal, Form, Input, Select, Switch, DatePicker, TimePicker, InputNumber, message,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EditOutlined, FieldTimeOutlined, CalendarOutlined, ClockCircleOutlined, DashboardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { callApi, api, ScheduledTaskDTO, TaskType, ExecMode } from './api';

const { Title, Text } = Typography;

const MODE_LABEL: Record<ExecMode, string> = {
  periodic: '定期任务',
  scheduled: '定时任务',
  once: '单次任务',
};

const MODE_COLOR: Record<ExecMode, string> = {
  periodic: 'blue',
  scheduled: 'green',
  once: 'purple',
};

const TYPE_LABEL: Record<string, string> = {
  items: '料品数据',
  customers: '客户数据',
  env_monitor: '环境监测',
};

const WEEK_DAYS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

export default function ScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTaskDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ScheduledTaskDTO | null>(null);
  const [form] = Form.useForm();

  const loadTasks = async () => {
    setLoading(true);
    const r = await callApi<ScheduledTaskDTO[]>(api.get('/scheduled-tasks'));
    if (r.success && r.data) setTasks(r.data);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleDelete = async (record: ScheduledTaskDTO) => {
    Modal.confirm({
      title: `删除计划任务 ${record.name} ?`,
      content: '删除后不可恢复。',
      okButtonProps: { danger: true },
      onOk: async () => {
        const r = await callApi(api.delete(`/scheduled-tasks/${record.scheduleId}`));
        if (r.success) {
          message.success('已删除');
          loadTasks();
        } else {
          message.error(r.message || '删除失败');
        }
      },
    });
  };

  const handleToggle = async (record: ScheduledTaskDTO) => {
    const r = await callApi(api.put(`/scheduled-tasks/${record.scheduleId}`, { isEnabled: !record.isEnabled }));
    if (r.success) loadTasks();
  };

  const handleTrigger = async (record: ScheduledTaskDTO) => {
    const r = await callApi(api.post(`/scheduled-tasks/${record.scheduleId}/trigger`));
    if (r.success) {
      message.success('已手动触发执行');
      loadTasks();
    } else {
      message.error(r.message || '触发失败');
    }
  };

  const handleSave = async (values: any) => {
    const payload: any = {
      name: values.name,
      type: values.type,
      execMode: values.execMode,
      isEnabled: values.isEnabled,
      config: {},
    };

    if (values.execMode === 'periodic') {
      payload.config = {
        interval: values.interval,
        intervalUnit: values.intervalUnit,
      };
    } else if (values.execMode === 'scheduled') {
      payload.config = {
        fixedTime: values.fixedTime?.format('HH:mm'),
        fixedDays: values.fixedDays,
      };
    } else if (values.execMode === 'once') {
      payload.config = {
        onceAt: values.onceAt?.format('YYYY-MM-DD HH:mm:ss'),
      };
    }

    if (editing) {
      const r = await callApi(api.put(`/scheduled-tasks/${editing.scheduleId}`, payload));
      if (r.success) {
        message.success('已更新');
        setModalVisible(false);
        setEditing(null);
        loadTasks();
      } else {
        message.error(r.message || '更新失败');
      }
    } else {
      const r = await callApi(api.post('/scheduled-tasks', payload));
      if (r.success) {
        message.success('已创建');
        setModalVisible(false);
        loadTasks();
      } else {
        message.error(r.message || '创建失败');
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ execMode: 'periodic', type: 'items', isEnabled: true, interval: 4, intervalUnit: 'hour', fixedDays: [1, 2, 3, 4, 5] });
    setModalVisible(true);
  };

  const openEdit = (record: ScheduledTaskDTO) => {
    setEditing(record);
    const vals: any = {
      name: record.name,
      type: record.type,
      execMode: record.execMode,
      isEnabled: record.isEnabled,
    };
    if (record.execMode === 'periodic') {
      vals.interval = record.config.interval;
      vals.intervalUnit = record.config.intervalUnit;
    } else if (record.execMode === 'scheduled') {
      vals.fixedTime = record.config.fixedTime ? dayjs(record.config.fixedTime, 'HH:mm') : null;
      vals.fixedDays = record.config.fixedDays;
    } else if (record.execMode === 'once') {
      vals.onceAt = record.config.onceAt ? dayjs(record.config.onceAt) : null;
    }
    form.setFieldsValue(vals);
    setModalVisible(true);
  };

  const formatConfig = (record: ScheduledTaskDTO) => {
    const cfg = record.config;
    if (record.execMode === 'periodic') {
      return `每 ${cfg.interval} ${cfg.intervalUnit === 'minute' ? '分钟' : cfg.intervalUnit === 'hour' ? '小时' : '天'}`;
    }
    if (record.execMode === 'scheduled') {
      const days = (cfg.fixedDays || []).map((d: number) => WEEK_DAYS.find((w) => w.value === d)?.label).filter(Boolean).join('、');
      return `${days} ${cfg.fixedTime}`;
    }
    if (record.execMode === 'once') {
      return cfg.onceAt ? dayjs(cfg.onceAt).format('YYYY-MM-DD HH:mm') : '-';
    }
    return '-';
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: ScheduledTaskDTO) => (
        <Space>
          <Text strong>{v}</Text>
          <Tag color={r.type === 'items' ? 'blue' : r.type === 'customers' ? 'green' : 'purple'}>{TYPE_LABEL[r.type]}</Tag>
        </Space>
      ),
    },
    {
      title: '执行方式',
      dataIndex: 'execMode',
      key: 'execMode',
      width: 120,
      render: (v: ExecMode) => <Tag color={MODE_COLOR[v]}>{MODE_LABEL[v]}</Tag>,
    },
    {
      title: '配置',
      key: 'config',
      width: 200,
      render: (_: any, r: ScheduledTaskDTO) => <Text type="secondary">{formatConfig(r)}</Text>,
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 160,
      render: (v: string, r: ScheduledTaskDTO) => {
        if (!r.isEnabled) return <Tag>已停用</Tag>;
        return v ? dayjs(v).format('MM-DD HH:mm') : <Tag>无</Tag>;
      },
    },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 160,
      render: (v: string, r: ScheduledTaskDTO) => {
        if (!v) return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text>{dayjs(v).format('MM-DD HH:mm')}</Text>
            {r.lastRunResult && <Text type="secondary" style={{ fontSize: 12 }}>{r.lastRunResult}</Text>}
          </Space>
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 90,
      render: (v: boolean, r: ScheduledTaskDTO) => (
        <Switch checked={v} onChange={() => handleToggle(r)} size="small" />
      ),
    },
    {
      title: '操作',
      key: 'ops',
      width: 200,
      render: (_: any, r: ScheduledTaskDTO) => (
        <Space>
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleTrigger(r)}>执行</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <CalendarOutlined /> 计划任务
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text type="secondary">系统根据配置自动执行，您也可以手动触发执行。</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增计划任务</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table
          size="small"
          columns={columns}
          dataSource={tasks}
          rowKey="scheduleId"
          pagination={{ pageSize: 10, showTotal: (n) => `共 ${n} 条` }}
          locale={{ emptyText: <Empty description="暂无计划任务，点击上方按钮新增" /> }}
        />
      </Spin>

      <Modal
        title={editing ? '编辑计划任务' : '新增计划任务'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditing(null); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：每日料品同步" />
          </Form.Item>

          <Form.Item name="type" label="任务类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'items', label: '料品数据' }, { value: 'customers', label: '客户数据' }, { value: 'env_monitor', label: '环境监测' }]} />
          </Form.Item>

          <Form.Item name="execMode" label="执行方式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'periodic', label: '定期任务（按间隔执行）' },
                { value: 'scheduled', label: '定时任务（固定时间点）' },
                { value: 'once', label: '单次任务（仅执行一次）' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.execMode !== curr.execMode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('execMode');
              if (mode === 'periodic') {
                return (
                  <Space>
                    <Form.Item name="interval" label="间隔" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <InputNumber min={1} max={999} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item name="intervalUnit" label="单位" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <Select style={{ width: 100 }} options={[
                        { value: 'minute', label: '分钟' },
                        { value: 'hour', label: '小时' },
                        { value: 'day', label: '天' },
                      ]} />
                    </Form.Item>
                  </Space>
                );
              }
              if (mode === 'scheduled') {
                return (
                  <>
                    <Form.Item name="fixedDays" label="执行日期" rules={[{ required: true }]}>
                      <Select mode="multiple" options={WEEK_DAYS} placeholder="选择周几执行" />
                    </Form.Item>
                    <Form.Item name="fixedTime" label="执行时间" rules={[{ required: true }]}>
                      <TimePicker format="HH:mm" placeholder="选择时间" />
                    </Form.Item>
                  </>
                );
              }
              if (mode === 'once') {
                return (
                  <Form.Item name="onceAt" label="执行时间" rules={[{ required: true }]}>
                    <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} placeholder="选择日期时间" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="isEnabled" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
