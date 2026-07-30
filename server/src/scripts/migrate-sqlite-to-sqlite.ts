import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import 'dotenv/config'

const SOURCE_DB = process.env.SQLITE_PATH || '/opt/milk-can-mes/u9tasks-orig.db'
const TARGET_DB = process.env.TARGET_DB || './data/milk_can_mes.sqlite'

function cleanDate(v: any): string | null {
  if (!v) return null
  let s = String(v)
  s = s.replace(/\.\d{3,6}\s*\+\d{2}:\d{2}$/, '').replace(/\.\d{3,6}$/, '')
  return s
}

async function main() {
  console.log('=== 开始数据迁移 (SQLite → SQLite) ===')
  console.log(`源库: ${SOURCE_DB}`)
  console.log(`目标库: ${TARGET_DB}\n`)

  const srcDb = new sqlite3.Database(SOURCE_DB)
  const tgtDb = new sqlite3.Database(TARGET_DB)
  const srcAll = promisify(srcDb.all.bind(srcDb))
  const tgtAll = promisify(tgtDb.all.bind(tgtDb))
  const tgtRun = promisify(tgtDb.run.bind(tgtDb))

  let totalMigrated = 0

  // ---- 1. 任务设置
  console.log('[1/8] 迁移任务设置...')
  const settings = await srcAll('SELECT * FROM u9_task_settings') as any[]
  for (const s of settings) {
    const existing = await tgtAll('SELECT setting_id FROM u9_task_setting WHERE task_type = ?', [s.taskType]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO u9_task_setting (task_type, name, description, source_url, field_count, is_active, params, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.taskType, s.name, s.description, s.sourceUrl, s.fieldCount, s.isActive, s.params, cleanDate(s.createdAt), cleanDate(s.updatedAt)]
    )
    totalMigrated++
  }
  console.log(`  ✓ 任务设置: 迁移 ${totalMigrated} 条`)

  // ---- 2. 定时任务
  let cnt = 0
  console.log('\n[2/8] 迁移定时任务...')
  const scheds = await srcAll('SELECT * FROM u9_scheduled_tasks') as any[]
  for (const s of scheds) {
    const existing = await tgtAll('SELECT schedule_id FROM u9_scheduled_task WHERE schedule_biz_id = ?', [s.scheduleId]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO u9_scheduled_task (schedule_biz_id, name, task_type, exec_mode, config, next_run_at, last_run_at, last_run_result, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.scheduleId, s.name, s.type, s.execMode, s.config, cleanDate(s.nextRunAt), cleanDate(s.lastRunAt), s.lastRunResult, s.isEnabled, cleanDate(s.createdAt), cleanDate(s.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 定时任务: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 3. 同步任务
  cnt = 0
  console.log('\n[3/8] 迁移同步任务...')
  const tasks = await srcAll('SELECT * FROM u9_tasks') as any[]
  for (const t of tasks) {
    const existing = await tgtAll('SELECT task_id FROM u9_sync_task WHERE task_biz_id = ?', [t.taskId]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO u9_sync_task (task_biz_id, task_type, status, progress, current_step, steps, total_records, output_file, output_size, error_msg, started_at, ended_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.taskId, t.type, t.status, t.progress, t.currentStep, t.steps, t.totalRecords, t.outputFile, t.outputSize, t.errorMsg, cleanDate(t.startedAt), cleanDate(t.endedAt), cleanDate(t.createdAt), cleanDate(t.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 同步任务: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 4. 料品数据
  cnt = 0
  console.log('\n[4/8] 迁移料品数据...')
  const items = await srcAll('SELECT * FROM u9_items') as any[]
  for (const it of items) {
    const existing = await tgtAll('SELECT item_id FROM u9_item WHERE item_code = ?', [it.itemCode]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO u9_item (task_id, main_category_code, category_name, item_code, item_name, specification, unit_name, film_no, cutting_size, print_process, color_info, blank_diameter, material_thickness, material_width, material_height, scrap_weight, stock_unit_weight, stock_unit_volume, weight_unit, volume_unit, inventory_category, unit_code, is_active, effective_date, expiration_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [it.taskId, it.mainCategoryCode, it.categoryName, it.itemCode, it.itemName, it.specification, it.unitName, it.filmNo, it.cuttingSize, it.printProcess, it.colorInfo, it.blankDiameter, it.materialThickness, it.materialWidth, it.materialHeight, it.scrapWeight, it.stockUnitWeight, it.stockUnitVolume, it.weightUnit, it.volumeUnit, it.inventoryCategory, it.unitCode, it.isActive, it.effectiveDate, it.expirationDate, cleanDate(it.createdAt), cleanDate(it.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 料品数据: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 5. 客户数据
  cnt = 0
  console.log('\n[5/8] 迁移客户数据...')
  const customers = await srcAll('SELECT * FROM u9_customers') as any[]
  for (const c of customers) {
    const existing = await tgtAll('SELECT customer_id FROM u9_customer WHERE customer_code = ?', [c.customerCode]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO u9_customer (task_id, customer_code, customer_name, short_name, category_id, category_name, is_active, expire_date, effective_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.taskId, c.customerCode, c.customerName, c.shortName, c.categoryId, c.categoryName, c.isActive, c.expireDate, c.effectiveDate, cleanDate(c.createdAt), cleanDate(c.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 客户数据: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 6. 环境监测数据
  cnt = 0
  console.log('\n[6/8] 迁移环境监测数据...')
  const monitors = await srcAll('SELECT * FROM env_monitor_data') as any[]
  for (const m of monitors) {
    const existing = await tgtAll('SELECT monitor_id FROM env_monitor_data WHERE factor_id = ? AND collect_time = ?', [m.factorId, cleanDate(m.collectTime)]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO env_monitor_data (factor_id, device_addr, device_name, node_id, register_id, factor_name, value, raw_data, unit, coefficient, device_status, collect_time, data_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.factorId, m.deviceAddr, m.deviceName, m.nodeId, m.registerId, m.factorName, m.value, m.rawData, m.unit, m.coefficient, m.deviceStatus, cleanDate(m.collectTime), cleanDate(m.dataTime), cleanDate(m.createdAt), cleanDate(m.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 环境监测: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 7. 环境报警记录
  cnt = 0
  console.log('\n[7/8] 迁移环境报警记录...')
  const alarms = await srcAll('SELECT * FROM env_alarm_records') as any[]
  for (const a of alarms) {
    const existing = await tgtAll('SELECT alarm_id FROM env_alarm_record WHERE factor_id = ? AND alarm_time = ?', [a.factorId, cleanDate(a.alarmTime)]) as any[]
    if (existing.length > 0) continue
    await tgtRun(
      `INSERT INTO env_alarm_record (factor_id, device_addr, device_name, node_id, register_id, factor_name, alarm_info, alarm_level, alarm_range, current_value, unit, alarm_time, is_handled, handle_msg, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.factorId, a.deviceAddr, a.deviceName, a.nodeId, a.registerId, a.factorName, a.alarmInfo, a.alarmLevel, a.alarmRange, a.currentValue, a.unit, cleanDate(a.alarmTime), a.isHandled, a.handleMsg, cleanDate(a.createdAt), cleanDate(a.updatedAt)]
    )
    cnt++
  }
  console.log(`  ✓ 环境报警: 迁移 ${cnt} 条`); totalMigrated += cnt

  // ---- 8. 天气信息
  cnt = 0
  console.log('\n[8/8] 迁移天气信息...')
  try {
    const weathers = await srcAll('SELECT * FROM weather_info') as any[]
    for (const w of weathers) {
      const existing = await tgtAll('SELECT weather_id FROM weather_info WHERE city = ? AND weather_time = ?', [w.city, cleanDate(w.weatherTime)]) as any[]
      if (existing.length > 0) continue
      await tgtRun(
        `INSERT INTO weather_info (city, temperature, humidity, pressure, weather_time, source, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.city, w.temperature, w.humidity, w.pressure, cleanDate(w.weatherTime), w.source, w.rawData, cleanDate(w.createdAt), cleanDate(w.updatedAt)]
      )
      cnt++
    }
    console.log(`  ✓ 天气信息: 迁移 ${cnt} 条`); totalMigrated += cnt
  } catch (e) {
    console.log(`  ⊘ 天气信息表不存在或无数据`)
  }

  srcDb.close()
  tgtDb.close()
  console.log(`\n=== 迁移完成！共新迁移 ${totalMigrated} 条记录 ===`)
}

main().catch(err => { console.error('迁移失败:', err); process.exit(1) })
