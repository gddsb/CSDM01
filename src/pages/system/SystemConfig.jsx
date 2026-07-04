import React, { useState, useEffect, useCallback } from 'react'
import { Form, Input, InputNumber, Select, Switch, Button, Row, Col, Typography, message, Spin } from 'antd'
import { SaveOutlined, SettingOutlined, ToolOutlined, SafetyOutlined, BellOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const { Title, Text } = Typography

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

// 后端配置（字符串）→ 表单值
function configToFormValues(cfg) {
  if (!cfg) return {}
  const v = { ...cfg }
  // 班次：逗号分隔字符串 → 数组
  if (typeof v.shift_setting === 'string' && v.shift_setting.length > 0) {
    v.shift_setting = v.shift_setting.split(',').map(s => s.trim()).filter(Boolean)
  } else if (v.shift_setting == null) {
    v.shift_setting = []
  }
  // 布尔开关：字符串 → 布尔
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach(k => {
    if (v[k] != null) v[k] = String(v[k]) === 'true'
  })
  // 数值：字符串 → 数字
  ;['standard_hours', 'defect_warning_threshold', 'microbe_cycle'].forEach(k => {
    if (v[k] != null && v[k] !== '') v[k] = Number(v[k])
  })
  return v
}

// 表单值 → 后端配置（字符串/原始值）
function formValuesToConfig(values) {
  const cfg = { ...values }
  // 班次：数组 → 逗号分隔字符串
  if (Array.isArray(cfg.shift_setting)) {
    cfg.shift_setting = cfg.shift_setting.join(',')
  }
  // 布尔开关：布尔 → 字符串
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach(k => {
    if (typeof cfg[k] === 'boolean') cfg[k] = String(cfg[k])
  })
  return cfg
}

export default function SystemConfig() {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config')
      const values = configToFormValues(res.data)
      form.setFieldsValue(values)
    } catch (err) {
      message.error(err.message || '加载系统配置失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = formValuesToConfig(values)
      const res = await api.put('/system/config', payload)
      message.success(res.message || '系统配置保存成功')
      // 保存后重新加载配置
      await loadConfig()
    } catch (e) {
      if (e?.errorFields) {
        message.warning('请完善必填配置项后再保存')
        return
      }
      message.error(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 分区块标题
  const SectionTitle = ({ icon, title, desc }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 18, color: 'var(--color-primary)' }}>{icon}</span>
      <Title level={5} style={{ margin: 0 }}>{title}</Title>
      {desc && <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>{desc}</Text>}
    </div>
  )

  return (
    <ThreeSectionPage
      title="系统配置"
      breadcrumbs="系统管理 / 系统配置"
      actions={
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存配置
        </Button>
      }
      table={
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
          >
            {/* 基本配置 */}
            <SectionTitle icon={<SettingOutlined />} title="基本配置" desc="系统基础信息设置" />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="system_name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
                  <Input placeholder="请输入系统名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="system_version" label="系统版本" rules={[{ required: true, message: '请输入系统版本' }]}>
                  <Input placeholder="请输入系统版本" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="company_name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
                  <Input placeholder="请输入公司名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="contact_phone" label="联系电话">
                  <Input placeholder="请输入联系电话" />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

            {/* 生产配置 */}
            <SectionTitle icon={<ToolOutlined />} title="生产配置" desc="生产相关默认参数" />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="default_line" label="默认产线">
                  <Input placeholder="请输入默认产线编号或名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="standard_hours" label="标准工时" rules={[{ required: true, message: '请输入标准工时' }]}>
                  <InputNumber min={1} max={24} addonAfter="h" style={{ width: '100%' }} placeholder="请输入标准工时" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="shift_setting" label="班次设置" rules={[{ required: true, message: '请选择班次' }]}>
                  <Select mode="multiple" placeholder="请选择班次" options={shiftOptions} />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

            {/* 质量配置 */}
            <SectionTitle icon={<SafetyOutlined />} title="质量配置" desc="质量检验默认参数" />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="default_standard" label="默认检验标准">
                  <Input placeholder="请输入默认检验标准编号或名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="defect_warning_threshold" label="不良率预警阈值" rules={[{ required: true, message: '请输入预警阈值' }]}>
                  <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} placeholder="请输入预警阈值" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="microbe_cycle" label="微生物检测周期" rules={[{ required: true, message: '请输入检测周期' }]}>
                  <InputNumber min={1} max={90} addonAfter="天" style={{ width: '100%' }} placeholder="请输入检测周期" />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

            {/* 报警配置 */}
            <SectionTitle icon={<BellOutlined />} title="报警配置" desc="系统报警开关设置" />
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="device_alarm" label="设备故障报警" valuePropName="checked">
                  <Switch checkedChildren="开" unCheckedChildren="关" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="quality_alarm" label="质量异常报警" valuePropName="checked">
                  <Switch checkedChildren="开" unCheckedChildren="关" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="stock_warning" label="库存预警" valuePropName="checked">
                  <Switch checkedChildren="开" unCheckedChildren="关" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Spin>
      }
    />
  )
}
