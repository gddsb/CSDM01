/**
 * 设备适配层统一导出
 *
 * 使用入口：import { useDevice, DeviceGate, isRouteAllowed, DeviceProvider } from './adapter'
 */
export * from './types'
export * from './deviceDetector'
export * from './DeviceContext'
export * from './DeviceGate'
export * from './adaptive'
export * from './offline/db'
export { useTvFocus } from './tv/FocusManager'
