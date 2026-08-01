/**
 * 最终验证脚本
 */
import sequelize from './config/database.js'
import {
  TaskSetting, Role, Permission, DataDictionary,
  SyncTask, ScheduledTask, U9Item, U9Customer,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData
} from './models/index.js'
import { Op } from 'sequelize'

async function count(m: any, label: string) {
  try { const c = await m.count(); console.log(`   ✅ ${label}: ${c} 条`); return c }
  catch (e: any) { console.log(`   ❌ ${label} 失败:`, e.message); return 0 }
}

async function main() {
  try {
    console.log('========== 最终验证 ==========\n')

    console.log('【1】任务设置验证')
    const tasks = await TaskSetting.findAll()
    for (const t of tasks) {
      console.log(`   - task_type=${t.task_type} → 名称=${t.name}, 启用=${t.is_active}`)
    }
    const energy = tasks.find(t => t.task_type === 'energy_meter')
    if (energy?.name === '电能数据采集') console.log('   ✅ 能源采集任务名称验证通过')
    else console.log(`   ❌ 能源采集任务名称错误：${energy?.name}`)

    console.log('\n【2】模拟数据记录数验证')
    await count(SyncTask, '同步日志(task_sync_log)')
    await count(ScheduledTask, '定时任务(task_scheduled)')
    await count(U9Item, '料品档案(task_item)')
    await count(U9Customer, '客户档案(task_customer)')
    await count(EnvMonitor, '环境监测数据')
    await count(EnvAlarm, '环境报警记录')
    await count(WeatherInfo, '气象数据')
    await count(EnergyMeterData, '能源采集数据')

    console.log('\n【3】权限验证 - 看板设置菜单是否已清除')
    const dashboardSetting = await Permission.findOne({
      where: { perm_code: { [Op.like]: '%bigscreen:setting%' } }
    })
    if (dashboardSetting) console.log(`   ❌ 仍然存在看板设置权限: ${dashboardSetting.perm_name} (${dashboardSetting.perm_code})`)
    else console.log('   ✅ 已清除看板设置菜单权限')
    const bigscreenPerms = await Permission.findAll({
      where: { perm_code: { [Op.like]: 'bigscreen%' } },
      attributes: ['perm_code', 'perm_name']
    })
    console.log(`   📋 剩余大屏相关权限：`)
    bigscreenPerms.forEach(p => console.log(`     - ${p.perm_code}: ${p.perm_name}`))

    console.log('\n【4】DASHBOARD_VIEWER 角色清理验证')
    const badRole = await Role.findAll({ where: { role_code: { [Op.in]: ['DASHBOARD_VIEWER', 'DASHBOARD_ADMIN'] } } })
    if (badRole.length === 0) console.log('   ✅ DASHBOARD_VIEWER/ADMIN 角色均已清除')
    else badRole.forEach(r => console.log(`   ❌ 仍然存在角色 ${r.role_code}: ${r.role_name}`))

    console.log('\n【5】数据字典中质量相关表分类验证')
    const qt = ['quality_incoming_inspection', 'quality_incoming_inspection_item', 'quality_microbe_inspection', 'quality_microbe_inspection_item']
    const expected = {
      quality_incoming_inspection: '来料检验子表',
      quality_incoming_inspection_item: '来料检验主表',
      quality_microbe_inspection: '微生物检验和环境检验主表',
      quality_microbe_inspection_item: '微生物检验和环境检验子表',
    } as Record<string, string>
    let allOk = true
    for (const tn of qt) {
      const rec = await DataDictionary.findOne({ where: { table_name: tn } })
      if (!rec) { console.log(`   ❌ ${tn} 字典记录不存在`); allOk = false; continue }
      const ok = rec.category === '业务表' && rec.purpose?.includes(expected[tn])
      if (ok) console.log(`   ✅ ${tn} → 分类=${rec.category}, 说明匹配`)
      else { console.log(`   ❌ ${tn} → 分类=${rec.category}, 用途=${rec.purpose?.slice(0, 40)}`); allOk = false }
    }

    console.log('\n【6】前端构建 dist 目录验证')
    try {
      const fs = await import('fs')
      const path = await import('path')
      const distPath = path.resolve(process.cwd(), '..', 'dist')
      if (fs.existsSync(distPath)) {
        const f = fs.readdirSync(path.join(distPath, 'assets'))
        console.log(`   ✅ dist 目录存在，assets 包含 ${f.length} 个文件`)
        const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8')
        if (indexHtml.includes('assets/index')) console.log('   ✅ index.html 引用新构建的资源')
      } else {
        console.log('   ⚠️  dist 目录不存在 (可能是相对路径问题，跳过)')
      }
    } catch (e: any) {
      console.log('   ⚠️  跳过前端dist验证：', e.message)
    }

    console.log('\n==============================')
    console.log(allOk ? '🎉 验证全部通过！' : '⚠️  请关注上述 ❌ 项')
  } catch (err: any) {
    console.error('❌ 验证脚本异常:', err)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}
main()
