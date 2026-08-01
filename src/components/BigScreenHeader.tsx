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
      {/* 背景装饰：横向光带 */}
      <div className="bs-header-bg" aria-hidden="true">
        <span className="bs-header-streak s1" />
        <span className="bs-header-streak s2" />
        <span className="bs-header-streak s3" />
      </div>

      {/* 顶部主行 */}
      <div className="bs-header-row">
        {/* 左侧：流动曲线 + 日期时间 */}
        <div className="bs-header-side bs-header-side--left">
          <svg
            className="bs-flow-curve bs-flow-curve--left"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="flowLeft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                <stop offset="40%" stopColor="rgba(0,212,255,0.6)" />
                <stop offset="100%" stopColor="rgba(0,180,255,0.8)" />
              </linearGradient>
              <filter id="glowLeft">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M0,30 C40,30 50,10 80,10 C110,10 120,50 150,50 C170,50 180,40 200,35"
              fill="none"
              stroke="url(#flowLeft)"
              strokeWidth="1.5"
              filter="url(#glowLeft)"
            />
            <path
              d="M0,38 C30,38 45,20 75,18 C105,16 125,42 155,44 C175,45 185,38 200,32"
              fill="none"
              stroke="rgba(0,212,255,0.3)"
              strokeWidth="0.8"
            />
            <circle cx="80" cy="10" r="2.5" fill="#00d4ff" filter="url(#glowLeft)" />
            <circle cx="150" cy="50" r="2" fill="#00d4ff" filter="url(#glowLeft)" />
          </svg>

          <div className="bs-header-left-content">
            {extraLeft}
          </div>
        </div>

        {/* 中间：标题 + 流动曲线装饰 */}
        <div className="bs-header-center">
          <div className="bs-title-wrap">
            <svg
              className="bs-title-flow bs-title-flow--left"
              viewBox="0 0 120 20"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="titleFlowL" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,212,255,0.8)" />
                </linearGradient>
              </defs>
              <path
                d="M0,10 C20,10 30,3 50,3 C70,3 80,17 100,17 C110,17 115,14 120,12"
                fill="none"
                stroke="url(#titleFlowL)"
                strokeWidth="1.2"
              />
              <circle cx="50" cy="3" r="1.5" fill="#00d4ff" />
              <circle cx="100" cy="17" r="1.2" fill="#00d4ff" />
            </svg>

            <h1 className="bs-title">{title}</h1>

            <svg
              className="bs-title-flow bs-title-flow--right"
              viewBox="0 0 120 20"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="titleFlowR" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(0,212,255,0.8)" />
                  <stop offset="100%" stopColor="rgba(0,212,255,0)" />
                </linearGradient>
              </defs>
              <path
                d="M0,12 C5,14 10,17 20,17 C40,17 50,3 70,3 C90,3 100,10 120,10"
                fill="none"
                stroke="url(#titleFlowR)"
                strokeWidth="1.2"
              />
              <circle cx="20" cy="17" r="1.2" fill="#00d4ff" />
              <circle cx="70" cy="3" r="1.5" fill="#00d4ff" />
            </svg>
          </div>
        </div>

        {/* 右侧：更新时间 + 流动曲线 + 刷新 */}
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
            className="bs-flow-curve bs-flow-curve--right"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="flowRight" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,180,255,0.8)" />
                <stop offset="60%" stopColor="rgba(0,212,255,0.6)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0)" />
              </linearGradient>
              <filter id="glowRight">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M0,25 C20,20 30,10 50,10 C80,10 90,50 120,50 C150,50 160,30 200,30"
              fill="none"
              stroke="url(#flowRight)"
              strokeWidth="1.5"
              filter="url(#glowRight)"
            />
            <path
              d="M0,32 C25,28 40,18 60,16 C90,14 100,44 130,46 C155,47 170,35 200,28"
              fill="none"
              stroke="rgba(0,212,255,0.3)"
              strokeWidth="0.8"
            />
            <circle cx="50" cy="10" r="2.5" fill="#00d4ff" filter="url(#glowRight)" />
            <circle cx="120" cy="50" r="2" fill="#00d4ff" filter="url(#glowRight)" />
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
