import type { ReactNode } from 'react'

interface BigScreenPanelProps {
  title?: string
  titleIcon?: ReactNode
  titleExtra?: ReactNode
  children: ReactNode
  style?: React.CSSProperties
  className?: string
  bodyStyle?: React.CSSProperties
}

export default function BigScreenPanel({
  title,
  titleIcon,
  titleExtra,
  children,
  style,
  className = '',
  bodyStyle,
}: BigScreenPanelProps) {
  return (
    <div className={`bs-panel ${className}`.trim()} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {/* 四角装饰 */}
      <span className="bs-panel-corner tl" />
      <span className="bs-panel-corner tr" />
      <span className="bs-panel-corner bl" />
      <span className="bs-panel-corner br" />

      {title && (
        <div className="bs-panel-title">
          {titleIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{titleIcon}</span>}
          <span>{title}</span>
          {titleExtra && <span className="bs-panel-title-sub">{titleExtra}</span>}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, ...bodyStyle }}>
        {children}
      </div>
    </div>
  )
}
