/**
 * Dashboard 常量 —— 从 MobileDashboard.tsx 抽取
 *
 * 纯数据定义，零业务逻辑。Dashboard 组件通过 import { DEFAULT_ORDER, ... } 使用。
 */
import {
  BillOutline, CheckOutline, TeamOutline, SetOutline, AppstoreOutline,
  FlagOutline, SearchOutline, CalendarOutline, PieOutline, FolderOutline,
  FileOutline, ChatAddOutline,
} from 'antd-mobile-icons'

export interface QuickEntry {
  key: string
  title: string
  icon: React.ReactNode
  color: string
  path: string
  permCode?: string
  disabled?: boolean
}

export interface TodoItem {
  icon: string
  text: string
  count: number
  path: string
  color: string
}

/** 快捷操作全集（按权限过滤 + localStorage 排序持久化） */
export const DEFAULT_ORDER: QuickEntry[] = [
  { key: 'reporting', title: '移动报工', icon: <BillOutline fontSize={28} />, color: '#2196F3', path: '/m/process-reporting', permCode: 'production:reporting' },
  { key: 'prod-orders', title: '生产订单', icon: <CalendarOutline fontSize={28} />, color: '#FF9800', path: '/m/production-orders', permCode: 'production:reporting' },
  { key: 'incoming', title: '来料检验', icon: <CheckOutline fontSize={28} />, color: '#4CAF50', path: '/m/incoming-inspection', permCode: 'quality:incoming' },
  { key: 'process', title: '过程检验', icon: <CheckOutline fontSize={28} />, color: '#3F51B5', path: '/m/process-inspection', permCode: 'quality:process' },
  { key: 'device', title: '设备点检', icon: <TeamOutline fontSize={28} />, color: '#FF9800', path: '/m/device-inspection', permCode: 'device:inspection' },
  { key: 'maintenance', title: '设备保养', icon: <SetOutline fontSize={28} />, color: '#00BCD4', path: '/m/device-maintenance', permCode: 'device:maintenance' },
  { key: 'spare-parts', title: '备件管理', icon: <FolderOutline fontSize={28} />, color: '#607D8B', path: '/m/spare-parts', permCode: 'device:spare-part' },
  { key: 'device-fault', title: '设备故障', icon: <FlagOutline fontSize={28} />, color: '#E91E63', path: '/m/device-fault', permCode: 'device:fault' },
  { key: 'exception', title: '异常上报', icon: <AppstoreOutline fontSize={28} />, color: '#F44336', path: '/m/exception-report', permCode: 'production:reporting' },
  { key: 'daily-card', title: '日报卡', icon: <CalendarOutline fontSize={28} />, color: '#009688', path: '/m/daily-card' },
  { key: 'device-documents', title: '电子档案', icon: <FileOutline fontSize={28} />, color: '#795548', path: '/m/device-documents', permCode: 'device:document' },
  { key: 'oee', title: '设备OEE', icon: <PieOutline fontSize={28} />, color: '#5E35B1', path: '/m/device-oee', permCode: 'device:oee' },
  { key: 'calibration', title: '校准提醒', icon: <SetOutline fontSize={28} />, color: '#FF5722', path: '/m/calibration-reminder', permCode: 'device:calibration' },
  { key: 'inspection-history', title: '检验历史', icon: <SearchOutline fontSize={28} />, color: '#795548', path: '/m/inspection-history', permCode: 'quality:incoming' },
  { key: 'microbe', title: '微生物检验', icon: <CheckOutline fontSize={28} />, color: '#673AB7', path: '/m/microbe-inspection', permCode: 'quality:incoming' },
  { key: 'complaint', title: '投诉上报', icon: <ChatAddOutline fontSize={28} />, color: '#FF4081', path: '/m/complaint-report', permCode: 'quality:incoming' },
]

/** localStorage 键：持久化快捷操作自定义顺序 */
export const STORAGE_KEY = 'mobile_home_order'

/** 高优先级 emoji — 通知区筛选条件之一 */
export const HIGH_PRIORITY_ICONS = new Set(['🚨', '🔧', '⚠️'])
