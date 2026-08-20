import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { ProxyOptions } from 'vite'

const apiProxy: ProxyOptions = {
  target: 'http://localhost:3001',
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      if (req.url && /[^\x00-\x7F]/.test(req.url)) {
        const [pathname, query] = req.url.split('?')
        if (query) {
          const encodedQuery = query.split('&').map(pair => {
            const idx = pair.indexOf('=')
            if (idx > -1) {
              const key = pair.substring(0, idx)
              const val = pair.substring(idx + 1)
              return `${encodeURIComponent(decodeURIComponent(key))}=${encodeURIComponent(decodeURIComponent(val))}`
            }
            return pair
          }).join('&')
          proxyReq.path = `${pathname}?${encodedQuery}`
        }
      }
    })
  },
}

export default defineConfig({
  plugins: [
    react(),
    // PWA：支持"添加到主屏幕"、离线缓存，覆盖安卓/苹果双端浏览器场景
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '奶粉罐生产管理系统',
        short_name: '奶粉罐MES',
        description: '奶粉罐生产管理系统 - 生产/质量/设备综合管理',
        start_url: '/mobile/home',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#2196F3',
        lang: 'zh-CN',
        scope: '/',
        icons: [
          { src: '/assets/logo-square.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/assets/logo-square.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity'],
      },
      workbox: {
        // 构建产物全量预缓存（html/js/css/img/svg/ico/png/webp/woff2），保证安装后离线可用首页/已缓存页面
        globPatterns: ['**/*.{html,js,css,png,svg,ico,webp,jpg,jpeg,woff2,ttf,json}'],
        // API / uploads 不缓存（实时数据）
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-network-first',
              networkTimeoutSeconds: 15,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'uploads-swr',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // PWA 仅生产构建生效，dev 时避免 sw 干扰 HMR
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.DEPLOY_RUN_PORT) || 5173,
    strictPort: true,
    proxy: {
      '/api': apiProxy,
      '/uploads': apiProxy,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons', 'antd-mobile', 'antd-mobile-icons'],
          'echarts-vendor': ['echarts'],
        },
      },
    },
  },
})
