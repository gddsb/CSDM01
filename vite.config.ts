import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
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
