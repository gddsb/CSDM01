import SimpleCrudPage from './SimpleCrudPage'
import { Tag } from 'antd'

export default function BusinessObjectPage() {
  return (
    <SimpleCrudPage
      title="业务对象字典"
      apiPath="/iam/business-objects"
      rowKey="obj_id"
      columns={[
        { title: 'ID', dataIndex: 'obj_id', width: 60 },
        { title: '对象编码', dataIndex: 'obj_code', width: 200 },
        { title: '对象名称', dataIndex: 'obj_name', width: 180 },
        { title: '模块', dataIndex: 'module', width: 120, render: (v: string) => v || '-' },
        { title: '数据权限', dataIndex: 'has_data_scope', width: 90, render: (v: number) => v ? <Tag color="blue">启用</Tag> : <Tag>关闭</Tag> },
        { title: '状态校验', dataIndex: 'has_biz_status', width: 90, render: (v: number) => v ? <Tag color="green">启用</Tag> : <Tag>关闭</Tag> },
        { title: '说明', dataIndex: 'description', ellipsis: true },
        { title: '排序', dataIndex: 'sort_order', width: 80 },
        { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => v ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag> },
      ]}
      searchFields={[
        { name: 'module', label: '模块', type: 'select', options: [
          { label: '生产', value: 'production' }, { label: '质量', value: 'quality' },
          { label: '设备', value: 'device' }, { label: '基础', value: 'basic' }, { label: '系统', value: 'system' },
        ]},
        { name: 'status', label: '状态', type: 'select', options: [
          { label: '启用', value: 1 }, { label: '禁用', value: 0 },
        ]},
      ]}
      fields={[
        { name: 'obj_code', label: '对象编码 (businessObj)', required: true, disabledInEdit: true, placeholder: '如 production_order' },
        { name: 'obj_name', label: '对象名称', required: true, placeholder: '如 生产订单' },
        { name: 'module', label: '所属模块', type: 'select', options: [
          { label: 'production', value: 'production' }, { label: 'quality', value: 'quality' },
          { label: 'device', value: 'device' }, { label: 'basic', value: 'basic' }, { label: 'system', value: 'system' },
        ]},
        { name: 'description', label: '说明', type: 'textarea' },
        { name: 'has_data_scope', label: '启用数据权限', type: 'switch' },
        { name: 'has_biz_status', label: '启用业务状态校验', type: 'switch' },
        { name: 'default_status_value', label: '新建默认状态值', placeholder: '如 开立' },
        { name: 'sort_order', label: '排序', type: 'number' },
        { name: 'status', label: '状态', type: 'switch' },
      ]}
    />
  )
}
