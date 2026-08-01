import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface TabItem {
  key: string
  label: string
  path?: string
}

interface BigScreenHeaderProps {
  title: string
  subtitle?: string
  tabs?: TabItem[]
  activeTab?: string
  onTabChange?: (key: string, path?: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  lastUpdate?: string | null
  extraLeft?: ReactNode
  extraRight?: ReactNode
  showBack?: boolean
  backPath?: string
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default function BigScreenHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onRefresh,
  refreshing = false,
  lastUpdate,
  extraLeft,
  extraRight,
  showBack = true,
  backPath = '/dashboard',
}: BigScreenHeaderProps) {
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const weekday = WEEKDAYS[now.getDay()]

  const updateStr = lastUpdate
    ? `${lastUpdate.replace('T', ' ').slice(0, 19)}`
    : `${dateStr} ${timeStr}`

  return (
    <div className="bs-header">
      {/* 左侧：返回 + 日期 + Tabs */}
      <div className="bs-header-left">
        {showBack && (
          <span
            className="bs-back-btn"
            onClick={() => navigate(backPath)}
            title="返回工作台"
          >
            <ArrowLeftOutlined />
          </span>
        )}

        <div className="bs-date-block">
          <span className="bs-date-label">{weekday}</span>
          <span className="bs-date-value">{dateStr}</span>
        </div>

        {tabs && tabs.length > 0 && (
          <div className="bs-screen-tabs">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className={`bs-screen-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => onTabChange?.(tab.key, tab.path)}
              >
                {tab.label}
              </div>
            ))}
          </div>
        )}

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

      {/* 右侧：刷新 + 时间 + 最后更新 */}
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

        <div className="bs-time-block">
          <span className="bs-time-value">{timeStr}</span>
        </div>

        <div className="bs-date-block" style={{ alignItems: 'flex-end' }}>
          <span className="bs-date-label">更新时间</span>
          <span className="bs-date-value" style={{ fontSize: 14 }}>{updateStr}</span>
        </div>

        {subtitle && (
          <span className="bs-date-label" style={{ marginLeft: 8 }}>{subtitle}</span>
        )}
      </div>
    </div>
  )
}
