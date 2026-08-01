import { type ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'

interface BigScreenHeaderProps {
  title: string
  onRefresh?: () => void
  refreshing?: boolean
  extraLeft?: ReactNode
  extraRight?: ReactNode
}

export default function BigScreenHeader({
  title,
  onRefresh,
  refreshing = false,
  extraLeft,
  extraRight,
}: BigScreenHeaderProps) {
  return (
    <div className="bs-header">
      {/* 左侧：扩展内容 */}
      <div className="bs-header-left">
        {extraLeft}
      </div>

      {/* 中间：主标题 */}
      <div className="bs-header-center">
        <div className="bs-title">
          {title}
          <span className="bs-title-deco">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
        </div>
      </div>

      {/* 右侧：刷新 + 扩展内容 */}
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
  )
}
