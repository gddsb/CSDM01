import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Switch, message, Drawer, Space, Popconfirm, InputNumber } from 'antd'
import {
  DatabaseOutlined, BookOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, ReloadOutlined, OrderedListOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const statusColorMap = { 0: 'default', 1: 'success' }

export default function DataDictionary() {
  const [typeList, setTypeList] = useState([])
  const [typeLoading, setTypeLoading] = useState(false)
  const [typeTotal, setTypeTotal] = useState(0)
  const [dataList, setDataList] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataTotal, setDataTotal] = useState(0)
  const [activeType, setActiveType] = useState(null)

  const [typeModalVisible, setTypeModalVisible] = useState(false)
  const [dataModalVisible, setDataModalVisible] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [editingData, setEditingData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [typeForm] = Form.useForm()
  const [dataForm] = Form.useForm()

  const [typeKeywordInput, setTypeKeywordInput] = useState('')
  const [typeStatusInput, setTypeStatusInput] = useState(undefined)
  const [typeQuery, setTypeQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined })

  const [dataKeywordInput, setDataKeywordInput] = useState('')
  const [dataStatusInput, setDataStatusInput] = useState(undefined)
  const [dataQuery, setDataQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined })

  const fetchTypes = useCallback(async () => {
    setTypeLoading(true)
    try {
      const params = { page: typeQuery.page, pageSize: typeQuery.pageSize }
      if (typeQuery.keyword) params.keyword = typeQuery.keyword
      if (typeQuery.status !== undefined && typeQuery.status !== null) params.status = typeQuery.status
      const res = await api.get('/system/dict/types', { params })
      setTypeList(res.data || [])
      setTypeTotal(res.total || 0)
      if (!activeType && res.data && res.data.length > 0) {
        setActiveType(res.data[0])
      }
    } catch (err) {
      message.error(err.message || '获取字典类型失败')
      setTypeList([])
      setTypeTotal(0)
    } finally {
      setTypeLoading(false)
    }
  }, [typeQuery, activeType])

  const fetchDatas = useCallback(async () => {
    if (!activeType) {
      setDataList([])
      setDataTotal(0)
      return
    }
    setDataLoading(true)
    try {
      const params = {
        page: dataQuery.page,
        pageSize: dataQuery.pageSize,
        dictType: activeType.dict_type,
      }
      if (dataQuery.keyword) params.keyword = dataQuery.keyword
      if (dataQuery.status !== undefined && dataQuery.status !== null) params.status = dataQuery.status
      const res = await api.get('/system/dict/datas', { params })
      setDataList(res.data || [])
      setDataTotal(res.total || 0)
    } catch (err) {
      message.error(err.message || '获取字典数据失败')
      setDataList([])
      setDataTotal(0)
    } finally {
      setDataLoading(false)
    }
  }, [activeType, dataQuery])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  useEffect(() => {
    fetchDatas()
  }, [fetchDatas])

  const refreshType = () => setTypeQuery(q => ({ ...q }))
  const refreshData = () => setDataQuery(q => ({ ...q }))

  const handleTypeSearch = () => {
    setTypeQuery(q => ({ ...q, page: 1, keyword: typeKeywordInput, status: typeStatusInput }))
  }

  const handleTypeReset = () => {
    setTypeKeywordInput('')
    setTypeStatusInput(undefined)
    setTypeQuery(q => ({ ...q, page: 1, keyword: '', status: undefined }))
  }

  const handleDataSearch = () => {
    setDataQuery(q => ({ ...q, page: 1, keyword: dataKeywordInput, status: dataStatusInput }))
  }

  const handleDataReset = () => {
    setDataKeywordInput('')
    setDataStatusInput(undefined)
    setDataQuery(q => ({ ...q, page: 1, keyword: '', status: undefined }))
  }

  const handleAddType = () => {
    setEditingType(null)
    setTypeModalVisible(true)
  }

  const handleEditType = (record) => {
    setEditingType(record)
    setTypeModalVisible(true)
  }

  const handleTypeSubmit = async () => {
    try {
      const values = await typeForm.validateFields()
      setSubmitting(true)
      if (editingType) {
        await api.put(`/system/dict/types/${editingType.dict_id}`, values)
        message.success('字典类型已更新')
      } else {
        await api.post('/system/dict/types', values)
        message.success('字典类型已创建')
      }
      setTypeModalVisible(false)
      refreshType()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteType = async (record) => {
    try {
      await api.delete(`/system/dict/types/${record.dict_id}`)
      message.success('字典类型已删除')
      if (activeType && activeType.dict_id === record.dict_id) {
        setActiveType(null)
      }
      refreshType()
    } catch (e) {
      message.error(e.message || '删除失败')
    }
  }

  const handleSelectType = (record) => {
    setActiveType(record)
    setDataQuery(q => ({ ...q, page: 1 }))
  }

  const handleAddData = () => {
    if (!activeType) {
      message.warning('请先选择字典类型')
      return
    }
    setEditingData(null)
    setDataModalVisible(true)
    dataForm.setFieldsValue({ dict_type: activeType.dict_type, status: 1, is_default: false, dict_sort: 0 })
  }

  const handleEditData = (record) => {
    setEditingData(record)
    setDataModalVisible(true)
  }

  const handleDataSubmit = async () => {
    try {
      const values = await dataForm.validateFields()
      setSubmitting(true)
      if (editingData) {
        await api.put(`/system/dict/datas/${editingData.dict_code}`, values)
        message.success('字典数据已更新')
      } else {
        await api.post('/system/dict/datas', values)
        message.success('字典数据已创建')
      }
      setDataModalVisible(false)
      refreshData()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteData = async (record) => {
    try {
      await api.delete(`/system/dict/datas/${record.dict_code}`)
      message.success('字典数据已删除')
      refreshData()
    } catch (e) {
      message.error(e.message || '删除失败')
    }
  }

  const typeColumns = [
    {
      title: '序号', key: 'index', width: 60,
      render: (_, __, index) => (typeQuery.page - 1) * typeQuery.pageSize + index + 1,
    },
    { title: '字典名称', dataIndex: 'dict_name', key: 'dict_name' },
    { title: '字典类型', dataIndex: 'dict_type', key: 'dict_type' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditType(record)}>编辑</Button>
          <Popconfirm title="确定删除该字典类型?" onConfirm={() => handleDeleteType(record)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const dataColumns = [
    {
      title: '序号', key: 'index', width: 60,
      render: (_, __, index) => (dataQuery.page - 1) * dataQuery.pageSize + index + 1,
    },
    { title: '标签', dataIndex: 'dict_label', key: 'dict_label', width: 140 },
    { title: '键值', dataIndex: 'dict_value', key: 'dict_value', width: 140 },
    {
      title: '样式', dataIndex: 'list_class', key: 'list_class', width: 100,
      render: v => v ? <Tag color={v}>{v}</Tag> : '-',
    },
    {
      title: '默认', dataIndex: 'is_default', key: 'is_default', width: 80,
      render: v => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    { title: '排序', dataIndex: 'dict_sort', key: 'dict_sort', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    {
      title: '操作', key: 'action', width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditData(record)}>编辑</Button>
          <Popconfirm title="确定删除该字典数据?" onConfirm={() => handleDeleteData(record)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const listClassOptions = [
    { label: '默认', value: 'default' },
    { label: '成功(绿)', value: 'success' },
    { label: '警告(橙)', value: 'warning' },
    { label: '错误(红)', value: 'error' },
    { label: '蓝色', value: 'blue' },
    { label: '青色', value: 'cyan' },
    { label: '紫色', value: 'purple' },
    { label: '洋红', value: 'magenta' },
    { label: '粉色', value: 'pink' },
    { label: '红色', value: 'red' },
    { label: '橙色', value: 'orange' },
    { label: '金色', value: 'gold' },
    { label: '绿色', value: 'green' },
    { label: '石灰', value: 'lime' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="数据字典"
        breadcrumbs="系统管理 / 数据字典"
        stats={[
          { label: '字典类型', value: typeTotal, icon: <BookOutlined />, color: '#2196F3' },
          { label: '字典条目', value: dataTotal, icon: <OrderedListOutlined />, color: '#00BCD4' },
        ]}
        table={
          <div style={{ display: 'flex', gap: 16, height: '100%' }}>
            <div style={{ width: 360, flexShrink: 0, background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>字典类型</span>
                <Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refreshType} />
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddType}>新增</Button>
                </Space>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input
                  size="small"
                  placeholder="搜索字典名称/类型"
                  value={typeKeywordInput}
                  onChange={e => setTypeKeywordInput(e.target.value)}
                  onBlur={handleTypeSearch}
                  style={{ flex: 1 }}
                />
                <Select
                  size="small"
                  placeholder="状态"
                  value={typeStatusInput}
                  onChange={v => { setTypeStatusInput(v); setTimeout(handleTypeSearch, 0) }}
                  allowClear
                  style={{ width: 90 }}
                  options={[
                    { label: '启用', value: 1 },
                    { label: '停用', value: 0 },
                  ]}
                />
              </div>
              <Table
                size="small"
                columns={typeColumns.filter(c => c.key !== 'action')}
                dataSource={typeList}
                rowKey="dict_id"
                loading={typeLoading}
                pagination={{
                  pageSize: typeQuery.pageSize,
                  current: typeQuery.page,
                  total: typeTotal,
                  size: 'small',
                  showSizeChanger: true,
                  showTotal: t => `共 ${t} 条`,
                  onChange: (page, pageSize) => setTypeQuery(q => ({ ...q, page, pageSize })),
                }}
                rowClassName={record => activeType?.dict_id === record.dict_id ? 'dict-type-active' : ''}
                onRow={record => ({
                  onClick: () => handleSelectType(record),
                  style: { cursor: 'pointer' },
                })}
                scroll={{ y: 400 }}
              />
            </div>

            <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  <DatabaseOutlined style={{ marginRight: 6, color: 'var(--color-primary)' }} />
                  字典数据 {activeType ? `- ${activeType.dict_name} (${activeType.dict_type})` : ''}
                </span>
                <Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refreshData} />
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddData}>新增</Button>
                </Space>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Input
                  size="small"
                  placeholder="搜索标签/键值"
                  value={dataKeywordInput}
                  onChange={e => setDataKeywordInput(e.target.value)}
                  onBlur={handleDataSearch}
                  style={{ width: 200 }}
                />
                <Select
                  size="small"
                  placeholder="状态"
                  value={dataStatusInput}
                  onChange={v => { setDataStatusInput(v); setTimeout(handleDataSearch, 0) }}
                  allowClear
                  style={{ width: 90 }}
                  options={[
                    { label: '启用', value: 1 },
                    { label: '停用', value: 0 },
                  ]}
                />
                <Button size="small" onClick={handleDataReset}>重置</Button>
              </div>
              <Table
                size="small"
                columns={dataColumns}
                dataSource={dataList}
                rowKey="dict_code"
                loading={dataLoading}
                pagination={{
                  pageSize: dataQuery.pageSize,
                  current: dataQuery.page,
                  total: dataTotal,
                  size: 'small',
                  showSizeChanger: true,
                  showTotal: t => `共 ${t} 条`,
                  onChange: (page, pageSize) => setDataQuery(q => ({ ...q, page, pageSize })),
                }}
                scroll={{ y: 400 }}
              />
            </div>
          </div>
        }
      />

      <Modal
        title={editingType ? '编辑字典类型' : '新增字典类型'}
        open={typeModalVisible}
        onCancel={() => setTypeModalVisible(false)}
        onOk={handleTypeSubmit}
        confirmLoading={submitting}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (!open) return
          if (editingType) {
            typeForm.setFieldsValue({
              dict_name: editingType.dict_name,
              dict_type: editingType.dict_type,
              status: editingType.status === 1,
              remark: editingType.remark,
            })
          } else {
            typeForm.resetFields()
            typeForm.setFieldsValue({ status: true })
          }
        }}
      >
        <Form form={typeForm} layout="vertical">
          <Form.Item label="字典名称" name="dict_name" rules={[{ required: true, message: '请输入字典名称' }]}>
            <Input placeholder="如：用户状态" />
          </Form.Item>
          <Form.Item label="字典类型" name="dict_type" rules={[{ required: true, message: '请输入字典类型编码' }]}>
            <Input placeholder="如：sys_user_status（英文唯一标识）" />
          </Form.Item>
          <Form.Item label="状态" name="status" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="请输入备注" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingData ? '编辑字典数据' : '新增字典数据'}
        open={dataModalVisible}
        onCancel={() => setDataModalVisible(false)}
        onOk={handleDataSubmit}
        confirmLoading={submitting}
        destroyOnHidden
        width={520}
        afterOpenChange={(open) => {
          if (!open) return
          if (editingData) {
            dataForm.setFieldsValue({
              dict_sort: editingData.dict_sort,
              dict_label: editingData.dict_label,
              dict_value: editingData.dict_value,
              dict_type: editingData.dict_type,
              css_class: editingData.css_class,
              list_class: editingData.list_class,
              is_default: editingData.is_default === 1,
              status: editingData.status === 1,
              remark: editingData.remark,
            })
          } else {
            dataForm.resetFields()
            dataForm.setFieldsValue({
              dict_type: activeType?.dict_type,
              status: true,
              is_default: false,
              dict_sort: 0,
            })
          }
        }}
      >
        <Form form={dataForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="显示标签" name="dict_label" rules={[{ required: true, message: '请输入标签' }]}>
                <Input placeholder="如：启用" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="数据键值" name="dict_value" rules={[{ required: true, message: '请输入键值' }]}>
                <Input placeholder="如：1" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="字典类型" name="dict_type" rules={[{ required: true, message: '请选择字典类型' }]}>
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="显示排序" name="dict_sort">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="列表样式" name="list_class">
                <Select placeholder="选择标签颜色" allowClear options={listClassOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="CSS类名" name="css_class">
                <Input placeholder="自定义CSS类名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="是否默认" name="is_default" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="请输入备注" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .dict-type-active > td {
          background: var(--color-primary) !important;
          color: #fff !important;
        }
        .dict-type-active > td a {
          color: #fff !important;
        }
      `}</style>
    </>
  )
}
