/**
 * 用 Sequelize queryGenerator 直接查看 MaintenanceGenerator 里生成的 SQL
 * 验证 where 条件是否有 bug（比如 device_id 类型不匹配、trigger_mode 条件写反了等）
 */

import Sequelize, { Op } from 'sequelize'
import { dailyPeriodKeys, weeklyPeriodKeys, monthlyStandardActive } from './server/src/utils/maintenanceMatrix.js'

// 模拟 effectiveDeviceIds（Profile 查出来的 device_id）
const effectiveDeviceIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 19, 24, 27, 28, 29, 30, 31, 32, 33, 34, 35]

const yr = 2026, mo = 11
const dailyKeys = dailyPeriodKeys(yr, mo)
const weekKeys = weeklyPeriodKeys(yr, mo)
const target_month = '2026-11'

// 创建一个空的 Sequelize 实例只为了用 queryGenerator
const seq = new Sequelize({
  dialect: 'mysql',
  logging: false,
})

// 模拟 DeviceMaintenanceRecord 模型定义
const DeviceMaintenanceRecord = seq.define('DeviceMaintenanceRecord', {}, {
  tableName: 'device_maintenance_record',
  timestamps: true,
  underscored: true,
})

console.log('========== SQL: 查 effective 档案 ==========')
const sql1 = seq.getQueryInterface().selectQuery('device_maintenance_profile', { status: '生效' }, {
  attributes: ['device_id'],
})
console.log(sql1)

console.log('\n========== SQL: 查 standards ==========')
const sql2 = seq.getQueryInterface().selectQuery('device_standard', {
  trigger_mode: { [Op.in]: ['daily', 'weekly', 'monthly'] },
  status: 1,
  device_id: { [Op.in]: effectiveDeviceIds },
}, {})
console.log(sql2)

console.log('\n========== SQL: 查 existingRecords (关键！) ==========')
const whereExisting = {
  device_id: { [Op.in]: effectiveDeviceIds },
  [Op.or]: [
    { trigger_mode: 'daily', period_key: { [Op.gte]: dailyKeys[0], [Op.lte]: dailyKeys[dailyKeys.length - 1] } },
    { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
    { trigger_mode: 'monthly', period_key: target_month },
  ],
}
const sql3 = seq.getQueryInterface().selectQuery('device_maintenance_record', whereExisting, {
  attributes: ['record_id', 'standard_id', 'period_key', 'trigger_mode', 'status', 'device_code', 'device_name'],
})
console.log(sql3)

console.log('\n========== 关键检查点 ==========')
console.log('dailyKeys 范围:', dailyKeys[0], '~', dailyKeys[dailyKeys.length-1])
console.log('weekKeys:', weekKeys)
console.log('monthly target:', target_month)
console.log('effectiveDeviceIds:', effectiveDeviceIds)

console.log('\n========== 怀疑点：Sequelize 的 Op.or 和 Op.in 组合在事务里的行为 ==========')
console.log('检查 effectiveDeviceIds 类型：', typeof effectiveDeviceIds[0])
console.log('如果 Profile.device_id 查出来是 STRING 而 Standard/Record.device_id 是 INTEGER')
console.log('那 Op.in 可能不匹配！但 Sequelize 的 where 应该会做类型转换...')

console.log('\n========== 另一个怀疑点：Op.or 在 WHERE 里的括号嵌套 ==========')
console.log('实际生成的 SQL 里 weekly period_key IN (...) 和 monthly = ? 是否正确带括号？')
