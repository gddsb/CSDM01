import { useState } from 'react';
import { Layout, Typography, Menu } from 'antd';
import {
  CloudServerOutlined, FileTextOutlined, TableOutlined, DashboardOutlined,
  SettingOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import DataViewer from './DataViewer';
import TaskLogs from './TaskLogs';
import TaskSettings from './TaskSettings';
import ScheduledTasks from './ScheduledTasks';
import Dashboard from './Dashboard';

const { Sider, Content } = Layout;
const { Title } = Typography;

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '环境看板',
    },
    {
      key: 'task_settings',
      icon: <SettingOutlined />,
      label: '任务设置',
    },
    {
      key: 'scheduled',
      icon: <ScheduleOutlined />,
      label: '计划任务',
    },
    {
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '任务日志',
    },
    {
      key: 'archive',
      icon: <TableOutlined />,
      label: '数据查看',
    },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'task_settings':
        return <TaskSettings />;
      case 'scheduled':
        return <ScheduledTasks />;
      case 'logs':
        return <TaskLogs />;
      case 'archive':
        return <DataViewer />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={200}
      >
        <div className="logo-container" style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          color: '#fff',
          fontSize: collapsed ? 14 : 14,
          fontWeight: 600,
          gap: 8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          <CloudServerOutlined style={{ fontSize: 22 }} />
          {!collapsed && <span>U9 数据同步</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeView]}
          onSelect={({ key }) => setActiveView(key)}
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Layout.Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
        }}>
          <Title level={4} style={{ margin: 0 }}>
            {menuItems.find((m) => m.key === activeView)?.label}
          </Title>
        </Layout.Header>

        <Content style={{ margin: '16px', padding: 0, minHeight: 280 }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}
