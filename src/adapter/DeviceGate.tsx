/**
 * DeviceGate — 路由守卫 & 组件级守卫
 *
 * 功能：
 *  1. 路由层面：按设备类型过滤 React Router Routes
 *     - TV 端只允许 /tv/* 和登录路由（跳过登录）
 *     - 手机/PDA/平板端屏蔽 /system /auto /settings 等前缀
 *  2. 组件层面：DeviceGate 包裹某个组件，仅在指定设备类型下渲染
 *     - 例：<DeviceGate allow={['pda']}><PdaScanBtn /></DeviceGate>
 *
 * 关键约束：
 *  - 不改变业务组件本身，只在外层包一层条件判断
 *  - TV 端强制屏蔽所有 interactive=true 的功能入口
 */
import React from 'react'
import type { DeviceType } from './types'
import { BLOCKED_ROUTE_PREFIXES } from './types'
import { useDevice } from './DeviceContext'

interface DeviceGateProps {
  /** 允许渲染的设备类型（白名单）；不填则视为所有设备允许 */
  allow?: DeviceType[]
  /** 禁止渲染的设备类型（黑名单，优先级高于 allow） */
  deny?: DeviceType[]
  /** TV 端（不允许交互）是否直接隐藏 interactive 组件；默认 true */
  hideInteractiveOnTv?: boolean
  children: React.ReactNode
  /** 不允许渲染时显示的占位（默认 null） */
  fallback?: React.ReactNode
}

export const DeviceGate: React.FC<DeviceGateProps> = ({
  allow,
  deny,
  children,
  hideInteractiveOnTv = true,
  fallback = null,
}) => {
  const { type, capability } = useDevice()

  // 黑名单命中
  if (deny && deny.includes(type)) return <>{fallback}</>

  // 白名单不命中
  if (allow && !allow.includes(type)) return <>{fallback}</>

  // TV 端屏蔽所有非纯展示组件
  if (hideInteractiveOnTv && type === 'tv' && capability.interactive === false) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/** 工具：判断路由 pathname 是否在当前设备上允许访问 */
export function isRouteAllowed(pathname: string, type: DeviceType): boolean {
  // TV 端：只允许 /tv 前缀、登录、public dashboard
  if (type === 'tv') {
    return pathname.startsWith('/tv') || pathname === '/login' || pathname === '/'
  }
  // 移动端：屏蔽 system / auto / settings
  const blocked = BLOCKED_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))
  if (blocked) return false
  return true
}
