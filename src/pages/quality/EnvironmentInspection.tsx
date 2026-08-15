import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography, Select, DatePicker, Space, Row, Col, Input, Alert, message } from 'antd'
import {
  EnvironmentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { envInspections } from '../../mock/data'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text, Title } = Typography

// 环境检验检测项目模板（按检验区域分类）
const envItemTemplates: Record<string, any[]> = {
  '更衣室': [
    { item_name: '温度', standard_value: '18-26℃', unit: '℃' },
    { item_name: '相对湿度', standard_value: '45-65%', unit: '%' },
    { item_name: '沉降菌', standard_value: '≤15 CFU/皿', unit: 'CFU/皿' },
    { item_name: '表面微生物', standard_value: '≤25 CFU/25cm²', unit: 'CFU/25cm²' },
    { item_name: '紫外灯消毒记录', standard_value: '每日消毒≥30min', unit: '' },
  ],
  '一号车间': [
    { item_name: '温度', standard_value: '18-26℃', unit: '℃' },
    { item_name: '相对湿度', standard_value: '45-65%', unit: '%' },
    { item_name: '沉降菌', standard_value: '≤10 CFU/皿', unit: 'CFU/皿' },
    { item_name: '浮游菌', standard_value: '≤100 CFU/m³', unit: 'CFU/m³' },
    { item_name: '表面微生物', standard_value: '≤10 CFU/25cm²', unit: 'CFU/25cm²' },
    { item_name: '压差', standard_value: '≥10 Pa', unit: 'Pa' },
  ],
  'A线': [
    { item_name: '温度', standard_value: '20-25℃', unit: '℃' },
    { item_name: '相对湿度', standard_value: '50-60%', unit: '%' },
    { item_name: '沉降菌', standard_value: '≤5 CFU/皿', unit: 'CFU/皿' },
    { item_name: '表面微生物', standard_value: '≤5 CFU/25cm²', unit: 'CFU/25cm²' },
    { item_name: '设备清洁度', standard_value: '无可见污渍', unit: '' },
  ],
  'B线': [
    { item_name: '温度', standard_value: '20-25℃', unit: '℃' },
    { item_name: '相对湿度', standard_value: '50-60%', unit: '%' },
    { item_name: '沉降菌', standard_value: '≤5 CFU/皿', unit: 'CFU/皿' },
    { item_name: '表面微生物', standard_value: '≤5 CFU/25cm²', unit: 'CFU/25cm²' },
    { item_name: '设备清洁度', standard_value: '无可见污渍', unit: '' },
  ],
}

function generateEnvActualValue(std: string, unit: string, passRate = 0.9) {
  const pass = Math.random() < passRate
  if (std.includes('≤')) {
    const num = parseFloat(std.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) {
      return { actual_value: pass ? '符合' : '不符合', judge: pass ? '合格' : '不合格' }
    }
    const actual = pass ? (num * 0.6 + Math.random() * num * 0.3) : (num * 1.1 + Math.random() * num * 0.3)
    return { actual_value: `${actual.toFixed(1)} ${unit}`.trim(), judge: actual <= num ? '合格' : '不合格' }
  }
  if (std.includes('-')) {
    const range = std.match(/([\d.]+)-([\d.]+)/)
    if (range) {
      const min = parseFloat(range[1])
      const max = parseFloat(range[2])
      const actual = pass ? (min + Math.random() * (max - min)) : (Math.random() < 0.5 ? min - 1 : max + 1)
      return { actual_value: `${actual.toFixed(1)} ${unit}`.trim(), judge: actual >= min && actual <= max ? '合格' : '不合格' }
    }
  }
  if (std.includes('≥')) {
    const num = parseFloat(std.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) {
      return { actual_value: pass ? '符合' : '不符合', judge: pass ? '合格' : '不合格' }
    }
    const actual = pass ? (num + Math.random() * 5) : (num - 1 - Math.random() * 3)
    return { actual_value: `${actual.toFixed(1)} ${unit}`.trim(), judge: actual >= num ? '合格' : '不合格' }
  }
  return { actual_value: pass ? '符合' : '不符合', judge: pass ? '合格' : '不合格' }
}

function getEnvItems(record: any) {
  const templates = envItemTemplates[record.area_name] || envItemTemplates['一号车间']
  return templates.map(tpl => {
    const { actual_value, judge } = generateEnvActualValue(tpl.standard_value, tpl.unit)
    return {
      item_name: tpl.item_name,
      standard_value: tpl.standard_value,
      actual_value,
      judge,
    }
  })
}

const resultColor = { '合格': 'success', '不合格': 'error' } as Record<string, string>
const triggerColor = { '自动': 'blue', '手工': 'purple' } as Record<string, string>
const statusColor = { '已完成': 'success', '检验中': 'processing' } as Record<string, string>

export default function EnvironmentInspection() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [currentItems, setCurrentItems] = useState<any[]>([])

  const [inspectionNo, setInspectionNo] = useState<any>(undefined)
  const [areaFilter, setAreaFilter] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const fetchData = useCallback(() => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        return
      }
      setRangeWarn(check.warn || false)
    } else {
      setRangeWarn(false)
    }
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    return envInspections.filter((r: any) => {
      if (inspectionNo && !r.inspection_no?.includes(inspectionNo)) return false
      if (areaFilter && r.area_name !== areaFilter) return false
      if (resultFilter && r.result !== resultFilter) return false
      if (dateRange && dateRange[0] && dateRange[1] && r.inspection_date) {
        const t = dayjs(r.inspection_date)
        if (!t.isAfter(dateRange[0].subtract(1, 'day')) || !t.isBefore(dateRange[1].add(1, 'day'))) {
          return false
        }
      }
      return true
    })
  }, [inspectionNo, areaFilter, resultFilter, dateRange])

  const passCount = filteredData.filter(i => i.result === '合格').length
  const failCount = filteredData.filter(i => i.result === '不合格').length
  const passRate = filteredData.length > 0
    ? Math.round((passCount / filteredData.length) * 100)
    : 0

  const stats: StatItem[] = [
    { label: '总检验数', value: filteredData.length, icon: <EnvironmentOutlined />, color: '#2196F3' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <CheckCircleOutlined />, color: '#00BCD4' },
  ]

  const areaOptions = useMemo(() => {
    const areas = Array.from(new Set(envInspections.map((i: any) => i.area_name)))
    return areas.map(a => ({ label: a, value: a }))
  }, [])

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const handleReset = () => {
    setInspectionNo(undefined)
    setAreaFilter(undefined)
    setResultFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  const showDetail = (record: any) => {
    setCurrent(record)
    setCurrentItems(getEnvItems(record))
    setDrawerOpen(true)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 160, fixed: 'left' as const },
    { title: '检验区域', dataIndex: 'area_name', key: 'area_name', width: 120 },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 100,
      render: (v: string) => <Tag color={triggerColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: (v: string) => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '纠正措施', dataIndex: 'correction_action', key: 'correction_action', width: 220,
      render: (v: string) => v ? v : <Text type="secondary">-</Text>
    },
    {
      title: '复查日期', dataIndex: 'recheck_date', key: 'recheck_date', width: 110,
      render: (v: string) => v || <Text type="secondary">-</Text>
    },
    {
      title: '复查结果', dataIndex: 'recheck_result', key: 'recheck_result', width: 100,
      render: (v: string) => v ? <Tag color={resultColor[v] || 'default'}>{v}</Tag> : <Text type="secondary">-</Text>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>查看详情</Button>
      )
    },
  ]

  const detailColumns = [
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value' },
    { title: '实测值', dataIndex: 'actual_value', key: 'actual_value' },
    {
      title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
      render: (v: string) => <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v}</Tag>
    },
  ]

  const filters = useMemo(() => [
    {
      type: 'input' as const,
      placeholder: '检验编号',
      icon: <SearchOutlined />,
      value: inspectionNo,
      onChange: (e: any) => setInspectionNo(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'select' as const,
      placeholder: '检验区域',
      options: areaOptions,
      value: areaFilter,
      onChange: setAreaFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '检验结果',
      options: [
        { label: '合格', value: '合格' },
        { label: '不合格', value: '不合格' },
      ],
      value: resultFilter,
      onChange: setResultFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '快速选择月份',
      options: MONTH_QUICK_OPTIONS,
      value: monthQuick || undefined,
      onChange: handleMonthQuick,
      col: { span: 4 },
    },
    {
      type: 'rangepicker' as const,
      value: dateRange,
      onChange: handleRangeChange,
      col: { span: 5 },
    },
  ], [inspectionNo, areaFilter, resultFilter, dateRange, monthQuick, areaOptions])

  return (
    <>
      <ThreeSectionPage
        title="环境检验"
        breadcrumbs="质量管理 / 环境检验"
        stats={stats}
        filters={filters}
        onSearch={fetchData}
        onReset={handleReset}
        actions={<ActionButtons />}
        table={
          <div>
            {rangeWarn && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态"
              />
            )}
            <ResizableTable tableKey="pages_quality_EnvironmentInspection"
              columns={columns}
              dataSource={filteredData}
              rowKey="inspection_id"
              size="small"
              scroll={{ x: 1400 }}
              pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
            />
          </div>
        }
      />
      <Drawer
        title="环境检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验区域">{current.area_name}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                <Tag color={triggerColor[current.trigger_type] || 'default'}>{current.trigger_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验日期">{current.inspection_date}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="复查日期">{current.recheck_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="复查结果">
                {current.recheck_result ? <Tag color={resultColor[current.recheck_result] || 'default'}>{current.recheck_result}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="纠正措施" span={2}>
                {current.correction_action || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <ResizableTable tableKey="pages_quality_EnvironmentInspection_detail"
              columns={detailColumns}
              dataSource={currentItems}
              rowKey={(r: any, i: number) => i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
