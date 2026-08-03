/**
 * 模拟数据填充脚本 seed-mock.ts
 * 分表批量插入测试数据到 MySQL
 */
import sequelize from './config/database.js'
import {
  SyncTask, ScheduledTask, U9Item, U9Customer,
  EnvMonitor, EnvAlarm, WeatherInfo,
  TaskSetting
} from './models/index.js'

function rand(min: number, max: number) { return Math.random() * (max - min) + min }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }
function pad(n: number, len = 4) { return String(n).padStart(len, '0') }
function dateOffset(days: number, hours = 0, mins = 0) {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(d.getHours() - hours); d.setMinutes(d.getMinutes() - mins); return d
}
function fmt(d: Date) { return d.toISOString().slice(0, 19).replace('T', ' ') }

async function seedSyncLog() {
  console.log('1. 填充同步任务日志...')
  const taskTypes = ['items', 'customers', 'env_monitor', 'weather']
  const stepNames: Record<string, string[]> = {
    items: ['创建同步任务', '连接U9 ERP', '登录认证', '拉取料品数据', '数据写入完成'],
    customers: ['创建同步任务', '连接U9 ERP', '登录认证', '拉取客户数据', '数据写入完成'],
    env_monitor: ['创建采集任务', '连接0531yun平台', '获取设备列表', '采集监测数据', '数据写入完成'],
    weather: ['创建抓取任务', '连接中国天气网', '解析城市页面', '提取气象数据', '数据写入完成'],
  }
  const records: any[] = []
  for (let i = 0; i < 60; i++) {
    const tt = pick(taskTypes)
    const isFail = Math.random() < 0.25
    const started = dateOffset(randInt(0, 30), randInt(0, 23), randInt(0, 59))
    const duration = randInt(30, 300)
    const ended = new Date(started.getTime() + duration * 1000)
    const totalRecords = isFail ? randInt(0, 50) : randInt(50, 500)
    const steps = stepNames[tt].map((name, idx) => ({
      step: idx + 1, name,
      status: isFail && idx >= 3 ? 'failed' : 'completed',
      duration: randInt(5, 60),
      detail: idx === 4 ? `${totalRecords}条记录` : undefined,
    }))
    records.push({
      task_biz_id: `mock-${pad(i, 6)}-${Date.now()}`,
      task_type: tt,
      started_at: started,
      ended_at: ended,
      status: isFail ? 'failed' : 'completed',
      progress: isFail ? randInt(10, 80) : 100,
      total_records: totalRecords,
      error_msg: isFail ? '数据源连接失败，请检查用户名密码或网络' : null,
      steps: JSON.stringify(steps),
    })
  }
  await SyncTask.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条同步日志`)
}

async function seedScheduledTask() {
  console.log('2. 填充定时任务...')
  const taskTypes = [
    { task_type: 'items', cron: '0 2 * * *', name: '每日料品同步' },
    { task_type: 'customers', cron: '0 3 * * *', name: '每日客户同步' },
    { task_type: 'env_monitor', cron: '*/15 * * * *', name: '每15分钟环境监测' },
    { task_type: 'weather', cron: '0 6 * * *', name: '每日气象抓取' },
  ]
  const records = taskTypes.map((t, i) => {
    const isFail = Math.random() < 0.25
    const lastRun = dateOffset(randInt(0, 7), randInt(0, 23))
    const nextRun = new Date(); nextRun.setHours(nextRun.getHours() + 1)
    return {
      schedule_biz_id: `sched-${pad(i + 1, 6)}-${Date.now()}`,
      name: t.name,
      task_type: t.task_type,
      exec_mode: 'periodic',
      config: JSON.stringify({ cron: t.cron, timezone: 'Asia/Shanghai' }),
      next_run_at: fmt(nextRun),
      last_run_at: fmt(lastRun),
      last_run_result: isFail ? 'failed' : 'success',
      is_enabled: 1,
    }
  })
  await ScheduledTask.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条定时任务`)
}

async function seedU9Items() {
  console.log('3. 填充料品档案(task_item)...')
  // 获取一个同步日志作为 task_id 来源
  const syncLog = await SyncTask.findOne({ where: { task_type: 'items' } })
  const taskId = String(syncLog?.task_biz_id || 'mock-task-001')
  const categories = [
    { name: '奶粉罐-铁听', code: 'TIN', specs: ['52mm×90mm', '73mm×125mm', '99mm×150mm', '65mm×110mm', '85mm×145mm'] },
    { name: '奶粉罐-铝听', code: 'ALU', specs: ['60mm×100mm', '80mm×130mm', '90mm×160mm'] },
    { name: '食品罐', code: 'FOD', specs: ['50mm×80mm', '70mm×120mm', '100mm×180mm'] },
    { name: '保健品罐', code: 'HLT', specs: ['55mm×95mm', '75mm×115mm', '95mm×140mm'] },
    { name: '礼盒包装', code: 'GFT', specs: ['120mm×80mm', '150mm×100mm', '180mm×120mm'] },
  ]
  const printProcesses = ['胶印', '凹印', '丝印', '胶印+UV']
  const records: any[] = []
  for (let i = 1; i <= 40; i++) {
    const cat = pick(categories)
    const spec = pick(cat.specs)
    const colors = randInt(1, 6)
    const spotColors = randInt(0, 2)
    const grade = pick(['A', 'B', 'C', 'D'])
    records.push({
      task_id: taskId,
      item_code: `MAT-${pad(i)}`,
      item_name: `${cat.name.split('-')[0]}${grade}型-${randInt(100, 800)}g`,
      specification: spec,
      main_category_code: cat.code,
      category_name: cat.name,
      print_process: pick(printProcesses),
      color_info: `${colors}色${spotColors > 0 ? `+${spotColors}专色` : ''}`,
      is_active: 1,
      sync_time: fmt(dateOffset(randInt(0, 30))),
    })
  }
  await U9Item.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条料品档案`)
}

async function seedU9Customers() {
  console.log('4. 填充客户档案(task_customer)...')
  const syncLog = await SyncTask.findOne({ where: { task_type: 'customers' } })
  const taskId = String(syncLog?.task_biz_id || 'mock-task-002')
  const customers = [
    '内蒙古伊利实业集团股份有限公司', '内蒙古蒙牛乳业(集团)股份有限公司',
    '中国飞鹤有限公司', '君乐宝乳业集团有限公司', '澳优乳业(中国)有限公司',
    '贝因美股份有限公司', '雀巢(中国)有限公司', '美赞臣营养品(中国)有限公司',
    '惠氏营养品(中国)有限公司', '雅培贸易(上海)有限公司', '达能营养食品(深圳)有限公司',
    '合生元广州有限公司', '纽瑞滋乳业有限公司', '圣元营养食品有限公司', '完达山乳业股份有限公司',
  ]
  const categories = ['战略客户', '重点客户', '普通客户', '潜在客户']
  const records = customers.map((name, i) => ({
    task_id: taskId,
    customer_code: `CUS-${pad(i + 1)}`,
    customer_name: name,
    main_category_code: pick(['A', 'B', 'C', 'D']),
    category_name: categories[i % categories.length],
    contact_person: pick(['张经理', '李总监', '王主管', '刘部长', '陈经理', '赵总监']),
    contact_phone: `1${pick(['38', '39', '86', '87', '58', '59'])}${pad(randInt(10000000, 99999999), 8)}`,
    is_active: i < 13 ? 1 : 0,
    sync_time: fmt(dateOffset(randInt(0, 30))),
  }))
  await U9Customer.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条客户档案`)
}

async function seedEnvMonitor() {
  console.log('5. 填充环境监测数据...')
  const locations = [
    { name: 'A线车间', device: 1, node: 1 },
    { name: 'B线车间', device: 2, node: 2 },
    { name: 'C线车间', device: 3, node: 3 },
    { name: '成品库', device: 4, node: 4 },
    { name: '原料库', device: 5, node: 5 },
    { name: '微生物室', device: 6, node: 6 },
  ]
  const factorConfig = [
    { code: 'temperature', name: '温度', unit: '℃', min: 20, max: 30, reg: 40001 },
    { code: 'humidity', name: '湿度', unit: '%RH', min: 40, max: 70, reg: 40002 },
    { code: 'pm25', name: 'PM2.5', unit: 'μg/m³', min: 10, max: 120, reg: 40003 },
    { code: 'co2', name: 'CO₂浓度', unit: 'ppm', min: 400, max: 900, reg: 40004 },
    { code: 'formaldehyde', name: '甲醛浓度', unit: 'mg/m³', min: 0.02, max: 0.1, reg: 40005 },
    { code: 'nh3', name: '氨气浓度', unit: 'ppm', min: 2, max: 22, reg: 40006 },
  ]
  const records: any[] = []
  let factorIdCounter = 1
  for (const loc of locations) {
    for (const fc of factorConfig) {
      for (let i = 0; i < 2; i++) {
        const val = rand(fc.min, fc.max)
        const collectTime = fmt(dateOffset(randInt(0, 7), randInt(0, 23), randInt(0, 59)))
        records.push({
          factor_id: String(factorIdCounter++),
          device_addr: loc.device,
          device_name: loc.name + '监测仪',
          node_id: loc.node,
          register_id: fc.reg,
          factor_name: fc.name,
          value: val,
          raw_data: val.toFixed(2),
          unit: fc.unit,
          collect_time: collectTime,
          data_time: collectTime,
        })
      }
    }
  }
  await EnvMonitor.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条环境监测数据`)
}

async function seedEnvAlarm() {
  console.log('6. 填充环境报警记录...')
  const alarms = [
    { loc: 'A线车间', dev: 1, node: 1, reg: 40001, factor: '温度', val: 29.50, thr: '28.00', unit: '℃', level: 2, handled: true, fid: '1' },
    { loc: 'B线车间', dev: 2, node: 2, reg: 40002, factor: '湿度', val: 73.20, thr: '70.00', unit: '%RH', level: 1, handled: true, fid: '2' },
    { loc: '原料库', dev: 5, node: 5, reg: 40003, factor: 'PM2.5', val: 96, thr: '75', unit: 'μg/m³', level: 2, handled: true, fid: '3' },
    { loc: 'C线车间', dev: 3, node: 3, reg: 40004, factor: 'CO₂浓度', val: 1180, thr: '1000', unit: 'ppm', level: 3, handled: false, fid: '4' },
    { loc: '微生物室', dev: 6, node: 6, reg: 40005, factor: '甲醛浓度', val: 0.126, thr: '0.100', unit: 'mg/m³', level: 3, handled: false, fid: '5' },
  ]
  const records = alarms.map((a) => ({
    factor_id: a.fid,
    device_addr: a.dev,
    device_name: a.loc + '监测仪',
    node_id: a.node,
    register_id: a.reg,
    factor_name: a.factor,
    alarm_info: `${a.loc} ${a.factor}超标: 当前值${a.val}${a.unit}, 阈值${a.thr}${a.unit}`,
    alarm_level: a.level,
    alarm_range: a.thr,
    current_value: a.val,
    unit: a.unit,
    alarm_time: fmt(dateOffset(randInt(0, 7), randInt(0, 23))),
    is_handled: a.handled ? 1 : 0,
    handle_msg: a.handled ? '已通知相关负责人并处理完毕' : null,
  }))
  await EnvAlarm.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条环境报警`)
}

async function seedWeather() {
  console.log('7. 填充气象数据...')
  const cities = ['长沙市', '望城区', '宁乡市', '浏阳市', '长沙县']
  const records: any[] = []
  for (const city of cities) {
    for (let d = 0; d < 6; d++) {
      const dt = dateOffset(d, randInt(6, 22))
      records.push({
        city,
        area: city,
        temperature: rand(10, 25).toFixed(1),
        humidity: String(randInt(40, 95)),
        pressure: String(randInt(995, 1025)),
        wind_direction: pick(['北风', '南风', '东风', '西风', '东北风', '西南风']),
        wind_power: pick(['1级', '2级', '3级', '4级', '5级']),
        weather: pick(['晴', '多云', '阴', '小雨', '中雨', '大雨']),
        weather_time: fmt(dt),
        source: '中国天气网',
      })
    }
  }
  await WeatherInfo.bulkCreate(records as any)
  console.log(`   ✅ 已填充 ${records.length} 条气象数据`)
}

async function main() {
  console.log('========== 开始填充模拟数据 ==========\n')
  try {
    // 先清空旧数据，避免重复执行时唯一键冲突
    console.log('0. 清空旧数据...')
    await WeatherInfo.destroy({ where: {}, truncate: true })
    await EnvAlarm.destroy({ where: {}, truncate: true })
    await EnvMonitor.destroy({ where: {}, truncate: true })
    await U9Customer.destroy({ where: {}, truncate: true })
    await U9Item.destroy({ where: {}, truncate: true })
    await ScheduledTask.destroy({ where: {}, truncate: true })
    await SyncTask.destroy({ where: {}, truncate: true })
    console.log('   ✅ 旧数据已清空\n')

    await seedSyncLog()
    await seedScheduledTask()
    await seedU9Items()
    await seedU9Customers()
    await seedEnvMonitor()
    await seedEnvAlarm()
    await seedWeather()
    console.log('\n🎉 所有模拟数据填充完成！')
  } catch (err: any) {
    console.error('❌ 填充失败:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}
main()
