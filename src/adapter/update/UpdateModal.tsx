/**
 * 更新弹窗 — 强制 / 非强制两种模式
 *
 * 强制更新（forceUpdate=true）：
 *   - 全屏蒙层，无关闭按钮，用户无法点击外部关闭
 *   - 顶部显示版本号 + 更新说明
 *   - 底部按钮：一个"立即更新"
 *
 * 非强制更新（forceUpdate=false）：
 *   - Modal 样式，可点击遮罩关闭
 *   - 底部按钮："稍后再说" + "立即更新"
 *
 * 关键约束：
 *   - 强制更新时 body 滚动锁死（antd ConfigProvider 下已有 modalMaskClosable=false）
 *   - 所有按钮点"立即更新"后走 UpdateService.downloadAndInstallApk
 */
import React, { useEffect, useState } from 'react'
import { Alert, Modal, Progress, Button, Typography, Space } from 'antd'
import { DownloadOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ReleaseInfo, UpdateCheckResult } from './UpdateService'
import { downloadAndInstallApk, skipUpdate, checkForUpdate } from './UpdateService'

interface UpdateModalProps {
  result: UpdateCheckResult
  /** 弹窗关闭后（非强制时用户点了"稍后再说"）调用 */
  onClose: () => void
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ result, onClose }) => {
  const { release, forceUpdate, local } = result
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null)

  // 强制更新不允许关闭
  const open = result.hasUpdate && !!release
  const title = forceUpdate ? (
    <Space size={8} style={{ color: '#e6a23c' }}>
      <WarningOutlined /> <span style={{ fontWeight: 700 }}>请升级到最新版本</span>
    </Space>
  ) : (
    <Space size={8}>
      <InfoCircleOutlined style={{ color: '#1890ff' }} /> <span>发现新版本</span>
    </Space>
  )

  const handleUpdate = async () => {
    if (!release) return
    setBusy(true)
    setStatus({ type: 'info', msg: '正在开始下载...' })

    // Web 端：直接刷新（Service Worker 会拉新）
    if (!local.isNative) {
      setStatus({ type: 'success', msg: '已触发热更新，即将刷新页面' })
      setTimeout(() => window.location.reload(), 800)
      return
    }

    // Android 原生壳
    try {
      const res = await downloadAndInstallApk(release.downloadUrl)
      if (res.ok) {
        setStatus({ type: 'success', msg: res.message })
        if (!forceUpdate) {
          setTimeout(onClose, 1500)
        }
      } else {
        setStatus({ type: 'error', msg: res.message })
      }
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.message || '更新失败，请手动下载' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      width={420}
      maskClosable={!forceUpdate}
      closable={!forceUpdate}
      keyboard={!forceUpdate}
      onCancel={forceUpdate ? undefined : onClose}
      footer={null}
      destroyOnClose
    >
      {release && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.8 }}>
              <div><b>当前版本：</b>{local.appVersion}（build {local.buildNumber || '—'}）</div>
              <div><b>最新版本：</b>
                <span style={{ color: '#1890ff', fontWeight: 700 }}>{release.version}</span>
                {release.buildNumber ? `（build ${release.buildNumber}）` : ''}
              </div>
            </div>
            {release.updateNotes && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: '#f5f7fa',
                borderRadius: 6,
                fontSize: 12,
                color: '#666',
                whiteSpace: 'pre-wrap',
              }}>
                📝 {release.updateNotes}
              </div>
            )}
          </div>

          {forceUpdate && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message="这是一次强制更新，请升级后继续使用"
              style={{ marginBottom: 12 }}
            />
          )}

          {status && (
            <Alert
              type={status.type}
              showIcon
              message={status.msg}
              style={{ marginBottom: 12 }}
            />
          )}

          {busy && (
            <Progress percent={50} status="active" size="small" style={{ marginBottom: 12 }} />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: forceUpdate ? 'center' : 'flex-end' }}>
            {!forceUpdate && (
              <Button
                disabled={busy}
                onClick={() => { skipUpdate(release); onClose() }}
              >
                稍后再说
              </Button>
            )}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={busy}
              onClick={handleUpdate}
            >
              {busy ? '处理中...' : '立即更新'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** 带 Hook 的可组合版本：自动在挂载时 check，有更新时弹窗 */
export function useAppUpdate(enabled: boolean = true) {
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    checkForUpdate().then((r) => {
      if (cancelled) return
      setResult(r)
      if (r.hasUpdate) setVisible(true)
    })
    // 每 12h 后台再查一次（冷启动已经查过，这里只在 APP 持续运行很久时有用）
    const timer = setInterval(async () => {
      const r = await checkForUpdate()
      if (cancelled) return
      setResult(r)
      if (r.hasUpdate) setVisible(true)
    }, 12 * 60 * 60 * 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [enabled])

  return (
    visible && result ? (
      <UpdateModal result={result} onClose={() => setVisible(false)} />
    ) : null
  )
}
