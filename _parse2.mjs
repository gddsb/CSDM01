import fs from 'fs'

const raw = fs.readFileSync('/workspace/_raw2.tsv', 'utf8')

function parseTSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === '\t' && !inQuotes) { row.push(field); field = '' }
    else if (c === '\n' && !inQuotes) { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') {}
    else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const trim = (v) => (v || '').trim()
const numOr = (v, d) => { const t = trim(v); return t && !isNaN(Number(t)) ? Number(t) : d }
function parsePlan(v) {
  const s = trim(v)
  if (!s || s === '-') return null
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a } catch {}
  return null
}

const rows = parseTSV(raw)
const data = []
const skipped = []
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (r.length === 1 && r[0] === '') continue
  const NF = r.length
  let obj = null
  if (NF >= 19) {
    // 完整行 weekly/monthly
    obj = {
      device_code: trim(r[0]),
      item_name: trim(r[2]) || null,
      mechanism: trim(r[3]) || null,
      component: trim(r[4]) || null,
      location: trim(r[5]) || null,
      maintenance_method: trim(r[6]) || null,
      maintenance_content: trim(r[7]) || null,
      judge_type: trim(r[8]) || '定性',
      standard_value: trim(r[9]) || null,
      unit: trim(r[10]) || null,
      point_count: numOr(r[11], 1),
      time_per_point: numOr(r[12], 0),
      trigger_mode: trim(r[13]) || 'daily',
      monthly_plan: parsePlan(r[14]),
      runtime_threshold: (r[15] && trim(r[15])) ? Number(trim(r[15])) : null,
      last_trigger_value: (r[16] && trim(r[16])) ? trim(r[16]) : null,
      sort_order: numOr(r[17], 0),
      status: numOr(r[18], 1),
      remarks: (r[19] && trim(r[19])) ? trim(r[19]) : null,
    }
  } else if (NF === 15) {
    // daily 行(压缩:机构/部件/部位/方法/保养项名称 都空)
    obj = {
      device_code: trim(r[0]),
      item_name: null,
      mechanism: null,
      component: null,
      location: null,
      maintenance_method: null,
      maintenance_content: trim(r[3]) || null,
      judge_type: trim(r[4]) || '定性',
      standard_value: trim(r[5]) || null,
      unit: trim(r[6]) || null,
      point_count: numOr(r[7], 1),
      time_per_point: numOr(r[8], 0),
      trigger_mode: trim(r[9]) || 'daily',
      monthly_plan: parsePlan(r[10]),
      runtime_threshold: null,
      last_trigger_value: null,
      sort_order: numOr(r[13], 0),
      status: numOr(r[14], 1),
      remarks: null,
    }
  } else {
    skipped.push({ i, NF, sample: r.join('|').slice(0, 60) })
    continue
  }
  if (!obj.device_code || !obj.maintenance_content) {
    skipped.push({ i, NF, reason: 'missing code/content', sample: r.join('|').slice(0, 60) })
    continue
  }
  data.push(obj)
}

console.log('parsed:', data.length, '| skipped:', skipped.length)
if (skipped.length) skipped.forEach(s => console.log('  skip row', s.i, 'NF=' + s.NF, s.reason || '', s.sample))

// 去重:device_code + mechanism + component + location + method + content
const seen = new Set()
const deduped = []
let dup = 0
for (const d of data) {
  const key = [d.device_code, d.mechanism, d.component, d.location, d.maintenance_method, d.maintenance_content].join('||')
  if (seen.has(key)) { dup++; continue }
  seen.add(key)
  deduped.push(d)
}
console.log('after dedup:', deduped.length, '(removed', dup, ')')

const byDev = {}
for (const d of deduped) byDev[d.device_code] = (byDev[d.device_code] || 0) + 1
console.log('by device:', JSON.stringify(byDev))
const byMode = {}
for (const d of deduped) byMode[d.trigger_mode] = (byMode[d.trigger_mode] || 0) + 1
console.log('by trigger_mode:', JSON.stringify(byMode))

// 校验
const badMode = deduped.filter(d => !['daily','weekly','monthly','runtime'].includes(d.trigger_mode))
if (badMode.length) console.log('WARN bad mode:', badMode.map(d => d.trigger_mode))
const noContent = deduped.filter(d => !d.maintenance_content)
if (noContent.length) console.log('WARN no content:', noContent.length)
// daily 抽查
const daily = deduped.filter(d => d.trigger_mode === 'daily')
console.log('daily sample:', daily.length ? JSON.stringify(daily[0]) : 'none')

fs.writeFileSync('/workspace/_data2.json', JSON.stringify(deduped, null, 2))
console.log('written _data2.json with', deduped.length, 'records')
