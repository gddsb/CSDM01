import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.daman.milkcanmes',
  appName: '奶粉罐MES',
  webDir: 'dist',
  server: {
    // 用 http 而非 https，避免混合内容阻止向 http://43.138.218.55 的 API 请求
    androidScheme: 'http',
    cleartext: true,
    // 允许从任何来源加载资源
    hostname: 'localhost',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000 },
    BarcodeScanner: { saveHistory: false },
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
  },
}

export default config
