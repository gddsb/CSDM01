import React, { useState, useEffect, useCallback } from 'react'
import { Card, Form, Spin } from 'antd'
import { useApp } from '../../../contexts/AppContext'
import api from '../../../utils/api'
import ParamsTab from '../config-tabs/ParamsTab'
import { configToFormValues, formValuesToConfig } from '../config-tabs/configTransform'

export default function ParamsConfigPage() {
  const { updateSystemConfig } = useApp()
  const message = (window as unknown as { antd?: { message?: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void } } }).antd?.message
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lineOptions, setLineOptions] = useState<{ label: string; value: string }[]>([])

  const showSuccess = (msg: string) => message?.success(msg)
  const showError = (msg: string) => message?.error(msg)
  const showWarning = (msg: string) => message?.warning(msg)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config')
      form.setFieldsValue(configToFormValues(res.data))
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : '加载系统配置失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  const loadLines = useCallback(async () => {
    try {
      const res = await api.get('/basic/production-lines?status=1')
      const list = res.data?.list || res.data || []
      setLineOptions(list.map((l: { line_name?: string; line_code?: string }) => ({ label: l.line_name || l.line_code || '', value: l.line_name || l.line_code || '' })))
    } catch (e: unknown) {
      console.warn('加载产线列表失败:', e instanceof Error ? e.message : e)
    }
  }, [])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = formValuesToConfig(values)
      const res = await api.put('/system/config', payload)
      showSuccess(res.message || '系统配置保存成功')
      updateSystemConfig({ system_name: String(payload.system_name ?? ''), company_name: String(payload.company_name ?? '') })
      await loadConfig()
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] })?.errorFields) {
        showWarning('请完善必填配置项后再保存')
        return
      }
      showError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadConfig()
    loadLines()
  }, [loadConfig, loadLines])

  return (
    <Card size="small" bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
      <Spin spinning={loading}>
        <ParamsTab
          form={form}
          loading={loading}
          saving={saving}
          lineOptions={lineOptions}
          handleSave={handleSave}
        />
      </Spin>
    </Card>
  )
}
