/**
 * safe-area 状态栏高度探测
 *
 * 根因：Android WebView 上 env(safe-area-inset-top) 返回 0px
 *       （Android 原生状态栏不算 iOS 风格 safe-area）
 *       iPhone 刘海屏 env() 才返回真实高度 ≈ 47px
 *
 * 解法：优先用 @capacitor/status-bar 原生插件 getInfo().height 精确获取
 *       插件不可用时 fallback 到 CSS env()（至少 iPhone 有值）
 */

const CSS_VAR_SAT = '--sat'

/**
 * 启动时探测状态栏高度并注入 CSS 变量 --sat
 * 调用时机：main.tsx 应用初始化阶段
 */
export async function initStatusBarHeight(): Promise<void> {
  try {
    // 1. 优先尝试原生插件（Capacitor Android + iOS 都精确）
    const { StatusBar } = await import('@capacitor/status-bar').catch(() => ({ StatusBar: null })) as any
    if (StatusBar?.getInfo) {
      const info = await StatusBar.getInfo()
      const h = Math.round(Number(info?.height) || 0)
      if (h > 0) {
        document.documentElement.style.setProperty(CSS_VAR_SAT, `${h}px`)
        return
      }
    }
  } catch {
    /* 插件不可用（浏览器 / SSR）—— 走 fallback */
  }

  // 2. Fallback：读 env(safe-area-inset-top)（iPhone 刘海有值，Android=0）
  const computed = getComputedStyle(document.documentElement)
  const envSat = computed.getPropertyValue(CSS_VAR_SAT).trim()

  // 3. 最后兜底：Android 非刘海没 safe-area 但状态栏仍占 24-28px
  //    用 window.innerHeight - screen.height 的差值估测（edge-to-edge 下成立）
  if (!envSat || envSat === '0px' || envSat === '') {
    const screenH = (window as any).screen?.height || 0
    const viewportH = window.innerHeight
    // 在 edge-to-edge 模式下，innerHeight > screen.height 说明 WebView 延伸到状态栏下面
    // 差值 ≈ 状态栏高度
    const estimated = screenH > 0 ? Math.max(0, Math.round(screenH - viewportH)) : 0
    const final = estimated > 0 ? estimated : 24   // 最终兜底 24px（Android 常见值）
    document.documentElement.style.setProperty(CSS_VAR_SAT, `${final}px`)
  }
}
