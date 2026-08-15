import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Table, Tag, Progress, Alert, message } from 'antd'
import {
  DashboardOutlined, ArrowUpOutlined, ArrowDownOutlined, PercentageOutlined,
} from '@ant-design/icons'
import * as echarts from 'echarts'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { devices } from '../../mock/data'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'

// 各设备 OEE 基准指标（百分比）
const baseRates = {
  d1: { availability: 92, performance: 88, quality: 96 },
  d2: { availability: 95, performance: 92, quality: 98 },
  d3: { availability: 78, performance: 85, quality: 94 },
  d4: { availability: 65, performance: 80, quality: 90 },
}

const clamp = (v) => Math.max(0, Math.min(100, v))

// 根据 OEE 判定状态
const getStatus = (oee) => oee >= 85 ? '优秀' : oee >= 70 ? '良好' : oee >= 60 ? '一般' : '预警'
const statusColorMap = { '优秀': 'green', '良好': 'blue', '一般': 'orange', '预警': 'red' }

// 根据月份范围计算偏移因子
const getFactorByRange = (range: any) => {
  if (!range || !range[0] || !range[1]) return { a: 0, p: 0, q: 0 }
  const months = range[1].endOf('month').diff(range[0].startOf('month'), 'month') + 1
  if (months <= 1) return { a: 0, p: 0, q: 0 }
  if (months <= 3) return { a: 1, p: 1, q: 0 }
  if (months <= 6) return { a: 2, p: 1, q: 1 }
  return { a: 3, p: 2, q: 1 }
}

export default function DeviceOEE() {
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)
  const chartRef = useRef(null)

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  // 日期验证
  useEffect(() => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
      }
      setRangeWarn(!!check.warn)
    } else {
      setRangeWarn(false)
    }
  }, [dateRange])

  // 根据时间范围计算各设备 OEE 数据
  const oeeData = useMemo(() => {
    const f = getFactorByRange(dateRange)
    return devices.map(d => {
      const b = baseRates[d.device_id]
      const availability = clamp(b.availability + f.a)
      const performance = clamp(b.performance + f.p)
      const quality = clamp(b.quality + f.q)
      // OEE = 可用率 × 性能率 × 质量率（百分比相乘后除以 10000）
      const oee = +(availability * performance * quality / 10000).toFixed(1)
      return { device_id: d.device_id, device_name: d.device_name, device_type: d.device_type, availability, performance, quality, oee }
    })
  }, [dateRange])

  // 统计数据
  const avgOee = +(oeeData.reduce((s, d) => s + d.oee, 0) / oeeData.length).toFixed(1)
  const maxDevice = oeeData.reduce((m, d) => d.oee > m.oee ? d : m, oeeData[0])
  const minDevice = oeeData.reduce((m, d) => d.oee < m.oee ? d : m, oeeData[0])
  const avgAvailability = +(oeeData.reduce((s, d) => s + d.availability, 0) / oeeData.length).toFixed(1)

  const stats: StatItem[] = [
    { label: '平均OEE', value: `${avgOee}%`, icon: <DashboardOutlined />, color: '#2196F3' },
    { label: `最高OEE · ${maxDevice.device_name}`, value: `${maxDevice.oee}%`, icon: <ArrowUpOutlined />, color: '#4CAF50' },
    { label: `最低OEE · ${minDevice.device_name}`, value: `${minDevice.oee}%`, icon: <ArrowDownOutlined />, color: '#F44336' },
    { label: '平均可用率', value: `${avgAvailability}%`, icon: <PercentageOutlined />, color: '#FF9800' },
  ]

  const handleReset = () => {
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  const filters: FilterItem[] = [
    { type: 'select', placeholder: '快速选择月份', options: MONTH_QUICK_OPTIONS, value: monthQuick || undefined, onChange: handleMonthQuick, col: { span: 6 } },
    { type: 'rangepicker', value: dateRange, onChange: handleRangeChange, col: { span: 8 } },
  ]

  // OEE 颜色
  const oeeColor = (oee) => {
    const st = getStatus(oee)
    return { '优秀': '#4CAF50', '良好': '#2196F3', '一般': '#FF9800', '预警': '#F44336' }[st]
  }

  // ECharts 柱状图：各设备 可用率/性能率/质量率 对比
  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const rootStyle = getComputedStyle(document.documentElement)
    const subColor = rootStyle.getPropertyValue('--text-secondary').trim() || '#757575'
    const splitColor = rootStyle.getPropertyValue('--border-color').trim() || '#E0E0E0'

    chart.setOption({
      color: ['#2196F3', '#00BCD4', '#4CAF50'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => `${v}%`,
      },
      legend: { data: ['可用率', '性能率', '质量率'], top: 0, textStyle: { color: subColor } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: oeeData.map(d => d.device_name),
        axisLabel: { color: subColor, interval: 0 },
        axisLine: { lineStyle: { color: splitColor } },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: subColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: [
        { name: '可用率', type: 'bar', barMaxWidth: 30, data: oeeData.map(d => d.availability), itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: '性能率', type: 'bar', barMaxWidth: 30, data: oeeData.map(d => d.performance), itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: '质量率', type: 'bar', barMaxWidth: 30, data: oeeData.map(d => d.quality), itemStyle: { borderRadius: [4, 4, 0, 0] } },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [oeeData])

  const columns = [
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150 },
    {
      title: '可用率', dataIndex: 'availability', key: 'availability', width: 180,
      render: v => <Progress percent={v} size="small" strokeColor="#2196F3" format={p => `${p}%`} />,
    },
    {
      title: '性能率', dataIndex: 'performance', key: 'performance', width: 180,
      render: v => <Progress percent={v} size="small" strokeColor="#00BCD4" format={p => `${p}%`} />,
    },
    {
      title: '质量率', dataIndex: 'quality', key: 'quality', width: 180,
      render: v => <Progress percent={v} size="small" strokeColor="#4CAF50" format={p => `${p}%`} />,
    },
    {
      title: 'OEE', dataIndex: 'oee', key: 'oee', width: 180,
      render: v => <Progress percent={v} size="small" strokeColor={oeeColor(v)} format={p => `${p}%`} />,
    },
    {
      title: '状态', key: 'status', width: 100,
      render: (_, r) => { const st = getStatus(r.oee); return <Tag color={statusColorMap[st]}>{st}</Tag> },
    },
  ]

  return (
    <ThreeSectionPage
      title="设备OEE"
      breadcrumbs="设备管理 / 设备OEE"
      stats={stats}
      filters={filters}
      onReset={handleReset}
      actions={<ActionButtons hasAdd={false} />}
      table={
        <div>
          {rangeWarn && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
          )}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>各设备OEE指标对比</div>
            <div ref={chartRef} style={{ width: '100%', height: 320 }} />
          </div>
          <ResizableTable tableKey="pages_device_DeviceOEE"             columns={columns}
            dataSource={oeeData}
            rowKey="device_id"
            size="small"
            pagination={false}
          />
        </div>
      }
    />
  )
}
