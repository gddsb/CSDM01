import sequelize from './src/config/database.js'
import { Op } from 'sequelize'
import Device from './src/models/Device.js'
import Std from './src/models/DeviceMaintenanceStandard.js'
import Prof from './src/models/DeviceMaintenanceProfile.js'
import Rec from './src/models/DeviceMaintenanceRecord.js'
import fs from 'fs'

async function main() {
  const data: any[] = JSON.parse(fs.readFileSync('./_data2.json', 'utf8'))
  console.log('loaded', data.length, 'records from JSON')

  const t = await sequelize.transaction()
  try {
    const codes = [...new Set(data.map((d: any) => d.device_code))]
    // 1. 创建缺失设备(findOrCreate,device_name 用编号)
    let createdDevs = 0
    for (const code of codes) {
      const [, created] = await Device.findOrCreate({
        where: { device_code: code },
        defaults: { device_code: code, device_name: code, status: '运行' as any },
        transaction: t,
      })
      if (created) createdDevs++
    }
    console.log('created missing devices:', createdDevs)

    // 2. 查所有涉及设备的 device_id + device_name
    const devs = await Device.findAll({
      where: { device_code: { [Op.in]: codes } },
      attributes: ['device_id', 'device_code', 'device_name'],
      transaction: t,
    })
    const devMap = new Map<string, { id: number; name: string }>()
    for (const d of devs) devMap.set(d.getDataValue('device_code'), { id: d.getDataValue('device_id'), name: d.getDataValue('device_name') })
    const missing = codes.filter(c => !devMap.has(c))
    if (missing.length) throw new Error('设备主数据缺失: ' + missing.join(', '))
    console.log('device map size:', devMap.size)

    // 3. 去重:查现有 standard 的 (device_code + maintenance_content) 键
    const existing = await Std.findAll({
      where: { device_code: { [Op.in]: codes } },
      attributes: ['device_code', 'maintenance_content'],
      transaction: t,
    })
    const existKeys = new Set(existing.map(s => s.getDataValue('device_code') + '||' + s.getDataValue('maintenance_content')))
    const toInsert = data.filter(d => !existKeys.has(d.device_code + '||' + d.maintenance_content))
    console.log('to insert:', toInsert.length, '(skip existing:', data.length - toInsert.length, ')')

    if (toInsert.length) {
      // 4. 批量插入 device_standard
      const stdRows = toInsert.map((d: any) => ({
        device_id: devMap.get(d.device_code)!.id,
        device_code: d.device_code,
        device_name: devMap.get(d.device_code)!.name,
        item_name: d.item_name,
        mechanism: d.mechanism,
        component: d.component,
        location: d.location,
        maintenance_method: d.maintenance_method,
        maintenance_content: d.maintenance_content,
        judge_type: d.judge_type,
        standard_value: d.standard_value,
        unit: d.unit,
        point_count: d.point_count,
        time_per_point: d.time_per_point,
        trigger_mode: d.trigger_mode,
        monthly_plan: d.monthly_plan,
        runtime_threshold: d.runtime_threshold,
        last_trigger_value: d.last_trigger_value,
        sort_order: d.sort_order,
        status: d.status,
        remarks: d.remarks,
      }))
      await Std.bulkCreate(stdRows, { transaction: t, validate: true })
      console.log('inserted device_standard:', stdRows.length)
    }

    // 5. 为没有 profile 的设备创建 profile(编制)
    const profExisting = await Prof.findAll({
      where: { device_code: { [Op.in]: codes } },
      attributes: ['device_code'],
      transaction: t,
    })
    const profiledCodes = new Set(profExisting.map(p => p.getDataValue('device_code')))
    const newProfCodes = codes.filter(c => !profiledCodes.has(c))
    if (newProfCodes.length) {
      const profRows = newProfCodes.map((c: string) => ({
        device_id: devMap.get(c)!.id,
        device_code: c,
        device_name: devMap.get(c)!.name,
        status: '编制',
        version: 1,
      }))
      await Prof.bulkCreate(profRows, { transaction: t, validate: true })
      console.log('created new profiles:', profRows.length, '| codes:', newProfCodes.join(', '))
    } else {
      console.log('all devices already have profile, no new profile created')
    }

    await t.commit()
    console.log('=== IMPORT DONE ===')
    console.log('device_standard total:', await Std.count())
    console.log('device_maintenance_profile total:', await Prof.count())
    console.log('device_record total:', await Rec.count())
    const byMode: Record<string, number> = {}
    const all = await Std.findAll({ attributes: ['trigger_mode'] })
    for (const s of all) byMode[s.getDataValue('trigger_mode')] = (byMode[s.getDataValue('trigger_mode')] || 0) + 1
    console.log('by trigger_mode:', JSON.stringify(byMode))
  } catch (e: any) {
    try { await t.rollback() } catch {}
    console.error('IMPORT FAILED:', e.message)
    console.error(e.stack)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}
main()
