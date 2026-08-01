import { type ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'

interface BigScreenHeaderProps {
  title: string
  onRefresh?: () => void
  refreshing?: boolean
  extraLeft?: ReactNode
  extraRight?: ReactNode
  envBar?: ReactNode
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
      {/* 背景渐变层（纯深蓝，无横向条纹） */}
      <div className="bs-header-bg" aria-hidden="true" />

      {/* 顶部主行 */}
      <div className="bs-header-row">
        {/* 左侧：闭合带状装饰 + 日期时间 */}
        <div className="bs-header-side bs-header-side--left">
          <svg
            className="bs-flow-band bs-flow-band--left"
            viewBox="0 0 220 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {/* 外带渐变填充 */}
              <linearGradient id="outerBandL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                <stop offset="30%" stopColor="rgba(0,212,255,0.18)" />
                <stop offset="55%" stopColor="rgba(0,212,255,0.35)" />
                <stop offset="80%" stopColor="rgba(0,180,255,0.5)" />
                <stop offset="100%" stopColor="rgba(0,180,255,0.6)" />
              </linearGradient>
              {/* 内带渐变填充 */}
              <linearGradient id="innerBandL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                <stop offset="40%" stopColor="rgba(0,212,255,0.08)" />
                <stop offset="65%" stopColor="rgba(0,212,255,0.22)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0.35)" />
              </linearGradient>
              {/* 外发光 */}
              <filter id="bandGlowL" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 外层 S 形闭合带 */}
            <path
              d="
                M0,36
                C30,36 38,14 72,14
                C102,14 110,58 142,58
                C168,58 182,44 220,40
                L220,32
                C188,36 172,50 150,50
                C118,50 108,18 78,18
                C46,18 34,40 0,42
                Z
              "
              fill="url(#outerBandL)"
              filter="url(#bandGlowL)"
              opacity="0.9"
            />

            {/* 内层 S 形闭合带（平行，更窄） */}
            <path
              d="
                M0,44
                C26,44 32,30 58,30
                C84,30 90,50 118,50
                C142,50 154,42 220,38
                L220,34
                C158,36 144,44 122,44
                C94,44 88,26 62,26
                C38,26 28,40 0,42
                Z
              "
              fill="url(#innerBandL)"
              opacity="0.85"
            />

            {/* 顶部亮边（描边高光） */}
            <path
              d="
                M0,40
                C32,38 44,20 76,20
                C106,20 114,56 146,56
                C170,56 186,42 220,36
              "
              fill="none"
              stroke="rgba(0,230,255,0.6)"
              strokeWidth="1"
            />

            {/* 底部亮边（描边高光） */}
            <path
              d="
                M0,42
                C30,44 46,28 74,28
                C100,28 108,48 136,48
                C158,48 172,40 220,38
              "
              fill="none"
              stroke="rgba(0,200,255,0.4)"
              strokeWidth="0.8"
            />
          </svg>

          <div className="bs-header-left-content">
            {extraLeft}
          </div>
        </div>

        {/* 中间：标题 + 小S形装饰 */}
        <div className="bs-header-center">
          <div className="bs-title-wrap">
            {/* 标题左装饰（小S形闭合带） */}
            <svg
              className="bs-title-band bs-title-band--left"
              viewBox="0 0 120 28"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="titleBandL" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                  <stop offset="50%" stopColor="rgba(0,212,255,0.25)" />
                  <stop offset="100%" stopColor="rgba(0,212,255,0.55)" />
                </linearGradient>
              </defs>
              <path
                d="
                  M0,14
                  C20,14 26,6 46,6
                  C66,6 72,22 92,22
                  C104,22 112,18 120,16
                  L120,12
                  C112,13 102,18 92,18
                  C74,18 68,4 48,4
                  C30,4 22,12 0,14
                  Z
                "
                fill="url(#titleBandL)"
                opacity="0.95"
              />
              <path
                d="M0,12 C22,12 28,4 48,4 C68,4 74,20 94,20 C104,20 112,18 120,16"
                fill="none"
                stroke="rgba(0,230,255,0.7)"
                strokeWidth="0.8"
              />
            </svg>

            <h1 className="bs-title">{title}</h1>

            {/* 标题右装饰（镜像小S形闭合带） */}
            <svg
              className="bs-title-band bs-title-band--right"
              viewBox="0 0 120 28"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="titleBandR" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(0,212,255,0.55)" />
                  <stop offset="50%" stopColor="rgba(0,212,255,0.25)" />
                  <stop offset="100%" stopColor="rgba(0,212,255,0)" />
                </linearGradient>
              </defs>
              <path
                d="
                  M0,12
                  C8,14 16,18 28,18
                  C48,18 54,4 74,4
                  C94,4 100,12 120,12
                  L120,16
                  C100,18 94,22 72,22
                  C52,22 46,6 26,6
                  C14,6 0,14 0,14
                  Z
                "
                fill="url(#titleBandR)"
                opacity="0.95"
              />
              <path
                d="M0,16 C16,20 26,20 46,20 C66,20 72,4 92,4 C100,4 108,12 120,12"
                fill="none"
                stroke="rgba(0,230,255,0.7)"
                strokeWidth="0.8"
              />
            </svg>
          </div>
        </div>

        {/* 右侧：镜像闭合带状装饰 + 更新时间 */}
        <div className="bs-header-side bs-header-side--right">
          <div className="bs-header-right-content">
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

          <svg
            className="bs-flow-band bs-flow-band--right"
            viewBox="0 0 220 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="outerBandR" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,180,255,0.6)" />
                <stop offset="20%" stopColor="rgba(0,180,255,0.5)" />
                <stop offset="45%" stopColor="rgba(0,212,255,0.35)" />
                <stop offset="70%" stopColor="rgba(0,212,255,0.18)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0)" />
              </linearGradient>
              <linearGradient id="innerBandR" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,212,255,0.35)" />
                <stop offset="35%" stopColor="rgba(0,212,255,0.22)" />
                <stop offset="60%" stopColor="rgba(0,212,255,0.08)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0)" />
              </linearGradient>
              <filter id="bandGlowR" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 外层 S 形闭合带（镜像） */}
            <path
              d="
                M0,30
                C38,34 52,50 78,50
                C110,50 118,14 148,14
                C182,14 190,36 220,36
                L220,44
                C190,42 174,58 146,58
                C114,58 106,14 74,14
                C46,14 36,40 0,40
                Z
              "
              fill="url(#outerBandR)"
              filter="url(#bandGlowR)"
              opacity="0.9"
            />

            {/* 内层 S 形闭合带（镜像，更窄） */}
            <path
              d="
                M0,38
                C36,40 58,50 86,50
                C112,50 120,30 148,30
                C176,30 186,36 220,34
                L220,38
                C186,40 174,44 150,44
                C124,44 116,26 88,26
                C62,26 52,40 0,42
                Z
              "
              fill="url(#innerBandR)"
              opacity="0.85"
            />

            {/* 顶部亮边 */}
            <path
              d="
                M0,36
                C34,34 50,56 82,56
                C112,56 120,20 152,20
                C178,20 190,38 220,38
              "
              fill="none"
              stroke="rgba(0,230,255,0.6)"
              strokeWidth="1"
            />

            {/* 底部亮边 */}
            <path
              d="
                M0,38
                C30,40 54,48 84,48
                C112,48 120,28 148,28
                C174,28 188,36 220,38
              "
              fill="none"
              stroke="rgba(0,200,255,0.4)"
              strokeWidth="0.8"
            />
          </svg>
        </div>
      </div>

      {/* 标题下方：温湿度/压差 行 */}
      {envBar && (
        <div className="bs-header-envbar">
          {envBar}
        </div>
      )}
    </div>
  )
}
