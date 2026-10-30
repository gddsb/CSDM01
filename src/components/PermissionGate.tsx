/**
 * 权限守卫组件 — 前端路由/页面级权限控制
 *
 * 设计：
 * 1. 调用 AppContext.hasPermission(permCode) — 内部已实现父子码继承
 *    （有 'basic:material' 自动放行所有 'basic:material:*' 的子操作）
 * 2. 无权限 → 显示友好的"无权限"页面（红色 Stop 图标 + 缺少的 perm_code）
 * 3. 有权限 → 渲染 children
 *
 * 与后端 permissionRequired 中间件配合：
 *  - 后端是安全兜底（绕过前端直接调 API 也会被拦）
 *  - 前端是体验层（避免用户看到空页面/按钮）
 *
 * 使用示例：
 *   <PermissionGate permCode="basic:material">
 *     <MaterialManagement />
 *   </PermissionGate>
 */
import React from 'react'
import { Result, Button } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'

interface PermissionGateProps {
  /** 必需的权限编码（支持父子码继承，如传 'basic:material' 会同时放行 'basic:material:create' 等） */
  permCode: string
  /** 有权限时渲染的页面/组件 */
  children: React.ReactNode
  /** 自定义无权限提示（不传则用默认 Result 组件） */
  fallback?: React.ReactNode
}

const PermissionGate: React.FC<PermissionGateProps> = ({ permCode, children, fallback }) => {
  const { hasPermission } = useApp()

  if (hasPermission(permCode)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 360 }}>
      <Result
        status="error"
        icon={<StopOutlined />}
        title="无权限访问"
        subTitle={
          <span>
            您缺少权限：<code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4, color: '#c0392b' }}>{permCode}</code>
            <br />
            请联系管理员分配后重试
          </span>
        }
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        }
      />
    </div>
  )
}

export default PermissionGate
