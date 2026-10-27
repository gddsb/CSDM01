import logger from '../../utils/logger.js'
import { isInNativeShell } from '../../adapter'
/**
 * useBarcode — 扫码 hook
 * - Capacitor 原生壳内（Android/iOS）：调用 @capacitor/barcode-scanner（官方插件 v3.x）
 *   官方插件自动处理相机权限申请，单 API scanBarcode() 拉起相机→扫码→返回
 * - Web 环境（PC 浏览器）：弹出 window.prompt 手动输入
 */
import { useCallback, useState } from 'react'

export interface BarcodeResult {
  code: string
  source: 'native' | 'manual'
}

export function useBarcode() {
  const [isScanning, setIsScanning] = useState(false)

  const scan = useCallback(async (): Promise<BarcodeResult | null> => {
    // 1) Capacitor 原生扫码
    if (isInNativeShell()) {
      try {
        const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } =
          await import('@capacitor/barcode-scanner')

        setIsScanning(true)
        try {
          // 官方插件：单 API 自动处理权限 → 拉起相机 → 返回结果
          const result = await CapacitorBarcodeScanner.scanBarcode({
            hint: CapacitorBarcodeScannerTypeHint.ALL,   // 支持所有格式（QR + 一维条码）
            scanInstructions: '将二维码/条码对准扫描框',
          })
          setIsScanning(false)

          if (result?.ScanResult && result.ScanResult.trim()) {
            return { code: result.ScanResult.trim(), source: 'native' }
          }
          // result 为空通常是用户点了取消
          return null
        } catch (scanErr: any) {
          setIsScanning(false)
          // cancel 是正常（插件返回特定错误码），静默
          logger.warn('CapacitorBarcodeScanner error:', scanErr?.message || scanErr)
          return null
        }
      } catch (err: any) {
        setIsScanning(false)
        logger.warn('CapacitorBarcodeScanner import failed:', err)
        // fallback 到手动输入
      }
    }

    // 2) Web / 原生不可用 → window.prompt 手动输入
    const manual = window.prompt('请输入编号（订单号 / 料号 / 设备编号）:')
    if (!manual) return null
    const code = manual.trim()
    if (!code) return null
    return { code, source: 'manual' }
  }, [])

  return { scan, isScanning }
}
