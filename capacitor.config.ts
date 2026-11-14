import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.daman.milkcanmes',
  appName: '奶粉罐MES',
  webDir: 'dist',
  server: {
    // 关键：让 WebView 每次打开从 prod nginx 拉 H5，而不是本地 assets/public/
    // 改完 capacitor.config 后必须重编 APK 才能生效（仅此一次），
    // 之后 deploy.sh 更新 prod dist → APK 下次打开即生效，无需再编 APK。
    url: 'http://43.138.218.55',
    // 用 http 而非 https，避免混合内容阻止向 http://43.138.218.55 的 API 请求
    androidScheme: 'http',
    cleartext: true,
    // 允许从任何来源加载资源
    hostname: 'localhost',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 3000 },
    // 键盘避让：Capacitor Android 原生级键盘高度事件 + WebView 自管缩放
    // resize:'none' = 让 WebView 自己决定大小（配合 AndroidManifest adjustResize）
    // 我们用 Keyboard plugin 的 keyboardInset 事件拿精确高度
    Keyboard: { resize: 'none' },
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
  },
}

export default config
