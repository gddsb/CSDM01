import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Row, Col, Switch, Drawer, Descriptions, Space, Upload } from 'antd'
import {
  ImportOutlined, ToolOutlined, DeleteOutlined,
  EditOutlined, PlusOutlined, EyeOutlined, SearchOutlined, ReloadOutlined, PictureOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { defectTypes as defectData, processes } from '../../mock/data'

// 所属大类标签颜色映射
const typeColorMap = { '来料不良': 'blue', '制程不良': 'orange', '检验报废': 'red' }

const categoryOptions = ['来料不良', '制程不良', '检验报废'].map(c => ({ label: c, value: c }))
const severityOptions = ['轻微', '一般', '严重'].map(s => ({ label: s, value: s }))

// 大类编码映射
const typeCodeMap = { '来料不良': 'MAT', '制程不良': 'PRC', '检验报废': 'SCP' }

// 工序选项
const processOptions = processes.map(p => ({ label: `${p.process_code} ${p.process_name}`, value: p.process_id }))

// 自动生成不良编码
const genDefectCode = (defectType, existingData) => {
  const prefix = 'D-' + typeCodeMap[defectType]
  const sameType = existingData.filter(d => d.defect_type === defectType)
  const maxNo = sameType.reduce((max, d) => {
    const match = d.defect_code?.match(/-(\d+)$/)
    return match ? Math.max(max, parseInt(match[1])) : max
  }, 0)
  const nextNo = String(maxNo + 1).padStart(2, '0')
  return `${prefix}-${nextNo}`
}

export default function DefectManagement() {
  const [data, setData] = useState(defectData)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [form] = Form.useForm()

  // 筛选状态
  const [filterCode, setFilterCode] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProcess, setFilterProcess] = useState('')
  const [uploadImages, setUploadImages] = useState([])

  const incomingCount = data.filter(d => d.defect_type === '来料不良').length
  const processCount = data.filter(d => d.defect_type === '制程不良').length
  const scrapCount = data.filter(d => d.defect_type === '检验报废').length

  const stats = [
    { label: '来料不良数', value: incomingCount, icon: <ImportOutlined />, color: '#2196F3' },
    { label: '制程不良数', value: processCount, icon: <ToolOutlined />, color: '#FF9800' },
    { label: '检验报废数', value: scrapCount, icon: <DeleteOutlined />, color: '#F44336' },
  ]

  // 筛选后的数据
  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (filterCode && !d.defect_code?.toLowerCase().includes(filterCode.toLowerCase())) return false
      if (filterType && d.defect_type !== filterType) return false
      if (filterName && !d.defect_name?.includes(filterName)) return false
      if (filterStatus && d.status !== filterStatus) return false
      if (filterProcess) {
        const related = d.related_processes || []
        if (!related.includes(filterProcess)) return false
      }
      return true
    })
  }, [data, filterCode, filterType, filterName, filterStatus, filterProcess])

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setUploadImages([])
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      defect_category: record.defect_type,
      related_processes: record.related_processes || [],
    })
    setUploadImages(record.defect_images || [])
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(d => editing.defect_id === d.defect_id ? {
          ...d,
          defect_code: values.defect_code,
          defect_name: values.defect_name,
          defect_type: values.defect_category,
          severity: values.severity,
          description: values.description,
          defect_unit: values.defect_unit || d.defect_unit,
          available_units: values.available_units ? values.available_units.split(',').map(u => u.trim()) : d.available_units,
          display: !!values.display,
          sort_order: values.sort_order ? parseInt(values.sort_order) : d.sort_order,
          related_processes: values.related_processes || [],
          defect_description: values.defect_description || '',
          defect_images: uploadImages,
        } : d))
        message.success('不良项编辑成功')
      } else {
        const autoCode = genDefectCode(values.defect_category, data)
        const newDefect = {
          defect_id: 'df' + Date.now(),
          defect_code: autoCode,
          defect_name: values.defect_name,
          defect_type: values.defect_category,
          severity: values.severity,
          description: values.description,
          defect_unit: values.defect_unit || '个',
          available_units: values.available_units ? values.available_units.split(',').map(u => u.trim()) : ['个'],
          display: !!values.display,
          sort_order: values.sort_order ? parseInt(values.sort_order) : data.length + 1,
          status: values.status || '启用',
          related_processes: values.related_processes || [],
          defect_description: values.defect_description || '',
          defect_images: uploadImages,
        }
        setData(prev => [newDefect, ...prev])
        message.success('不良项新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 100, fixed: 'left' },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: '不良名称', dataIndex: 'defect_name', key: 'defect_name', width: 100 },
    { title: '默认单位', dataIndex: 'defect_unit', key: 'defect_unit', width: 60 },
    {
      title: '关联工序', dataIndex: 'related_processes', key: 'related_processes', width: 150,
      render: v => {
        if (!v || v.length === 0) return <Tag color="default">全部工序</Tag>
        return (
          <Space size="small" wrap>
            {v.map(pid => {
              const p = processes.find(proc => proc.process_id === pid)
              return p ? <Tag key={pid} color="cyan">{p.process_name}</Tag> : null
            })}
          </Space>
        )
      },
    },
    {
      title: '不良描述', dataIndex: 'defect_description', key: 'defect_description', width: 200,
      render: v => <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{v || '-'}</div>,
    },
    {
      title: '展示图片', dataIndex: 'defect_images', key: 'defect_images', width: 80, align: 'center',
      render: v => {
        const count = (v || []).length
        return count > 0 ? (
          <Tag icon={<PictureOutlined />}>{count}张</Tag>
        ) : '-'
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100, fixed: 'right',
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="制程不良分类"
        breadcrumbs="基础数据 / 制程不良分类"
        stats={stats}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <>
            {/* 筛选区域 */}
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={4}>
                <Input placeholder="不良编码" allowClear value={filterCode} onChange={e => setFilterCode(e.target.value)} />
              </Col>
              <Col span={4}>
                <Select placeholder="所属大类" allowClear style={{ width: '100%' }} value={filterType || undefined} onChange={v => setFilterType(v || '')} options={categoryOptions} />
              </Col>
              <Col span={4}>
                <Input placeholder="不良名称" allowClear value={filterName} onChange={e => setFilterName(e.target.value)} />
              </Col>
              <Col span={4}>
                <Select placeholder="状态" allowClear style={{ width: '100%' }} value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')} options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
              </Col>
              <Col span={4}>
                <Select placeholder="关联工序" allowClear style={{ width: '100%' }} value={filterProcess || undefined} onChange={v => setFilterProcess(v || '')} options={processOptions} />
              </Col>
              <Col span={4}>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={() => {}}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setFilterCode(''); setFilterType(''); setFilterName(''); setFilterStatus(''); setFilterProcess('') }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="defect_id"
              size="small"
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </>
        }
      />
      <Modal
        title={editing ? '编辑不良项' : '新增不良项'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={780}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="defect_code" label="不良编码">
                <Input placeholder="自动生成" disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_name" label="不良名称" rules={[{ required: true, message: '请输入不良名称' }]}>
                <Input placeholder="请输入不良名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_category" label="不良类别" rules={[{ required: true, message: '请选择不良类别' }]}>
                <Select placeholder="请选择不良类别" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="severity" label="严重等级" rules={[{ required: true, message: '请选择严重等级' }]}>
                <Select placeholder="请选择严重等级" options={severityOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_unit" label="默认单位" rules={[{ required: true, message: '请输入默认单位' }]}>
                <Input placeholder="如：个、处、片" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="available_units" label="可选单位（逗号分隔）" rules={[{ required: true, message: '请输入可选单位' }]}>
                <Input placeholder="如：个,处 或 个" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="display" label="默认显示" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态" options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="related_processes" label="关联工序">
            <Select
              mode="multiple"
              placeholder="请选择关联工序（未选择则在所有工序可用）"
              options={processOptions}
              allowClear
            />
          </Form.Item>
          <Form.Item name="defect_description" label="不良描述">
            <Input.TextArea placeholder="请输入不良描述" rows={3} />
          </Form.Item>
          <Form.Item label="展示图片（最多10张）">
            <Upload
              listType="picture-card"
              fileList={uploadImages}
              onChange={({ fileList }) => {
                if (fileList.length <= 10) setUploadImages(fileList)
                else message.warning('最多上传10张图片')
              }}
              beforeUpload={(file) => {
                // 自动重命名：不良编码-流水码
                const code = form.getFieldValue('defect_code') || 'D-NEW'
                const seq = String((uploadImages.length + 1)).padStart(2, '0')
                const ext = file.name.split('.').pop()
                Object.defineProperty(file, 'name', { value: `${code}-${seq}.${ext}` })
                return false
              }}
              accept="image/*"
            >
              {uploadImages.length < 10 && <PlusOutlined />}
            </Upload>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              上传后自动命名为：不良编码-两位流水码
            </div>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="查看不良项"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={480}
      >
        {viewRecord && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="不良编码">{viewRecord.defect_code}</Descriptions.Item>
            <Descriptions.Item label="不良名称">{viewRecord.defect_name}</Descriptions.Item>
            <Descriptions.Item label="所属大类">
              <Tag color={typeColorMap[viewRecord.defect_type]}>{viewRecord.defect_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重等级">{viewRecord.severity || '-'}</Descriptions.Item>
            <Descriptions.Item label="默认单位">{viewRecord.defect_unit}</Descriptions.Item>
            <Descriptions.Item label="可选单位">{Array.isArray(viewRecord.available_units) ? viewRecord.available_units.join('、') : viewRecord.available_units}</Descriptions.Item>
            <Descriptions.Item label="默认显示">{viewRecord.display ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            <Descriptions.Item label="关联工序" span={2}>
              {(!viewRecord.related_processes || viewRecord.related_processes.length === 0)
                ? <Tag color="default">全部工序</Tag>
                : viewRecord.related_processes.map(pid => {
                    const p = processes.find(proc => proc.process_id === pid)
                    return p ? <Tag key={pid} color="cyan">{p.process_name}</Tag> : null
                  })}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={viewRecord.status === '启用' ? 'green' : 'red'}>{viewRecord.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="展示图片">
              {(viewRecord.defect_images || []).length > 0
                ? <Tag icon={<PictureOutlined />}>{viewRecord.defect_images.length}张</Tag>
                : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="不良描述" span={2}>
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{viewRecord.defect_description || '-'}</div>
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{viewRecord.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
