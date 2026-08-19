/**
 * 检验数据统一存储改造（阶段4.1-4.5）
 * 统一检验项目录入组件 InspectionItemEditor
 *
 * 设计目标：
 * - 三页面（来料/产品/微生物）共用
 * - 按 item_cfg 的 item_type（qualitative/quantitative）动态渲染
 * - qualitative：N 件 OK/NG 单选，写入 measure_value_text，判定自动计算
 * - quantitative（单值维度）：N 个 InputNumber，写入 measure_value_num，实时上下限红绿提示
 * - quantitative（多维度）：动态表格，行=sample_no，列=dimension_code
 * - 自动判定实时展示（红绿 Tag）+ 汇总 result 自动计算
 * - 旧 actual_value 只读展示（向后兼容历史数据，无 sample_values 时显示 actual_value）
 *
 * Props：
 *  - items: 受控 items 数组（来自页面 state inspectItems）
 *  - disabled?: 是否只读（详情页面用）
 *  - onChange?: (items) => void（保存回 state 触发 onChange）
 */
import React, { useMemo } from 'react'
import { Table, Input, InputNumber, Segmented, Tag, Space, Tooltip, Typography, Select } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

export interface SampleValue {
  value_id?: number
  sample_no: number
  dimension_code?: string
  dimension_name?: string
  measure_value_num?: number | null
  measure_value_text?: string | null
  is_qualified?: number | null // 0/1/null
  defect_desc?: string | null
  measured_at?: string | null
  inspector_id?: number | null
}

export interface InspectionItemRow {
  item_id?: number
  inspection_id?: number
  item_cfg_id?: number | null
  item_name: string
  category?: string | null
  standard_value?: string | null
  actual_value?: string | null // 旧字段，兼容历史数据只读展示
  sample_count?: number | null
  summary?: string | null
  result?: '合格' | '不合格' | string | null
  inspector_id?: number | null
  inspector_name?: string | null
  inspection_time?: string | null
  unit?: string | null
  sort_order?: number
  remarks?: string | null
  // 检验标准配置（stage1 回填字段），来自 item_cfg 或直接后端返回
  item_type?: 'qualitative' | 'quantitative' | string | null
  need_sample_count?: number | null
  nominal_value?: number | null
  upper_limit?: number | null
  lower_limit?: number | null
  // 样品测量值（stage3+ 返回的数据）
  sample_values?: SampleValue[]
}

interface Props {
  items: InspectionItemRow[]
  disabled?: boolean
  onChange?: (next: InspectionItemRow[]) => void
}

// ============================================================
//  单 sample_value 的判定（纯函数，与后端 SampleJudgeService 规则一致）
// ============================================================
function judgeSampleValue(
  sample: Pick<SampleValue, 'measure_value_num' | 'measure_value_text'>,
  cfg: { nominal_value?: number | null; upper_limit?: number | null; lower_limit?: number | null },
): number | null {
  const text = (sample.measure_value_text || '').trim()
  if (text) {
    const lower = text.toLowerCase()
    if (['ok', '合格', 'pass'].includes(lower) || text === 'OK') return 1
    if (['ng', '不合格', 'fail', '无'].some(kw => text.includes(kw))) return 0
    return null
  }
  const num = sample.measure_value_num
  if (num === null || num === undefined || Number.isNaN(Number(num))) return null
  const n = Number(num)
  const { upper_limit, lower_limit, nominal_value } = cfg
  if (upper_limit !== null && upper_limit !== undefined && n > Number(upper_limit)) return 0
  if (lower_limit !== null && lower_limit !== undefined && n < Number(lower_limit)) return 0
  if ((upper_limit === null || upper_limit === undefined) &&
      (lower_limit === null || lower_limit === undefined) &&
      nominal_value !== null && nominal_value !== undefined &&
      Math.abs(n - Number(nominal_value)) > 1e-9) {
    return 0
  }
  return 1
}

// 汇总 row.result（基于每个 sample_value 的 is_qualified）
function aggregateRowResult(svs: SampleValue[], rowResult: any): '合格' | '不合格' | any {
  let anyFail = false
  let allNull = true
  for (const sv of svs) {
    const judged = sv.is_qualified
    if (judged === 0 || judged === 1) {
      allNull = false
      if (judged === 0) anyFail = true
    }
  }
  if (allNull) return rowResult // 无 sample_value 用原 row.result（旧数据）
  return anyFail ? '不合格' : '合格'
}

// ============================================================
//  辅助：把 items 的 sample_values 规范化为 N 件
// ============================================================
function ensureSampleValues(
  row: InspectionItemRow,
  dimensionCode = 'VALUE',
): SampleValue[] {
  const raw = row.sample_values || []
  if (raw.length > 0) return raw
  const n = Number(row.need_sample_count) || 0
  const fallback = Number(row.sample_count) || 0
  const count = n > 0 ? n : (fallback > 0 ? fallback : 1)
  return Array.from({ length: count }, (_, i) => ({
    sample_no: i + 1,
    dimension_code: dimensionCode,
    measure_value_num: null,
    measure_value_text: null,
    is_qualified: null,
  }))
}

// 工具函数：更新 items[rowIdx].sample_values 后同步更新 row.result
function applyUpdate(
  items: InspectionItemRow[],
  rowIdx: number,
  mutator: (row: InspectionItemRow) => void,
  onChange?: (next: InspectionItemRow[]) => void,
) {
  const next = items.map((r, i) => (i === rowIdx ? { ...r, sample_values: [...(r.sample_values || [])] } : r))
  mutator(next[rowIdx])
  const row = next[rowIdx]
  if (row.sample_values && row.sample_values.length > 0) {
    const cfg = {
      nominal_value: row.nominal_value ?? null,
      upper_limit: row.upper_limit ?? null,
      lower_limit: row.lower_limit ?? null,
    }
    // 对每个 sample_value 重算 is_qualified
    row.sample_values = row.sample_values.map(sv => ({
      ...sv,
      is_qualified: judgeSampleValue({ measure_value_num: sv.measure_value_num, measure_value_text: sv.measure_value_text }, cfg),
    }))
    // 汇总 row.result
    row.result = aggregateRowResult(row.sample_values, row.result)
  }
  onChange?.(next)
}

// ============================================================
//  单个 sample value 的渲染（qualitative 用 Segmented OK/NG）
// ============================================================
function QualitativeCell(props: {
  value: SampleValue
  onChange: (next: SampleValue) => void
  disabled?: boolean
}) {
  const { value, onChange, disabled } = props
  const text = (value.measure_value_text || '').trim()
  const selectValue = text === 'OK' || text === '合格' ? 1 : text === 'NG' || text === '不合格' ? 0 : undefined
  const color = value.is_qualified === 1 ? '#52c41a' : value.is_qualified === 0 ? '#ff4d4f' : undefined
  return (
    <Segmented
      size="small"
      disabled={disabled}
      value={selectValue}
      options={[
        {
          label: (
            <Space size={2}>
              <CheckCircleOutlined style={{ color: color || '#52c41a' }} />
              OK
            </Space>
          ),
          value: 1,
        },
        {
          label: (
            <Space size={2}>
              <CloseCircleOutlined style={{ color: color || '#ff4d4f' }} />
              NG
            </Space>
          ),
          value: 0,
        },
      ]}
      onChange={val => {
        if (disabled) return
        onChange({
          ...value,
          measure_value_text: val === 1 ? 'OK' : 'NG',
          measure_value_num: null,
        })
      }}
    />
  )
}

// 单个 sample value 的渲染（quantitative 单值维度用 InputNumber）
function QuantitativeCell(props: {
  value: SampleValue
  unit?: string | null
  cfg: { nominal_value?: number | null; upper_limit?: number | null; lower_limit?: number | null }
  onChange: (next: SampleValue) => void
  disabled?: boolean
}) {
  const { value, unit, cfg, onChange, disabled } = props
  const qualified = value.is_qualified
  const borderColor = qualified === 1 ? '#52c41a' : qualified === 0 ? '#ff4d4f' : undefined
  const hint = useMemo(() => {
    const parts: string[] = []
    if (cfg.lower_limit !== null && cfg.lower_limit !== undefined) parts.push(`≥${cfg.lower_limit}`)
    if (cfg.upper_limit !== null && cfg.upper_limit !== undefined) parts.push(`≤${cfg.upper_limit}`)
    if (cfg.nominal_value !== null && cfg.nominal_value !== undefined && parts.length === 0)
      parts.push(`=${cfg.nominal_value}`)
    return parts.join(' ~ ')
  }, [cfg.lower_limit, cfg.upper_limit, cfg.nominal_value])
  return (
    <Tooltip title={hint || '无上下限配置'} placement="topLeft">
      <InputNumber
        size="small"
        disabled={disabled}
        style={{ borderColor, boxShadow: borderColor ? `0 0 0 1px ${borderColor} inset` : undefined, width: 110 }}
        step={0.001}
        value={value.measure_value_num}
        addonAfter={unit || null}
        onChange={val => {
          if (disabled) return
          onChange({
            ...value,
            measure_value_num: val as any,
            measure_value_text: null,
          })
        }}
      />
    </Tooltip>
  )
}

// 合格标识 Tag
function QualifiedTag({ qualified }: { qualified: number | null }) {
  if (qualified === null || qualified === undefined) {
    return <Tag icon={<MinusCircleOutlined />} color="default">未判定</Tag>
  }
  return qualified === 1
    ? <Tag icon={<CheckCircleOutlined />} color="success">合格</Tag>
    : <Tag icon={<CloseCircleOutlined />} color="error">不合格</Tag>
}

// ============================================================
//  主组件
// ============================================================
export default function InspectionItemEditor(props: Props) {
  const { items, disabled, onChange } = props

  // 取 row 的 item_type（优先后端返回，null 则按 need_sample_count + standard_value 启发式推断）
  const getItemType = (row: InspectionItemRow): 'qualitative' | 'quantitative' => {
    if (row.item_type === 'quantitative' || row.item_type === 'qualitative') return row.item_type
    // 启发式：有 upper_limit/lower_limit/nominal_value → quantitative
    if (row.upper_limit !== null && row.upper_limit !== undefined) return 'quantitative'
    if (row.lower_limit !== null && row.lower_limit !== undefined) return 'quantitative'
    if (row.nominal_value !== null && row.nominal_value !== undefined) return 'quantitative'
    // 有 actual_value 且能 parse 成数字的比例高 → quantitative
    const av = (row.actual_value || '').toString()
    if (av && !isNaN(Number(av.trim()))) return 'quantitative'
    // 默认定性
    return 'qualitative'
  }

  // ============================================================
  //  1) qualitative 模式的渲染：N 件 × OK/NG
  //     用 expandable 子表格展示 N 件输入；父行展示 summary + result
  // ============================================================
  const expandedRowRender = (record: InspectionItemRow, rowIdx: number) => {
    const itemType = getItemType(record)
    const svs = ensureSampleValues(record)

    if (itemType === 'qualitative') {
      // 每行 5 件
      const cols = Math.min(5, svs.length)
      const rowsCount = Math.ceil(svs.length / cols) || 1
      return (
        <div style={{ padding: '8px 16px 8px 48px', background: '#fafafa', borderRadius: 4 }}>
          <Text type="secondary" style={{ marginRight: 12 }}>
            模式: 定性（{record.need_sample_count || svs.length} 件）
          </Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(160px, 1fr))`,
              gap: 12,
              marginTop: 8,
            }}
          >
            {svs.map((sv, j) => (
              <div
                key={j}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 4,
                  padding: 8,
                  background: '#fff',
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong>No.{sv.sample_no}</Text>
                  <QualitativeCell
                    value={sv}
                    disabled={disabled}
                    onChange={next => {
                      applyUpdate(items, rowIdx, row => {
                        row.sample_values = ensureSampleValues(row)
                        row.sample_values![j] = next
                      }, onChange)
                    }}
                  />
                  <QualifiedTag qualified={sv.is_qualified ?? null} />
                </Space>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // quantitative：单值维度（dimension_code='VALUE'）
    if (itemType === 'quantitative') {
      const cfg = {
        nominal_value: record.nominal_value ?? null,
        upper_limit: record.upper_limit ?? null,
        lower_limit: record.lower_limit ?? null,
      }
      const cols = Math.min(5, svs.length)
      const rowsCount = Math.ceil(svs.length / cols) || 1
      return (
        <div style={{ padding: '8px 16px 8px 48px', background: '#fafafa', borderRadius: 4 }}>
          <Text type="secondary" style={{ marginRight: 12 }}>
            模式: 定量（{record.need_sample_count || svs.length} 件，
            {cfg.lower_limit !== null && cfg.lower_limit !== undefined ? `下限 ${cfg.lower_limit}` : '下限 无'}，
            {cfg.upper_limit !== null && cfg.upper_limit !== undefined ? `上限 ${cfg.upper_limit}` : '上限 无'}
            {cfg.nominal_value !== null && cfg.nominal_value !== undefined ? `，标称 ${cfg.nominal_value}` : ''}）
          </Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(160px, 1fr))`,
              gap: 12,
              marginTop: 8,
            }}
          >
            {svs.map((sv, j) => (
              <div
                key={j}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 4,
                  padding: 8,
                  background: '#fff',
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong>No.{sv.sample_no}</Text>
                  <QuantitativeCell
                    value={sv}
                    unit={record.unit || null}
                    cfg={cfg}
                    disabled={disabled}
                    onChange={next => {
                      applyUpdate(items, rowIdx, row => {
                        row.sample_values = ensureSampleValues(row)
                        row.sample_values![j] = next
                      }, onChange)
                    }}
                  />
                  <QualifiedTag qualified={sv.is_qualified ?? null} />
                </Space>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  const columns: ColumnsType<InspectionItemRow> = [
    { title: '序号', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: '项目分类', dataIndex: 'category', width: 80,
      render: v => v || '-',
    },
    {
      title: '检验项目', dataIndex: 'item_name', width: 160,
      render: (v, r) => (
        <Space direction="vertical" size={2}>
          <span>{v || '-'}</span>
          {r.item_type && (
            <Tag color={r.item_type === 'quantitative' ? 'blue' : 'purple'} style={{ margin: 0 }}>
              {r.item_type === 'quantitative' ? '定量' : '定性'}
              {r.need_sample_count ? ` · N=${r.need_sample_count}` : ''}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '标准要求', dataIndex: 'standard_value', width: 200,
      render: (v, r) => (
        <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.5 }}>
          <div>{v || '-'}</div>
          {(r.upper_limit !== null || r.lower_limit !== null || r.nominal_value !== null) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.nominal_value !== null && r.nominal_value !== undefined ? `标称 ${r.nominal_value}` : ''}
              {r.lower_limit !== null && r.lower_limit !== undefined ? ` ≥ ${r.lower_limit}` : ''}
              {r.upper_limit !== null && r.upper_limit !== undefined ? ` ≤ ${r.upper_limit}` : ''}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '实测值（旧，只读）', dataIndex: 'actual_value', width: 180,
      render: (v, record) => {
        // 阶段4.9 兼容：无 sample_values（纯历史数据）时显示 actual_value
        const hasSvs = (record.sample_values?.length ?? 0) > 0
        if (hasSvs) {
          // 折叠展开后有录入，此处仅提示
          return (
            <Tag color="geekblue" style={{ margin: 0 }}>
              已录入 {record.sample_values!.length} 件（展开详情）
            </Tag>
          )
        }
        if (!v) return <Text type="secondary">-</Text>
        return <Text code copyable style={{ maxWidth: 180 }}>{v}</Text>
      },
    },
    {
      title: '判定结论', dataIndex: 'result', width: 120,
      render: (v: any, record, rowIdx) => {
        // 优先基于 sample_values 计算的 result
        const svs = record.sample_values || []
        const displayResult = svs.length > 0
          ? aggregateRowResult(svs, v)
          : v
        if (disabled) {
          // 只读详情：用 result Tag
          if (!displayResult) return <Tag>待判定</Tag>
          return displayResult === '合格'
            ? <Tag icon={<CheckCircleOutlined />} color="success">合格</Tag>
            : <Tag icon={<CloseCircleOutlined />} color="error">不合格</Tag>
        }
        // 可编辑模式：Select 兜底（sample_values 空时可用）
        const hasSvs = svs.length > 0
        if (hasSvs) {
          return displayResult === '合格'
            ? <Tag icon={<CheckCircleOutlined />} color="success">自动·合格</Tag>
            : displayResult === '不合格'
              ? <Tag icon={<CloseCircleOutlined />} color="error">自动·不合格</Tag>
              : <Tag color="default">请录入</Tag>
        }
        return (
          <Select
            style={{ width: '100%' }}
            placeholder="请选择"
            allowClear
            size="small"
            value={v}
            options={[{ label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }]}
            onChange={val => {
              const next = items.map((r, i) => (i === rowIdx ? { ...r, result: val } : r))
              onChange?.(next)
            }}
          />
        )
      },
    },
  ]

  // 旧版输入（向后兼容：无 item_type 时仍可输入 actual_value 单值，走 updateItem 的 actual_value 字段）
  // 注意：此处复用 original updateItem 逻辑，需要 items 已受控
  return (
    <Table<InspectionItemRow>
      columns={columns}
      dataSource={items}
      rowKey={(r, i) => (r as any).item_id || `row-${i}`}
      size="small"
      pagination={false}
      expandable={{
        expandedRowRender: (record, idx) => expandedRowRender(record, idx),
        rowExpandable: record => !disabled || (record.sample_values?.length ?? 0) > 0,
      }}
      // 默认展开所有行（启用 sample_values 录入时）
    />
  )
}
