/**
 * 检验数据统一存储改造（扁平化重构版）
 * 统一检验项目录入组件 InspectionItemEditor
 *
 * 设计目标：
 * - 三页面（来料/产品/微生物）共用
 * - 扁平化布局，样品值内联为独立列
 * - 根据 need_sample_count 动态生成样本列
 * - qualitative: 样本列显示 OK/NG 单选
 * - quantitative: 样本列显示 InputNumber + 单位 + 上下限红绿提示
 * - 判定结论实时自动计算
 *
 * Props：
 *  - items: 受控 items 数组
 *  - disabled?: 是否只读
 *  - onChange?: (items) => void
 *  - materialInfo?: 物料信息（顶部展示，不入表格）
 */
import React, { useMemo } from 'react'
import { Table, InputNumber, Checkbox, Tag, Space, Tooltip, Typography, Card, Descriptions } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

export interface SampleValue {
  value_id?: number
  sample_no: number
  dimension_code?: string
  dimension_name?: string
  measure_value_num?: number | null
  measure_value_text?: string | null
  is_qualified?: number | null
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
  actual_value?: string | null
  sample_count?: number | null
  summary?: string | null
  result?: '合格' | '不合格' | string | null
  inspector_id?: number | null
  inspector_name?: string | null
  inspection_time?: string | null
  unit?: string | null
  sort_order?: number
  remarks?: string | null
  item_type?: 'qualitative' | 'quantitative' | string | null
  need_sample_count?: number | null
  upper_limit?: number | null
  lower_limit?: number | null
  sampling_plan?: string | null
  sampling_detail?: string | null
  accept_number?: number | null
  reject_number?: number | null
  sample_values?: SampleValue[]
}

interface MaterialInfo {
  material_code?: string | null
  material_name?: string | null
  specification?: string | null
  quantity?: number | null | string
  supplier_name?: string | null
  supplier_batch_no?: string | null
}

interface Props {
  items: InspectionItemRow[]
  disabled?: boolean
  onChange?: (next: InspectionItemRow[]) => void
  materialInfo?: MaterialInfo
  /** 是否显示顶部物料信息卡片（详情 Drawer 传 false 隐藏，默认 true） */
  showMaterialInfo?: boolean
}

// ============================================================
//  单 sample_value 的判定
// ============================================================
function judgeSampleValue(
  sample: Pick<SampleValue, 'measure_value_num' | 'measure_value_text'>,
  cfg: { upper_limit?: number | null; lower_limit?: number | null },
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
  const { upper_limit, lower_limit } = cfg
  if (upper_limit !== null && upper_limit !== undefined && n > Number(upper_limit)) return 0
  if (lower_limit !== null && lower_limit !== undefined && n < Number(lower_limit)) return 0
  return 1
}

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
  if (allNull) return rowResult
  return anyFail ? '不合格' : '合格'
}

function ensureSampleValues(row: InspectionItemRow): SampleValue[] {
  const raw = row.sample_values || []
  const count = Number(row.need_sample_count) || Number(row.sample_count) || 1
  if (raw.length >= count) return raw.slice(0, count)
  return Array.from({ length: count }, (_, i) => {
    const existing = raw[i]
    return existing || {
      sample_no: i + 1,
      dimension_code: 'VALUE',
      measure_value_num: null,
      measure_value_text: null,
      is_qualified: null,
    }
  })
}

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
    const cfg = { upper_limit: row.upper_limit ?? null, lower_limit: row.lower_limit ?? null }
    row.sample_values = row.sample_values.map(sv => ({
      ...sv,
      is_qualified: judgeSampleValue({ measure_value_num: sv.measure_value_num, measure_value_text: sv.measure_value_text }, cfg),
    }))
    // 实时逐行判定（用户要求：全部样本完成后才给判定结论，在判定结论列 render 中延迟判定）
    // 这里只更新 is_qualified，不立即更新 result
  }
  onChange?.(next)
}

// ============================================================
//  单元格渲染：定性 勾选框（OK / NG）
// ============================================================
function QualitativeCell(props: {
  value: SampleValue
  onChange: (next: SampleValue) => void
  disabled?: boolean
}) {
  const { value, onChange, disabled } = props
  const text = (value.measure_value_text || '').trim()
  // 兼容旧数据 合格/不合格
  const isOK = text === 'OK' || text === '合格'
  const isNG = text === 'NG' || text === '不合格'
  return (
    <Space size="middle" style={{ display: 'flex', justifyContent: 'center' }}>
      <Checkbox
        checked={isOK}
        disabled={disabled}
        style={{ color: isOK ? '#52c41a' : undefined, fontWeight: isOK ? 600 : undefined }}
        onChange={(e) => {
          if (disabled) return
          const checked = e.target.checked
          // 勾选互斥：OK => 取消 NG
          onChange({
            ...value,
            measure_value_text: checked ? 'OK' : '',
            measure_value_num: null,
          })
        }}
      >
        <span style={{ color: isOK ? '#52c41a' : undefined }}>OK</span>
      </Checkbox>
      <Checkbox
        checked={isNG}
        disabled={disabled}
        style={{ color: isNG ? '#ff4d4f' : undefined, fontWeight: isNG ? 600 : undefined }}
        onChange={(e) => {
          if (disabled) return
          const checked = e.target.checked
          onChange({
            ...value,
            measure_value_text: checked ? 'NG' : '',
            measure_value_num: null,
          })
        }}
      >
        <span style={{ color: isNG ? '#ff4d4f' : undefined }}>NG</span>
      </Checkbox>
    </Space>
  )
}

// ============================================================
//  单元格渲染：定量 InputNumber（不显示单位后缀）
// ============================================================
function QuantitativeCell(props: {
  value: SampleValue
  cfg: { upper_limit?: number | null; lower_limit?: number | null }
  onChange: (next: SampleValue) => void
  disabled?: boolean
}) {
  const { value, cfg, onChange, disabled } = props
  const qualified = value.is_qualified
  // 不合格显示红色（用户要求：不合格显示红色）
  const borderColor = qualified === 0 ? '#ff4d4f' : undefined
  const bgColor = qualified === 0 ? '#fff2f0' : undefined
  const hint = useMemo(() => {
    const parts: string[] = []
    if (cfg.lower_limit !== null && cfg.lower_limit !== undefined) parts.push(`≥${cfg.lower_limit}`)
    if (cfg.upper_limit !== null && cfg.upper_limit !== undefined) parts.push(`≤${cfg.upper_limit}`)
    return parts.join(' ~ ')
  }, [cfg.lower_limit, cfg.upper_limit])
  return (
    <Tooltip title={hint || '无上下限配置'} placement="topLeft">
      <InputNumber
        size="small"
        disabled={disabled}
        style={{ borderColor, backgroundColor: bgColor, boxShadow: borderColor ? `0 0 0 1px ${borderColor} inset` : undefined, width: 110 }}
        step={0.001}
        value={value.measure_value_num}
        onChange={val => {
          if (disabled) return
          onChange({ ...value, measure_value_num: val as any, measure_value_text: null })
        }}
      />
    </Tooltip>
  )
}

// ============================================================
//  主组件
// ============================================================
export default function InspectionItemEditor(props: Props) {
  const { items, disabled, onChange, materialInfo, showMaterialInfo = true } = props

  const getItemType = (row: InspectionItemRow): 'qualitative' | 'quantitative' => {
    if (row.item_type === 'quantitative' || row.item_type === 'qualitative') return row.item_type
    if (row.upper_limit !== null && row.upper_limit !== undefined) return 'quantitative'
    if (row.lower_limit !== null && row.lower_limit !== undefined) return 'quantitative'
    const av = (row.actual_value || '').toString()
    if (av && !isNaN(Number(av.trim()))) return 'quantitative'
    return 'qualitative'
  }

  // 计算最大样本列数
  const maxSampleCount = useMemo(() => {
    let max = 1
    for (const row of items) {
      const cnt = Number(row.need_sample_count) || Number(row.sample_count) || (row.sample_values?.length || 1)
      if (cnt > max) max = cnt
    }
    return Math.min(max, 20)
  }, [items])

  // 动态生成样本列（不显示单项结果 Tag）
  const sampleColumns = useMemo(() => {
    const cols: ColumnsType<InspectionItemRow> = []
    for (let i = 0; i < maxSampleCount; i++) {
      cols.push({
        title: `样本${i + 1}`,
        key: `sample_${i}`,
        width: 150,
        align: 'center',
        render: (_: any, record: InspectionItemRow, rowIdx: number) => {
          const itemType = getItemType(record)
          const svs = ensureSampleValues(record)
          const sv = svs[i]
          if (!sv) return <Text type="secondary">-</Text>
          const cfg = { upper_limit: record.upper_limit ?? null, lower_limit: record.lower_limit ?? null }
          if (itemType === 'qualitative') {
            return (
              <QualitativeCell
                value={sv}
                disabled={disabled}
                onChange={next => {
                  applyUpdate(items, rowIdx, row => {
                    row.sample_values = ensureSampleValues(row)
                    row.sample_values![i] = next
                  }, onChange)
                }}
              />
            )
          }
          return (
            <QuantitativeCell
              value={sv}
              cfg={cfg}
              disabled={disabled}
              onChange={next => {
                applyUpdate(items, rowIdx, row => {
                  row.sample_values = ensureSampleValues(row)
                  row.sample_values![i] = next
                }, onChange)
              }}
            />
          )
        },
      })
    }
    return cols
  }, [maxSampleCount, items, disabled, onChange])

  // 判定结论：完成所有样本后才给出
  const judgeFinal = (record: InspectionItemRow): { text: string; color: string; icon?: any; pending?: boolean } => {
    const expected = Number(record.need_sample_count) || Number(record.sample_count) || maxSampleCount
    const svs = ensureSampleValues(record)
    // 定性/定量判断是否"录入完成"
    const itemType = getItemType(record)
    let allFilled = true
    for (let i = 0; i < expected; i++) {
      const sv = svs[i]
      if (!sv) { allFilled = false; break }
      if (itemType === 'qualitative') {
        const t = (sv.measure_value_text || '').trim()
        if (!t) { allFilled = false; break }
      } else {
        const n = sv.measure_value_num
        if (n === null || n === undefined || Number.isNaN(Number(n))) { allFilled = false; break }
      }
    }
    if (!allFilled) return { text: '待完成', color: 'default', pending: true }

    // 已全部录入，按Ac/Re+不合格数判定
    const ac = record.accept_number ?? 0
    const re = record.reject_number ?? 1
    const defectCount = svs.slice(0, expected).filter(sv => sv.is_qualified === 0).length

    if (defectCount <= ac) return { text: '合格', color: 'success', icon: <CheckCircleOutlined /> }
    if (defectCount >= re) return { text: '不合格', color: 'error', icon: <CloseCircleOutlined /> }
    // Ac < x < Re 情况
    return { text: `继续抽样(${defectCount})`, color: 'warning' }
  }

  // 格式化检验标准（上下限）
  const renderStandard = (r: InspectionItemRow): React.ReactNode => {
    const parts: string[] = []
    if (r.lower_limit !== null && r.lower_limit !== undefined) parts.push(`≥${r.lower_limit}`)
    if (r.upper_limit !== null && r.upper_limit !== undefined) parts.push(`≤${r.upper_limit}`)
    if (parts.length === 0) return r.standard_value ? <span>{r.standard_value}</span> : <Text type="secondary">-</Text>
    return (
      <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>{parts.join(' ~ ')}</Text>
        {r.standard_value && <span>{r.standard_value}</span>}
      </Space>
    )
  }

  // 表格列：序号、检验项目、检验标准(上限、下限)、单位、样本量、Ac/Re、样本...、判定结论
  const columns: ColumnsType<InspectionItemRow> = [
    { title: '序号', width: 50, fixed: 'left' as const, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: '检验项目', dataIndex: 'item_name', width: 150, fixed: 'left' as const,
      render: (v, r) => (
        <Space direction="vertical" size={2}>
          <span>{v || '-'}</span>
          {r.item_type && (
            <Tag color={r.item_type === 'quantitative' ? 'blue' : 'purple'} style={{ margin: 0 }}>
              {r.item_type === 'quantitative' ? '定量' : '定性'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '检验标准', width: 140,
      render: (_: any, r: InspectionItemRow) => renderStandard(r),
    },
    {
      title: '单位', dataIndex: 'unit', width: 70,
      render: (v: string | null | undefined) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '样本量', dataIndex: 'need_sample_count', width: 70,
      render: (v, r) => v || r.sample_count || <Text type="secondary">1</Text>,
    },
    {
      title: 'Ac/Re', dataIndex: 'accept_number', width: 80,
      render: (v, r) => {
        const ac = r.accept_number
        const re = r.reject_number
        if (ac == null && re == null) return <Text type="secondary">-</Text>
        return <Text style={{ fontSize: 12 }}>Ac={ac ?? '-'} / Re={re ?? '-'}</Text>
      },
    },
    ...sampleColumns,
    {
      title: '判定结论', width: 100, fixed: 'right' as const,
      render: (_: any, record: InspectionItemRow) => {
        const { text, color, icon, pending } = judgeFinal(record)
        if (pending) return <Tag color="default">{text}</Tag>
        return <Tag icon={icon || undefined} color={color as any}>{text}</Tag>
      },
    },
  ]

  // 物料信息卡片：只有 showMaterialInfo=true 时才显示
  const materialCard = showMaterialInfo && materialInfo && (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Descriptions column={4} size="small" bordered>
        <Descriptions.Item label="料号">{materialInfo.material_code || '-'}</Descriptions.Item>
        <Descriptions.Item label="料品名称">{materialInfo.material_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="规格">{materialInfo.specification || '-'}</Descriptions.Item>
        <Descriptions.Item label="到货数量">
          {materialInfo.quantity !== null && materialInfo.quantity !== undefined
            ? (typeof materialInfo.quantity === 'number' ? materialInfo.quantity.toLocaleString() : materialInfo.quantity)
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="供应商">{materialInfo.supplier_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="供应商批号" span={3}>{materialInfo.supplier_batch_no || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
  )

  return (
    <div>
      {materialCard}
      <Table<InspectionItemRow>
        columns={columns}
        dataSource={items}
        rowKey={(r, i) => (r as any).item_id || `row-${i}`}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
