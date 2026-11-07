import SimpleCrudPage from './SimpleCrudPage'
import { Tag } from 'antd'

export default function DataDimensionPage() {
  return (
    <SimpleCrudPage
      title="数据维度字典"
      apiPath="/iam/data-dimensions"
      rowKey="dim_id"
      columns={[
        { title: 'ID', dataIndex: 'dim_id', width: 60 },
        { title: '维度编码', dataIndex: 'dim_code', width: 160 },
        { title: '维度名称', dataIndex: 'dim_name', width: 140 },
        { title: '目标表', dataIndex: 'target_table', width: 200, ellipsis: true },
        { title: '目标字段 (SQL列)', dataIndex: 'target_column', width: 150 },
        { title: '类型', dataIndex: 'data_type', width: 90 },
        { title: '说明', dataIndex: 'description', ellipsis: true },
        { title: '排序', dataIndex: 'sort_order', width: 70 },
        { title: '状态', dataIndex: 'status', width: 70, render: (v: number) => v ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag> },
      ]}
      fields={[
        { name: 'dim_code', label: '维度编码', required: true, disabledInEdit: true, placeholder: '如 workshop' },
        { name: 'dim_name', label: '维度名称', required: true, placeholder: '如 车间' },
        { name: 'target_table', label: '目标数据表 (逗号分隔)', required: true, placeholder: 'production_order,device_fault' },
        { name: 'target_column', label: 'SQL WHERE 过滤列名', required: true, placeholder: '如 workshop 或 line_id' },
        { name: 'data_type', label: '字段类型', type: 'select', required: true, options: [
          { label: 'string', value: 'string' }, { label: 'number', value: 'number' },
          { label: 'date', value: 'date' }, { label: 'enum', value: 'enum' },
        ]},
        { name: 'description', label: '说明', type: 'textarea' },
        { name: 'sort_order', label: '排序', type: 'number' },
        { name: 'status', label: '状态', type: 'switch' },
      ]}
    />
  )
}
