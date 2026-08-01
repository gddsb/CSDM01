import { type ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'

interface BigScreenHeaderProps {
  title: string
  onRefresh?: () => void
  refreshing?: boolean
  extraLeft?: ReactNode
  extraRight?: ReactNode
  /** 标题下方一行：显示温湿度/压差/时钟等 */
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
      {/* 顶部第一行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 80,
        }}
      >
        <div className="bs-header-left">
          {extraLeft}
        </div>

        <div className="bs-header-center">
          <div className="bs-title">
            {title}
            <span className="bs-title-deco">
              <span></span><span></span><span></span><span></span><span></span>
            </span>
          </div>
        </div>

        <div className="bs-header-right">
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

      {/* 标题下方：温湿度/压差 行 */}
      {envBar && (
        <div className="bs-header-envbar">
          {envBar}
        </div>
      )}
    </div>
  )
}
