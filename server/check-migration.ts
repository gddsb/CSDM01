import { Op } from 'sequelize'
import sequelize from './src/config/database.js'
import {
  Permission, TaskSetting, ScheduledTask, SyncTask,
  U9Item, U9Customer, EnvMonitor, EnvAlarm, WeatherInfo
} from './src/models/index.js'

async function check() {
  try {
    await sequelize.authenticate()
    console.log('✅ 数据库连接成功\n')

    // 检查菜单权限中的自动任务相关
    console.log('🔍 ========================================')
    console.log('📋 检查1: 自动任务菜单权限 (sys_permission)')
    console.log('🔍 ========================================')
    const perms = await Permission.findAll({
      where: { perm_code: { [Op.like]: 'auto%' } },
      order: [['sort_order', 'ASC']],
      raw: true,
    })
    console.log(`找到 ${perms.length} 条自动任务相关权限:`)
    perms.forEach(p => {
      console.log(`  [${p.type}] ${p.perm_code} - ${p.perm_name} (parent_id:${p.parent_id}, path:${p.path || 'N/A'})`)
    })

    // 检查任务设置
    console.log('\n🔍 ========================================')
    console.log('📋 检查2: 任务设置 (task_setting)')
    console.log('🔍 ========================================')
    const tasks = await TaskSetting.findAll({ raw: true })
    console.log(`记录数: ${tasks.length}`)
    tasks.forEach(t => console.log(`  [${t.task_type}] ${t.name} (active:${t.is_active})`))

    // 检查定时任务
    console.log('\n🔍 ========================================')
    console.log('📋 检查3: 定时任务 (scheduled_task)')
    console.log('🔍 ========================================')
    const scheds = await ScheduledTask.findAll({ raw: true })
    console.log(`记录数: ${scheds.length}`)
    scheds.forEach(s => console.log(`  [${s.schedule_biz_id}] ${s.name} - type:${s.task_type}, enabled:${s.is_enabled}`))

    // 检查同步任务
    console.log('\n🔍 ========================================')
    console.log('📋 检查4: 同步任务 (sync_task)')
    console.log('🔍 ========================================')
    const syncs = await SyncTask.findAll({ raw: true, limit: 5 })
    console.log(`记录数: ${await SyncTask.count()}`)
    syncs.forEach(s => console.log(`  [${s.task_biz_id}] type:${s.task_type}, status:${s.status}, progress:${s.progress}%`))

    // 检查料品数据
    console.log('\n🔍 ========================================')
    console.log('📋 检查5: U9料品数据 (u9_item)')
    console.log('🔍 ========================================')
    console.log(`记录数: ${await U9Item.count()}`)

    // 检查客户数据
    console.log('\n🔍 ========================================')
    console.log('📋 检查6: U9客户数据 (u9_customer)')
    console.log('🔍 ========================================')
    console.log(`记录数: ${await U9Customer.count()}`)

    // 检查环境监测
    console.log('\n🔍 ========================================')
    console.log('📋 检查7: 环境监测数据 (env_monitor)')
    console.log('🔍 ========================================')
    console.log(`记录数: ${await EnvMonitor.count()}`)

    // 检查环境报警
    console.log('\n🔍 ========================================')
    console.log('📋 检查8: 环境报警数据 (env_alarm)')
    console.log('🔍 ========================================')
    console.log(`记录数: ${await EnvAlarm.count()}`)

    // 检查天气信息
    console.log('\n🔍 ========================================')
    console.log('📋 检查9: 天气信息 (weather_info)')
    console.log('🔍 ========================================')
    console.log(`记录数: ${await WeatherInfo.count()}`)

    await sequelize.close()
  } catch (err) {
    console.error('❌ 检查失败:', err)
    process.exit(1)
  }
}

check()
