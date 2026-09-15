import React, { useState, useEffect, useCallback } from 'react'
import { Card, Modal } from 'antd'
import api from '../../../utils/api'
import EnvTab from '../config-tabs/EnvTab'
import type { EnvInfo } from '../config-tabs/types'

export default function EnvConfigPage() {
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void } } }).antd?.message
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [envLoading, setEnvLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)

  const showSuccess = (msg: string) => message?.success(msg)
  const showError = (msg: string) => message?.error(msg)
  const showWarning = (msg: string) => message?.warning(msg)

  const loadEnv = useCallback(async () => {
    setEnvLoading(true)
    try {
      const res = await api.get('/system/config/environment')
      setEnvInfo(res.data)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载项目环境失败')
    } finally {
      setEnvLoading(false)
    }
  }, [])

  const handleRestart = useCallback(async () => {
    Modal.confirm({
      title: '确认重启服务？',
      content: '重启期间服务将短暂不可用，重启完成后会自动刷新环境信息。',
      okText: '确认重启',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setRestartLoading(true)
        try {
          const res = await api.post('/system/config/restart')
          showSuccess(res.message || '重启指令已发送，服务正在重启...')
          const waitAndRefresh = async (attempt = 0) => {
            if (attempt >= 20) {
              setRestartLoading(false)
              showWarning('服务重启时间较长，请手动刷新页面查看')
              return
            }
            try {
              await new Promise(resolve => setTimeout(resolve, 1500))
              const envRes = await api.get('/system/config/environment')
              setEnvInfo(envRes.data)
              setRestartLoading(false)
              showSuccess('服务重启成功，环境信息已刷新')
            } catch {
              waitAndRefresh(attempt + 1)
            }
          }
          waitAndRefresh()
        } catch (err: unknown) {
          setRestartLoading(false)
          showError(err instanceof Error ? err.message : '重启服务失败')
        }
      },
    })
  }, [])

  useEffect(() => {
    loadEnv()
  }, [loadEnv])

  return (
    <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
      <EnvTab
        envLoading={envLoading}
        restartLoading={restartLoading}
        envInfo={envInfo}
        loadEnv={loadEnv}
        handleRestart={handleRestart}
      />
    </Card>
  )
}
