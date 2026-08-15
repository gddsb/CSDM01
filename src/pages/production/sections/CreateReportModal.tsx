import React from 'react'
import { Form, InputNumber, Modal, Select } from 'antd'

interface OrderOption {
  label: string
  value: string | number
  order_no?: string
  planned_qty?: number
  finished_qty?: number
}

interface LineOption {
  label: string
  value: string | number
}

interface CreateReportModalProps {
  open: boolean
  loading: boolean
  form: any
  orderOptions: OrderOption[]
  lineOptions: LineOption[]
  selectedOrder: OrderOption | null
  onConfirm: () => void
  onCancel: () => void
  onOrderChange: (option?: OrderOption) => void
}

export default function CreateReportModal({
  open, loading, form, orderOptions, lineOptions, selectedOrder, onConfirm, onCancel, onOrderChange,
}: CreateReportModalProps) {
  return (
    <Modal
      title="新增报工单"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="确定"
      cancelText="取消"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="order_id" label="生产订单" rules={[{ required: true, message: '请选择生产订单' }]}>
          <Select
            placeholder="请选择生产订单（仅下发状态）"
            options={orderOptions}
            showSearch
            optionFilterProp="label"
            popupClassName="mes-select-dropdown"
            onChange={(_value, option) => onOrderChange(option as OrderOption | undefined)}
          />
        </Form.Item>
        <Form.Item name="line_id" label="产线" rules={[{ required: true, message: '请选择产线' }]}>
          <Select
            placeholder="请选择产线（仅运行中）"
            options={lineOptions}
            showSearch
            optionFilterProp="label"
            popupClassName="mes-select-dropdown"
          />
        </Form.Item>
        <Form.Item
          name="report_qty"
          label={
            <span>
              报工数量
              {selectedOrder && (
                <span style={{ color: '#8c8c8c', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                  （计划{selectedOrder.planned_qty} - 已完工{selectedOrder.finished_qty} = 剩余
                  {Number(selectedOrder.planned_qty || 0) - Number(selectedOrder.finished_qty || 0)}）
                </span>
              )}
            </span>
          }
          rules={[{ required: true, message: '请填写报工数量' }]}
        >
          <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="report_time" label="报工时间" rules={[{ required: true, message: '请选择报工时间' }]}>
          <InputNumber readOnly style={{ width: '100%' }} placeholder="自动填充为当前时间" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
