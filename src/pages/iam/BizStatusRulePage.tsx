import { useState, useEffect } from 'react'
import { Button, Table, Tag, Space, Modal, Form, Select, InputNumber, Input, message, Popconfirm, Descriptions } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function BizStatusRulePage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterObj, setFilterObj] = useState<string | undefined>()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const [objects, setObjects] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/iam/biz-status-rules', { params: { page, pageSize, obj_code: filterObj } })
      setList(res.data?.rows ?? [])
    } catch (e: any) { message.error(e?.message) } finally { setLoading(false) }
  }
  const loadObjs = async () => {
    const res = await api.get('/iam/business-objects', { params: { pageSize: 500 } })
    setObjects(res.data?.rows ?? [])
  }
  useEffect(() => { load(); loadObjs() }, [page, pageSize, filterObj])

  const handleAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 1 }); setModalOpen(true) }
  const handleEdit = (row: any) => {
    setEditing(row)
    form.setFieldsValue({ ...row, allowed_states: JSON.parse(row.allowed_states).join(',') })
    setModalOpen(true)
  }
  const handleDelete = async (row: any) => {
    try { await api.delete(`/iam/biz-status-rules/${row.rule_id}`); message.success('删除成功'); load() }
    catch (e: any) { message.error(e?.message) }
  }
  const handleSave = async () => {
    const v = await form.validateFields()
    const data: any = { ...v }
    data.allowed_states = JSON.stringify(
      String(v.allowed_states).split(',').map(s => {
        const t = s.trim(); const n = Number(t); return Number.isFinite(n) && String(n) === t ? n : t
      }).filter(Boolean)
    )
    try {
      if (editing) { await api.put(`/iam/biz-status-rules/${editing.rule_id}`, data); message.success('修改成功') }
      else { await api.post('/iam/biz-status-rules', data); message.success('创建成功') }
      setModalOpen(false); load()
    } catch (e: any) { message.error(e?.message) }
  }

  const objName = (code: string) => objects.find(o => o.obj_code === code)?.obj_name ?? code

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>业务状态规则</h2>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增规则</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        <Space>
          <span>业务对象:</span>
          <Select allowClear style={{ width: 180 }} placeholder="全部"
            value={filterObj} onChange={(v) => { setFilterObj(v); setPage(1) }}>
            {objects.map(o => <Select.Option key={o.obj_code} value={o.obj_code}>{o.obj_name}</Select.Option>)}
          </Select>
        </Space>
      </Space>

      <Table
        rowKey="rule_id"
        columns={[
          { title: 'ID', dataIndex: 'rule_id', width: 60 },
          { title: '业务对象', dataIndex: 'obj_code', width: 180, render: (v) => objName(v) },
          { title: '操作', width: 200, render: (_, r) => <Space><Tag color="blue">{r.operate_key}</Tag>{r.operate_name}</Space> },
          { title: '允许状态', dataIndex: 'allowed_states', render: (v) => {
            const arr = JSON.parse(v || '[]')
            return arr.map((s: any, i: number) => <Tag key={i}>{s}</Tag>)
          }},
          { title: '目标状态', dataIndex: 'next_state', width: 100, render: (v) => v ? <Tag color="green">→ {v}</Tag> : '-' },
          { title: '绑定 perm_code', dataIndex: 'perm_code', width: 160, render: (v) => v || '-' },
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
        pagination={{ current: page, pageSize, total: undefined, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps) } }}
        scroll={{ x: 'max-content' }}
      />

      <Modal title={editing ? '编辑规则' : '新增规则'} open={modalOpen} width={680}
        onCancel={() => setModalOpen(false)} onOk={handleSave} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="obj_code" label="业务对象" rules={[{ required: true }]}>
            <Select options={objects.map(o=>({label:`${o.obj_name} (${o.obj_code})`,value:o.obj_code}))} showSearch placeholder="选业务对象" />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="operate_key" label="操作键" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="如 start / finish / close / submit_repair" />
            </Form.Item>
            <Form.Item name="operate_name" label="操作名称" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="如 开工 / 完工 / 关闭" />
            </Form.Item>
          </Space>
          <Form.Item name="allowed_states" label="允许的单据状态值 (逗号分隔, 数字或字符串均可)" rules={[{ required: true }]}>
            <Input placeholder='如 开立,下发  或  0,1' />
          </Form.Item>
          <Form.Item name="next_state" label="操作后目标状态 (可选)"><Input placeholder="如 开工" /></Form.Item>
          <Form.Item name="perm_code" label="绑定权限码 (可选, 只有在用户具备该 perm_code 时才做这条校验)">
            <Input placeholder="如 production:order:start" />
          </Form.Item>
          <Form.Item name="error_message" label="校验失败提示 (可选, NULL 用默认文案)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序"><InputNumber style={{ width: 120 }} /></Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select options={[{label:'启用',value:1},{label:'禁用',value:0}]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
