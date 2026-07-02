import React, { useState } from 'react'
import { Form, Input, InputNumber, Select, Switch, Button, Row, Col, Typography, message } from 'antd'
import { SaveOutlined, SettingOutlined, ToolOutlined, SafetyOutlined, BellOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { productionLines, inspectionStandards } from '../../mock/data'

const { Title, Text } = Typography

const lineOptions = productionLines.map(l => ({ label: l.line_name, value: l.line_id }))
const standardOptions = inspectionStandards.map(s => ({ label: s.standard_name, value: s.standard_id }))
const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

export default function SystemConfig() {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      // 模拟保存
      setTimeout(() => {
        setSaving(false)
        message.success('系统配置保存成功')
        console.log('配置内容：', values)
      }, 500)
    } catch (e) {
      message.warning('请完善必填配置项后再保存')
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
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          initialValues={{
            system_name: '奶粉罐MES',
            system_version: 'v1.0.0',
            company_name: '恒丰包装科技有限公司',
            contact_phone: '0571-88888888',
            default_line: 'l1',
            standard_hours: 8,
            shift_setting: ['白班', '夜班'],
            default_standard: 's1',
            defect_warning_threshold: 3,
            microbe_cycle: 7,
            device_alarm: true,
            quality_alarm: true,
            stock_warning: true,
          }}
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
              <Form.Item name="default_line" label="默认产线" rules={[{ required: true, message: '请选择默认产线' }]}>
                <Select placeholder="请选择默认产线" options={lineOptions} />
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
              <Form.Item name="default_standard" label="默认检验标准" rules={[{ required: true, message: '请选择默认检验标准' }]}>
                <Select placeholder="请选择默认检验标准" options={standardOptions} />
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
      }
    />
  )
}
