import { type ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'

interface BigScreenHeaderProps {
  title: string
  onRefresh?: () => void
  refreshing?: boolean
  /** 左侧区域：显示日期/时间等 */
  extraLeft?: ReactNode
  /** 右侧区域：更新时间/刷新按钮等 */
  extraRight?: ReactNode
  /** 标题下方一行：显示温湿度/压差等（仅生产看板使用） */
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
      {/* 背景装饰：横向光带 + 暗纹 */}
      <div className="bs-header-bg" aria-hidden="true">
        <span className="bs-header-streak s1" />
        <span className="bs-header-streak s2" />
        <span className="bs-header-streak s3" />
      </div>

      {/* 顶部主行 */}
      <div className="bs-header-row">
        {/* 左侧：装饰旗 + 日期时间 */}
        <div className="bs-header-side bs-header-side--left">
          <div className="bs-header-flag" />
          <div className="bs-header-left-content">
            {extraLeft}
          </div>
        </div>

        {/* 中间：标题 */}
        <div className="bs-header-center">
          <div className="bs-title-wrap">
            <div className="bs-title-deco-left" aria-hidden="true" />
            <h1 className="bs-title">{title}</h1>
            <div className="bs-title-deco-right" aria-hidden="true" />
          </div>
        </div>

        {/* 右侧：更新时间 + 装饰旗 + 刷新 */}
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
          <div className="bs-header-flag bs-header-flag--mirror" />
        </div>
      </div>

      {/* 标题下方：温湿度/压差 行（仅生产看板显示） */}
      {envBar && (
        <div className="bs-header-envbar">
          {envBar}
        </div>
      )}
    </div>
  )
}
