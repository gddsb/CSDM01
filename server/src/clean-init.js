import sequelize from './config/database.js'
import { DataTypes, Op } from 'sequelize'
import db from './models/index.js'
import bcrypt from 'bcryptjs'

const { User, Role, Permission, OperationLog,
  Material, ProductionLine, Process, Device, DefectType,
  Order, WorkOrder, ProcessReport, ManpowerRecord, ExceptionRecord } = db

async function cleanAll() {
  console.log('🗑️  清除所有示例数据...')

  // 删除生产数据
  await ExceptionRecord.destroy({ where: {}, force: true })
  console.log('✅ 异常记录已清除')
  await ManpowerRecord.destroy({ where: {}, force: true })
  console.log('✅ 人员记录已清除')
  await ProcessReport.destroy({ where: {}, force: true })
  console.log('✅ 工序报工已清除')
  await WorkOrder.destroy({ where: {}, force: true })
  console.log('✅ 工单已清除')
  await Order.destroy({ where: {}, force: true })
  console.log('✅ 生产订单已清除')

  // 删除基础数据
  await DefectType.destroy({ where: {}, force: true })
  console.log('✅ 不良分类已清除')
  await Device.destroy({ where: {}, force: true })
  console.log('✅ 设备档案已清除')
  await Process.destroy({ where: {}, force: true })
  console.log('✅ 工序已清除')
  await ProductionLine.destroy({ where: {}, force: true })
  console.log('✅ 产线已清除')
  await Material.destroy({ where: {}, force: true })
  console.log('✅ 料品档案已清除')

  // 删除操作日志
  await OperationLog.destroy({ where: {}, force: true })
  console.log('✅ 操作日志已清除')

  // 保留角色，删除除admin外的用户
  await User.destroy({ where: { username: { [Op.ne]: 'admin' } }, force: true })
  console.log('✅ 示例用户已清除（保留 admin）')

  console.log('\n🎉 系统初始化完成（干净版）')
  console.log('   - 角色：保留 9 条（系统基础）')
  console.log('   - 用户：保留 1 条（admin / 123456）')
  console.log('   - 其余所有示例数据已清除')
  console.log('\n💡 提示：如需重新填充示例数据，运行 node src/seed.js')

  process.exit(0)
}

cleanAll().catch(err => {
  console.error('初始化失败:', err)
  process.exit(1)
})
