import React from 'react'
import { Button, Col, Row, Select, Space, Tag } from 'antd'
import { PlusOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ResizableTable from '../../../components/ResizableTable'
import type { DefectRecord, ExceptionRecord, ManpowerRecord, MaterialRecord } from '../types'

interface TabToolbarProps {
  editable: boolean
  onSave: () => void
  onAdd: () => void
  hint: string
  readOnlyHint?: string
}

export function TabToolbar({ editable, onSave, onAdd, hint, readOnlyHint = '已完工，数据只读' }: TabToolbarProps) {
  return (
    <Row style={{ marginBottom: 16 }} align="middle">
      <Col span={12}>
        <Space>
          {editable ? (
            <>
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>保存</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>添加</Button>
            </>
          ) : <span style={{ color: '#666' }}>只读数据</span>}
        </Space>
      </Col>
      <Col span={12} style={{ textAlign: 'right' }}>
        {editable ? <Tag color="blue">{hint}</Tag> : <Tag color="default">{readOnlyHint}</Tag>}
      </Col>
    </Row>
  )
}

interface DefectTabProps {
  selectedProcessId: number | null
  processes: { process_id: number; process_name: string }[]
  onSelectProcess: (id: number) => void
  editable: boolean
  columns: ColumnsType<DefectRecord>
  data: DefectRecord[]
  onSave: () => void
  onAdd: () => void
  stats: { inputQty: number; qualifiedQty: number; processDefectQty: number; materialDefectQty: number }
  scrollX?: number
}

export function ProcessDefectTab({ selectedProcessId, processes, onSelectProcess, editable, columns, data, onSave, onAdd, stats, scrollX = 900 }: DefectTabProps) {
  return (
    <div>
      <Row style={{ marginBottom: 16 }} align="middle">
        <Col span={12}>
          <Space>
            <span>选择工序：</span>
            <Select value={selectedProcessId} onChange={onSelectProcess} options={processes.map(p => ({ label: p.process_name, value: p.process_id }))} style={{ width: 200 }} placeholder="请选择工序" popupClassName="mes-select-dropdown" />
            {editable && (
              <>
                <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>保存</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>添加</Button>
              </>
            )}
          </Space>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          {selectedProcessId && (
            <Space size="large">
              <span style={{ color: '#999', fontSize: 12 }}>当前工序统计：</span>
              <span>投入数量：<b style={{ color: '#1890ff' }}>{stats.inputQty}</b></span>
              <span>合格数：<b style={{ color: '#52c41a' }}>{stats.qualifiedQty}</b></span>
              <span>制程不良：<b style={{ color: '#fa8c16' }}>{stats.processDefectQty}</b></span>
              <span>来料不良：<b style={{ color: '#faad14' }}>{stats.materialDefectQty}</b></span>
            </Space>
          )}
        </Col>
      </Row>
      <ResizableTable tableKey="pages_production_ProcessReporting_defect" columns={columns} dataSource={data} rowKey="id" size="small" pagination={false} scroll={{ x: scrollX }} tableLayout="fixed" />
    </div>
  )
}

interface GenericTabProps<T> {
  editable: boolean
  columns: ColumnsType<T>
  data: T[]
  onSave: () => void
  onAdd: () => void
  title?: string
  hint?: string
  readOnlyHint?: string
  scrollX?: number
  tableKey: string
}

export function GenericRecordTab<T extends { id: string | number }>({
  editable, columns, data, onSave, onAdd, title, hint = '点"添加"前会自动保存未提交记录；录入数据后请点"保存"提交',
  readOnlyHint = '已完工，数据只读', scrollX = 900, tableKey,
}: GenericTabProps<T>) {
  return (
    <div>
      <Row style={{ marginBottom: 16 }} align="middle">
        <Col span={12}>
          <Space>
            <span style={{ color: '#666' }}>{title}</span>
            {editable && (
              <>
                <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>保存</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>添加</Button>
              </>
            )}
          </Space>
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          {editable ? <Tag color="blue">{hint}</Tag> : <Tag color="default">{readOnlyHint}</Tag>}
        </Col>
      </Row>
      <ResizableTable tableKey={tableKey} columns={columns} dataSource={data} rowKey="id" size="small" pagination={false} scroll={{ x: scrollX }} tableLayout="fixed" />
    </div>
  )
}

export type AnyRecord = DefectRecord | MaterialRecord | ExceptionRecord | ManpowerRecord
