import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const SQLITE_PATH = process.env.SQLITE_PATH || '/tmp/u9-orig/u9-data-sync/data/u9tasks.db'

async function main() {
  console.log('=== 开始数据迁移 (SQLite → MySQL) ===')

  const sqlite = await open({ filename: SQLITE_PATH, driver: sqlite3.Database })
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    namedPlaceholders: true,
  })
  mysqlConn.config.namedPlaceholders = true

  let totalMigrated = 0

  // ---- 1. u9_task_settings → u9_task_setting ----
  console.log('\n[1/7] 迁移任务设置...')
  const settings = await sqlite.all('SELECT * FROM u9_task_settings')
  console.log(`  SQLite 共 ${settings.length} 条`)
  for (const s of settings) {
    const [existing] = await mysqlConn.execute(
      'SELECT setting_id FROM u9_task_setting WHERE task_type = ?',
      [s.taskType]
    )
    if (existing.length > 0) {
      console.log(`  跳过已存在: ${s.taskType} (${s.name})`)
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO u9_task_setting (task_type, name, description, source_url, field_count, is_active, params, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.taskType, s.name, s.description, s.sourceUrl, s.fieldCount, s.isActive, s.params, s.createdAt, s.updatedAt]
    )
    console.log(`  ✓ 迁移: ${s.taskType} (${s.name})`)
    totalMigrated++
  }

  // ---- 2. u9_scheduled_tasks → u9_scheduled_task ----
  console.log('\n[2/7] 迁移定时任务...')
  const scheds = await sqlite.all('SELECT * FROM u9_scheduled_tasks')
  console.log(`  SQLite 共 ${scheds.length} 条`)
  for (const s of scheds) {
    const [existing] = await mysqlConn.execute(
      'SELECT schedule_id FROM u9_scheduled_task WHERE schedule_biz_id = ?',
      [s.scheduleId]
    )
    if (existing.length > 0) {
      console.log(`  跳过已存在: ${s.scheduleId} (${s.name})`)
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO u9_scheduled_task (schedule_biz_id, name, task_type, exec_mode, config, next_run_at, last_run_at, last_run_result, is_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.scheduleId, s.name, s.type, s.execMode, s.config, s.nextRunAt, s.lastRunAt, s.lastRunResult, s.isEnabled, s.createdAt, s.updatedAt]
    )
    console.log(`  ✓ 迁移: ${s.scheduleId} (${s.name})`)
    totalMigrated++
  }

  // ---- 3. u9_tasks → u9_sync_task ----
  console.log('\n[3/7] 迁移同步任务...')
  const tasks = await sqlite.all('SELECT * FROM u9_tasks')
  console.log(`  SQLite 共 ${tasks.length} 条`)
  for (const t of tasks) {
    const [existing] = await mysqlConn.execute(
      'SELECT task_id FROM u9_sync_task WHERE task_biz_id = ?',
      [t.taskId]
    )
    if (existing.length > 0) {
      console.log(`  跳过已存在: ${t.taskId} (${t.type})`)
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO u9_sync_task (task_biz_id, task_type, status, progress, current_step, steps, total_records, output_file, output_size, error_msg, started_at, ended_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.taskId, t.type, t.status, t.progress, t.currentStep, t.steps, t.totalRecords, t.outputFile, t.outputSize, t.errorMsg, t.startedAt, t.endedAt, t.createdAt, t.updatedAt]
    )
    console.log(`  ✓ 迁移: ${t.taskId} (${t.type}, ${t.status})`)
    totalMigrated++
  }

  // ---- 4. u9_items → u9_item ----
  console.log('\n[4/7] 迁移料品数据...')
  const items = await sqlite.all('SELECT * FROM u9_items')
  console.log(`  SQLite 共 ${items.length} 条`)
  let itemMigrated = 0, itemSkipped = 0
  for (const it of items) {
    const [existing] = await mysqlConn.execute(
      'SELECT item_id FROM u9_item WHERE item_code = ?',
      [it.itemCode]
    )
    if (existing.length > 0) {
      itemSkipped++
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO u9_item (task_id, main_category_code, category_name, item_code, item_name, specification, unit_name, film_no, cutting_size, print_process, color_info, blank_diameter, material_thickness, material_width, material_height, scrap_weight, stock_unit_weight, stock_unit_volume, weight_unit, volume_unit, inventory_category, unit_code, is_active, effective_date, expiration_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [it.taskId, it.mainCategoryCode, it.categoryName, it.itemCode, it.itemName, it.specification, it.unitName, it.filmNo, it.cuttingSize, it.printProcess, it.colorInfo, it.blankDiameter, it.materialThickness, it.materialWidth, it.materialHeight, it.scrapWeight, it.stockUnitWeight, it.stockUnitVolume, it.weightUnit, it.volumeUnit, it.inventoryCategory, it.unitCode, it.isActive, it.effectiveDate, it.expirationDate, it.createdAt, it.updatedAt]
    )
    itemMigrated++
  }
  console.log(`  ✓ 迁移: ${itemMigrated} 条, 跳过(已存在): ${itemSkipped} 条`)
  totalMigrated += itemMigrated

  // ---- 5. u9_customers → u9_customer ----
  console.log('\n[5/7] 迁移客户数据...')
  const customers = await sqlite.all('SELECT * FROM u9_customers')
  console.log(`  SQLite 共 ${customers.length} 条`)
  let custMigrated = 0, custSkipped = 0
  for (const c of customers) {
    const [existing] = await mysqlConn.execute(
      'SELECT customer_id FROM u9_customer WHERE customer_code = ?',
      [c.customerCode]
    )
    if (existing.length > 0) {
      custSkipped++
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO u9_customer (task_id, customer_code, customer_name, short_name, category_id, category_name, is_active, expire_date, effective_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.taskId, c.customerCode, c.customerName, c.shortName, c.categoryId, c.categoryName, c.isActive, c.expireDate, c.effectiveDate, c.createdAt, c.updatedAt]
    )
    custMigrated++
  }
  console.log(`  ✓ 迁移: ${custMigrated} 条, 跳过(已存在): ${custSkipped} 条`)
  totalMigrated += custMigrated

  // ---- 6. env_monitor_data → env_monitor_data ----
  console.log('\n[6/7] 迁移环境监测数据...')
  const monitors = await sqlite.all('SELECT * FROM env_monitor_data')
  console.log(`  SQLite 共 ${monitors.length} 条`)
  let monMigrated = 0, monSkipped = 0
  for (const m of monitors) {
    const [existing] = await mysqlConn.execute(
      'SELECT monitor_id FROM env_monitor_data WHERE factor_id = ? AND collect_time = ?',
      [m.factorId, m.collectTime]
    )
    if (existing.length > 0) {
      monSkipped++
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO env_monitor_data (factor_id, device_addr, device_name, node_id, register_id, factor_name, value, raw_data, unit, coefficient, device_status, collect_time, data_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.factorId, m.deviceAddr, m.deviceName, m.nodeId, m.registerId, m.factorName, m.value, m.rawData, m.unit, m.coefficient, m.deviceStatus, m.collectTime, m.dataTime, m.createdAt, m.updatedAt]
    )
    monMigrated++
  }
  console.log(`  ✓ 迁移: ${monMigrated} 条, 跳过(已存在): ${monSkipped} 条`)
  totalMigrated += monMigrated

  // ---- 7. env_alarm_records → env_alarm_record ----
  console.log('\n[7/7] 迁移环境报警记录...')
  const alarms = await sqlite.all('SELECT * FROM env_alarm_records')
  console.log(`  SQLite 共 ${alarms.length} 条`)
  let alarmMigrated = 0, alarmSkipped = 0
  for (const a of alarms) {
    const [existing] = await mysqlConn.execute(
      'SELECT alarm_id FROM env_alarm_record WHERE factor_id = ? AND alarm_time = ?',
      [a.factorId, a.alarmTime]
    )
    if (existing.length > 0) {
      alarmSkipped++
      continue
    }
    await mysqlConn.execute(
      `INSERT INTO env_alarm_record (factor_id, device_addr, device_name, node_id, register_id, factor_name, alarm_info, alarm_level, alarm_range, current_value, unit, alarm_time, is_handled, handle_msg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.factorId, a.deviceAddr, a.deviceName, a.nodeId, a.registerId, a.factorName, a.alarmInfo, a.alarmLevel, a.alarmRange, a.currentValue, a.unit, a.alarmTime, a.isHandled, a.handleMsg, a.createdAt, a.updatedAt]
    )
    alarmMigrated++
  }
  console.log(`  ✓ 迁移: ${alarmMigrated} 条, 跳过(已存在): ${alarmSkipped} 条`)
  totalMigrated += alarmMigrated

  await sqlite.close()
  await mysqlConn.end()

  console.log(`\n=== 迁移完成！共新迁移 ${totalMigrated} 条记录 ===`)
}

main().catch(err => {
  console.error('迁移失败:', err)
  process.exit(1)
})
