import sequelize from './src/config/database.js'
import {
  Order, Supplier, Customer, Device, ProductionLine,
  Process, Material, User, InspectionStandard, InspectionStandardItem,
  ReportOrder, ReportProcess, LineProcess, DefectType,
  ProcessException, ProcessDefect, ProcessMaterial, ManpowerRecord,
  ReportImage, ProductInspection,
} from './src/models/index.js'

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n, len = 2) { return String(n).padStart(len, '0') }

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function regenerateReportOrders() {
  console.log('\n=== 重新生成报工单数据 ===')
  console.log('1. 清空旧报工单数据...')

  // 先删除产品检验（关联报工单）
  const productInspCount = await ProductInspection.count()
  if (productInspCount > 0) {
    console.log('  先清空产品检验记录:', productInspCount, '条')
    await ProductInspection.destroy({ where: {}, force: true })
  }

  // 删除关联数据
  await ReportImage.destroy({ where: {}, force: true })
  await ManpowerRecord.destroy({ where: {}, force: true })
  await ProcessException.destroy({ where: {}, force: true })
  await ProcessDefect.destroy({ where: {}, force: true })
  await ProcessMaterial.destroy({ where: {}, force: true })
  await ReportProcess.destroy({ where: {}, force: true })
  await ReportOrder.destroy({ where: {}, force: true })
  console.log('  ✅ 旧数据已清空')

  console.log('\n2. 加载基础数据...')
  const orders = await Order.findAll({ raw: true })
  const lines = await ProductionLine.findAll({ raw: true })
  const users = await User.findAll({ raw: true })
  const lineProcesses = await LineProcess.findAll({ raw: true })
  const defectTypes = await DefectType.findAll({ raw: true })
  const materials = await Material.findAll({ raw: true, limit: 50 })
  const devices = await Device.findAll({ raw: true })

  const opUsers = users.filter(u => u.role_id === 6 || u.username === 'op')
  const pmUsers = users.filter(u => u.role_id === 5 || u.username === 'pm')
  const maintUsers = users.filter(u => u.role_id === 8 || u.username === 'maint')

  console.log('  订单:', orders.length, '条')
  console.log('  产线:', lines.length, '条')
  console.log('  工序(产线):', lineProcesses.length, '条')
  console.log('  不良类型:', defectTypes.length, '条')

  const reportOrders = []
  const reportProcesses = []
  const processDefects = []
  const processExceptions = []
  const processMaterials = []

  const scrapDefectTypes = defectTypes.filter(d => d.defect_type === '检验报废')
  const normalDefectTypes = defectTypes.filter(d => d.defect_type !== '检验报废')

  let roId = 1
  const mayStart = new Date(2026, 4, 1)
  const julEnd = new Date(2026, 6, 30)

  console.log('\n3. 生成报工单...')

  for (const order of orders) {
    const line = pick(lines)
    const lineId = line.line_id
    const lineDevices = devices.filter(d => d.line_id === lineId || d.line_id == null)

    const roCount = rand(1, 2)
    for (let r = 0; r < roCount; r++) {
      const reportUser = pick(opUsers)
      const finishUser = pick(pmUsers)

      const reportDate = randomDate(mayStart, julEnd)
      const reportTime = new Date(reportDate.getTime() + r * 3600000 * 2)
      const finishTime = new Date(reportTime.getTime() + rand(2, 8) * 3600000)

      const curRP = []
      const curPD = []
      const curScrap = []
      const curPM = []
      const curPE = []

      let firstProcessInput = 0
      let firstProcessReturn = 0

      const procs = lineProcesses.filter(lp => lp.line_id === lineId)
      for (const lp of procs) {
        const proc = await Process.findByPk(lp.process_id, { raw: true })
        if (!proc) continue

        const hasMat = proc.has_material === 1 || proc.has_material === true ? 1 : 0
        const mustRep = proc.must_report === 1 || proc.must_report === true ? 1 : 0

        curRP.push({
          report_order_id: roId,
          process_id: proc.process_id,
          process_code: proc.process_code,
          process_name: proc.process_name,
          has_material: hasMat,
          must_report: mustRep,
          sort_order: lp.sort_order,
          created_at: reportTime,
          updated_at: reportTime,
        })

        // must_report=1 必须有不良记录
        const needDefect = mustRep === 1 || Math.random() < 0.3
        if (needDefect) {
          const defectCount = mustRep === 1 ? rand(1, 3) : rand(1, 2)
          for (let d = 0; d < defectCount; d++) {
            const def = pick(normalDefectTypes.length > 0 ? normalDefectTypes : defectTypes)
            curPD.push({
              report_order_id: roId,
              process_id: proc.process_id,
              defect_type_id: def.defect_id,
              quantity: rand(1, 20),
              unit: '个',
              created_at: reportTime,
            })
          }
        }

        const procIndex = procs.findIndex(lp => lp.process_id === proc.process_id)
        const isFirstProcess = procIndex === 0
        const needMaterial = hasMat === 1

        if (isFirstProcess) {
          const investMat = materials.length > 0 ? pick(materials) : null
          const investQty = Math.floor(order.planned_qty * (0.9 + Math.random() * 0.2))
          firstProcessInput = investQty
          curPM.push({
            report_order_id: roId,
            process_id: proc.process_id,
            material_type: '投入',
            bas_material_id: investMat?.material_id || null,
            material_batch: 'B' + pad(rand(1000, 9999)),
            package_no: 'P' + pad(rand(100, 999)),
            quantity: investQty,
            created_at: reportTime,
          })
          if (Math.random() < 0.05) {
            const retQty = rand(1, 10)
            firstProcessReturn = retQty
            curPM.push({
              report_order_id: roId,
              process_id: proc.process_id,
              material_type: '退回',
              bas_material_id: investMat?.material_id || null,
              material_batch: 'B' + pad(rand(1000, 9999)),
              package_no: 'P' + pad(rand(100, 999)),
              quantity: retQty,
              created_at: reportTime,
            })
          }
        }

        if (!isFirstProcess) {
          if (needMaterial) {
            const mat = materials.length > 0 ? pick(materials) : null
            curPM.push({
              report_order_id: roId,
              process_id: proc.process_id,
              material_type: '投入',
              bas_material_id: mat?.material_id || null,
              material_batch: 'B' + pad(rand(1000, 9999)),
              package_no: 'P' + pad(rand(100, 999)),
              quantity: rand(10, 200),
              created_at: reportTime,
            })
          } else if (Math.random() < 0.3 && materials.length > 0) {
            const mat = pick(materials)
            curPM.push({
              report_order_id: roId,
              process_id: proc.process_id,
              material_type: '投入',
              bas_material_id: mat.material_id,
              material_batch: 'B' + pad(rand(1000, 9999)),
              package_no: 'P' + pad(rand(100, 999)),
              quantity: rand(10, 200),
              created_at: reportTime,
            })
          }
        }
      }

      // 所有工序不良总和
      const totalProcessDefectQty = curPD.reduce((s, d) => s + Number(d.quantity || 0), 0)

      // 检验报废
      let totalScrapQty = 0
      if (Math.random() < 0.3 && scrapDefectTypes.length > 0) {
        const scrapCount = rand(1, 2)
        for (let s = 0; s < scrapCount; s++) {
          const def = pick(scrapDefectTypes)
          const qty = rand(1, 15)
          totalScrapQty += qty
          curScrap.push({
            report_order_id: roId,
            process_id: null,
            defect_type_id: def.defect_id,
            quantity: qty,
            unit: '个',
            created_at: reportTime,
          })
        }
      }

      // 报工单产出 = 首道投入 - 首道退回 - 所有不良 - 检验报废
      const firstProcessNetInput = Math.max(0, firstProcessInput - firstProcessReturn)
      const reportQty = Math.max(0, firstProcessNetInput - totalProcessDefectQty - totalScrapQty)

      // 异常工时
      if (Math.random() < 0.2 && lineDevices.length > 0) {
        const excTypes = ['设备故障', '物料短缺', '质量异常', '人员短缺', '工艺问题']
        const device = pick(lineDevices)
        const confirmer = pick(maintUsers.length > 0 ? maintUsers : pmUsers)
        curPE.push({
          report_order_id: roId,
          exception_type: pick(excTypes),
          device_id: device.device_id,
          device_code: device.device_code,
          device_name: device.device_name,
          stop_type: pick(['计划停机', '非计划停机', '故障停机']),
          confirm_user: confirmer.username,
          confirm_user_name: confirmer.real_name || confirmer.username,
          start_time: new Date(reportTime.getTime() + rand(30, 120) * 60000),
          end_time: new Date(reportTime.getTime() + rand(120, 300) * 60000),
          duration: rand(30, 180) / 60,
          description: '模拟生成异常工时记录',
          record_user: reportUser.username,
          record_user_name: reportUser.real_name || reportUser.username,
          created_at: reportTime,
        })
      }

      reportOrders.push({
        report_order_id: roId,
        order_id: order.order_id,
        order_no: order.order_no,
        report_no: 'WO-16' + reportTime.getFullYear().toString().slice(2) +
          pad(reportTime.getMonth() + 1) + pad(reportTime.getDate()) + pad(roId, 3),
        line_id: lineId,
        line_name: line.line_name,
        material_id: order.material_id,
        material_code: order.material_code,
        material_name: order.material_name,
        specification: order.specification || '',
        report_qty: reportQty,
        report_time: reportTime,
        finish_time: finishTime,
        close_time: finishTime,
        status: 1,
        report_user_id: reportUser.user_id,
        report_user_name: reportUser.real_name || reportUser.username,
        finish_user_id: finishUser.user_id,
        finish_user_name: finishUser.real_name || finishUser.username,
        close_user_id: finishUser.user_id,
        close_user_name: finishUser.real_name || finishUser.username,
        remarks: '模拟生成报工单数据',
        created_at: reportTime,
        updated_at: finishTime,
      })

      reportProcesses.push(...curRP)
      processDefects.push(...curPD, ...curScrap)
      processMaterials.push(...curPM)
      processExceptions.push(...curPE)

      roId++
    }
  }

  console.log('\n4. 写入数据库...')
  await ReportOrder.bulkCreate(reportOrders)
  console.log('  ✅ 报工单:', reportOrders.length, '条')
  if (reportProcesses.length > 0) {
    await ReportProcess.bulkCreate(reportProcesses)
    console.log('  ✅ 报工工序:', reportProcesses.length, '条')
  }
  if (processDefects.length > 0) {
    await ProcessDefect.bulkCreate(processDefects)
    console.log('  ✅ 工序不良:', processDefects.length, '条')
  }
  if (processExceptions.length > 0) {
    await ProcessException.bulkCreate(processExceptions)
    console.log('  ✅ 异常工时:', processExceptions.length, '条')
  }
  if (processMaterials.length > 0) {
    await ProcessMaterial.bulkCreate(processMaterials)
    console.log('  ✅ 工序物料:', processMaterials.length, '条')
  }

  // 同步订单状态
  console.log('\n5. 同步订单状态...')
  const orderIds = [...new Set(reportOrders.map(r => r.order_id))]
  let orderUpdated = 0
  for (const orderId of orderIds) {
    const order = await Order.findByPk(orderId)
    if (!order) continue
    const orderRos = reportOrders.filter(r => r.order_id === orderId)
    const totalRO = orderRos.length
    const finishedRO = orderRos.filter(r => r.status === 1).length
    const finishedSum = orderRos.reduce((s, r) => s + Number(r.report_qty || 0), 0)
    const plannedQty = Number(order.planned_qty || 0)

    let targetStatus = order.getDataValue('status')
    if (totalRO > 0 && finishedRO === totalRO && finishedSum >= plannedQty) {
      targetStatus = 3
    } else if (finishedRO > 0) {
      targetStatus = 2
    } else if (totalRO > 0) {
      targetStatus = 2
    }

    if (targetStatus !== order.getDataValue('status')) {
      await order.update({ status: targetStatus, finished_qty: finishedSum })
      orderUpdated++
    } else {
      await order.update({ finished_qty: finishedSum })
    }
  }
  console.log('  ✅ 同步订单:', orderUpdated, '个')

  console.log('\n🎉 报工单模拟数据重新生成完成！')
}

async function main() {
  try {
    await sequelize.sync()
    console.log('✅ 数据库表同步完成')
    await regenerateReportOrders()
  } catch (err) {
    console.error('❌ 失败:', err.message)
    console.error(err.stack)
  } finally {
    await sequelize.close()
  }
}

main()
