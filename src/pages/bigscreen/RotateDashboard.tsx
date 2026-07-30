import { useState, useEffect, useCallback, useRef } from 'react'
import { Spin, message, Result, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import ProductionBigScreen from './ProductionBigScreen'
import QualityBigScreen from './QualityBigScreen'
import ManagementBigScreen from './ManagementBigScreen'
import EnvironmentBigScreen from './EnvironmentBigScreen'

interface DashboardItem {
  path: string
  name: string
  duration?: number
}

interface DashboardConfig {
  config_id: number
  config_name: string
  dashboards: DashboardItem[]
  default_duration: number
}

const SCREEN_MAP: Record<string, React.ComponentType> = {
  '/bigscreen/production': ProductionBigScreen,
  '/bigscreen/quality': QualityBigScreen,
  '/bigscreen/management': ManagementBigScreen,
  '/bigscreen/environment': EnvironmentBigScreen,
}

export default function RotateDashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadConfig = useCallback(async () => {
    if (!token) {
      setError('缺少访问令牌')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/dashboard/dashboards/share/${token}`)
      setConfig(res.data?.config || null)
    } catch (err: any) {
      setError(err.message || '加载看板配置失败')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!config || !config.dashboards || config.dashboards.length === 0) return
    const current = config.dashboards[currentIndex]
    const duration = (current?.duration || config.default_duration || 10) * 1000
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % config.dashboards.length)
    }, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [config, currentIndex])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e' }}>
        <Result
          status="warning"
          title={error}
          subTitle="请检查链接是否正确或联系管理员"
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={loadConfig}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (!config || !config.dashboards || config.dashboards.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e' }}>
        <Result status="warning" title="看板配置为空" subTitle="请先在看板设置中配置看板" />
      </div>
    )
  }

  const currentDashboard = config.dashboards[currentIndex]
  const ScreenComponent = SCREEN_MAP[currentDashboard?.path || '']

  if (!ScreenComponent) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e' }}>
        <Result status="warning" title={`未知看板类型: ${currentDashboard?.path}`} />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ScreenComponent key={currentIndex} />
      {/* 指示器 */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 12,
        zIndex: 100,
      }}>
        {config.dashboards.map((d, idx) => (
          <div
            key={idx}
            style={{
              width: idx === currentIndex ? 32 : 12,
              height: 12,
              borderRadius: 6,
              background: idx === currentIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            title={d.name}
            onClick={() => setCurrentIndex(idx)}
          />
        ))}
      </div>
      {/* 看板名称 */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 24,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        zIndex: 100,
      }}>
        {currentDashboard.name}
      </div>
    </div>
  )
}
