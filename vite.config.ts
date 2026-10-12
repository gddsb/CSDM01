import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { ProxyOptions } from 'vite'
import pkg from './package.json'
import { execSync } from 'node:child_process'

/** 从环境变量 APP_BUILD 或 git rev-list 获取 build number */
function resolveBuildNumber(): string {
  if (process.env.APP_BUILD) return process.env.APP_BUILD
  try {
    return execSync('git rev-list --count HEAD 2>/dev/null', { encoding: 'utf-8' }).trim() || '1'
  } catch {
    return '1'
  }
}

const APP_BUILD = resolveBuildNumber()

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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(APP_BUILD),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA：支持"添加到主屏幕"、离线缓存，覆盖安卓/苹果双端浏览器场景
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '奶粉罐生产管理系统',
        short_name: '奶粉罐MES',
        description: '奶粉罐生产管理系统 - 生产/质量/设备综合管理',
        start_url: '/',
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
        // 允许大文件（antd chunk 超 2MB）预缓存
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // ⚠️ 关键：禁用 navigateFallback
        // vite-plugin-pwa 默认值是 "index.html"，会把 index.html 加入 precache 并注册 NavigationRoute，
        // 导致旧 SW 锁死旧 HTML → 服务器更新后用户浏览器仍加载旧 JS（PC 误判 bug 永远不生效）。
        // 我们自己在 runtimeCaching 里用 NetworkFirst 处理 HTML（见下），保证每次拿最新版本。
        navigateFallback: null,
        // JS/CSS/图片走 precache；HTML 不在此列表（由 runtimeCaching 处理）
        globPatterns: ['**/*.{js,css,png,svg,ico,webp,jpg,jpeg,woff2,ttf,json}'],
        // API / uploads / HTML 分别处理
        runtimeCaching: [
          {
            // ⚠️ 关键修复：HTML 每次走 NetworkFirst
            // 旧 SW 的 NavigationRoute + precache index.html 会把入口锁死在旧版本，
            // 服务器更新后用户浏览器加载的仍是旧 JS → PC 误判 bug 永远不生效。
            // 让 HTML 每次从服务器拿最新版本，JS 引用才会随构建更新。
            urlPattern: ({ url }) => url.pathname === '/' || url.pathname.endsWith('.html'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-network-first',
              networkTimeoutSeconds: 10,
            },
          },
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
          'antd-vendor': ['antd', '@ant-design/icons'],
          'echarts-vendor': ['echarts'],
        },
      },
    },
  },
})
