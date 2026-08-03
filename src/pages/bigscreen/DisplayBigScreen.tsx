import { useState, useEffect, useRef, useCallback } from 'react'

const SCREENS = [
  { name: '生产实时看板', path: '/bigscreen/production' },
  { name: '质量分析看板', path: '/bigscreen/quality' },
  { name: '管理驾驶舱', path: '/bigscreen/management' },
  { name: '环境看板', path: '/bigscreen/environment' },
]

const DISPLAY_DURATION = 10000

export default function DisplayBigScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iframesRef = useRef<(HTMLIFrameElement | null)[]>([])

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {})
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      exitFullscreen()
    } else {
      requestFullscreen()
    }
  }, [requestFullscreen, exitFullscreen])

  useEffect(() => {
    requestFullscreen()
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      exitFullscreen()
    }
  }, [requestFullscreen, exitFullscreen])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SCREENS.length)
    }, DISPLAY_DURATION)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const goTo = (idx: number) => {
    setCurrentIndex(idx)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % SCREENS.length)
      }, DISPLAY_DURATION)
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#060d1b',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {SCREENS.map((screen, idx) => (
        <iframe
          key={screen.path}
          ref={(el) => { iframesRef.current[idx] = el }}
          src={screen.path}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            opacity: idx === currentIndex ? 1 : 0,
            pointerEvents: idx === currentIndex ? 'auto' : 'none',
            transition: 'opacity 0.8s ease-in-out',
            zIndex: idx === currentIndex ? 1 : 0,
          }}
          title={screen.name}
          allow="fullscreen"
        />
      ))}

      {/* 底部指示器 + 控制栏 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'linear-gradient(180deg, transparent 0%, rgba(6,13,27,0.85) 50%, rgba(6,13,27,0.95) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 10,
          padding: '0 24px',
        }}
      >
        {SCREENS.map((screen, idx) => (
          <button
            key={screen.path}
            onClick={() => goTo(idx)}
            style={{
              padding: '8px 16px',
              background: idx === currentIndex
                ? 'linear-gradient(90deg, rgba(0,212,255,0.3), rgba(0,212,255,0.15))'
                : 'rgba(0,50,80,0.4)',
              border: idx === currentIndex
                ? '1px solid rgba(0,212,255,0.6)'
                : '1px solid rgba(0,212,255,0.15)',
              borderRadius: 4,
              color: idx === currentIndex ? '#8adfff' : '#5b8ca8',
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: 1,
              transition: 'all 0.3s',
              fontWeight: idx === currentIndex ? 600 : 400,
            }}
          >
            {screen.name}
          </button>
        ))}

        <div style={{ width: 1, height: 28, background: 'rgba(0,212,255,0.2)', margin: '0 8px' }} />

        <button
          onClick={toggleFullscreen}
          style={{
            padding: '8px 16px',
            background: 'rgba(0,50,80,0.4)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 4,
            color: '#8adfff',
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          {isFullscreen ? '退出全屏' : '全屏显示'}
        </button>
      </div>
    </div>
  )
}
