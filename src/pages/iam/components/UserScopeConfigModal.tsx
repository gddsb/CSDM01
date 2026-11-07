/**
 * 用户独立数据权限配置 Modal
 * 用于 UserManagement 每行 "数据权限" 按钮
 *
 * 语义：
 *   - 先加载 role_id=该用户角色 对应的数据权限规则（角色级）— 展示为只读参考
 *   - 再加载 user_id=该用户 的独立规则 — 可编辑，用于覆盖角色级同 businessObj 的规则
 *   - 用户级 scope_type_override 也支持 all / inherit / custom
 */
import { useState, useEffect } from 'react'
import { Modal, Space, Button, Tag, Table, Select, InputNumber, Input, message, Empty, Row, Col, Divider, Switch, Tooltip, Form, Popconfirm, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import api from '../../../utils/api'

const SCOPE_TYPES = [
  { label: '全部数据 (all)', value: 'all' },
  { label: '继承角色 (inherit)', value: 'inherit' },
  { label: '仅本人 (self)', value: 'self' },
  { label: '本车间 (workshop)', value: 'workshop' },
  { label: '自定义维度 (custom)', value: 'custom' },
]

const OPERATORS = ['IN', 'NOT_IN', 'EQ', 'NEQ', 'LIKE', 'GT', 'LT']

interface UserScopeConfigModalProps {
  open: boolean
  onClose: () => void
  userId: number | null
  userName: string
  roleId: number | null
  roleName: string
}

export default function UserScopeConfigModal({ open, onClose, userId, userName, roleId, roleName }: UserScopeConfigModalProps) {
  const [roleScopes, setRoleScopes] = useState<any[]>([])
  const [userScopes, setUserScopes] = useState<any[]>([])
  const [objects, setObjects] = useState<any[]>([])
  const [dims, setDims] = useState<any[]>([])

  const [overrideGlobal, setOverrideGlobal] = useState<string>('inherit')

  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    if (!userId) return
    try {
      const [rsRes, usRes, objRes, dimRes] = await Promise.all([
        roleId ? api.get('/iam/data-scopes', { params: { role_id: roleId } }) : Promise.resolve({ data: { rows: [] } }),
        api.get('/iam/data-scopes', { params: { user_id: userId } }),
        api.get('/iam/business-objects', { params: { pageSize: 500 } }),
        api.get('/iam/data-dimensions', { params: { pageSize: 500 } }),
      ])
      setRoleScopes(rsRes.data?.rows ?? [])
      setUserScopes(usRes.data?.rows ?? [])
      setObjects(objRes.data?.rows ?? [])
      setDims(dimRes.data?.rows ?? [])
    } catch (e: any) { message.error(e?.message) }
  }

  useEffect(() => { if (open) load() }, [open, userId, roleId])

  const handleAdd = () => {
    if (!userId) return
    setEditing(null); form.resetFields(); setModalOpen(true)
  }
  const handleEdit = (row: any) => { setEditing(row); form.setFieldsValue({ ...row, dim_value: row.dim_value ? JSON.parse(row.dim_value).join(',') : '' }); setModalOpen(true) }
  const handleDelete = async (row: any) => {
    try { await api.delete(`/iam/data-scopes/${row.scope_id}`); message.success('删除成功'); load() }
    catch (e: any) { message.error(e?.message) }
  }
  const handleSave = async () => {
    const v = await form.validateFields()
    const data: any = { ...v, user_id: userId, role_id: null, grant_type: 'user' }
    if (v.scope_type === 'custom') {
      data.dim_value = JSON.stringify(String(v.dim_value ?? '').split(',').map(s => s.trim()).filter(Boolean))
    } else { data.dim_code = null; data.operator = null; data.dim_value = null }
    try {
      if (editing) { await api.put(`/iam/data-scopes/${editing.scope_id}`, data); message.success('修改成功') }
      else { await api.post('/iam/data-scopes', data); message.success('创建成功') }
      setModalOpen(false); load()
    } catch (e: any) { message.error(e?.message) }
  }

  const objName = (c: string) => objects.find(o => o.obj_code === c)?.obj_name ?? c
  const dimName = (c: string) => dims.find(d => d.dim_code === c)?.dim_name ?? c

  // Modal for editing one rule
  const [innerOpen, setModalOpen] = useState(false)

  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} okText="关闭" cancelButtonProps={{ style: { display: 'none' } }}
      width={1000} title={`用户独立数据权限配置 — ${userName} (角色: ${roleName || '未分配'})`} destroyOnClose>

      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="用户级规则会覆盖同业务对象的角色级规则；scope_type=inherit 表示该业务对象沿用角色级配置。" />

      {/* 角色级规则（只读参考） */}
      <Divider orientation="left">角色级规则（参考，来自 {roleName || '—'}）</Divider>
      <Table size="small" rowKey="scope_id" pagination={false}
        columns={[
          { title: '业务对象', dataIndex: 'obj_code', render: (v) => <Tag color="blue">{objName(v)}</Tag> },
          { title: 'scope_type', dataIndex: 'scope_type', width: 100 },
          { title: '维度/操作符', width: 150, render: (_, r) => r.dim_code ? `${dimName(r.dim_code)} [${r.operator}]` : '-' },
          { title: '过滤值', dataIndex: 'dim_value', render: (v) => v ? JSON.parse(v).join(', ') : '-' },
        ]}
        dataSource={roleScopes}
        locale={{ emptyText: roleId ? '角色未配置任何数据权限规则 → 所有业务对象默认全量可见' : '该用户未分配角色' }}
      />

      {/* 用户级独立规则（可编辑） */}
      <Divider orientation="left">用户级独立规则（覆盖角色级）</Divider>
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!userId}>新增独立规则</Button>
      </Space>
      <Table size="small" rowKey="scope_id" pagination={false}
        columns={[
          { title: '业务对象', dataIndex: 'obj_code', render: (v) => <Tag color="purple">{objName(v)}</Tag> },
          { title: 'scope_type', dataIndex: 'scope_type', width: 100, render: (v) => <Tag color={{ all:'green',inherit:'default',self:'blue',workshop:'cyan',custom:'purple'}[v]}>{v}</Tag> },
          { title: '维度/操作符', width: 150, render: (_, r) => r.dim_code ? `${dimName(r.dim_code)} [${r.operator}]` : '-' },
          { title: '过滤值', dataIndex: 'dim_value', render: (v) => v ? JSON.parse(v).join(', ') : '-' },
          { title: '操作', width: 120, render: (_, r) => (
            <Space size="small">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )},
        ]}
        dataSource={userScopes}
        locale={{ emptyText: '该用户未配置任何独立数据权限规则' }}
      />

      {/* 编辑子 Modal */}
      <Modal title={editing ? '编辑用户级规则' : '新增用户级规则'}
        open={innerOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} width={600} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="obj_code" label="业务对象" rules={[{ required: true }]}>
            <Select options={objects.map(o => ({ label: `${o.obj_name} (${o.obj_code})`, value: o.obj_code }))} showSearch placeholder="选业务对象" />
          </Form.Item>
          <Form.Item name="scope_type" label="范围类型" rules={[{ required: true }]} initialValue="self">
            <Select options={SCOPE_TYPES.filter(s => s.value !== 'inherit')} />
          </Form.Item>
          <Form.Item shouldUpdate={(p, c) => p.scope_type !== c.scope_type}>
            {({ getFieldValue }) => getFieldValue('scope_type') === 'custom' ? (
              <>
                <Form.Item name="dim_code" label="数据维度" rules={[{ required: true }]}>
                  <Select options={dims.map(d => ({ label: `${d.dim_name} → ${d.target_column}`, value: d.dim_code }))} showSearch />
                </Form.Item>
                <Form.Item name="operator" label="操作符" rules={[{ required: true }]} initialValue="IN">
                  <Select options={OPERATORS.map(o => ({ label: o, value: o }))} />
                </Form.Item>
                <Form.Item name="dim_value" label="过滤值 (多值逗号分隔)" rules={[{ required: true }]}>
                  <Input placeholder="如 车间A,车间B" />
                </Form.Item>
              </>
            ) : null}
          </Form.Item>
          <Form.Item name="perm_code" label="绑定权限码 (可选, 留空=对该业务对象所有接口生效)">
            <Input placeholder="如 production:order:view" />
          </Form.Item>
          <Form.Item name="description" label="说明"><Input /></Form.Item>
        </Form>
      </Modal>
    </Modal>
  )
}
