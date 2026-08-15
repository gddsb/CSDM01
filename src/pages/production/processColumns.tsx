/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Button, Input, InputNumber, Popconfirm, Select, Table } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

type RecordAny = Record<string, any>

interface CommonHandlers {
  isEditable: boolean
  markDirty?: (id: any) => void
  openImageDrawer?: (title: string, images: any[], context: any) => void
}

interface DefectColumnHandlers extends CommonHandlers {
  options: any[]
  onChange: (recordId: any, field: string, value: any) => void
  onDelete: (record: any) => void
  getUnitOptions: (defectTypeId: any) => any[]
  getFilteredOptions: (recordId: any) => any[]
}

interface MaterialColumnHandlers extends CommonHandlers {
  options: any[]
  onChange: (recordId: any, field: string, value: any) => void
  onDelete: (record: any) => void
  getFilteredOptions: (record: any) => any[]
}

export function buildDefectColumns(handlers: DefectColumnHandlers): ColumnsType<RecordAny> {
  const { isEditable, options, onChange, onDelete, getUnitOptions, getFilteredOptions, openImageDrawer } = handlers
  const SelectAny = Select as any
  return [
    {
      title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 100,
      render: (_, record) => {
        const opts = getFilteredOptions(record.id)
        return isEditable ? (
          <SelectAny
            placeholder="请选择不良编码"
            value={record.defect_type_id || undefined}
            onChange={(val: any) => onChange(record.id, 'defect_type_id', val)}
            options={opts}
            style={{ width: '100%' }}
            showSearch
            popupMatchSelectWidth={false}
            popupPlacement="bottomLeft"
            popupClassName="mes-select-dropdown"
            labelRender={(props: any) => {
              const opt = opts.find((o) => o.value === props.value)
              return opt?.defect_code || props.label
            }}
            filterOption={(input: string, option: any) => {
              const code = (option?.defect_code || '').toLowerCase()
              const name = (option?.defect_name || '').toLowerCase()
              const inputLower = input.toLowerCase()
              return code.includes(inputLower) || name.includes(inputLower)
            }}
            size="small"
          />
        ) : record.defect_code || '-'
      },
    },
    { title: '不良类型', dataIndex: 'defect_type', key: 'defect_type', width: 120, render: (val) => val || '-' },
    { title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 150, render: (val) => val || '-' },
    {
      title: '不良数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? (
        <InputNumber min={1} step={1} precision={0} value={val} onChange={(v) => onChange(record.id, 'quantity', v || 0)} style={{ width: '100%' }} size="small" controls={false} />
      ) : val,
    },
    {
      title: '单位', dataIndex: 'unit', key: 'unit', width: 100,
      render: (_, record) => isEditable ? (
        <Select placeholder="请选择单位" value={record.unit || undefined} onChange={(val) => onChange(record.id, 'unit', val)} options={getUnitOptions(record.defect_type_id)} style={{ width: '100%' }} size="small" disabled={!record.defect_type_id} popupClassName="mes-select-dropdown" />
      ) : record.unit || '-',
    },
    {
      title: '不良图片', dataIndex: 'defect_images', key: 'defect_images', width: 120,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />} onClick={() => openImageDrawer?.('不良图片', val || [], { listType: record.businessListType || 'prodDefect', recordId: record.id, field: 'defect_images', category: 'defect' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => onDelete(record)}><Button type="link" size="small" danger>删除</Button></Popconfirm>
      ) : null,
    },
  ]
}

export function buildMaterialColumns(handlers: MaterialColumnHandlers): ColumnsType<RecordAny> {
  const { isEditable, options, onChange, onDelete, getFilteredOptions, openImageDrawer } = handlers
  const SelectAny = Select as any
  return [
    {
      title: '物料类型', dataIndex: 'material_type', key: 'material_type', width: 100,
      render: (val, record) => isEditable ? (
        <Select placeholder="请选择" value={val || undefined} onChange={(v) => onChange(record.id, 'material_type', v)} options={[{ label: '投入', value: '投入' }, { label: '退回', value: '退回' }]} style={{ width: '100%' }} size="small" popupClassName="mes-select-dropdown" />
      ) : val || '-',
    },
    {
      title: '料号', dataIndex: 'material_code', key: 'material_code', width: 120,
      render: (_, record) => {
        const opts = getFilteredOptions(record)
        return isEditable ? (
          <SelectAny placeholder="请选择料号" value={record.bas_material_id || undefined} onChange={(val: any) => onChange(record.id, 'bas_material_id', val)} options={opts} style={{ width: '100%' }} showSearch popupMatchSelectWidth={false} popupPlacement="bottomLeft" popupClassName="mes-select-dropdown"
            labelRender={(props: any) => { const opt = opts.find((o) => String(o.value) === String(props.value)); return opt?.material_code || props.label }}
            optionRender={(optionInfo: any) => {
              const opt = optionInfo.data
              return <span><span style={{ fontWeight: 600, color: '#212121' }}>{opt.material_code}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{opt.material_name}</span></span>
            }}
            filterOption={(input: string, option: any) => {
              const code = (option?.material_code || '').toLowerCase()
              const name = (option?.material_name || '').toLowerCase()
              const spec = (option?.specification || '').toLowerCase()
              const inputLower = input.toLowerCase()
              return code.includes(inputLower) || name.includes(inputLower) || spec.includes(inputLower)
            }}
            size="small" />
        ) : record.material_code || options.find(m => String(m.value) === String(record.bas_material_id))?.material_code || '-'
      },
    },
    {
      title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 150,
      render: (val, record) => val || options.find(m => String(m.value) === String(record.bas_material_id))?.material_name || '-',
    },
    {
      title: '规格', dataIndex: 'specification', key: 'specification', width: 150,
      render: (val, record) => val || options.find(m => String(m.value) === String(record.bas_material_id))?.specification || '-',
    },
    {
      title: <span><span style={{ color: '#ff4d4f' }}>*</span> 批号</span>, dataIndex: 'material_batch', key: 'material_batch', width: 120,
      render: (val, record) => isEditable ? <Input placeholder="批号" value={val} onChange={(e) => onChange(record.id, 'material_batch', (e as React.ChangeEvent<HTMLInputElement>).target.value)} size="small" status={!val || !String(val).trim() ? 'error' : undefined} /> : val || '-',
    },
    { title: '包号', dataIndex: 'package_no', key: 'package_no', width: 120, render: (val, record) => isEditable ? <Input placeholder="包号" value={val} onChange={(e) => onChange(record.id, 'package_no', (e as React.ChangeEvent<HTMLInputElement>).target.value)} size="small" /> : val || '-' },
    {
      title: <span><span style={{ color: '#ff4d4f' }}>*</span> 数量</span>, dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? <InputNumber min={1} step={1} precision={0} value={val} onChange={(v) => onChange(record.id, 'quantity', v || 0)} style={{ width: '100%' }} size="small" controls={false} status={!val || val <= 0 ? 'error' : undefined} /> : val,
    },
    {
      title: '标签图片', dataIndex: 'label_images', key: 'label_images', width: 120,
      render: (val, record) => <Button type="link" size="small" icon={<PictureOutlined />} onClick={() => openImageDrawer?.('标签图片', val || [], { listType: 'material', recordId: record.id, field: 'label_images', category: 'label' })}>{(val || []).length} 张</Button>,
    },
    {
      title: '操作', key: 'action',
      render: (_, record) => isEditable ? <Popconfirm title="确认删除？" onConfirm={() => onDelete(record)}><Button type="link" size="small" danger>删除</Button></Popconfirm> : null,
    },
  ]
}

// 让 Table 的 columns 类型在 antd 5 中更宽松，避免使用时被 ColumnsType 严格校验阻塞
export type AnyColumns = ColumnsType<RecordAny>
