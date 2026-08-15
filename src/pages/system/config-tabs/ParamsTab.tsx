import React from 'react'
import { Form, Input, InputNumber, Select, Switch, Button, Row, Col, Spin, Typography } from 'antd'
import { SaveOutlined, SettingOutlined, ToolOutlined, SafetyOutlined, BellOutlined } from '@ant-design/icons'
import { shiftOptions } from './configTransform'

const { Title, Text } = Typography

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; desc?: string }> = ({ icon, title, desc }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span style={{ color: '#1677ff' }}>{icon}</span>
    <span style={{ fontWeight: 600 }}>{title}</span>
    {desc && <span style={{ color: '#999', fontSize: 12 }}>{desc}</span>}
  </div>
)

interface ParamsTabProps {
  form: any
  loading: boolean
  saving: boolean
  lineOptions: { label: string; value: string | number }[]
  handleSave: () => void
}

export default function ParamsTab({ form, loading, saving, lineOptions, handleSave }: ParamsTabProps) {
  return (
    <Spin spinning={loading}>
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
      >
        <SectionTitle icon={<SettingOutlined />} title="基本配置" desc="系统基础信息设置" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="system_name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
              <Input placeholder="请输入系统名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="system_version" label="系统版本" rules={[{ required: true, message: '请输入系统版本' }]}>
              <Input placeholder="系统版本（只读）" disabled readOnly />
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

        <SectionTitle icon={<ToolOutlined />} title="生产配置" desc="生产相关默认参数" />
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="default_line" label="默认产线">
              <Select
                placeholder="请选择默认产线"
                options={lineOptions}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="standard_hours" label="标准工时" rules={[{ required: true, message: '请输入标准工时' }]}>
              <InputNumber min={1} max={24} addonAfter="h" style={{ width: '100%' }} placeholder="请输入标准工时" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="shift_setting" label="班次设置" rules={[{ required: true, message: '请选择班次' }]}>
              <Select mode="multiple" placeholder="请选择班次（默认白班）" options={shiftOptions} />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0 20px' }} />

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

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存配置
          </Button>
        </div>
      </Form>
    </Spin>
  
  )
}
