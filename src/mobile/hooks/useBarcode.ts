/**
 * useBarcode — 扫码 hook
 * - Capacitor 环境（Android/iOS）：调用 @capacitor-community/barcode-scanner
 * - Web 环境：弹出 window.prompt 手动输入
 * - 权限处理：主动请求相机权限，被拒时引导用户到系统设置
 */
import { useCallback, useRef, useState } from 'react'
import { Dialog, Toast } from 'antd-mobile'

export interface BarcodeResult {
  code: string
  source: 'native' | 'manual'
}

function isCapacitor(): boolean {
  const win: any = window
  return typeof win.Capacitor !== 'undefined' || /Capacitor/i.test(navigator.userAgent)
}

export function useBarcode() {
  const [isScanning, setIsScanning] = useState(false)
  const lastCancel = useRef<(() => void) | null>(null)

  const scan = useCallback(async (): Promise<BarcodeResult | null> => {
    // 1) Capacitor 原生扫码
    if (isCapacitor()) {
      try {
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner')

        // 1a. 主动请求相机权限（force: true 会触发系统弹窗）
        let permission = await BarcodeScanner.checkPermission({ force: false })
        if (!permission.granted) {
          // 主动请求权限
          permission = await BarcodeScanner.checkPermission({ force: true })
        }

        if (!permission.granted) {
          // 用户拒绝了权限，弹窗提示并引导到系统设置
          const openSettings = await Dialog.confirm({
            content: '需要相机权限才能扫码，是否去系统设置中开启？',
            confirmText: '去设置',
            cancelText: '取消',
          })
          if (openSettings) {
            try {
              await BarcodeScanner.openAppSettings()
            } catch {
              // openAppSettings 在部分平台可能不可用，静默忽略
            }
          }
          Toast.show({ content: '相机权限未授予，无法扫码', position: 'bottom' })
          return null
        }

        // 1b. 权限已获取，启动扫码
        setIsScanning(true)
        lastCancel.current = () => BarcodeScanner.stopScan()
        try {
          await BarcodeScanner.hideBackground()
        } catch {
          // ignore
        }

        let result
        try {
          result = await BarcodeScanner.startScan()
        } catch (scanErr: any) {
          setIsScanning(false)
          try { await BarcodeScanner.showBackground() } catch {}
          // 扫码启动失败（可能是权限刚授予还没生效，或摄像头被占用）
          Toast.show({
            content: scanErr?.message || '无法启动摄像头，请重试或检查相机权限',
            position: 'bottom',
          })
          return null
        }

        setIsScanning(false)
        try { await BarcodeScanner.showBackground() } catch {}

        if (result?.hasContent && result.content) {
          return { code: result.content.trim(), source: 'native' }
        }
        return null
      } catch (err: any) {
        setIsScanning(false)
        console.warn('Capacitor barcode scan failed:', err)
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

  const cancel = useCallback(() => { lastCancel.current?.(); setIsScanning(false) }, [])

  return { scan, cancel, isScanning }
}
