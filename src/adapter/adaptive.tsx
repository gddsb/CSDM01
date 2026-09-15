/**
 * Adaptive — 共享组件设备变体分发器
 *
 * 模式：每个共享组件按设备类型导出不同变体，分发器自动选对应设备版本。
 *
 * 约定目录：
 *   src/components/adaptive/<ComponentName>/
 *   ├── index.tsx         ← 分发器（由开发写）
 *   ├── MobileVariant.tsx
 *   ├── PdaVariant.tsx
 *   ├── TabletVariant.tsx
 *   └── TvVariant.tsx
 *
 * 分发器样板：
 *   import { useDevice } from '../../adapter/DeviceContext'
 *   import MobileVariant from './MobileVariant'
 *   import PdaVariant from './PdaVariant'
 *   import TabletVariant from './TabletVariant'
 *   import TvVariant from './TvVariant'
 *   export default function OrderCard(props: OrderCardProps) {
 *     const { type } = useDevice()
 *     switch (type) {
 *       case 'pda':    return <PdaVariant {...props} />
 *       case 'tablet': return <TabletVariant {...props} />
 *       case 'tv':     return <TvVariant {...props} />
 *       default:       return <MobileVariant {...props} />
 *     }
 *   }
 *
 * 也可使用下方便捷工具函数 getVariant 减少 switch 模板代码。
 */
import React from 'react'
import type { DeviceType } from './types'
import { useDevice } from './DeviceContext'

type VariantMap<T> = Partial<Record<DeviceType, React.ComponentType<T>>> & { default?: React.ComponentType<T> }

/**
 * 根据当前设备类型从变体映射中选择对应组件。
 * 优先级：具体设备变体 → default 变体 → 抛错
 */
export function getVariant<P = unknown>(map: VariantMap<P>, type: DeviceType): React.ComponentType<P> {
  const direct = map[type]
  if (direct) return direct
  if (map.default) return map.default
  throw new Error(`[Adaptive] No variant for device "${type}" and no default fallback`)
}

/** 便捷 Hook — 直接返回当前设备对应的变体组件 */
export function useAdaptive<P = unknown>(map: VariantMap<P>): React.ComponentType<P> {
  const { type } = useDevice()
  return getVariant<P>(map, type)
}

/**
 * 辅助：为缺失的设备变体提供统一 fallback 组件的工厂
 * 例：placeholder('OrderCard', 'pda') → 渲染一个占位卡片提示开发中
 */
export function placeholder(component: string, device: DeviceType): React.FC {
  return React.memo(function Placeholder() {
    return React.createElement(
      'div',
      {
        style: {
          padding: 12,
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          color: '#999',
          fontSize: 12,
          textAlign: 'center' as const,
        },
      },
      `${component} — ${device.toUpperCase()} 变体待实现`
    )
  })
}
