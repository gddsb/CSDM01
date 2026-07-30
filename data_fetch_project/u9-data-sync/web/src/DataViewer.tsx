import { useEffect, useState } from 'react';
import {
  Card, Table, Input, Pagination, Tag, Typography, Select,
  Empty, Spin, Drawer, Button, Space,
} from 'antd';
import { SearchOutlined, DatabaseOutlined, TeamOutlined, TableOutlined, EyeOutlined, BarsOutlined, DashboardOutlined, AlertOutlined, FilterOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { callApi, api, ArchiveSchemaDTO, ArchiveListDTO } from './api';

const { Title, Text } = Typography;

interface ArchiveMeta {
  key: string;
  name: string;
  icon: React.ReactNode;
  type: string;
  tableName: string;
  description: string;
  color: string;
}

interface FilterOptions {
  deviceNames?: string[];
  factorNames?: string[];
  alarmLevels?: number[];
}

const ARCHIVES: ArchiveMeta[] = [
  {
    key: 'items',
    name: '料品档案',
    icon: <DatabaseOutlined />,
    type: 'items',
    tableName: 'u9_items',
    description: '料品主数据，含主分类、料号、品名、规格、尺寸、工艺、库存信息等字段',
    color: '#1677ff',
  },
  {
    key: 'customers',
    name: '客户档案',
    icon: <TeamOutlined />,
    type: 'customers',
    tableName: 'u9_customers',
    description: '客户主数据，含编码、名称、简称、分类、生效状态等字段',
    color: '#52c41a',
  },
  {
    key: 'env_monitor',
    name: '环境监测数据',
    icon: <DashboardOutlined />,
    type: 'env_monitor',
    tableName: 'env_monitor_data',
    description: '因子ID、节点、寄存器、因子名称、当前值、单位、系数、状态、采集时间',
    color: '#faad14',
  },
  {
    key: 'env_alarm',
    name: '报警信息',
    icon: <AlertOutlined />,
    type: 'env_alarm',
    tableName: 'env_alarm_records',
    description: '按因子ID、设备名称、报警信息、报警时间与设备关联',
    color: '#ff4d4f',
  },
  {
    key: 'weather',
    name: '气象信息',
    icon: <EnvironmentOutlined />,
    type: 'weather',
    tableName: 'weather_info',
    description: '望城实时气象数据，含城市、温度、湿度、大气压、发布时间、数据来源',
    color: '#13c2c2',
  },
];

// 支持分类筛选的档案类型
const FILTERABLE_TYPES = ['env_monitor', 'env_alarm'];

export default function DataViewer() {
  const [archiveList, setArchiveList] = useState<(ArchiveMeta & { totalRecords: number })[]>([]);
  const [loading, setLoading] = useState(false);

  const [drawerType, setDrawerType] = useState<'schema' | 'records' | null>(null);
  const [drawerArchive, setDrawerArchive] = useState<(ArchiveMeta & { totalRecords?: number }) | null>(null);
  const [schema, setSchema] = useState<ArchiveSchemaDTO | null>(null);
  const [data, setData] = useState<ArchiveListDTO | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 分类筛选状态
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [filterDeviceName, setFilterDeviceName] = useState<string>('');
  const [filterFactorName, setFilterFactorName] = useState<string>('');
  const [filterAlarmLevel, setFilterAlarmLevel] = useState<number | undefined>(undefined);
  const [filterIsHandled, setFilterIsHandled] = useState<boolean | undefined>(undefined);

  const loadArchiveList = async () => {
    setLoading(true);
    const list = await Promise.all(
      ARCHIVES.map(async (a) => {
        const r = await callApi<ArchiveSchemaDTO>(api.get(`/archive/schema/${a.type}`));
        return { ...a, totalRecords: r.data?.totalRecords || 0 };
      })
    );
    setArchiveList(list);
    setLoading(false);
  };

  useEffect(() => {
    loadArchiveList();
  }, []);

  const openSchemaDrawer = async (archive: ArchiveMeta & { totalRecords: number }) => {
    setDrawerArchive(archive);
    setDrawerType('schema');
    setLoadingSchema(true);
    const r = await callApi<ArchiveSchemaDTO>(api.get(`/archive/schema/${archive.type}`));
    if (r.success && r.data) setSchema(r.data);
    setLoadingSchema(false);
  };

  const openRecordsDrawer = async (archive: ArchiveMeta & { totalRecords: number }) => {
    setDrawerArchive(archive);
    setDrawerType('records');
    setPage(1);
    setKeyword('');
    setPageSize(20);
    setFilterDeviceName('');
    setFilterFactorName('');
    setFilterAlarmLevel(undefined);
    setFilterIsHandled(undefined);
    // 先拉 schema 保证列名正确显示
    const r = await callApi<ArchiveSchemaDTO>(api.get(`/archive/schema/${archive.type}`));
    if (r.success && r.data) setSchema(r.data);
    // 如果是可筛选类型，拉取筛选选项
    if (FILTERABLE_TYPES.includes(archive.type)) {
      const fr = await callApi<FilterOptions>(api.get(`/archive/${archive.type}/filters`));
      if (fr.success && fr.data) setFilterOptions(fr.data);
    } else {
      setFilterOptions({});
    }
    await loadRecords(archive.type, 1, 20, '', '', '', undefined, undefined);
  };

  const loadRecords = async (
    type: string, p: number, ps: number, kw: string,
    devName?: string, factName?: string, alarmLvl?: number, isHandled?: boolean,
  ) => {
    setLoadingData(true);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('pageSize', String(ps));
    if (kw) params.set('keyword', kw);
    if (devName) params.set('deviceName', devName);
    if (factName) params.set('factorName', factName);
    if (alarmLvl !== undefined) params.set('alarmLevel', String(alarmLvl));
    if (isHandled !== undefined) params.set('isHandled', String(isHandled));
    const r = await callApi<ArchiveListDTO>(api.get(`/archive/${type}?${params.toString()}`));
    if (r.success && r.data) {
      setData(r.data);
      setPage(r.data.pagination.page);
      setPageSize(r.data.pagination.pageSize);
    }
    setLoadingData(false);
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
    if (drawerArchive) {
      loadRecords(drawerArchive.type, 1, pageSize, value, filterDeviceName, filterFactorName, filterAlarmLevel, filterIsHandled);
    }
  };

  const handleFilterChange = () => {
    setPage(1);
    if (drawerArchive) {
      loadRecords(drawerArchive.type, 1, pageSize, keyword, filterDeviceName, filterFactorName, filterAlarmLevel, filterIsHandled);
    }
  };

  // 档案列表主表列
  const columns = [
    {
      title: '序号',
      key: 'idx',
      width: 60,
      render: (_: any, __: any, index: number) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: '档案名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: any) => (
        <Space>
          <span style={{ fontSize: 18, color: r.color || '#666' }}>{r.icon}</span>
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '数据表',
      dataIndex: 'tableName',
      key: 'tableName',
      render: (v: string, r: any) => (
        <Tag color="default" style={{ borderWidth: 1, borderColor: r.color, color: r.color }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '记录数',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      width: 100,
      render: (v: number) => <Text strong style={{ color: v > 0 ? '#1677ff' : undefined }}>{v}</Text>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'ops',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, r: ArchiveMeta & { totalRecords: number }) => (
        <Space>
          <Button size="small" icon={<BarsOutlined />} onClick={() => openSchemaDrawer(r)}>结构</Button>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => openRecordsDrawer(r)}>记录</Button>
        </Space>
      ),
    },
  ];

  // 表结构列表列
  const schemaColumns = [
    {
      title: '序号',
      key: 'idx',
      width: 60,
      render: (_: any, __: any, index: number) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: '字段名',
      dataIndex: 'field',
      key: 'field',
      width: 180,
      render: (v: string) => <Text code copyable>{v}</Text>,
    },
    {
      title: '字段说明',
      dataIndex: 'label',
      key: 'label',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          INTEGER: 'geekblue',
          STRING: 'blue',
          BOOLEAN: 'green',
          DATE: 'purple',
          DOUBLE: 'orange',
          FLOAT: 'orange',
        };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
  ];

  // 数据记录列（按 schema 动态生成）
  const getRecordColumns = (schemaData: ArchiveSchemaDTO | null) => {
    if (!schemaData) return [];
    return schemaData.columns
      .filter((c) => c.field !== 'id' && c.field !== 'createdAt' && c.field !== 'updatedAt')
      .map((c) => ({
        title: c.label,
        dataIndex: c.field,
        key: c.field,
        ellipsis: true,
        width: c.type === 'BOOLEAN' ? 90 : c.type === 'DATE' ? 170 : undefined,
        render: (v: any) => {
          if (c.type === 'BOOLEAN') {
            return v === true ? <Tag color="success">是</Tag> : v === false ? <Tag color="default">否</Tag> : '-';
          }
          if (c.type === 'DATE' && v) {
            return <Text>{new Date(v).toLocaleString('zh-CN', { hour12: false })}</Text>;
          }
          if (v === null || v === undefined || v === '') return '-';
          return v;
        },
      }));
  };

  // 是否显示分类筛选
  const showFilters = drawerArchive && FILTERABLE_TYPES.includes(drawerArchive.type);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <TableOutlined /> 档案数据查看
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">点击操作列的「结构」查看表结构（列表方式），「记录」查看数据详情。共 {archiveList.length} 个档案。</Text>
      </Card>

      <Spin spinning={loading}>
        <Table
          size="small"
          columns={columns}
          dataSource={archiveList}
          rowKey="key"
          pagination={false}
          scroll={{ x: 960 }}
          locale={{ emptyText: <Empty description="暂无档案" /> }}
        />
      </Spin>

      {/* 结构 Drawer */}
      <Drawer
        title={
          <Space>
            <BarsOutlined />
            {drawerArchive?.name} - 表结构
            {schema && <Tag color="purple">{schema.tableName}</Tag>}
          </Space>
        }
        width={760}
        open={drawerType === 'schema'}
        onClose={() => setDrawerType(null)}
      >
        <Spin spinning={loadingSchema}>
          {schema && (
            <>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Text>总记录数：</Text>
                  <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{schema.totalRecords}</Text>
                  <Text>字段数：</Text>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{schema.columns.length}</Text>
                  <Text>数据表：</Text>
                  <Tag color="purple">{schema.tableName}</Tag>
                </Space>
              </Card>
              <Table
                size="small"
                columns={schemaColumns}
                dataSource={schema.columns}
                rowKey="field"
                pagination={false}
                scroll={{ y: 'calc(100vh - 360px)' }}
              />
            </>
          )}
        </Spin>
      </Drawer>

      {/* 记录 Drawer */}
      <Drawer
        title={
          <Space>
            <EyeOutlined />
            {drawerArchive?.name} - 数据记录
            {data && <Text type="secondary">共 {data.pagination.total} 条</Text>}
          </Space>
        }
        width="90%"
        open={drawerType === 'records'}
        onClose={() => setDrawerType(null)}
      >
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space wrap size="middle">
              <Input.Search
                placeholder={`搜索${drawerArchive?.name}...`}
                allowClear
                enterButton={<SearchOutlined />}
                onSearch={handleSearch}
                style={{ width: 260 }}
              />
              {/* 分类筛选 */}
              {showFilters && (
                <>
                  <FilterOutlined style={{ color: '#999' }} />
                  {filterOptions.deviceNames && filterOptions.deviceNames.length > 0 && (
                    <Select
                      placeholder="设备名称"
                      allowClear
                      style={{ width: 160 }}
                      value={filterDeviceName || undefined}
                      onChange={(v) => { setFilterDeviceName(v || ''); setTimeout(handleFilterChange, 0); }}
                      options={filterOptions.deviceNames.map((d) => ({ label: d, value: d }))}
                    />
                  )}
                  {filterOptions.factorNames && filterOptions.factorNames.length > 0 && (
                    <Select
                      placeholder="因子名称"
                      allowClear
                      style={{ width: 160 }}
                      value={filterFactorName || undefined}
                      onChange={(v) => { setFilterFactorName(v || ''); setTimeout(handleFilterChange, 0); }}
                      options={filterOptions.factorNames.map((f) => ({ label: f, value: f }))}
                    />
                  )}
                  {drawerArchive?.type === 'env_alarm' && filterOptions.alarmLevels && (
                    <Select
                      placeholder="报警级别"
                      allowClear
                      style={{ width: 120 }}
                      value={filterAlarmLevel}
                      onChange={(v) => { setFilterAlarmLevel(v); setTimeout(handleFilterChange, 0); }}
                      options={filterOptions.alarmLevels.map((l) => ({ label: `级别 ${l}`, value: l }))}
                    />
                  )}
                  {drawerArchive?.type === 'env_alarm' && (
                    <Select
                      placeholder="处理状态"
                      allowClear
                      style={{ width: 120 }}
                      value={filterIsHandled}
                      onChange={(v) => { setFilterIsHandled(v); setTimeout(handleFilterChange, 0); }}
                      options={[
                        { label: '未处理', value: false },
                        { label: '已处理', value: true },
                      ]}
                    />
                  )}
                </>
              )}
              {keyword && <Tag color="blue" closable onClose={() => handleSearch('')}>关键词: {keyword}</Tag>}
            </Space>
          }
          extra={
            data?.pagination && (
              <Text type="secondary">
                第 {data.pagination.page}/{data.pagination.totalPages} 页，每页 {data.pagination.pageSize} 条
              </Text>
            )
          }
        >
          <Spin spinning={loadingData}>
            <Table
              size="small"
              columns={getRecordColumns(schema) as any}
              dataSource={data?.list || []}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
            {data?.pagination && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Pagination
                  current={data.pagination.page}
                  pageSize={data.pagination.pageSize}
                  total={data.pagination.total}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(n) => `共 ${n} 条`}
                  pageSizeOptions={[10, 20, 50, 100, 200]}
                  onChange={(p, ps) => {
                    const newSize = ps || pageSize;
                    setPage(p);
                    setPageSize(newSize);
                    if (drawerArchive) loadRecords(drawerArchive.type, p, newSize, keyword, filterDeviceName, filterFactorName, filterAlarmLevel, filterIsHandled);
                  }}
                />
              </div>
            )}
          </Spin>
        </Card>
      </Drawer>
    </div>
  );
}
