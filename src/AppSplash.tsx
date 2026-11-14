/**
 * AppSplash — React 开屏遮罩
 *
 * 设计思路（彻底绕开之前 10 次 index.html inline loader 失败的坑）：
 * 1. 用 React 组件而非 index.html inline HTML → JS chunk 带 hash，
 *    不会被 Service Worker 的 index.html precache 锁死
 * 2. logo 用 display:inline-block + max-width + height:auto，
 *    彻底绕开 flex item 对 <img> 的 shrink/交叉轴计算干扰
 */

type Props = { fading?: boolean }

export default function AppSplash({ fading = false }: Props) {
  return (
    <div
      className="app-splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'linear-gradient(180deg, #2196F3 0%, #1565C0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: 'opacity 350ms ease-out',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Logo —— 关键：display:inline-block 绕开 flex item 对 img 的 shrink 干扰
          width + height:auto 严格按原始 2.88:1 比例自动计算高度
          max-width:80vw 极窄屏也不溢出 */}
      <img
        src="/assets/logo-rect-transparent.png"
        alt="Daman 大满"
        style={{
          display: 'inline-block',
          width: 140, // 200 × 0.7 = 少 30%；height:auto 保持原始宽高比自动计算高度
          height: 'auto',
          maxWidth: '80vw',
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.25))',
          marginBottom: 32,
          animation: 'splashFadeIn 900ms ease-out 100ms both, splashScale 900ms ease-out 100ms both',
        }}
      />

      {/* 欢迎词 1 */}
      <div
        style={{
          color: '#fff',
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '0.2em',
          marginBottom: 16,
          textShadow: '0 2px 8px rgba(0,0,0,0.2)',
          animation: 'splashFadeIn 800ms ease-out 600ms both, splashSlideUp 800ms ease-out 600ms both',
        }}
      >
        大家满意
      </div>

      {/* 欢迎词 2 */}
      <div
        style={{
          color: '#FFCDD2',
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '0.2em',
          marginBottom: 48,
          textShadow: '0 2px 8px rgba(0,0,0,0.2)',
          animation: 'splashFadeIn 800ms ease-out 900ms both, splashSlideUp 800ms ease-out 900ms both',
        }}
      >
        共创未来
      </div>

      {/* Spinner */}
      <div
        style={{
          width: 24,
          height: 24,
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'splashSpin 0.9s linear infinite, splashFadeIn 500ms ease-out 1200ms both',
        }}
      />

      {/* 底部系统名 */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          letterSpacing: '0.1em',
          animation: 'splashFadeIn 500ms ease-out 1400ms both',
        }}
      >
        奶粉罐生产管理系统
      </div>

      {/* 内联动画 keyframes — 确保即使 global.css 没加载也能跑 */}
      <style>{`
        @keyframes splashFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes splashSlideUp { from { transform: translateY(16px) } to { transform: translateY(0) } }
        @keyframes splashScale { from { transform: scale(0.85) } to { transform: scale(1) } }
        @keyframes splashSpin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
