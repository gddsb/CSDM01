import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tabs, Table, Tag, Button, Drawer, Space, Modal, Form, Input, Select,
  DatePicker, Upload, Popconfirm, Empty, Spin, Image, Tooltip, Row, Col,
  Input as AntInput, Alert, Typography,
} from 'antd'
import type { UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FilePdfOutlined, FileWordOutlined, FileExcelOutlined, FileImageOutlined,
  FileOutlined, FileZipOutlined, FileTextOutlined, FilePptOutlined, FileUnknownOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, UploadOutlined, SearchOutlined, FileTextTwoTone,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'
import dayjs from 'dayjs'

const { Text } = Typography

// 文档类型映射
const DOC_TYPE_MAP: Record<string, string> = {
  'factory': '出厂资料',
  'acceptance': '验收资料',
  'external_repair': '外保记录',
  'internal_repair': '内部维修',
  'modification': '改造记录',
}
const DOC_TYPE_KEYS = Object.keys(DOC_TYPE_MAP)

const DOC_TYPE_OPTIONS = DOC_TYPE_KEYS.map(k => ({ label: DOC_TYPE_MAP[k], value: k }))

// 文件格式 -> 图标 映射
const fileIconMap: Record<string, React.ReactNode> = {
  'pdf': <FilePdfOutlined style={{ color: '#F5222D' }} />,
  'doc': <FileWordOutlined style={{ color: '#2962FF' }} />,
  'docx': <FileWordOutlined style={{ color: '#2962FF' }} />,
  'xls': <FileExcelOutlined style={{ color: '#388E3C' }} />,
  'xlsx': <FileExcelOutlined style={{ color: '#388E3C' }} />,
  'ppt': <FilePptOutlined style={{ color: '#EF6C00' }} />,
  'pptx': <FilePptOutlined style={{ color: '#EF6C00' }} />,
  'jpg': <FileImageOutlined style={{ color: '#7E57C2' }} />,
  'jpeg': <FileImageOutlined style={{ color: '#7E57C2' }} />,
  'png': <FileImageOutlined style={{ color: '#7E57C2' }} />,
  'gif': <FileImageOutlined style={{ color: '#7E57C2' }} />,
  'bmp': <FileImageOutlined style={{ color: '#7E57C2' }} />,
  'zip': <FileZipOutlined style={{ color: '#6D4C41' }} />,
  'rar': <FileZipOutlined style={{ color: '#6D4C41' }} />,
  'txt': <FileTextOutlined style={{ color: '#757575' }} />,
}

function getFileIcon(format?: string): React.ReactNode {
  if (!format) return <FileOutlined />
  const key = String(format).toLowerCase()
  return fileIconMap[key] || <FileUnknownOutlined />
}

function isPreviewable(format?: string): boolean {
  if (!format) return false
  const key = String(format).toLowerCase()
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(key)
}

function isImage(format?: string): boolean {
  if (!format) return false
  const key = String(format).toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(key)
}

function isPdf(format?: string): boolean {
  if (!format) return false
  return String(format).toLowerCase() === 'pdf'
}

function apiBase(): string {
  return (import.meta as any).env?.VITE_API_BASE_URL || '/api'
}

// 构造下载 URL（带 token header 由拦截器处理；此处直接走 axios 触发下载）
async function downloadDocument(record: any, message: ReturnType<typeof useMessage>) {
  try {
    // 使用直接 URL 下载方式（携带 token via fetch）
    const token = localStorage.getItem('mes_token')
    const url = `${apiBase().replace(/\/$/, '')}/basic/device-documents/${record.doc_id}/download`
    const resp = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(errText || `下载失败：${resp.status}`)
    }
    const blob = await resp.blob()
    const downloadName = record.doc_name
      ? `${record.doc_name}${record.file_format ? '.' + record.file_format : ''}`
      : (record.file_path?.split('/').pop() || 'document')
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  } catch (e: any) {
    message.error(e?.message || '下载失败')
  }
}

// 在新窗口在线预览（PDF 与图片直接走静态资源 URL）
function previewDocument(record: any) {
  const format = record.file_format
  const relPath = record.file_path
  if (!relPath) return
  // 通过后端静态资源访问 PDF 或图片
  const url = `${apiBase().replace(/\/api\/?$/, '')}${relPath}`
  if (isPdf(format) || isImage(format)) {
    window.open(url, '_blank')
  } else {
    window.open(url, '_blank')
  }
}

interface DeviceRow {
  device_id: number
  device_code: string
  device_name: string
  device_type?: string
  device_model?: string
  status?: string | number
  location?: string
}

interface DocRow {
  doc_id: number
  device_id: number
  device_code?: string
  device_name?: string
  doc_type: string
  doc_type_name?: string
  doc_name: string
  file_path: string
  file_format?: string
  file_size?: number
  file_size_text?: string
  version?: string
  related_order?: string
  valid_until?: string
  uploaded_by?: number
  uploaded_by_name?: string
  remarks?: string
  created_at?: string
  updated_at?: string
}

export default function DeviceDocumentPage() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const canEdit = hasPermission('device:document:update') || hasPermission('device:list:update')
  const canDelete = hasPermission('device:document:delete') || hasPermission('device:list:delete')
  const canUpload = hasPermission('device:document:upload') || canEdit

  // 设备列表（主表）
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [deviceKeyword, setDeviceKeyword] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)

  // 全部文档（用于主表统计 + 子表展示）
  const [allDocs, setAllDocs] = useState<DocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // 上传 Modal
  const [uploadVisible, setUploadVisible] = useState(false)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [uploadForm] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 更新 Modal
  const [editVisible, setEditVisible] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editForm] = Form.useForm()
  const [editingDoc, setEditingDoc] = useState<DocRow | null>(null)

  // 详情 Drawer
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailDoc, setDetailDoc] = useState<DocRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 统计
  const [totalDocs, setTotalDocs] = useState(0)
  const [devicesCount, setDevicesCount] = useState(0)

  // ============ 获取设备列表 ============
  const fetchDevices = useCallback(async (keyword?: string) => {
    setDevicesLoading(true)
    try {
      const params: any = { page: 1, pageSize: 500 }
      if (keyword) params.keyword = keyword
      const res = await api.get('/basic/devices', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        const arr: DeviceRow[] = Array.isArray(list) ? list : []
        setDevices(arr)
        setDevicesCount(res.data?.total || res.total || arr.length)
      }
    } catch (e: any) {
      if (!/timeout|network/i.test(e?.message || '')) message.error(e?.message || '获取设备列表失败')
    } finally {
      setDevicesLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  // ============ 获取全部设备文档（用于主表统计 + 子表展示） ============
  const fetchAllDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      const res = await api.get('/basic/device-documents', { params: { page: 1, page_size: 9999 } })
      if (res.success !== false) {
        const raw = res.data
        const list = Array.isArray(raw) ? raw : (raw?.list || raw?.rows || [])
        setAllDocs(list as DocRow[])
        setTotalDocs(Array.isArray(raw) ? list.length : (raw?.total || list.length))
      } else {
        setAllDocs([])
        setTotalDocs(0)
        message.error(res.message || '获取文档列表失败')
      }
    } catch (e: any) {
      setAllDocs([])
      setTotalDocs(0)
      if (!/timeout|network/i.test(e?.message || '')) message.error(e?.message || '获取文档列表失败')
    } finally {
      setDocsLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchAllDocs()
  }, [fetchAllDocs])

  // ============ 统计 ============
  const stats: StatItem[] = useMemo(() => {
    const factoryCount = allDocs.filter(d => d.doc_type === 'factory').length
    const repairCount = allDocs.filter(d => d.doc_type === 'internal_repair' || d.doc_type === 'external_repair').length
    return [
      { label: '设备总数', value: devicesCount, icon: <FileTextTwoTone />, color: '#2196F3' },
      { label: '档案总数', value: totalDocs, icon: <FileOutlined />, color: '#4CAF50' },
      { label: '出厂资料', value: factoryCount, icon: <FileTextOutlined />, color: '#FF9800' },
      { label: '维修记录', value: repairCount, icon: <FileUnknownOutlined />, color: '#9C27B0' },
    ]
  }, [devicesCount, totalDocs, allDocs])

  // ============ 按设备聚合文档计数（主表统计列） ============
  const docsCountByDevice = useMemo(() => {
    const map: Record<number, Record<string, number>> = {}
    for (const d of allDocs) {
      if (!map[d.device_id]) map[d.device_id] = {}
      const t = d.doc_type || 'unknown'
      map[d.device_id][t] = (map[d.device_id][t] || 0) + 1
    }
    return map
  }, [allDocs])

  // ============ 当前选中设备的子表数据 ============
  const selectedDeviceDocs = useMemo(() => {
    if (selectedDeviceId == null) return []
    return allDocs.filter(d => Number(d.device_id) === Number(selectedDeviceId))
  }, [allDocs, selectedDeviceId])

  const selectedDevice = useMemo<DeviceRow | null>(() => {
    if (selectedDeviceId == null) return null
    return devices.find(d => d.device_id === selectedDeviceId) || null
  }, [devices, selectedDeviceId])

  // ============ 选中设备（主表行点击） ============
  const handleSelectDevice = (device: DeviceRow) => {
    setSelectedDeviceId(device.device_id)
  }

  const handleSearchDevice = () => {
    fetchDevices(deviceKeyword || undefined)
  }

  const handleResetDevice = () => {
    setDeviceKeyword('')
    fetchDevices()
  }

  // ============ 上传 ============
  const openUpload = () => {
    if (!selectedDeviceId) {
      message.warning('请先在主表选择设备')
      return
    }
    uploadForm.resetFields()
    uploadForm.setFieldsValue({
      device_id: selectedDeviceId,
      doc_type: 'factory',
      version: 'v1',
    })
    setFileList([])
    setUploadVisible(true)
  }

  const handleUploadSubmit = async () => {
    try {
      const values = await uploadForm.validateFields()
      const validFiles = fileList.filter(f => f.originFileObj)
      if (validFiles.length === 0) {
        message.warning('请选择要上传的文件')
        return
      }
      const formData = new FormData()
      formData.append('device_id', String(values.device_id))
      formData.append('doc_type', values.doc_type)
      formData.append('doc_name', values.doc_name || '')
      formData.append('version', values.version || 'v1')
      if (values.valid_until) formData.append('valid_until', values.valid_until.format('YYYY-MM-DD'))
      if (values.related_order) formData.append('related_order', values.related_order)
      if (values.remarks) formData.append('remarks', values.remarks)
      validFiles.forEach(f => formData.append('files', f.originFileObj as File))

      setUploadSubmitting(true)
      const res = await api.post('/basic/device-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.success !== false) {
        message.success(res.message || `成功上传${validFiles.length}个文件`)
        setUploadVisible(false)
        fetchAllDocs()
      } else {
        message.error(res.message || '上传失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '上传失败')
    } finally {
      setUploadSubmitting(false)
    }
  }

  // ============ 更新 ============
  const openEdit = (record: DocRow) => {
    setEditingDoc(record)
    editForm.resetFields()
    editForm.setFieldsValue({
      device_id: record.device_id,
      doc_name: record.doc_name,
      version: record.version,
      valid_until: record.valid_until ? dayjs(record.valid_until) : undefined,
      related_order: record.related_order,
      remarks: record.remarks,
    })
    setEditVisible(true)
  }

  const handleEditSubmit = async () => {
    if (!editingDoc) return
    try {
      const values = await editForm.validateFields()
      const payload: any = {
        doc_name: values.doc_name,
        version: values.version,
        related_order: values.related_order || null,
        remarks: values.remarks || null,
        valid_until: values.valid_until ? values.valid_until.format('YYYY-MM-DD') : null,
      }
      if (values.device_id && Number(values.device_id) !== Number(editingDoc.device_id)) {
        payload.device_id = values.device_id
      }
      setEditSubmitting(true)
      const res = await api.put(`/basic/device-documents/${editingDoc.doc_id}`, payload)
      if (res.success !== false) {
        message.success(res.message || '更新成功')
        setEditVisible(false)
        fetchAllDocs()
      } else {
        message.error(res.message || '更新失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '更新失败')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ============ 删除 ============
  const handleDelete = async (record: DocRow) => {
    try {
      const res = await api.delete(`/basic/device-documents/${record.doc_id}`)
      if (res.success !== false) {
        message.success(res.message || '删除成功')
        fetchAllDocs()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  // ============ 详情 ============
  const openDetail = async (record: DocRow) => {
    setDetailDoc(record)
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/device-documents/${record.doc_id}`)
      if (res.success !== false && res.data) {
        setDetailDoc(res.data)
      }
    } catch {
      // 保持当前 record 作为兜底
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 表格列定义 ============
  const columns: ColumnsType<DocRow> = [
    {
      title: '文档类型', dataIndex: 'doc_type', key: 'doc_type', width: 110,
      render: (v: string) => v ? <Tag color="blue">{DOC_TYPE_MAP[v] || v}</Tag> : '-',
    },
    {
      title: '文档名称', dataIndex: 'doc_name', key: 'doc_name', width: 240, ellipsis: true,
      render: (v: string, r: DocRow) => (
        <Space size={4}>
          {getFileIcon(r.file_format)}
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        </Space>
      ),
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '格式', dataIndex: 'file_format', key: 'file_format', width: 80,
      render: (v: string) => v ? <Tag>{v.toUpperCase()}</Tag> : '-',
    },
    {
      title: '大小', dataIndex: 'file_size_text', key: 'file_size_text', width: 100,
      render: (v: string) => v || '-',
    },
    { title: '关联工单', dataIndex: 'related_order', key: 'related_order', width: 120, ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '有效期至', dataIndex: 'valid_until', key: 'valid_until', width: 120,
      render: (v: string) => {
        if (!v) return <Text type="secondary">-</Text>
        const overdue = dayjs(v).isBefore(dayjs().startOf('day'))
        return <span style={{ color: overdue ? '#F5222D' : undefined, fontWeight: overdue ? 600 : undefined }}>{v}</span>
      },
    },
    { title: '上传人', dataIndex: 'uploaded_by_name', key: 'uploaded_by_name', width: 100, render: (v: string) => v || '-' },
    {
      title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 150,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_: any, record: DocRow) => (
        <Space size="small" wrap>
          {isPreviewable(record.file_format) && (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => previewDocument(record)}>预览</Button>
          )}
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => downloadDocument(record, message)}>下载</Button>
          <Button type="link" size="small" onClick={() => openDetail(record)}>详情</Button>
          {canEdit && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          )}
          {canDelete && (
            <Popconfirm title="确认删除该文档？将同时删除物理文件，不可恢复。" onConfirm={() => handleDelete(record)} okText="删除" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ============ 主表列定义（设备 + 各类型文档计数） ============
  const masterColumns: ColumnsType<DeviceRow> = [
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 140, render: (v: string) => v || '-' },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 160, render: (v: string) => v || '-' },
    ...DOC_TYPE_KEYS.map((key) => ({
      title: DOC_TYPE_MAP[key], key, width: 110, align: 'center' as const,
      render: (_: any, r: DeviceRow) => {
        const n = docsCountByDevice[r.device_id]?.[key] || 0
        return n > 0 ? <Tag color="blue">{n}</Tag> : <Text type="secondary">-</Text>
      },
    })),
  ]

  // ============ 主子表联动布局（一二级列表） ============
  const renderMasterDetail = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 一级：主表 */}
      <div>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text strong>设备电子档案（主表 · 点击行查看子表档案）</Text>
          <Space wrap>
            <AntInput
              placeholder="搜索设备编号/名称/型号"
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 240 }}
              value={deviceKeyword}
              onChange={(e) => setDeviceKeyword(e.target.value)}
              onPressEnter={handleSearchDevice}
            />
            <Button size="small" icon={<SearchOutlined />} onClick={handleSearchDevice}>查询</Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleResetDevice}>重置</Button>
          </Space>
        </div>
        <Table
          size="small"
          rowKey="device_id"
          columns={masterColumns as any}
          dataSource={devices}
          loading={devicesLoading || docsLoading}
          scroll={{ x: 920 }}
          pagination={false}
          rowClassName={(r: DeviceRow) => r.device_id === selectedDeviceId ? 'device-archive-row-selected' : ''}
          onRow={(r: DeviceRow) => ({
            onClick: () => handleSelectDevice(r),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备" /> }}
        />
      </div>

      {/* 二级：子表 */}
      <div>
        <div style={{ marginBottom: 8 }}>
          <Space wrap>
            <Text strong>档案明细（子表）</Text>
            {selectedDevice ? (
              <Tag color="blue">{selectedDevice.device_name}（{selectedDevice.device_code}）</Tag>
            ) : (
              <Text type="warning">未选择设备</Text>
            )}
            <Text type="secondary">｜ 明细数：</Text>
            <Tag color="geekblue">{selectedDeviceDocs.length}</Tag>
          </Space>
        </div>
        {selectedDeviceId == null ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请点击上方主表选择设备后查看对应档案明细"
            style={{ padding: '24px 0' }}
          />
        ) : (
          <Table
            size="small"
            rowKey="doc_id"
            columns={columns as any}
            dataSource={selectedDeviceDocs}
            loading={docsLoading}
            scroll={{ x: 1300 }}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该设备暂无档案文档" /> }}
          />
        )}
      </div>
    </div>
  )

  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <Text type="secondary" style={{ fontSize: 13 }}>
        当前设备：
      </Text>
      {selectedDevice ? (
        <Tag color="blue" style={{ fontSize: 13 }}>
          {selectedDevice.device_name} ({selectedDevice.device_code})
        </Tag>
      ) : (
        <Text type="warning">未选择</Text>
      )}
      <Text type="secondary" style={{ fontSize: 13 }}>｜ 文档总数：</Text>
      <Tag color="geekblue">{totalDocs}</Tag>
    </Space>
  )

  const actions = (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={openUpload} disabled={!canUpload || !selectedDeviceId}>
        上传文档
      </Button>
      <Button icon={<ReloadOutlined />} onClick={() => { fetchDevices(deviceKeyword); fetchAllDocs() }}>刷新</Button>
    </Space>
  )

  // ============ 详情 Drawer 文件预览 ============
  const renderDetailPreview = () => {
    if (!detailDoc?.file_path) return <Empty description="无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    const url = `${apiBase().replace(/\/api\/?$/, '')}${detailDoc.file_path}`
    if (isPdf(detailDoc.file_format)) {
      return (
        <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
          <iframe title="pdf-preview" src={url} style={{ width: '100%', height: 480, border: 'none' }} />
        </div>
      )
    }
    if (isImage(detailDoc.file_format)) {
      return (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <Image src={url} alt={detailDoc.doc_name} style={{ maxWidth: '100%', maxHeight: 480 }} />
        </div>
      )
    }
    return (
      <Alert
        type="info"
        showIcon
        message="该格式暂不支持在线预览，请下载后查看"
        action={<Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => downloadDocument(detailDoc, message)}>下载</Button>}
      />
    )
  }

  return (
    <>
      <style>{`
        .device-archive-row-selected > td { background: rgba(33,150,243,0.10) !important; }
        .device-archive-row-selected:hover > td { background: rgba(33,150,243,0.16) !important; }
      `}</style>
      <ThreeSectionPage
        title="设备电子档案"
        breadcrumbs="设备管理 / 设备电子档案"
        stats={stats}
        filter={filterNode}
        actions={actions}
        table={
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
            {renderMasterDetail()}
          </div>
        }
      />

      {/* 上传 Modal */}
      <Modal
        title="上传设备文档"
        open={uploadVisible}
        onOk={handleUploadSubmit}
        confirmLoading={uploadSubmitting}
        onCancel={() => setUploadVisible(false)}
        okText="上传"
        cancelText="取消"
        width={680}
        destroyOnHidden
      >
        <Form form={uploadForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="设备" name="device_id" rules={[{ required: true, message: '请选择设备' }]}>
                <Select
                  showSearch
                  placeholder="请选择设备"
                  optionFilterProp="label"
                  options={devices.map(d => ({
                    label: `${d.device_name || ''}${d.device_code ? ' (' + d.device_code + ')' : ''}`,
                    value: d.device_id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="文档类型" name="doc_type" rules={[{ required: true, message: '请选择文档类型' }]}>
                <Select placeholder="请选择文档类型" options={DOC_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="文档名称" name="doc_name" rules={[{ required: true, message: '请填写文档名称' }]}>
                <Input placeholder="如：使用说明书、合格证、维修报告" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="版本号" name="version" rules={[{ required: true, message: '请填写版本号' }]}>
                <Input placeholder="如：v1" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="有效期至" name="valid_until">
                <DatePicker style={{ width: '100%' }} placeholder="如：质保截止" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="关联工单号" name="related_order">
                <Input placeholder="故障/维护/校准工单号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" name="remarks">
                <Input placeholder="可填写备注" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="文件"
            extra="支持 PDF/Word/Excel/图片/压缩包，单文件最大 50MB；可多选。命名规范：{类型}_{设备编号}_{名称}_{版本}_{日期}.ext"
          >
            <Upload.Dragger
              fileList={fileList}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.txt,.zip,.rar"
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">支持单次多文件上传</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑 Modal */}
      <Modal
        title="编辑文档信息"
        open={editVisible}
        onOk={handleEditSubmit}
        confirmLoading={editSubmitting}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        width={620}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="设备" name="device_id" rules={[{ required: true, message: '请选择设备' }]}>
                <Select
                  showSearch
                  placeholder="请选择设备"
                  optionFilterProp="label"
                  options={devices.map(d => ({
                    label: `${d.device_name || ''}${d.device_code ? ' (' + d.device_code + ')' : ''}`,
                    value: d.device_id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="文档名称" name="doc_name" rules={[{ required: true, message: '请填写文档名称' }]}>
                <Input placeholder="请填写文档名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="版本号" name="version" rules={[{ required: true, message: '请填写版本号' }]}>
                <Input placeholder="如：v1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="关联工单号" name="related_order">
                <Input placeholder="工单号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="有效期至" name="valid_until">
                <DatePicker style={{ width: '100%' }} placeholder="质保截止" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={3} placeholder="可填写备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="文档详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={640}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {detailDoc && (
            <div>
              <Tabs
                defaultActiveKey="info"
                items={[
                  {
                    key: 'info',
                    label: '基础信息',
                    children: (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        <div><Text type="secondary">设备名称：</Text>{detailDoc.device_name || '-'}</div>
                        <div><Text type="secondary">设备编号：</Text>{detailDoc.device_code || '-'}</div>
                        <div><Text type="secondary">文档类型：</Text>{detailDoc.doc_type_name || DOC_TYPE_MAP[detailDoc.doc_type] || detailDoc.doc_type}</div>
                        <div><Text type="secondary">文档名称：</Text>{detailDoc.doc_name || '-'}</div>
                        <div><Text type="secondary">版本：</Text>{detailDoc.version || '-'}</div>
                        <div><Text type="secondary">格式：</Text>{detailDoc.file_format ? detailDoc.file_format.toUpperCase() : '-'}</div>
                        <div><Text type="secondary">大小：</Text>{detailDoc.file_size_text || '-'}</div>
                        <div><Text type="secondary">关联工单：</Text>{detailDoc.related_order || '-'}</div>
                        <div><Text type="secondary">有效期至：</Text>{detailDoc.valid_until || '-'}</div>
                        <div><Text type="secondary">上传人：</Text>{detailDoc.uploaded_by_name || '-'}</div>
                        <div><Text type="secondary">上传时间：</Text>{detailDoc.created_at ? dayjs(detailDoc.created_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
                        <div><Text type="secondary">更新时间：</Text>{detailDoc.updated_at ? dayjs(detailDoc.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
                        <div style={{ gridColumn: 'span 2' }}><Text type="secondary">备注：</Text>{detailDoc.remarks || '-'}</div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <Space>
                            <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadDocument(detailDoc, message)}>下载</Button>
                            {isPreviewable(detailDoc.file_format) && (
                              <Button size="small" icon={<EyeOutlined />} onClick={() => previewDocument(detailDoc)}>预览</Button>
                            )}
                          </Space>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'preview',
                    label: '文件预览',
                    children: renderDetailPreview(),
                  },
                ]}
              />
            </div>
          )}
        </Spin>
      </Drawer>
    </>
  )
}
