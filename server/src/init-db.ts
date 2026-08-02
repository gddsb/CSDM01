/**
 * 精简初始化脚本：
 * 1. 同步表结构 + 初始化默认配置/权限/编号规则/任务设置
 * 2. 更新 energy_meter 任务名称为"电能数据采集"
 * 3. 清理 DASHBOARD_VIEWER / DASHBOARD_ADMIN 角色
 * 4. 刷新数据字典
 */

import sequelize from './config/database.js'
import { TaskSetting, Role, DataDictionary } from './models/index.js'
import { initDefaultConfigs, refreshDictionaryData } from './controllers/SystemConfigController.js'
import { initDefaultPermissions } from './controllers/RoleController.js'
import { initDefaultRules } from './controllers/NumberRuleController.js'
import { runMigrations } from './migrate.js'
import { Op } from 'sequelize'

async function main() {
  try {
    console.log('🧪 开始初始化数据库')
    await sequelize.sync()
    console.log('✅ sequelize.sync()')
    await runMigrations()
    console.log('✅ runMigrations()')
    await initDefaultConfigs()
    console.log('✅ initDefaultConfigs()')
    await initDefaultPermissions()
    console.log('✅ initDefaultPermissions()')
    await initDefaultRules()
    console.log('✅ initDefaultRules()')

    // 初始化任务设置 & 强制修正 energy_meter 名称
    const defaultTasks = [
      { task_type: 'items', name: '料品数据同步', description: '从U9 ERP系统同步料品基础档案数据', source_url: '', field_count: 24, is_active: 1 },
      { task_type: 'customers', name: '客户数据同步', description: '从U9 ERP系统同步客户基础档案数据', source_url: '', field_count: 11, is_active: 1 },
      { task_type: 'production_orders', name: '生产订单同步', description: '从U9 ERP系统同步生产订单数据（制造订单MO）', source_url: '', field_count: 15, is_active: 1 },
      { task_type: 'env_monitor', name: '环境监测采集', description: '从0531yun物联网平台采集车间环境监测数据', source_url: '', field_count: 15, is_active: 1 },
      { task_type: 'weather', name: '气象信息抓取', description: '从中国天气网抓取城市/区域实时气象数据', source_url: '', field_count: 8, is_active: 1 },
      { task_type: 'energy_meter', name: '电能数据采集', description: '从云集云能源平台采集总表有功/无功总电能历史记录', source_url: '', field_count: 11, is_active: 1 },
    ]
    for (const t of defaultTasks) {
      const [rec, created] = await TaskSetting.findOrCreate({ where: { task_type: t.task_type }, defaults: t })
      if (!created) {
        await rec.update({ name: t.name, description: t.description, field_count: t.field_count })
        console.log(`  ↻ 更新任务 ${t.task_type} → 名称=${t.name}`)
      } else {
        console.log(`  + 创建任务 ${t.task_type} → 名称=${t.name}`)
      }
    }
    console.log('✅ 任务设置初始化完成')

    // 清理无用角色（先删除关联的 user_role 记录，避免外键约束失败）
    const badRoles = await Role.findAll({ where: { role_code: { [Op.in]: ['DASHBOARD_VIEWER', 'DASHBOARD_ADMIN'] } } })
    for (const r of badRoles) {
      console.log(`  🗑 删除角色 ${r.role_name} (${r.role_code})`)
      try {
        // 先删除关联的用户-角色记录，避免外键约束失败
        await sequelize.query(`DELETE FROM sys_user_role WHERE role_id = :rid`, { replacements: { rid: r.role_id } })
        await r.destroy()
      } catch (e: any) {
        console.log(`    ⚠️ 删除角色失败: ${e.message}，跳过`)
      }
    }
    console.log(`✅ 清理 ${badRoles.length} 个无用角色`)

    // 刷新数据字典
    await refreshDictionaryData()
    console.log('✅ 数据字典已刷新')

    // 验证质量表分类
    const qt = ['quality_incoming_inspection', 'quality_incoming_inspection_item', 'quality_microbe_inspection', 'quality_microbe_inspection_item']
    for (const tn of qt) {
      const rec = await DataDictionary.findOne({ where: { table_name: tn } })
      if (rec) console.log(`  📋 ${tn} → 分类=${rec.category}, 用途=${(rec.purpose || '').slice(0, 30)}...`)
    }

    console.log('\n🎉 初始化完成')
  } catch (err: any) {
    console.error('❌ 初始化失败:', err)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}
main()
