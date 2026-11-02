import Sequelize, { Op } from 'sequelize'
import { dailyPeriodKeys, weeklyPeriodKeys } from './src/utils/maintenanceMatrix.js'

const effectiveDeviceIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 19, 24, 27, 28, 29, 30, 31, 32, 33, 34, 35]

const yr = 2026, mo = 11
const dailyKeys = dailyPeriodKeys(yr, mo)
const weekKeys = weeklyPeriodKeys(yr, mo)
const target_month = '2026-11'

const seq = new Sequelize({ dialect: 'mysql', logging: false })

console.log('========== SQL: 查 existingRecords ==========')
const whereExisting = {
  device_id: { [Op.in]: effectiveDeviceIds },
  [Op.or]: [
    { trigger_mode: 'daily', period_key: { [Op.gte]: dailyKeys[0], [Op.lte]: dailyKeys[dailyKeys.length - 1] } },
    { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
    { trigger_mode: 'monthly', period_key: target_month },
  ],
}
const sql = seq.getQueryInterface().selectQuery('device_maintenance_record', whereExisting, {
  attributes: ['record_id', 'standard_id', 'period_key', 'trigger_mode', 'status', 'device_code', 'device_name'],
})
console.log(sql)

console.log('\n========== 关键变量 ==========')
console.log('dailyKeys range:', dailyKeys[0], '~', dailyKeys[dailyKeys.length-1])
console.log('weekKeys:', weekKeys)
console.log('monthly target:', target_month)
console.log('effectiveDeviceIds sample:', effectiveDeviceIds.slice(0, 3), 'types:', effectiveDeviceIds.slice(0,3).map(i => typeof i))

console.log('\n========== 怀疑：Profile.device_id 类型 vs Standard.device_id ==========')
console.log('如果 Profile.device_id 从 DB 查出来是 STRING 类型（Sequelize 配置问题）')
console.log('而 Standard/Record 表里 device_id 是 INTEGER')
console.log('那 Op.in: ["1","2","3"] 和 INTEGER 列可能不完全匹配')
console.log('但 MySQL 会自动做类型转换，应该没问题...')

console.log('\n========== 再怀疑：Op.or + Op.in 在 MySQL 里的优先级 ==========')
console.log('WHERE device_id IN (...)')
console.log('  AND (trigger_mode="daily" AND period_key BETWEEN ...')
console.log('       OR trigger_mode="weekly" AND period_key IN (...)')
console.log('       OR trigger_mode="monthly" AND period_key = "2026-11")')
console.log('这应该正确... 但如果括号没加对就会出问题！')
