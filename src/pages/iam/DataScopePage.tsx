import { useState, useEffect } from 'react'
import { Button, Table, Tag, Space, Modal, Form, Select, InputNumber, Input, message, Popconfirm, Descriptions, Tooltip } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const SCOPE_TYPES = [
  { label: '全部数据 (all)', value: 'all' },
  { label: '仅本人 (self)', value: 'self' },
  { label: '本部门 (dept)', value: 'dept' },
  { label: '本车间 (workshop)', value: 'workshop' },
  { label: '自定义维度过滤 (custom)', value: 'custom' },
]

const OPERATORS = ['IN', 'NOT_IN', 'EQ', 'NEQ', 'LIKE', 'GT', 'LT', 'BETWEEN']

export default function DataScopePage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filter, setFilter] = useState<any>({})

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const [objects, setObjects] = useState<any[]>([])
  const [dims, setDims] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/iam/data-scopes', { params: { page, pageSize, ...filter } })
      setList(res.data?.rows ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) { message.error(e?.message); } finally { setLoading(false) }
  }

  const loadRefs = async () => {
    const [o, d, r, u] = await Promise.all([
      api.get('/iam/business-objects', { params: { pageSize: 500 } }),
      api.get('/iam/data-dimensions', { params: { pageSize: 500 } }),
      api.get('/system/roles'),
      api.get('/system/users'),
    ])
    setObjects(o.data?.rows ?? [])
    setDims(d.data?.rows ?? [])
    setRoles(r.data?.rows ?? [])
    setUsers(u.data?.rows ?? [])
  }

  useEffect(() => { load(); loadRefs() }, [page, pageSize, filter])

  const handleAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ scope_type: 'all', operator: 'IN', status: 1 }); setModalOpen(true) }
  const handleEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({ ...row, dim_value: row.dim_value ? JSON.parse(row.dim_value).join(',') : '' })
    setModalOpen(true)
  }
  const handleDelete = async (row: any) => {
    try { await api.delete(`/iam/data-scopes/${row.scope_id}`); message.success('删除成功'); load() }
    catch (e: any) { message.error(e?.message) }
  }
  const handleSave = async () => {
    const v = await form.validateFields()
    const data: any = { ...v }
    // 用户级还是角色级
    if (v.grant_type === 'user') { data.user_id = v.target; data.role_id = null }
    else { data.role_id = v.target; data.user_id = null }
    if (v.scope_type === 'custom') {
      data.dim_code = v.dim_code
      data.operator = v.operator
      const values = String(v.dim_value ?? '').split(',').map(s => s.trim()).filter(Boolean)
      data.dim_value = JSON.stringify(values)
    } else {
      data.dim_code = null; data.operator = null; data.dim_value = null
    }
    delete data.grant_type; delete data.target
    try {
      if (editing) { await api.put(`/iam/data-scopes/${editing.scope_id}`, data); message.success('修改成功') }
      else { await api.post('/iam/data-scopes', data); message.success('创建成功') }
      setModalOpen(false); load()
    } catch (e: any) { message.error(e?.message) }
  }

  const objName = (code: string) => objects.find(o => o.obj_code === code)?.obj_name ?? code
  const dimName = (code: string) => dims.find(d => d.dim_code === code)?.dim_name ?? code
  const roleName = (id: number) => roles.find(r => r.role_id === id)?.role_name ?? '-'
  const userName = (id: number) => users.find(u => u.user_id === id)?.username ?? '-'

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>数据权限规则</h2>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增规则</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        <Tooltip title="角色级 scope 可被同业务对象的用户级 scope 覆盖；scope_type=custom 时按数据维度字典里的 target_column 拼 WHERE"><InfoCircleOutlined /></Tooltip>
      </Space>

      <Table
        rowKey="scope_id"
        columns={[
          { title: 'ID', dataIndex: 'scope_id', width: 60 },
          { title: '归属', width: 140, render: (_, r) => r.user_id ? <Tag color="purple">用户: {userName(r.user_id)}</Tag> : <Tag color="blue">角色: {roleName(r.role_id)}</Tag> },
          { title: '业务对象', dataIndex: 'obj_code', width: 180, render: (v) => objName(v) },
          { title: '范围类型', dataIndex: 'scope_type', width: 110, render: (v) => <Tag color={{ all:'green',self:'blue',dept:'orange',workshop:'cyan',custom:'purple'}[v]}>{SCOPE_TYPES.find(x=>x.value===v)?.label ?? v}</Tag> },
          { title: '维度 / 操作符', width: 160, render: (_, r) => r.dim_code ? `${dimName(r.dim_code)} [${r.operator}]` : <Tag>-</Tag> },
          { title: '过滤值', dataIndex: 'dim_value', ellipsis: true, render: (v) => v ? JSON.parse(v).join(', ') : '-' },
          { title: '绑定 perm_code', dataIndex: 'perm_code', width: 150, render: (v) => v || '-' },
          { title: '排序', dataIndex: 'sort_order', width: 70 },
          { title: '状态', dataIndex: 'status', width: 70, render: (v) => v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
          {
            title: '操作', key: 'a', fixed: 'right', width: 150,
            render: (_, r) => (
              <Space size="small">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
                <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={list} loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps) } }}
        scroll={{ x: 'max-content' }}
      />

      <Modal title={editing ? '编辑规则' : '新增规则'} open={modalOpen} width={680}
        onCancel={() => setModalOpen(false)} onOk={handleSave} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="grant_type" label="归属类型" rules={[{ required: true }]} initialValue={editing?.user_id ? 'user' : 'role'}>
            <Select options={[{label:'角色级',value:'role'},{label:'用户级 (覆盖角色)',value:'user'}]} disabled={!!editing} />
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.grant_type !== cur.grant_type}>
            {({ getFieldValue }) => (
              <Form.Item name="target" label="目标" rules={[{ required: true }]}>
                {getFieldValue('grant_type') === 'user'
                  ? <Select options={users.map(u=>({label:u.username,value:u.user_id}))} placeholder="选用户" showSearch />
                  : <Select options={roles.map(r=>({label:r.role_name,value:r.role_id}))} placeholder="选角色" showSearch />}
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="obj_code" label="业务对象" rules={[{ required: true }]}>
            <Select options={objects.map(o=>({label:`${o.obj_name} (${o.obj_code})`,value:o.obj_code}))} placeholder="选业务对象" showSearch />
          </Form.Item>
          <Form.Item name="scope_type" label="范围类型" rules={[{ required: true }]}>
            <Select options={SCOPE_TYPES} />
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.scope_type !== cur.scope_type}>
            {({ getFieldValue }) => getFieldValue('scope_type') === 'custom' ? (
              <>
                <Form.Item name="dim_code" label="数据维度" rules={[{ required: true }]}>
                  <Select options={dims.map(d=>({label:`${d.dim_name} → ${d.target_column}`,value:d.dim_code}))} placeholder="选维度字典" showSearch />
                </Form.Item>
                <Form.Item name="operator" label="操作符" rules={[{ required: true }]}>
                  <Select options={OPERATORS.map(o=>({label:o,value:o}))} />
                </Form.Item>
                <Form.Item name="dim_value" label="过滤值 (多值用逗号分隔)" rules={[{ required: true }]}>
                  <Input placeholder='如 车间A,车间B  或  1,2,3' />
                </Form.Item>
              </>
            ) : null}
          </Form.Item>
          <Form.Item name="perm_code" label="绑定权限码 (可选, 精确到某个按钮/接口时才填)">
            <Input placeholder="如 device:fault:view" />
          </Form.Item>
          <Form.Item name="description" label="说明"><Input /></Form.Item>
          <Form.Item name="sort_order" label="排序"><InputNumber style={{ width: 120 }} /></Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[{label:'启用',value:1},{label:'禁用',value:0}]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
