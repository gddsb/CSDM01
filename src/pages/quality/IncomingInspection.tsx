import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Tag, Button, Select, DatePicker, Space, Row, Col, Modal, Form, Input, Drawer, Descriptions, Typography, Popconfirm, Table as AntTable, InputNumber, Alert, Checkbox } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, PercentageOutlined,
  SyncOutlined, ReloadOutlined, SearchOutlined,
  EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { formatDateTime, formatDate } from '../../utils'
import api from '../../utils/api'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'

const { RangePicker } = DatePicker
const { Title } = Typography

const resultColor = { '合格': 'success', '不合格': 'error' }
const handleColor = { '入库': 'green', '退货': 'red', '让步接收': 'orange', '报废': 'red' }
const triggerColor = { '自动': 'blue', '手工': 'purple' }
const statusColor = { '待检': 'default', '检验中': 'processing', '审核中': 'warning', '已完成': 'success', '已关闭': 'default' }

const STATUS_OPTIONS = ['待检', '检验中', '审核中', '已完成', '已关闭']
const DEFAULT_STATUS = ['待检', '检验中', '审核中']

const canEdit = (status: string) => status === '待检' || status === '检验中'
const canSubmit = (status: string) => status === '检验中'

export default function IncomingInspection() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 12, total: 0 })
  const [summaryStats, setSummaryStats] = useState<any>({ total: 0, pending: 0, inspecting: 0, reviewing: 0, pass: 0, fail: 0 })

  const [supplierFilter, setSupplierFilter] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>([...DEFAULT_STATUS])
  const [dateRange, setDateRange] = useState<any>(null)
  const [monthQuick, setMonthQuick] = useState<string>('')
  const [rangeWarn, setRangeWarn] = useState(false)
  const [standards, setStandards] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)

  const [editVisible, setEditVisible] = useState(false)
  const [inspectDrawerOpen, setInspectDrawerOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [inspectItems, setInspectItems] = useState<any[]>([])
  const [editForm] = Form.useForm()
  const message = useMessage()

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        setLoading(false)
        return
      }
      setRangeWarn(!!check.warn)
    } else {
      setRangeWarn(false)
    }
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (supplierFilter) params.supplier_name = supplierFilter
      if (resultFilter) params.result = resultFilter
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/incoming-inspections', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
        if (res.data?.stats) setSummaryStats(res.data.stats)
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e: any) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
    } finally {
      setLoading(false)
      setRangeWarn(false)
    }
  }, [pagination.current, pagination.pageSize, supplierFilter, resultFilter, statusFilter, dateRange])

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const loadStandards = async () => {
      try {
        const res = await api.get('/basic/standards', { params: { page: 1, page_size: 500, status: '生效', standard_type: '材料检验' } })
        const list = res.data?.list || res.data || []
        setStandards(list)
      } catch (e) {
        // ignore
      }
    }
    loadStandards()
  }, [])

  const totalCount = summaryStats.total || pagination.total
  const passCount = summaryStats.pass ?? 0
  const failCount = summaryStats.fail ?? 0
  const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : '0.0'
  const pendingCount = summaryStats.pending ?? 0
  const inspectingCount = summaryStats.inspecting ?? 0

  const stats: StatItem[] = [
    { label: '检验总数', value: totalCount, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '待检', value: pendingCount, icon: <ExperimentOutlined />, color: '#FF9800' },
    { label: '检验中', value: inspectingCount, icon: <ExperimentOutlined />, color: '#1890FF' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <PercentageOutlined />, color: '#9C27B0' },
  ]

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/basic/incoming-inspections/sync-purchase-receipts')
      if (res.success !== false) {
        const d = res.data || {}
        message.success(res.message || `采购入库同步完成：共 ${d.totalReceipts ?? 0} 条，新建 ${d.created ?? 0} 条，更新 ${d.updated ?? 0} 条`)
        fetchData()
      } else {
        message.error(res.message || '同步失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '同步失败，请重试')
    } finally {
      setSyncing(false)
    }
  }

  const handleEdit = (record: any) => {
    setCurrent(record)
    editForm.setFieldsValue({
      supplier_name: record.supplier_name,
      receipt_no: record.receipt_no ? (record.line_no ? `${record.receipt_no} (行${record.line_no})` : record.receipt_no) : '',
      material_code: record.material_code,
      material_name: record.material_name,
      specification: record.specification,
      supplier_batch_no: record.supplier_batch_no,
      internal_batch_no: record.internal_batch_no,
      arrival_date: record.arrival_date ? dayjs(record.arrival_date) : null,
      quantity: record.quantity,
      receipt_status: record.receipt_status || '',
      standard_id: record.standard_id,
    })
    setEditVisible(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      const standard = standards.find(s => String(s.standard_id) === String(values.standard_id))
      const payload = {
        standard_id: values.standard_id ? Number(values.standard_id) : null,
        standard_name: standard?.standard_name || '',
      }
      const res = await api.put(`/basic/incoming-inspections/${current.inspection_id}`, payload)
      if (res.success !== false) {
        message.success('修改成功')
        setEditVisible(false)
        fetchData()
      } else {
        message.error(res.message || '修改失败')
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败，请重试')
    }
  }

  const openInspect = async (record: any) => {
    try {
      const res = await api.get(`/basic/incoming-inspections/${record.inspection_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setInspectItems((detail.items || []).map((it: any, idx: number) => ({ ...it, sort_order: it.sort_order !== undefined ? it.sort_order : idx })))
      setInspectDrawerOpen(true)
    } catch (e) {
      setCurrent(record)
      setInspectDrawerOpen(true)
    }
  }

  const handleStart = async (record: any) => {
    try {
      const res = await api.put(`/basic/incoming-inspections/${record.inspection_id}/start`)
      if (res.success !== false) {
        message.success('已开检')
        fetchData()
      } else {
        message.error(res.message || '开检失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '开检失败')
    }
  }

  const handleInspectSave = async () => {
    try {
      const payload = { items: inspectItems }
      await api.put(`/basic/incoming-inspections/${current.inspection_id}`, payload)
      message.success('检测项目已保存')
      setInspectDrawerOpen(false)
      fetchData()
    } catch (e: any) {
      // ignore
    }
  }

  const handleSubmit = async (record: any) => {
    try {
      await api.put(`/basic/incoming-inspections/${record.inspection_id}/submit`)
      message.success('已报审')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '报审失败')
    }
  }

  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/incoming-inspections/${record.inspection_id}`)
      if (res.success !== false) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const handleReview = async (result: '合格' | '不合格') => {
    try {
      const res = await api.put(`/basic/incoming-inspections/${current.inspection_id}/review`, { result })
      if (res.success !== false) {
        message.success(`审核${result}成功`)
        setDetailDrawerOpen(false)
        fetchData()
      } else {
        message.error(res.message || '审核失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '审核失败')
    }
  }

  const showDetail = async (record: any) => {
    try {
      const res = await api.get(`/basic/incoming-inspections/${record.inspection_id}`)
      setCurrent(res.data || record)
      setDetailDrawerOpen(true)
    } catch (e) {
      setCurrent(record)
      setDetailDrawerOpen(true)
    }
  }

  const updateItem = useCallback((index: number, field: string, value: any) => {
    setInspectItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' as const },
    {
      title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 130, ellipsis: true,
      render: (_: any, r: any) => {
        const display = r.supplier_short_name || r.supplier_name || '-'
        const full = r.supplier_name
        return (
          <span title={full && display !== full ? full : undefined}>
            {display}
          </span>
        )
      }
    },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 120, ellipsis: true },
    {
      // 料品名称：自动换行
      title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 180,
      render: (text: any) => (
        <div style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>
          {text || '-'}
        </div>
      )
    },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120, ellipsis: true },
    {
      title: '到货数量', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'right' as const,
      render: v => v ? Number(v).toLocaleString() : '-'
    },
    { title: '供应商批号', dataIndex: 'supplier_batch_no', key: 'supplier_batch_no', width: 130, ellipsis: true },
    { title: '内部批号', dataIndex: 'internal_batch_no', key: 'internal_batch_no', width: 130, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColor[v as keyof typeof statusColor]}>{v}</Tag>
    },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: v => v && v !== '-' ? <Tag color={resultColor[v as keyof typeof resultColor]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '处理方式', dataIndex: 'handle_type', key: 'handle_type', width: 100,
      render: v => v ? <Tag color={handleColor[v as keyof typeof handleColor]}>{v}</Tag> : '-'
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 90, render: v => v || '-' },
    { title: '到货日期', dataIndex: 'arrival_date', key: 'arrival_date', width: 110, render: (v: any) => formatDate(v) },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: formatDateTime },
    {
      title: '收货单状态', dataIndex: 'receipt_status', key: 'receipt_status', width: 100,
      render: v => v ? <Tag>{v}</Tag> : <span style={{ color: '#999' }}>-</span>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 220,
      render: (_: any, record: any) => (
        <Space size={2} wrap>
          <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
          {record.status === '待检' && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {record.status === '待检' && record.standard_id && (
            <Button type="link" size="small" onClick={() => handleStart(record)}>开检</Button>
          )}
          {record.status === '检验中' && (
            <Button type="link" size="small" onClick={() => openInspect(record)}>检测</Button>
          )}
          {canSubmit(record.status) && (
            <Popconfirm title="确认报审？报审后数据不可修改" onConfirm={() => handleSubmit(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small">报审</Button>
            </Popconfirm>
          )}
          {record.status === '待检' && record.trigger_type === '手工' && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ]

  const inspectColumns = useMemo(() => [
    { title: '序号', dataIndex: 'sort_order', key: 'sort_order', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: '项目分类', dataIndex: 'category', key: 'category', width: 80,
      render: (v: any) => v || '-',
    },
    {
      title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 140,
      render: (v: any) => v || '-',
    },
    {
      title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 160,
      render: (v: any) => (
        <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.5, padding: '4px 8px' }}>
          {v || '-'}
        </div>
      ),
    },
    {
      title: '检验结果', dataIndex: 'actual_value', key: 'actual_value', width: 100,
      render: (v: any, record: any, index: number) => (
        <Input
          key={`input-actual-${record.item_id || index}`}
          value={v}
          onChange={e => updateItem(index, 'actual_value', e.target.value)}
          placeholder="请输入检验结果"
        />
      ),
    },
    {
      title: '判定结论', dataIndex: 'result', key: 'result', width: 100,
      render: (v: any, record: any, index: number) => (
        <Select
          key={`select-result-${record.item_id || index}`}
          style={{ width: '100%' }}
          placeholder="请选择"
          allowClear
          value={v}
          onChange={val => updateItem(index, 'result', val)}
          options={[{ label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }]}
        />
      ),
    },
  ], [updateItem])

  return (
    <>
      <ThreeSectionPage
        title="来料检验"
        breadcrumbs="质量管理 / 来料检验"
        stats={stats}
        actions={
          <>
            <Button type="primary" icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>采购入库同步</Button>
          </>
        }
        filter={
          <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
            <Input
              placeholder="供应商名称"
              style={{ width: 150 }}
              allowClear
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value || undefined)}
            />
            <Select
              placeholder="结果"
              allowClear
              style={{ width: 100 }}
              options={[{ label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }]}
              value={resultFilter}
              onChange={setResultFilter}
            />
            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: 13, marginRight: 6, whiteSpace: 'nowrap' }}>状态：</span>
              <Checkbox.Group
                value={statusFilter}
                onChange={v => setStatusFilter(v as string[])}
                style={{ display: 'inline-flex', gap: 8, whiteSpace: 'nowrap' }}
                options={STATUS_OPTIONS}
              />
            </div>
            <Select
              placeholder="快速时间"
              allowClear
              style={{ width: 130 }}
              value={monthQuick || undefined}
              onChange={handleMonthQuick}
              options={MONTH_QUICK_OPTIONS}
            />
            <RangePicker
              style={{ width: 240 }}
              value={dateRange}
              onChange={handleRangeChange}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setSupplierFilter(undefined); setResultFilter(undefined)
              setStatusFilter([...DEFAULT_STATUS]); setMonthQuick(''); setDateRange(null)
            }}>重置</Button>
          </Space>
        }
        table={
          <div>
            {rangeWarn && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
            )}
            <ResizableTable
              tableKey="pages_quality_IncomingInspection"
              columns={columns as any}
              dataSource={data}
              rowKey="inspection_id"
              size="small"
              loading={loading}
              scroll={{ x: 1900 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                pageSizeOptions: [12, 20, 50, 100],
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setPagination(v => ({ ...v, current: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />

      <Modal
        title="编辑来料检验"
        open={editVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="supplier_name" label="供应商名称">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="receipt_no" label="采购收货单号">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_code" label="料号">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="material_name" label="料品名称">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="specification" label="规格">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplier_batch_no" label="供应商批号">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="internal_batch_no" label="内部批号">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="arrival_date" label="到货日期">
                <DatePicker style={{ width: '100%' }} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantity" label="到货数量">
                <InputNumber style={{ width: '100%' }} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="receipt_status" label="收货单状态">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="standard_id" label="检验标准">
                <Select
                  placeholder="请选择检验标准"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={standards.map(s => ({
                    label: `${s.standard_no || ''} ${s.standard_name || ''}`.trim(),
                    value: s.standard_id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={current ? `来料检验 - ${current.inspection_no}` : '来料检验'}
        open={inspectDrawerOpen}
        onClose={() => setInspectDrawerOpen(false)}
        width={1100}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setInspectDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleInspectSave}>保存</Button>
          </Space>
        }
      >
        <AntTable
          columns={inspectColumns}
          dataSource={inspectItems}
          rowKey={(r: any, i: number) => r.item_id || `row-${i}`}
          size="small"
          pagination={false}
        />
      </Drawer>

      <Drawer
        title={current ? `检验详情 - ${current.inspection_no}` : '检验详情'}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={900}
        destroyOnHidden
        extra={
          current?.status === '审核中' ? (
            <Space>
              <Popconfirm title="确认审核通过？" onConfirm={() => handleReview('合格')} okText="确认" cancelText="取消">
                <Button type="primary">审核通过</Button>
              </Popconfirm>
              <Popconfirm title="确认审核不通过？" onConfirm={() => handleReview('不合格')} okText="确认" cancelText="取消">
                <Button danger>审核不通过</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {current && (
          <>
            <Descriptions column={4} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                {current.trigger_type ? <Tag color={triggerColor[current.trigger_type as keyof typeof triggerColor]}>{current.trigger_type}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status as keyof typeof statusColor]}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总结果">
                {current.result && current.result !== '-' ? <Tag color={resultColor[current.result as keyof typeof resultColor]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>

              <Descriptions.Item label="供应商" span={2}>{current.supplier_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商编码">{current.supplier_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商批号">{current.supplier_batch_no || '-'}</Descriptions.Item>

              <Descriptions.Item label="料号">{current.material_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="料品名称" span={2}>{current.material_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="规格">{current.specification || '-'}</Descriptions.Item>

              <Descriptions.Item label="内部批号">{current.internal_batch_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="到货数量">{current.quantity ? Number(current.quantity).toLocaleString() : '-'}</Descriptions.Item>
              <Descriptions.Item label="到货日期">{current.arrival_date ? formatDate(current.arrival_date) : '-'}</Descriptions.Item>
              <Descriptions.Item label="收货单状态">
                {current.receipt_status ? <Tag>{current.receipt_status}</Tag> : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="采购收货单号" span={2}>
                {current.receipt_no ? (current.line_no ? `${current.receipt_no} (行${current.line_no})` : current.receipt_no) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="检验标准">{current.standard_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {current.handle_type ? <Tag color={handleColor[current.handle_type as keyof typeof handleColor]}>{current.handle_type}</Tag> : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="检验人">{current.inspector_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{formatDateTime(current.inspection_time)}</Descriptions.Item>
              <Descriptions.Item label="审核人">{current.reviewer_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(current.review_time)}</Descriptions.Item>

              {current.handle_reason && (
                <Descriptions.Item label="处理原因" span={4}>{current.handle_reason}</Descriptions.Item>
              )}
              {current.remarks && (
                <Descriptions.Item label="备注" span={4}>{current.remarks}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginTop: 8 }}>检测项目</Title>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
              <AntTable
                size="small"
                dataSource={current.items || []}
                rowKey={(r: any, i: number) => r.item_id || i}
                pagination={false}
                tableLayout="auto"
                columns={[
                  { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                  { title: '检测项目', dataIndex: 'item_name' },
                  { title: '标准要求', dataIndex: 'standard_value' },
                  { title: '检测值', dataIndex: 'actual_value' },
                  {
                    title: '判定', dataIndex: 'result', width: 100,
                    render: (v: any) => v !== null && v !== undefined ? (
                      <Tag color={v === '合格' || v === 1 ? 'success' : 'error'}>
                        {typeof v === 'number' ? (v === 1 ? '合格' : '不合格') : v}
                      </Tag>
                    ) : '-'
                  },
                ]}
              />
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}
