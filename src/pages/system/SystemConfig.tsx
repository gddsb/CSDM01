import { Navigate } from 'react-router-dom'

/**
 * 兼容壳：原 /system/config 入口重定向到参数配置页。
 * 系统配置已拆分为 5 个独立页面，分别对应：
 *   /system/config/params   参数配置
 *   /system/config/env      运行环境
 *   /system/config/db       数据库
 *   /system/config/backup   备份还原
 *   /system/config/files    文件管理
 */
export default function SystemConfig() {
  return <Navigate to="/system/config/params" replace />
}
