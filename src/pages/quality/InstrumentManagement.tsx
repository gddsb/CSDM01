import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Tag, Button, Drawer, Space, Modal, Form, Input, Select, Descriptions, Row, Col, Collapse, Table, Upload, Popconfirm } from 'antd'
import {
  ToolOutlined, PlayCircleOutlined, SafetyCertificateOutlined,
  PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

// 状态标签颜色映射（与后端 Instrument 模型一致：在用/停用）
const statusColorMap = { '在用': 'green', '运行': 'green', '停用': 'red', '维修': 'orange' }
const statusOptions = ['在用', '停用'].map(s => ({ label: s, value: s }))
const calibrationTypeOptions = ['外校', '内校', '不需要校准'].map(s => ({ label: s, value: s }))

export default function InstrumentManagement() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const [docList, setDocList] = useState<any[]>([])
  const [planList, setPlanList] = useState<any[]>([])
  const [recordList, setRecordList] = useState<any[]>([])
  const [faultList, setFaultList] = useState<any[]>([])
  const [docUploadOpen, setDocUploadOpen] = useState(false)
  const [docSubmitting, setDocSubmitting] = useState(false)
  const [docForm] = Form.useForm()

  const loadArchives = useCallback(async (instrumentId: number) => {
    if (!instrumentId) return
    try {
      const [docsRes, plansRes, recordsRes, faultsRes] = await Promise.all([
        api.get('/basic/device-documents', { params: { device_id: instrumentId, page: 1, page_size: 200 } }).catch(() => null),
        api.get('/basic/device-calibration-plans', { params: { asset_id: instrumentId, page: 1, page_size: 200 } }).catch(() => null),
        api.get('/basic/device-calibration-records', { params: { asset_id: instrumentId } }).catch(() => null),
        api.get('/basic/device-faults', { params: { device_id: instrumentId, page: 1, page_size: 200 } }).catch(() => null),
      ])
      // 后端统一返回 { success, data: { list, total, ... } }，api.get 解包到 response.data
      setDocList(Array.isArray(docsRes?.data?.list) ? docsRes.data.list : [])
      setPlanList(Array.isArray(plansRes?.data?.list) ? plansRes.data.list : [])
      setRecordList(Array.isArray(recordsRes?.data?.list) ? recordsRes.data.list : [])
      setFaultList(Array.isArray(faultsRes?.data?.list) ? faultsRes.data.list : [])
    } catch { /* ignore */ }
  }, [])

  // 筛选输入态（仅关键字输入框使用受控值，避免每次按键触发查询；select 直接以 query 为单一数据源）
  const [keywordInput, setKeywordInput] = useState('')
  // 已应用的查询条件（筛选条件单一数据源：select 变化直接修改 query 立即查询）
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined as string | undefined, department: undefined as string | undefined, calibration_type: undefined as string | undefined })
  // 关键字防抖句柄
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 组件卸载时清理防抖计时器
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const inUseCount = data.filter(d => d.status === '在用').length
  const stopCount = data.filter(d => d.status === '停用').length

  const stats: StatItem[] = [
    { label: '仪器总数', value: total, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '在用', value: inUseCount, icon: <PlayCircleOutlined />, color: '#4CAF50' },
    { label: '停用', value: stopCount, icon: <SafetyCertificateOutlined />, color: '#F44336' },
  ]

  const departmentOptions = [...new Set(data.map(d => d.department).filter(Boolean))].map(d => ({ label: d, value: d }))

  // 获取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize, sortBy: 'instrument_no', sortOrder: 'asc' }
        if (query.keyword) params.keyword = query.keyword
        if (query.status) params.status = query.status
        if (query.department) params.department = query.department
        if (query.calibration_type) params.calibration_type = query.calibration_type
        const res = await api.get('/basic/instruments', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取检测仪器列表失败')
          setData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  // 查询：仅提交关键字输入框当前值（select 已在各自 onChange 中即时更新到 query）
  const handleSearch = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput }))
  }

  const handleReset = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    setKeywordInput('')
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, department: undefined, calibration_type: undefined }))
  }

  // 关键字输入：受控更新显示值 + 300ms 防抖立即查询
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setKeywordInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(q => ({ ...q, page: 1, keyword: v }))
    }, 300)
  }

  const handleDetail = (record) => {
    setCurrent(record)
    setDetailOpen(true)
    if (record?.instrument_id) loadArchives(record.instrument_id)
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  // Modal 打开动画结束后再设置表单值（配合 destroyOnHidden + preserve={false}）
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        instrument_no: editing.instrument_no,
        instrument_name: editing.instrument_name,
        instrument_model: editing.instrument_model,
        precision: editing.precision,
        department: editing.department,
        location: editing.location,
        status: editing.status,
        calibration_type: editing.calibration_type,
        calibration_cycle: editing.calibration_cycle,
        last_calibration_date: editing.last_calibration_date,
        next_calibration_date: editing.next_calibration_date,
        supplier: editing.supplier,
        remarks: editing.remarks,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: '在用' })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        // 编号不可修改，剔除 instrument_no
        delete payload.instrument_no
        const res = await api.put(`/basic/instruments/${editing.instrument_id}`, payload)
        message.success(res.message || '检测仪器编辑成功')
      } else {
        const res = await api.post('/basic/instruments', payload)
        message.success(res.message || '检测仪器新增成功')
      }
      setModalVisible(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    { title: '仪器编号', dataIndex: 'instrument_no', key: 'instrument_no', width: 140, fixed: 'left' as const },
    { title: '仪器名称', dataIndex: 'instrument_name', key: 'instrument_name', width: 130 },
    { title: '型号', dataIndex: 'instrument_model', key: 'instrument_model', width: 110 },
    { title: '精度', dataIndex: 'precision', key: 'precision', width: 100 },
    { title: '使用部门', dataIndex: 'department', key: 'department', width: 110 },
    { title: '存放地点', dataIndex: 'location', key: 'location', width: 110 },
    { title: '校验类型', dataIndex: 'calibration_type', key: 'calibration_type', width: 100 },
    { title: '校准周期(天)', dataIndex: 'calibration_cycle', key: 'calibration_cycle', width: 110 },
    { title: '上次校准日期', dataIndex: 'last_calibration_date', key: 'last_calibration_date', width: 120 },
    { title: '下次校准日期', dataIndex: 'next_calibration_date', key: 'next_calibration_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>,
    },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: 110 },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          {hasPermission('quality:instrument:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  const filters: FilterItem[] = [
    { type: 'input', placeholder: '仪器编号 / 名称 / 型号', col: { flex: '180px' }, value: keywordInput, onChange: handleKeywordChange },
    { type: 'select', field: 'department', placeholder: '使用部门', options: departmentOptions, col: { flex: '150px' }, value: query.department, onChange: (v) => setQuery(q => ({ ...q, page: 1, department: v as string | undefined })) },
    { type: 'select', field: 'calibration_type', placeholder: '校验类型', options: calibrationTypeOptions, col: { flex: '150px' }, value: query.calibration_type, onChange: (v) => setQuery(q => ({ ...q, page: 1, calibration_type: v as string | undefined })) },
    { type: 'select', field: 'status', placeholder: '状态', options: statusOptions, col: { flex: '150px' }, value: query.status, onChange: (v) => setQuery(q => ({ ...q, page: 1, status: v as string | undefined })) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检测仪器"
        breadcrumbs="质量管理 / 检测仪器"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增仪器</Button>,
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
            ]}
          />
        }
        table={
          <ResizableTable tableKey="pages_quality_InstrumentManagement" columns={columns}
            dataSource={data}
            rowKey="instrument_id"
            size="small"
            loading={loading}
            scroll={{ x: 1500 }}
            pagination={{
              current: query.page,
              pageSize: query.pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
            }}
          />
        }
      />
      <Modal
        title={editing ? '编辑检测仪器' : '新增检测仪器'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="instrument_no"
                label="仪器编号"
                rules={[{ required: true, message: '请输入仪器编号' }]}
                extra={editing ? '编码已生成，不允许修改' : '编码一经生成不可修改，请仔细核对'}
              >
                <Input placeholder="请输入仪器编号（如 DMCS-ZJC-02）" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="instrument_name" label="仪器名称" rules={[{ required: true, message: '请输入仪器名称' }]}>
                <Input placeholder="请输入仪器名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="instrument_model" label="型号">
                <Input placeholder="请输入型号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="precision" label="精度">
                <Input placeholder="如 0.01mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="department" label="使用部门">
                <Input placeholder="如 生产部" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="location" label="存放地点">
                <Input placeholder="如 下料" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="calibration_type" label="校验类型">
                <Select placeholder="请选择" options={calibrationTypeOptions} allowClear />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="calibration_cycle" label="校准周期（天）">
                <Input placeholder="如 365" type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplier" label="供应商">
                <Input placeholder="请输入供应商" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="last_calibration_date" label="上次校准日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_calibration_date" label="下次校准日期">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
        {editing && (
          <div style={{ marginTop: 8, color: '#faad14', fontSize: 12 }}>
            提示：仪器编号一经生成不允许修改。
          </div>
        )}
      </Modal>
      <Drawer
        title="仪器电子档案"
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setCurrent(null) }}
        width={720}
      >
        {current && (
          <Collapse
            defaultActiveKey={['info', 'docs', 'plans', 'records', 'faults']}
            ghost
          >
            <Collapse.Panel header="📋 基本信息" key="info">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="仪器编号">{current.instrument_no}</Descriptions.Item>
                <Descriptions.Item label="仪器名称">{current.instrument_name}</Descriptions.Item>
                <Descriptions.Item label="型号">{current.instrument_model || '-'}</Descriptions.Item>
                <Descriptions.Item label="精度">{current.precision || '-'}</Descriptions.Item>
                <Descriptions.Item label="使用部门">{current.department || '-'}</Descriptions.Item>
                <Descriptions.Item label="存放地点">{current.location || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status] || 'default'}>{current.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="校验类型">{current.calibration_type || '-'}</Descriptions.Item>
                <Descriptions.Item label="校准周期（天）">{current.calibration_cycle ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="上次校准日期">{current.last_calibration_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="下次校准日期">{current.next_calibration_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="供应商">{current.supplier || '-'}</Descriptions.Item>
                <Descriptions.Item label="备注">{current.remarks || '-'}</Descriptions.Item>
              </Descriptions>
            </Collapse.Panel>
            <Collapse.Panel header={`📎 电子文档 (${docList.length})`} key="docs">
              <>
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <Button size="small" type="primary" onClick={() => { docForm.resetFields(); setDocUploadOpen(true) }}>上传文档</Button>
                </div>
                <Table size="small" rowKey="doc_id" dataSource={docList} pagination={false} locale={{ emptyText: '暂无文档' }}
                  columns={[
                    { title: '文档类型', dataIndex: 'doc_type', width: 100 },
                    { title: '文档名称', dataIndex: 'doc_name' },
                    { title: '版本', dataIndex: 'version', width: 70 },
                    { title: '上传日期', dataIndex: 'upload_date', width: 110 },
                    { title: '操作', key: 'a', width: 100,
                      render: (_, r: any) => (
                        <Space size={4}>
                          <Button size="small" type="link" href={r.file_path} target="_blank">查看</Button>
                          <Popconfirm title="删除文档？" onConfirm={async () => {
                            try { await api.delete(`/basic/device-documents/${r.doc_id}`); message.success('已删除'); loadArchives(current.instrument_id) } catch (e: any) { message.error(e.message) }
                          }}><Button size="small" type="link" danger>删除</Button></Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            </Collapse.Panel>
            <Collapse.Panel header={`📅 校准计划 (${planList.length})`} key="plans">
              <Table size="small" rowKey="plan_id" dataSource={planList} pagination={false} locale={{ emptyText: '暂无校准计划' }}
                columns={[
                  { title: '周期(月)', dataIndex: 'calibration_cycle', width: 90 },
                  { title: '上次校准', dataIndex: 'last_calibration_date', width: 110 },
                  { title: '下次校准', dataIndex: 'next_calibration_date', width: 110 },
                  { title: '校准机构', dataIndex: 'calibration_org' },
                  { title: '状态', dataIndex: 'status', width: 80,
                    render: (v: string) => <Tag color={{ '待校准': 'blue', '已校准': 'green', '已超期': 'red', '已锁定': 'default' }[v] || 'default'}>{v}</Tag> },
                ]}
              />
            </Collapse.Panel>
            <Collapse.Panel header={`🏆 校准记录 (${recordList.length})`} key="records">
              <Table size="small" rowKey="record_id" dataSource={recordList} pagination={false} locale={{ emptyText: '暂无校准记录' }}
                columns={[
                  { title: '校准日期', dataIndex: 'calibration_date', width: 110 },
                  { title: '校准机构', dataIndex: 'calibration_org' },
                  { title: '证书号', dataIndex: 'certificate_no' },
                  { title: '结果', dataIndex: 'calibration_result', width: 70,
                    render: (v: string) => <Tag color={v === '合格' ? 'green' : 'red'}>{v}</Tag> },
                  { title: '证书', key: 'c', width: 80,
                    render: (_, r: any) => r.certificate_path ? <Button size="small" type="link" href={r.certificate_path} target="_blank">查看</Button> : '-' },
                ]}
              />
            </Collapse.Panel>
            <Collapse.Panel header={`⚠️ 故障记录 (${faultList.length})`} key="faults">
              <Table size="small" rowKey="fault_id" dataSource={faultList} pagination={false} locale={{ emptyText: '暂无故障记录' }}
                columns={[
                  { title: '故障编号', dataIndex: 'fault_no', width: 120 },
                  { title: '故障描述', dataIndex: 'fault_desc' },
                  { title: '发生时间', dataIndex: 'fault_time', width: 150 },
                  { title: '状态', dataIndex: 'status', width: 80,
                    render: (v: string) => <Tag color={{ '待派工': 'orange', '维修中': 'blue', '待审批': 'purple', '已关闭': 'green' }[v] || 'default'}>{v}</Tag> },
                ]}
              />
            </Collapse.Panel>
          </Collapse>
        )}
      </Drawer>
      <Modal
        title="上传仪器文档"
        open={docUploadOpen}
        onCancel={() => setDocUploadOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={docForm} layout="vertical" preserve={false}>
          <Form.Item name="doc_type" label="文档类型" rules={[{ required: true, message: '请选择文档类型' }]}>
            <Select placeholder="请选择" options={[
              { label: '出厂资料', value: 'factory' },
              { label: '验收报告', value: 'acceptance' },
              { label: '校准证书', value: 'calibration' },
              { label: '外部维修', value: 'external_repair' },
              { label: '内部维修', value: 'internal_repair' },
              { label: '改造升级', value: 'modification' },
              { label: '其他', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="doc_name" label="文档名称" rules={[{ required: true, message: '请输入文档名称' }]}>
            <Input placeholder="如：XX仪器校准证书" />
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="如：v1.0" />
          </Form.Item>
          <Form.Item label="文件" required>
            <Upload.Dragger multiple={false} maxCount={1} beforeUpload={() => false}
              onChange={({ fileList }) => docForm.setFieldsValue({ _file: fileList[0] })}>
              <p className="ant-upload-drag-icon">📄</p>
              <p className="ant-upload-text">点击或拖拽文件到此处</p>
            </Upload.Dragger>
          </Form.Item>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Space>
              <Button onClick={() => setDocUploadOpen(false)}>取消</Button>
              <Button type="primary" loading={docSubmitting} onClick={async () => {
                try {
                  const values = await docForm.validateFields()
                  if (!values._file) { message.warning('请选择文件'); return }
                  setDocSubmitting(true)
                  const fd = new FormData()
                  // 后端 multer.array('files', 10) 接收 files 字段
                  fd.append('files', values._file.originFileObj || values._file)
                  fd.append('device_id', String(current.instrument_id))
                  fd.append('doc_type', values.doc_type)
                  fd.append('doc_name', values.doc_name)
                  if (values.version) fd.append('version', values.version)
                  const res = await api.post('/basic/device-documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                  if (res?.success === false) throw new Error(res.message)
                  message.success('上传成功')
                  setDocUploadOpen(false)
                  loadArchives(current.instrument_id)
                } catch (e: any) { message.error(e.message || '上传失败') }
                finally { setDocSubmitting(false) }
              }}>确定上传</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </>
  )
}
