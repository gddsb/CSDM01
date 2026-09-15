/**
 * useBarcode — 扫码 hook
 * - Capacitor 环境（Android/iOS）：调用 @capacitor-community/barcode-scanner
 * - Web 环境：弹出 window.prompt 手动输入
 */
import { useCallback, useRef, useState } from 'react'

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
        const status = await BarcodeScanner.checkPermission({ force: false })
        if (status.granted === false) {
          try { await BarcodeScanner.openAppSettings() } catch {}
        }
        setIsScanning(true)
        lastCancel.current = () => BarcodeScanner.stopScan()
        try { BarcodeScanner.hideBackground() } catch {}
        const result = await BarcodeScanner.startScan()
        setIsScanning(false)
        try { BarcodeScanner.showBackground() } catch {}
        if (result.hasContent && result.content) {
          return { code: result.content.trim(), source: 'native' }
        }
        return null
      } catch (err) {
        setIsScanning(false)
        // fallback
      }
    }

    // 2) Web / 原生失败 → window.prompt 手动输入
    const manual = window.prompt('请输入编号（订单号 / 料号 / 设备编号）:')
    if (!manual) return null
    const code = manual.trim()
    if (!code) return null
    return { code, source: 'manual' }
  }, [])

  const cancel = useCallback(() => { lastCancel.current?.(); setIsScanning(false) }, [])

  return { scan, cancel, isScanning }
}
