import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Tabs, Form, Input, InputNumber, Select, Button, Space, Tag, message } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, CalendarOutlined, SettingOutlined, ClockCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const M = message

/** ============= 工具 ============= */

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

function pad(n: number) { return n < 10 ? '0' + n : String(n) }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function parseDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 获取某年月的日期网格（6x7=42格） */
function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startWeekday = firstDay.getDay() // 0=Sun
  const result: Date[] = []
  for (let i = startWeekday - 1; i >= 0; i--) {
    result.push(new Date(year, month - 1, -i))
  }
  for (let d = 1; d <= daysInMonth; d++) {
    result.push(new Date(year, month - 1, d))
  }
  while (result.length < 42) {
    const last = result[result.length - 1]
    result.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
  }
  return result
}

/** ============= Tab2: 休息时间默认值 ============= */

interface BreakPattern { start: string; end: string }

function BreakTimeTab() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config')
      const raw = res.data?.default_break_times
      let patterns: BreakPattern[] = []
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed)) patterns = parsed
        } catch { /* ignore */ }
      }
      if (patterns.length === 0) {
        patterns = [{ start: '12:00', end: '13:00' }, { start: '18:00', end: '18:30' }]
      }
      form.setFieldsValue({ patterns })
    } catch (e: unknown) {
      M.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const patterns: BreakPattern[] = (values.patterns || []).filter(
        (p: BreakPattern) => p?.start && p?.end
      )
      setSaving(true)
      await api.put('/system/config', {
        default_break_times: JSON.stringify(patterns),
      })
      M.success(`已保存 ${patterns.length} 条默认休息时间段（新建报工单时自动展开）`)
      await loadData()
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] })?.errorFields) return
      M.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const timeValidator = (_: unknown, value: string) => {
    if (!value) return Promise.resolve()
    if (!/^\d{1,2}:\d{2}$/.test(value)) return Promise.reject(new Error('格式 HH:mm'))
    const [h, m] = value.split(':').map(Number)
    if (h > 23 || m > 59) return Promise.reject(new Error('时间无效'))
    return Promise.resolve()
  }

  return (
    <Card size="small" loading={loading}>
      <div style={{ marginBottom: 12, color: '#666', fontSize: 13, lineHeight: 1.8 }}>
        设置系统默认休息时间段（HH:mm 格式）。<br />
        <span style={{ color: '#1677ff' }}>新建报工单时将根据报工日期自动展开为具体的休息记录</span>，
        人工工时/停线异常的净时长计算会自动扣除重叠的休息时间。
      </div>
      <Form form={form} layout="vertical">
        <Form.List name="patterns">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#666', minWidth: 60, flexShrink: 0 }}>休息{name + 1}:</span>
                  <Form.Item {...restField} name={[name, 'start']} rules={[{ required: true, message: '开始时间' }, { validator: timeValidator }]} style={{ marginBottom: 0 }}>
                    <Input placeholder="12:00" style={{ width: 96 }} />
                  </Form.Item>
                  <span style={{ color: '#999' }}>—</span>
                  <Form.Item {...restField} name={[name, 'end']} rules={[{ required: true, message: '结束时间' }, { validator: timeValidator }]} style={{ marginBottom: 0 }}>
                    <Input placeholder="13:00" style={{ width: 96 }} />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => remove(name)}
                    disabled={fields.length <= 1}
                  >删除</Button>
                </div>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ start: '', end: '' })}
                icon={<PlusOutlined />}
                style={{ width: 260 }}
              >
                添加休息时间段
              </Button>
            </>
          )}
        </Form.List>
      </Form>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存默认休息时间
        </Button>
      </div>
    </Card>
  )
}

/** ============= Tab3: 休息日管理 ============= */

interface HolidayItem {
  holiday_date: string
  holiday_name?: string
  is_workday: number // 0=真休跳过维保, 1=调休上班
}

function HolidayTab() {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1
  const nextYear = curMonth === 12 ? curYear + 1 : curYear
  const nextMonth = curMonth === 12 ? 1 : curMonth + 1
  const todayStr = toDateStr(now)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [holidays, setHolidays] = useState<Map<string, HolidayItem>>(new Map())

  /** 解析某日实际状态：优先用显式标记，否则周一~五默认上班、周六日默认休息 */
  const resolveDayStatus = (date: Date, h?: HolidayItem): { isRest: boolean; source: 'explicit' | 'default' } => {
    if (h) return { isRest: h.is_workday === 0, source: 'explicit' }
    const wd = date.getDay() // 0=Sun, 6=Sat
    return { isRest: wd === 0 || wd === 6, source: 'default' }
  }

  const loadHolidays = useCallback(async () => {
    setLoading(true)
    try {
      const [resCur, resNext] = await Promise.all([
        api.get('/production/holidays', { params: { year: curYear, month: curMonth } }),
        api.get('/production/holidays', { params: { year: nextYear, month: nextMonth } }),
      ])
      const map = new Map<string, HolidayItem>()
      const listCur = ((resCur.data?.list || resCur.data) as HolidayItem[]) || []
      const listNext = ((resNext.data?.list || resNext.data) as HolidayItem[]) || []
      ;[...listCur, ...listNext].forEach(h => map.set(h.holiday_date, h))
      setHolidays(map)
    } catch (e: unknown) {
      M.error(e instanceof Error ? e.message : '加载休息日失败')
    } finally {
      setLoading(false)
    }
  }, [curYear, curMonth, nextYear, nextMonth])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  /** 循环切换：默认工作日→休、默认休息日→班、再点恢复默认 */
  const toggleDay = (dateStr: string, date: Date) => {
    const today = new Date(todayStr + 'T00:00:00')
    if (date.getTime() < today.getTime()) {
      M.warning('不能设置过去的日期')
      return
    }
    const newMap = new Map(holidays)
    const existing = newMap.get(dateStr)
    const { isRest: defaultRest } = resolveDayStatus(date)

    if (!existing) {
      // 无显式标记：第一次点，反默认
      if (defaultRest) {
        // 默认休息日 → 标成"调休上班"
        newMap.set(dateStr, { holiday_date: dateStr, holiday_name: '调休上班', is_workday: 1 })
      } else {
        // 默认工作日 → 标成"休息"
        newMap.set(dateStr, { holiday_date: dateStr, holiday_name: '休息', is_workday: 0 })
      }
    } else if (existing.is_workday === 0) {
      // 已标休息 → 改成调休上班
      newMap.set(dateStr, { ...existing, is_workday: 1, holiday_name: existing.holiday_name || '调休上班' })
    } else {
      // 已标调休上班 → 恢复默认
      newMap.delete(dateStr)
    }
    setHolidays(newMap)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const records = Array.from(holidays.values())
      await api.post('/production/holidays/batch', { records })
      M.success('休息日保存成功，维保计划已自动重新生成')
      await loadHolidays()
    } catch (e: unknown) {
      M.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const renderMonth = (year: number, month: number) => {
    const grid = getMonthGrid(year, month)
    const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
    return (
      <div style={{ flex: 1, minWidth: 340 }}>
        <div style={{ textAlign: 'center', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
          {year} 年 {month} 月
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {weekdayLabels.map(w => (
            <div key={w} style={{ textAlign: 'center', padding: '4px 0', color: '#999', fontSize: 12 }}>{w}</div>
          ))}
          {grid.map((d, idx) => {
            const ds = toDateStr(d)
            const inMonth = d.getMonth() === month - 1
            const isToday = ds === todayStr
            const h = holidays.get(ds)
            const isPast = parseDateStr(ds).getTime() < parseDateStr(todayStr).getTime()
            const { isRest, source } = resolveDayStatus(d, h)

            let bg = inMonth ? '#fff' : '#fafafa'
            let color = inMonth ? 'inherit' : '#ccc'
            let border = '1px solid #f0f0f0'
            let badgeText: React.ReactNode = null
            let badgeColor = ''
            let cursor = 'pointer'

            if (isPast) { cursor = 'not-allowed'; color = '#ccc'; bg = '#f9f9f9' }
            else if (source === 'explicit') {
              if (h!.is_workday === 0) {
                bg = '#fff1f0'; border = '1px solid #ffa39e'
                badgeText = <span style={{ color: '#cf1322', fontWeight: 600 }}>休</span>
              } else {
                bg = '#e6f4ff'; border = '1px solid #91caff'
                badgeText = <span style={{ color: '#0958d9', fontWeight: 600 }}>班</span>
              }
            } else {
              // 默认状态（无显式标记）
              if (isRest) {
                bg = '#fafafa'
                badgeText = <span style={{ color: '#bbb', fontWeight: 500 }}>休</span>
              } else {
                // 默认上班不显示 badge，保持干净
              }
            }
            if (isToday) border = '2px solid #1677ff'

            const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六']
            const weekday = weekDayLabels[d.getDay()]
            const dayTip = isPast ? '过去日期不可修改'
              : source === 'explicit'
                ? `${h?.holiday_name || ''}（${h!.is_workday === 0 ? '显式休息' : '调休上班'}）`
                : isRest ? '默认休息日（周六/周日），点击标记调休上班'
                : `默认工作日（周${weekday}），点击标记休息`

            return (
              <div
                key={idx}
                onClick={() => toggleDay(ds, d)}
                title={dayTip}
                style={{
                  padding: '6px 8px',
                  minHeight: 44,
                  border,
                  borderRadius: 4,
                  background: bg,
                  color,
                  cursor,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 13 }}>{d.getDate()}</span>
                {badgeText}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined />
          <span>本月 + 下月 休息日管理</span>
        </div>
      }
      extra={
        <Space>
          <Button onClick={loadHolidays} loading={loading}>刷新</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 12, color: '#666', fontSize: 13, lineHeight: 1.8 }}>
        点击日期循环切换：
        <Tag color="red">休</Tag> 跳过维保计划
        &nbsp;
        <Tag color="blue">班</Tag> 调休上班（不跳过）
        &nbsp;— 灰色为过去日期不可修改。保存后维保计划自动重新生成。
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {renderMonth(curYear, curMonth)}
        {renderMonth(nextYear, nextMonth)}
      </div>
    </Card>
  )
}

/** ============= 主页面 ============= */

export default function ProductionSettings() {
  const [form] = Form.useForm()
  const [lineOptions, setLineOptions] = useState<{ label: string; value: string }[]>([])
  const [saving, setSaving] = useState(false)

  const loadProdConfig = useCallback(async () => {
    try {
      const res = await api.get('/system/config')
      const cfg = res.data || {}
      const values: Record<string, unknown> = {}
      if (cfg.default_line != null && cfg.default_line !== '') values.default_line = String(cfg.default_line)
      if (cfg.standard_hours != null && cfg.standard_hours !== '') values.standard_hours = Number(cfg.standard_hours)
      if (cfg.shift_setting != null) {
        values.shift_setting = typeof cfg.shift_setting === 'string'
          ? cfg.shift_setting.split(',').map(s => s.trim()).filter(Boolean)
          : cfg.shift_setting
        if (!Array.isArray(values.shift_setting) || values.shift_setting.length === 0) values.shift_setting = ['白班']
      } else {
        values.shift_setting = ['白班']
      }
      form.setFieldsValue(values)
    } catch (e: unknown) {
      M.error(e instanceof Error ? e.message : '加载生产参数失败')
    }
  }, [form])

  const loadLines = useCallback(async () => {
    try {
      const res = await api.get('/basic/production-lines?status=1')
      const list = res.data?.list || res.data || []
      setLineOptions(
        list.map((l: { line_name?: string; line_code?: string }) => ({
          label: l.line_name || l.line_code || '',
          value: l.line_name || l.line_code || '',
        }))
      )
    } catch { /* ignore */ }
  }, [])

  const handleProdSave = useCallback(async () => {
    setSaving(true)
    try {
      const values = await form.validateFields()
      const payload: Record<string, unknown> = { ...values }
      if (Array.isArray(payload.shift_setting)) payload.shift_setting = payload.shift_setting.join(',')
      await api.put('/system/config', payload)
      M.success('生产参数保存成功')
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] })?.errorFields) return
      M.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }, [form])

  useEffect(() => { loadProdConfig(); loadLines() }, [loadProdConfig, loadLines])

  const items = useMemo(() => [
    {
      key: 'params',
      label: <span><SettingOutlined /> 生产参数</span>,
      children: (
        <Card size="small" title={null}>
          <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
            <Form.Item name="default_line" label="默认产线">
              <Select placeholder="报工单创建时默认填充的产线" allowClear options={lineOptions} style={{ width: 320 }} />
            </Form.Item>
            <Form.Item name="standard_hours" label="标准工时(h)" rules={[{ required: true, message: '请输入标准工时' }]}>
              <InputNumber min={1} max={24} step={0.5} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="shift_setting" label="启用班次" rules={[{ required: true, message: '请选择班次' }]}>
              <Select mode="multiple" placeholder="选择工厂启用的班次" options={shiftOptions} style={{ width: 320 }} />
            </Form.Item>
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleProdSave}>
                保存生产参数
              </Button>
            </div>
          </Form>
        </Card>
      ),
    },
    {
      key: 'breaktime',
      label: <span><ClockCircleOutlined /> 默认休息时间</span>,
      children: <BreakTimeTab />,
    },
    {
      key: 'holiday',
      label: <span><CalendarOutlined /> 休息日管理</span>,
      children: <HolidayTab />,
    },
  ], [form, lineOptions, saving, handleProdSave])

  return (
    <Card size="small" title="生产设置" bodyStyle={{ paddingTop: 8 }}>
      <Tabs items={items} destroyInactiveTabPane />
    </Card>
  )
}
