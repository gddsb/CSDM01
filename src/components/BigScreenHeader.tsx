import { type ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'

interface BigScreenHeaderProps {
  title: string
  onRefresh?: () => void
  refreshing?: boolean
  /** 标题下方左侧：日期/时间/星期 */
  extraLeft?: ReactNode
  /** 标题下方右侧：更新时间等 */
  extraRight?: ReactNode
  /** 标题下方温湿度/压差（紧挨 extraRight 左侧） */
  envBar?: ReactNode
}

/**
 * 对称装饰图案 SVG（左右镜像）
 * 设计：菱形主体 + 翼形曲线 + 渐变填充
 */
function SymmetryDeco({ mirror = false }: { mirror?: boolean }) {
  const transform = mirror ? 'scale(-1, 1) translate(-220, 0)' : undefined
  return (
    <svg
      className="bs-deco-svg"
      viewBox="0 0 220 56"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={transform ? { transform } : undefined}
    >
      <defs>
        <linearGradient id="decoGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,212,255,0)" />
          <stop offset="25%" stopColor="rgba(0,212,255,0.15)" />
          <stop offset="50%" stopColor="rgba(0,212,255,0.4)" />
          <stop offset="75%" stopColor="rgba(0,180,255,0.55)" />
          <stop offset="100%" stopColor="rgba(0,160,255,0.65)" />
        </linearGradient>
        <linearGradient id="decoGradInner" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,212,255,0)" />
          <stop offset="40%" stopColor="rgba(0,212,255,0.08)" />
          <stop offset="70%" stopColor="rgba(0,212,255,0.25)" />
          <stop offset="100%" stopColor="rgba(0,212,255,0.4)" />
        </linearGradient>
        <filter id="decoGlow" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 外层翼形带：从窄到宽的 S 形闭合带 */}
      <path
        d="
          M0,28
          C30,28 36,10 64,10
          C92,10 96,48 124,48
          C148,48 158,38 220,34
          L220,30
          C160,32 150,44 126,44
          C98,44 94,6 66,6
          C40,6 32,24 0,24
          Z
        "
        fill="url(#decoGrad)"
        filter="url(#decoGlow)"
        opacity="0.92"
      />

      {/* 内层翼形带（更窄，平行） */}
      <path
        d="
          M0,34
          C24,34 28,22 50,22
          C72,22 76,42 98,42
          C118,42 128,36 220,30
          L220,28
          C130,32 120,38 100,38
          C80,38 74,18 52,18
          C32,18 26,30 0,30
          Z
        "
        fill="url(#decoGradInner)"
        opacity="0.85"
      />

      {/* 顶部亮边描线 */}
      <path
        d="M0,26 C32,24 38,8 66,8 C94,8 98,46 126,46 C150,46 160,36 220,32"
        fill="none"
        stroke="rgba(0,230,255,0.55)"
        strokeWidth="0.8"
      />
      {/* 底部亮边描线 */}
      <path
        d="M0,28 C28,30 34,18 56,18 C78,18 82,40 104,40 C124,40 136,34 220,30"
        fill="none"
        stroke="rgba(0,200,255,0.35)"
        strokeWidth="0.6"
      />
    </svg>
  )
}

/**
 * 标题两侧小对称装饰
 */
function TitleSymmetryDeco({ mirror = false }: { mirror?: boolean }) {
  const transform = mirror ? 'scale(-1, 1) translate(-100, 0)' : undefined
  return (
    <svg
      className="bs-title-deco-svg"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={transform ? { transform } : undefined}
    >
      <defs>
        <linearGradient id="titleDecoGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,212,255,0)" />
          <stop offset="50%" stopColor="rgba(0,212,255,0.2)" />
          <stop offset="100%" stopColor="rgba(0,212,255,0.5)" />
        </linearGradient>
      </defs>
      <path
        d="
          M0,12
          C15,12 20,4 36,4
          C52,4 56,20 72,20
          C82,20 90,16 100,14
          L100,10
          C90,12 82,16 72,16
          C56,16 52,2 36,2
          C22,2 16,10 0,10
          Z
        "
        fill="url(#titleDecoGrad)"
        opacity="0.9"
      />
      <path
        d="M0,10 C16,10 22,2 38,2 C54,2 58,18 74,18 C84,18 92,14 100,12"
        fill="none"
        stroke="rgba(0,230,255,0.6)"
        strokeWidth="0.6"
      />
    </svg>
  )
}

export default function BigScreenHeader({
  title,
  onRefresh,
  refreshing = false,
  extraLeft,
  extraRight,
  envBar,
}: BigScreenHeaderProps) {
  return (
    <div className="bs-header">
      {/* 背景渐变层 */}
      <div className="bs-header-bg" aria-hidden="true" />

      {/* 顶部波浪装饰线（跨全宽） */}
      <svg
        className="bs-header-wave"
        viewBox="0 0 1920 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,212,255,0)" />
            <stop offset="10%" stopColor="rgba(0,212,255,0.18)" />
            <stop offset="30%" stopColor="rgba(0,230,255,0.5)" />
            <stop offset="50%" stopColor="rgba(100,200,255,0.7)" />
            <stop offset="70%" stopColor="rgba(0,230,255,0.5)" />
            <stop offset="90%" stopColor="rgba(0,212,255,0.18)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0)" />
          </linearGradient>
          <linearGradient id="waveGradInner" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,212,255,0)" />
            <stop offset="20%" stopColor="rgba(0,212,255,0.08)" />
            <stop offset="50%" stopColor="rgba(0,200,255,0.3)" />
            <stop offset="80%" stopColor="rgba(0,212,255,0.08)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0)" />
          </linearGradient>
          <filter id="waveGlow" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* 外层波浪带 */}
        <path
          d="M0,14 C200,6 360,22 560,14 C760,6 920,22 1120,14 C1320,6 1480,22 1680,14 C1780,10 1860,16 1920,12 L1920,18 C1860,22 1780,18 1680,22 C1480,30 1320,14 1120,22 C920,30 760,14 560,22 C360,30 200,14 0,22 Z"
          fill="url(#waveGrad)"
          filter="url(#waveGlow)"
          opacity="0.85"
        />
        {/* 内层波浪线 */}
        <path
          d="M0,16 C200,10 360,20 560,16 C760,10 920,20 1120,16 C1320,10 1480,20 1680,16 C1780,14 1860,18 1920,16"
          fill="none"
          stroke="url(#waveGradInner)"
          strokeWidth="0.8"
          opacity="0.7"
        />
        {/* 顶部亮线 */}
        <path
          d="M0,12 C200,4 360,20 560,12 C760,4 920,20 1120,12 C1320,4 1480,20 1680,12 C1780,8 1860,14 1920,10"
          fill="none"
          stroke="rgba(180,240,255,0.5)"
          strokeWidth="0.6"
        />
      </svg>

      {/* 顶部主行：左装饰 + 标题 + 右装饰（完全对称） */}
      <div className="bs-header-row">
        {/* 左侧对称装饰 */}
        <div className="bs-header-deco bs-header-deco--left">
          <SymmetryDeco />
        </div>

        {/* 中间标题 */}
        <div className="bs-header-center">
          <div className="bs-title-wrap">
            <TitleSymmetryDeco />
            <h1 className="bs-title">{title}</h1>
            <TitleSymmetryDeco mirror />
          </div>
        </div>

        {/* 右侧对称装饰（镜像） */}
        <div className="bs-header-deco bs-header-deco--right">
          <SymmetryDeco mirror />
        </div>
      </div>

      {/* 标题下方行：左侧日期时间星期 | 右侧 温湿度压差 + 更新时间 */}
      {(extraLeft || extraRight || envBar) && (
        <div className="bs-header-info-row">
          <div className="bs-header-info-left">
            {extraLeft}
          </div>
          <div className="bs-header-info-right">
            {envBar}
            {extraRight}
            {onRefresh && (
              <span
                className="bs-refresh-btn"
                onClick={onRefresh}
                title="刷新数据"
              >
                <ReloadOutlined spin={refreshing} />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
