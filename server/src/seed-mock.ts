/**
 * 模拟数据填充脚本（分表逐个执行，避免大事务）
 */
import sequelize from './config/database.js'
import {
  SyncTask, ScheduledTask, U9Item, U9Customer,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData
} from './models/index.js'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a
const pick = <T,>(arr: T[]) => arr[randInt(0, arr.length - 1)]

async function main() {
  try {
    // ---------- task_sync_log ----------
    console.log('\n1. 填充同步任务日志...')
    await SyncTask.destroy({ where: {} })
    const taskTypes = ['items', 'customers', 'env_monitor', 'weather', 'energy_meter']
    const statuses: Array<'pending' | 'running' | 'completed' | 'failed'> = ['completed', 'completed', 'completed', 'failed']
    const rows: any[] = []
    const now = Date.now()
    for (let i = 0; i < 60; i++) {
      const taskType = pick(taskTypes)
      const status = pick(statuses)
      const progress = status === 'completed' ? 100 : status === 'failed' ? randInt(10, 80) : status === 'running' ? randInt(30, 70) : 0
      const total = status === 'completed' ? randInt(50, 500) : 0
      const s = new Date(now - randInt(1, 30) * 86400000 - randInt(0, 86400000))
      const e = new Date(s.getTime() + randInt(30000, 300000))
      const steps = [
        { time: fmt(s), message: '任务已创建，等待调度', percent: 5 },
        { time: fmt(new Date(s.getTime() + 10000)), message: '开始连接数据源...', percent: 15 },
        { time: fmt(new Date(s.getTime() + 30000)), message: '登录并获取数据列表', percent: 35 },
        { time: fmt(new Date(s.getTime() + 60000)), message: `正在处理数据（共${total || '?'}条）`, percent: progress >= 60 ? 60 : progress },
        status === 'failed'
          ? { time: fmt(e), message: '失败：数据源连接超时', percent: progress }
          : { time: fmt(e), message: `完成，写入 ${total} 条记录`, percent: 100 },
      ]
      rows.push({
        task_biz_id: `SYNC-${taskType.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        task_type: taskType,
        status, progress,
        current_step: steps[steps.length - 1].message,
        steps: JSON.stringify(steps),
        total_records: total,
        output_file: '', output_size: 0,
        error_msg: status === 'failed' ? '数据源连接失败，请检查用户名密码或网络' : null,
        started_at: fmt(s), ended_at: fmt(e),
      })
    }
    await SyncTask.bulkCreate(rows, { validate: false })
    console.log(`   ✅ 已填充 ${rows.length} 条同步日志`)

    // ---------- task_scheduled ----------
    console.log('\n2. 填充定时任务...')
    await ScheduledTask.destroy({ where: {} })
    const templates = [
      { name: '每日料品数据同步', task_type: 'items', cron: '0 2 * * *' },
      { name: '每日客户数据同步', task_type: 'customers', cron: '0 3 * * *' },
      { name: '每15分钟环境监测', task_type: 'env_monitor', cron: '*/15 * * * *' },
      { name: '每日气象抓取', task_type: 'weather', cron: '0 6 * * *' },
      { name: '每小时电能采集', task_type: 'energy_meter', cron: '0 * * * *' },
    ]
    const schedRows = templates.map((t, i) => ({
      schedule_biz_id: `SCHED-${t.task_type.toUpperCase()}`,
      name: t.name,
      task_type: t.task_type,
      exec_mode: 'periodic',
      config: JSON.stringify({ cron: t.cron }),
      next_run_at: fmt(new Date(now + randInt(300, 3600) * 1000)),
      last_run_at: fmt(new Date(now - randInt(1, 6) * 3600000)),
      last_run_result: pick(['success', 'success', 'success', 'failed']),
      is_enabled: 1,
    }))
    await ScheduledTask.bulkCreate(schedRows, { validate: false })
    console.log(`   ✅ 已填充 ${schedRows.length} 条定时任务`)

    // ---------- task_item (U9Item) ----------
    console.log('\n3. 填充料品档案(task_item)...')
    await U9Item.destroy({ where: {} })
    const cats = ['奶粉罐-铁听', '奶粉罐-铝听', '食品罐', '保健品罐', '礼盒包装']
    const itemRows: any[] = []
    for (let i = 1; i <= 40; i++) {
      const c = pick(cats)
      itemRows.push({
        task_id: '1',
        main_category_code: 'CAT-' + String(cats.indexOf(c) + 1).padStart(2, '0'),
        category_name: c,
        item_code: `MAT-${String(i).padStart(5, '0')}`,
        item_name: `${c.replace('奶粉罐-', '')}${['A', 'B', 'C', 'D'][i % 4]}型-${randInt(300, 900)}g`,
        specification: `${randInt(52, 99)}mm×${randInt(70, 180)}mm`,
        unit_name: '个',
        film_no: i % 3 === 0 ? '' : `FL-${String(i).padStart(4, '0')}`,
        cutting_size: `${randInt(200, 400)}×${randInt(300, 600)}`,
        print_process: pick(['胶印', '凹印', '丝印', '胶印+UV']),
        color_info: `${randInt(1, 6)}色+${randInt(0, 2)}专色`,
        blank_diameter: String(randInt(50, 200)),
        material_thickness: (Math.random() * 0.3 + 0.15).toFixed(3),
        material_width: String(randInt(600, 1200)),
        material_height: String(randInt(500, 1000)),
        scrap_weight: (Math.random() * 5 + 0.5).toFixed(2),
        stock_unit_weight: (Math.random() * 50 + 10).toFixed(2),
        stock_unit_volume: (Math.random() * 2 + 0.2).toFixed(3),
        weight_unit: 'g', volume_unit: 'L',
        inventory_category: pick(['成品', '半成品', '原材料']),
        unit_code: 'PCS',
        is_active: 1,
        effective_date: '2024-01-01 00:00:00',
        expiration_date: '2030-12-31 23:59:59',
      })
    }
    await U9Item.bulkCreate(itemRows, { validate: false })
    console.log(`   ✅ 已填充 ${itemRows.length} 条料品档案`)

    // ---------- task_customer (U9Customer) ----------
    console.log('\n4. 填充客户档案(task_customer)...')
    await U9Customer.destroy({ where: {} })
    const names = [
      '内蒙古伊利实业集团股份有限公司', '内蒙古蒙牛乳业（集团）股份有限公司',
      '黑龙江飞鹤乳业有限公司', '君乐宝乳业集团有限公司', '澳优乳业（中国）有限公司',
      '贝因美股份有限公司', '上海雀巢产品服务有限公司', '美赞臣营养品（中国）有限公司',
      '惠氏营养品（中国）有限公司', '雅培贸易（上海）有限公司', '达能（中国）食品饮料有限公司',
      '合生元（广州）健康产品有限公司', '纽瑞滋（上海）食品有限公司',
      '圣元营养食品有限公司', '完达山乳业股份有限公司',
    ]
    const custCats = ['战略客户', '重点客户', '普通客户', '潜在客户']
    const custRows = names.map((n, i) => ({
      task_id: '2',
      customer_code: `CUS-${String(i + 1).padStart(5, '0')}`,
      customer_name: n,
      short_name: n.length > 6 ? n.slice(0, 6) : n,
      category_id: String(custCats.indexOf(custCats[i % custCats.length]) + 1),
      category_name: custCats[i % custCats.length],
      is_active: i < 13 ? 1 : 0,
      expire_date: '2030-12-31 23:59:59',
      effective_date: '2023-01-01 00:00:00',
    }))
    await U9Customer.bulkCreate(custRows, { validate: false })
    console.log(`   ✅ 已填充 ${custRows.length} 条客户档案`)

    // ---------- task_env_monitor_data ----------
    console.log('\n5. 填充环境监测数据...')
    await EnvMonitor.destroy({ where: {} })
    const factorNames = ['温度', '湿度', 'PM2.5', 'CO2浓度', '甲醛浓度', '氨气浓度']
    const units = ['℃', '%RH', 'μg/m³', 'ppm', 'mg/m³', 'ppm']
    const deviceNames = ['A线车间监测点', 'B线车间监测点', 'C线车间监测点', '成品库监测点', '原料库监测点', '微生物室监测点']
    const envRows: any[] = []
    for (let i = 0; i < 80; i++) {
      const fi = i % 6
      const t = new Date(now - randInt(0, 7) * 86400000 - randInt(0, 86400000))
      let value = 0
      if (fi === 0) value = +(Math.random() * 10 + 20).toFixed(2)
      else if (fi === 1) value = +(Math.random() * 30 + 40).toFixed(1)
      else if (fi === 2) value = randInt(10, 120)
      else if (fi === 3) value = randInt(400, 900)
      else if (fi === 4) value = +(Math.random() * 0.08 + 0.02).toFixed(3)
      else value = +(Math.random() * 20 + 2).toFixed(1)
      envRows.push({
        factor_id: String(fi + 1),
        device_addr: (i % 6) + 1,
        device_name: deviceNames[i % 6],
        node_id: (i % 6) + 1,
        register_id: fi + 1,
        factor_name: factorNames[fi],
        value, raw_data: String(value), unit: units[fi],
        coefficient: 1.0, device_status: '1',
        collect_time: fmt(t), data_time: fmt(t),
      })
    }
    await EnvMonitor.bulkCreate(envRows, { validate: false })
    console.log(`   ✅ 已填充 ${envRows.length} 条环境监测数据`)

    // ---------- task_env_alarm_record ----------
    console.log('\n6. 填充环境报警记录...')
    await EnvAlarm.destroy({ where: {} })
    const alarms = [
      { fi: 0, dn: deviceNames[0], info: '温度超标（>28℃）', range: '>28', val: 29.5, unit: '℃', level: '中' },
      { fi: 1, dn: deviceNames[1], info: '湿度过高（>70%RH）', range: '>70', val: 73.2, unit: '%RH', level: '低' },
      { fi: 2, dn: deviceNames[4], info: 'PM2.5超标（>75μg/m³）', range: '>75', val: 96, unit: 'μg/m³', level: '中' },
      { fi: 3, dn: deviceNames[2], info: 'CO2浓度偏高（>1000ppm）', range: '>1000', val: 1180, unit: 'ppm', level: '高' },
      { fi: 4, dn: deviceNames[5], info: '甲醛浓度超标（>0.1mg/m³）', range: '>0.1', val: 0.126, unit: 'mg/m³', level: '高' },
    ]
    const alarmRows = alarms.map((a, i) => {
      const t = new Date(now - (i + 1) * 86400000 - randInt(0, 6) * 3600000)
      return {
        factor_id: String(a.fi + 1),
        device_addr: i + 1, device_name: a.dn,
        node_id: i + 1, register_id: a.fi + 1,
        factor_name: factorNames[a.fi],
        alarm_info: a.info, alarm_level: a.level,
        alarm_range: a.range, current_value: a.val, unit: a.unit,
        alarm_time: fmt(t),
        is_handled: i < 3 ? 1 : 0,
        handle_msg: i < 3 ? '已通风处理，恢复正常' : '',
      }
    })
    await EnvAlarm.bulkCreate(alarmRows, { validate: false })
    console.log(`   ✅ 已填充 ${alarmRows.length} 条环境报警`)

    // ---------- task_weather_info ----------
    console.log('\n7. 填充气象数据...')
    await WeatherInfo.destroy({ where: {} })
    const cities = ['长沙市', '望城区', '宁乡市', '浏阳市', '长沙县']
    const weatherRows: any[] = []
    for (let i = 0; i < 30; i++) {
      const t = new Date(now - Math.floor(i / 5) * 86400000)
      weatherRows.push({
        city: cities[i % 5],
        temperature: +(Math.random() * 15 + 10).toFixed(1),
        humidity: randInt(40, 95),
        pressure: randInt(995, 1025),
        weather_time: fmt(t),
        source: '中国天气网', raw_data: '',
      })
    }
    await WeatherInfo.bulkCreate(weatherRows, { validate: false })
    console.log(`   ✅ 已填充 ${weatherRows.length} 条气象数据`)

    // ---------- task_energy_meter_data（注意字段是驼峰式） ----------
    console.log('\n8. 填充能源采集数据...')
    await EnergyMeterData.destroy({ where: {} })
    const meters = [
      { addr: 'METER-001', name: '总配电房主电表' },
      { addr: 'METER-002', name: 'A线车间电表' },
      { addr: 'METER-003', name: 'B线车间电表' },
      { addr: 'METER-004', name: 'C线车间电表' },
      { addr: 'METER-005', name: '办公区电表' },
      { addr: 'METER-006', name: '冷库/仓储区电表' },
    ]
    // 小批量逐次插入，避免SQLite SQL长度限制
    const batchEnergy: any[] = []
    for (let d = 0; d < 5; d++) {
      for (let h = 0; h < 24; h += 4) {
        for (const m of meters) {
          const off = meters.indexOf(m) * 1000
          const t = new Date(now - d * 86400000 + h * 3600000)
          batchEnergy.push({
            taskSettingId: 5,
            deviceAddr: m.addr,
            deviceName: m.name,
            forwardActiveEnergy: 150000 + d * 200 + h * 10 + off + randInt(0, 50),
            forwardReactiveEnergy: 40000 + d * 50 + h * 3 + Math.floor(off / 3) + randInt(0, 15),
            reverseActiveEnergy: randInt(0, 5),
            reverseReactiveEnergy: randInt(0, 3),
            recordTime: fmt(t),
          })
        }
      }
    }
    // 每 50 条一批
    for (let i = 0; i < batchEnergy.length; i += 50) {
      const part = batchEnergy.slice(i, i + 50)
      await EnergyMeterData.bulkCreate(part, { validate: false })
    }
    console.log(`   ✅ 已填充 ${batchEnergy.length} 条能源采集记录`)

    console.log('\n🎉 所有模拟数据填充完成！')
  } catch (err: any) {
    console.error('❌ 失败:', err.message)
    if (err.errors) err.errors.forEach((e: any) => console.error('  -', e.message))
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}
main()
