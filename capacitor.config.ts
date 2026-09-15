import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.daman.milkcanmes',
  appName: '奶粉罐MES',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // 开发时允许加载本地 dev server（真机调试用）
    cleartext: true,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000 },
    BarcodeScanner: { saveHistory: false },
  },
  // Android TV 支持清单：capacitor 会自动处理 CATEGORY_LEANBACK_LAUNCHER
  android: {
    allowMixedContent: true,
    captureInput: false,
  },
}

export default config
