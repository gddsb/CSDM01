/**
 * 检验数据统一存储改造（阶段1.6）
 * 回填 quality_inspection_standard_item.item_type 等5字段
 *
 * 启发式规则：
 * 1. standard_value 含「±」「~」「-」连接数值  → quantitative + 解析 nominal/upper/lower
 * 2. standard_value 以「≥」「≤」「大于等于」「小于等于」开头  → quantitative + 解析单边限
 * 3. standard_value 含「无」「光亮」「洁净」「基本平整」等定性描述 → qualitative
 * 4. 其他无法判断的 → qualitative（保守判定，定性安全）
 * 5. need_sample_count 从 sample_rule 解析（如"抽8"→8，"S-4"→0不限制）
 *
 * 用法：node --experimental-strip-types server/src/seeders/backfill-item-type.ts
 * 或：cd server && npx tsx src/seeders/backfill-item-type.ts
 */
import sequelize from '../config/database.js'
import InspectionStandardItem from '../models/InspectionStandardItem.js'

// 定性描述关键词（命中任一则判为 qualitative）
const QUALITATIVE_KEYWORDS = [
  '无', '洁净', '光亮', '平整', '均匀', '完整', '清晰', '准确', '良好',
  '基本', '正常', '符合', '一致', '不得', '无异物', '无异味', '无锈蚀',
  '光洁', '光滑', '无明显', '无影响', '无缺口', '无凹陷', '无皱折', '无变形',
]

// 数值模式正则
const RANGE_PATTERN = /(-?\d+(?:\.\d+)?)\s*[±~\\-]\s*(-?\d+(?:\.\d+)?)/  // 136.7 ± 0.1
const GE_PATTERN = /[≥≥>]\s*(-?\d+(?:\.\d+)?)/   // ≥300%  ≥5
const LE_PATTERN = /[≤≤<]\s*(-?\d+(?:\.\d+)?)/   // ≤12%
const SAMPLE_PATTERN = /抽\s*(\d+)/   // 抽8

function parseItem(row: { standard_value: string; sample_rule?: string | null; unit?: string | null }) {
  const sv = (row.standard_value || '').trim()
  let item_type: 'qualitative' | 'quantitative' = 'qualitative'
  let nominal_value: number | null = null
  let upper_limit: number | null = null
  let lower_limit: number | null = null

  // 1. 双边范围：136.7 ± 0.1
  const mRange = sv.match(RANGE_PATTERN)
  if (mRange) {
    item_type = 'quantitative'
    nominal_value = parseFloat(mRange[1])
    const tol = Math.abs(parseFloat(mRange[2]))
    upper_limit = nominal_value + tol
    lower_limit = nominal_value - tol
  }

  // 2. 单边 ≥ 或 ≤
  if (item_type === 'qualitative') {
    const mGe = sv.match(GE_PATTERN)
    if (mGe) {
      item_type = 'quantitative'
      lower_limit = parseFloat(mGe[1])
    } else {
      const mLe = sv.match(LE_PATTERN)
      if (mLe) {
        item_type = 'quantitative'
        upper_limit = parseFloat(mLe[1])
      }
    }
  }

  // 3. 定性描述判定
  if (item_type === 'qualitative') {
    if (QUALITATIVE_KEYWORDS.some(kw => sv.includes(kw))) {
      item_type = 'qualitative'
    }
  }

  // 4. 抽样数解析
  let need_sample_count = 0
  const mSample = (row.sample_rule || '').match(SAMPLE_PATTERN)
  if (mSample) need_sample_count = parseInt(mSample[1], 10)

  return { item_type, need_sample_count, nominal_value, upper_limit, lower_limit }
}

async function backfill() {
  await sequelize.authenticate()
  console.log('数据库连接成功，开始回填 quality_inspection_standard_item')

  const items = await InspectionStandardItem.findAll()
  console.log(`共 ${items.length} 条标准项目待回填`)

  let qtCount = 0, qlCount = 0, skipCount = 0
  for (const it of items) {
    const sv = (it.get('standard_value') as string) || ''
    if (!sv) { skipCount++; continue }
    const parsed = parseItem({
      standard_value: sv,
      sample_rule: (it.get('sample_rule') as string) || null,
      unit: (it.get('unit') as string) || null,
    })
    await it.update({
      item_type: parsed.item_type,
      need_sample_count: parsed.need_sample_count,
      nominal_value: parsed.nominal_value,
      upper_limit: parsed.upper_limit,
      lower_limit: parsed.lower_limit,
    })
    if (parsed.item_type === 'quantitative') qtCount++
    else qlCount++
  }

  console.log(`\n回填完成：定量 ${qtCount} 条，定性 ${qlCount} 条，跳过 ${skipCount} 条`)
  console.log('\n注意事项：')
  console.log('  - 启发式解析可能不完美，建议人工抽检定量项的上下限是否正确')
  console.log('  - 定性项的 nominal/upper/lower 为 NULL，符合预期')
  await sequelize.close()
}

backfill().catch(err => {
  console.error('回填失败：', err)
  process.exit(1)
})
