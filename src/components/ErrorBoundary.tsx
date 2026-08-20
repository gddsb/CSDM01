import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  chunkReloading: boolean
}

/**
 * 全局错误边界组件
 * - 捕获页面运行时错误，防止整个应用白屏
 * - 针对 Vite/React 懒加载 chunk 加载失败 (ChunkLoadError) 自动刷新一次
 * - 其他错误显示友好提示，支持手动重试
 */
export default class ErrorBoundary extends Component<Props, State> {
  private reloadAttempted = false

  state: State = {
    hasError: false,
    error: null,
    chunkReloading: false,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, chunkReloading: false }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获错误:', error, errorInfo)

    // 检测 ChunkLoadError（懒加载 chunk 丢失/版本不匹配）
    const isChunkLoadError =
      error.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error.message) ||
      /Loading CSS chunk .* failed/i.test(error.message)

    if (isChunkLoadError && !this.reloadAttempted) {
      this.reloadAttempted = true
      this.setState({ chunkReloading: true })
      // 延迟 1 秒后自动刷新，给用户一个过渡状态
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, chunkReloading: false })
    this.reloadAttempted = false
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.chunkReloading) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#f5f5f5',
            fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <div style={{ fontSize: 16, color: '#666' }}>检测到系统新版本，正在刷新...</div>
        </div>
      )
    }

    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#f5f5f5',
            fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>😵</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8 }}>
            页面加载出错了
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#999',
              marginBottom: 24,
              maxWidth: 400,
              textAlign: 'center',
              wordBreak: 'break-all',
            }}
          >
            {this.state.error?.message || '发生了未知错误'}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: '#2196F3',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
