import {
  Order,
  ReportOrder,
  ReportProcess,
  ProcessDefect,
  ProcessMaterial,
  DefectType,
  Material,
  Process,
  ProductionLine,
  LineProcess,
} from './src/models/index.js'
import sequelize from './src/config/database.js'

async function createTestData() {
  try {
    console.log('🔄 开始创建测试数据...')

    // 1. 获取一个开立状态的生产订单
    const order = await Order.findOne({ where: { status: 0 } })
    if (!order) {
      console.log('❌ 没有找到开立状态的生产订单')
      return
    }
    console.log(`✅ 找到生产订单: ${order.order_no}`)

    // 2. 获取产线和工序
    const line = await ProductionLine.findOne()
    if (!line) {
      console.log('❌ 没有找到产线')
      return
    }
    console.log(`✅ 找到产线: ${line.line_name}`)

    // 获取该产线的工序
    const lineProcesses = await LineProcess.findAll({
      where: { line_id: line.line_id },
      order: [['sort_order', 'ASC']],
    })
    if (lineProcesses.length === 0) {
      console.log('❌ 产线没有工序')
      return
    }
    console.log(`✅ 找到 ${lineProcesses.length} 道工序`)

    // 获取工序详情
    const processIds = lineProcesses.map(lp => lp.process_id)
    const processes = await Process.findAll({
      where: { process_id: processIds },
    })
    const processMap = {}
    processes.forEach(p => {
      processMap[p.process_id] = p
    })

    // 3. 创建报工单
    const reportOrder = await ReportOrder.create({
      order_id: order.order_id,
      order_no: order.order_no,
      report_no: 'WO260714001',
      line_id: line.line_id,
      line_name: line.line_name,
      material_id: order.material_id,
      material_code: order.material_code,
      material_name: order.material_name,
      specification: order.specification,
      report_qty: order.planned_qty,
      report_time: new Date(),
      status: 0, // 开工
      report_user_id: 1,
      report_user_name: '管理员',
    })
    console.log(`✅ 创建报工单: ${reportOrder.report_no}`)

    // 4. 创建报工工序
    const reportProcesses = []
    for (const lp of lineProcesses) {
      const proc = processMap[lp.process_id]
      if (proc) {
        const rp = await ReportProcess.create({
          report_order_id: reportOrder.report_order_id,
          process_id: proc.process_id,
          process_code: proc.process_code,
          process_name: proc.process_name,
          sort_order: lp.sort_order,
        })
        reportProcesses.push(rp)
        console.log(`  - 添加工序: ${proc.process_name}`)
      }
    }

    // 5. 获取不良类型
    const allDefectTypes = await DefectType.findAll({
      where: { status: 1 },
      limit: 10,
    })
    const defectTypes = allDefectTypes.filter(d => {
      const dt = d.defect_type
      return dt === '制程不良' || dt === '来料不良'
    }).slice(0, 5)
    console.log(`✅ 找到 ${defectTypes.length} 个不良类型`)

    // 6. 为第一道工序添加不良记录
    if (reportProcesses.length > 0 && defectTypes.length > 0) {
      const firstProcess = reportProcesses[0]
      console.log(`\n📝 为工序 "${firstProcess.process_name}" 添加不良记录...`)

      for (let i = 0; i < Math.min(3, defectTypes.length); i++) {
        const dt = defectTypes[i]
        const defect = await ProcessDefect.create({
          report_order_id: reportOrder.report_order_id,
          process_id: firstProcess.process_id,
          defect_type_id: dt.defect_id,
          quantity: (i + 1) * 2,
          unit: dt.defect_unit || '个',
          defect_images: JSON.stringify([]),
        })
        console.log(`  - 添加不良: ${dt.defect_name} x ${(i + 1) * 2}`)
      }
    }

    // 7. 获取物料
    const materials = await Material.findAll({
      where: { is_active: true },
      limit: 5,
    })
    console.log(`✅ 找到 ${materials.length} 个物料`)

    // 8. 为第一道工序添加物料记录
    if (reportProcesses.length > 0 && materials.length > 0) {
      const firstProcess = reportProcesses[0]
      console.log(`\n📝 为工序 "${firstProcess.process_name}" 添加物料记录...`)

      for (let i = 0; i < Math.min(3, materials.length); i++) {
        const mat = materials[i]
        const material = await ProcessMaterial.create({
          report_order_id: reportOrder.report_order_id,
          process_id: firstProcess.process_id,
          material_type: '投入',
          bas_material_id: mat.material_id,
          material_batch: `BATCH${String(i + 1).padStart(4, '0')}`,
          quantity: (i + 1) * 100,
          label_images: JSON.stringify([]),
        })
        console.log(`  - 添加物料: ${mat.material_name} x ${(i + 1) * 100} (批号: BATCH${String(i + 1).padStart(4, '0')})`)
      }
    }

    // 9. 为第二道工序也添加一些数据（如果有的话）
    if (reportProcesses.length > 1) {
      const secondProcess = reportProcesses[1]
      console.log(`\n📝 为工序 "${secondProcess.process_name}" 添加数据...`)

      if (defectTypes.length > 3) {
        const dt = defectTypes[3]
        await ProcessDefect.create({
          report_order_id: reportOrder.report_order_id,
          process_id: secondProcess.process_id,
          defect_type_id: dt.defect_id,
          quantity: 5,
          unit: dt.defect_unit || '个',
          defect_images: JSON.stringify([]),
        })
        console.log(`  - 添加不良: ${dt.defect_name} x 5`)
      }

      if (materials.length > 3) {
        const mat = materials[3]
        await ProcessMaterial.create({
          report_order_id: reportOrder.report_order_id,
          process_id: secondProcess.process_id,
          material_type: '投入',
          bas_material_id: mat.material_id,
          material_batch: 'BATCH0005',
          quantity: 200,
          label_images: JSON.stringify([]),
        })
        console.log(`  - 添加物料: ${mat.material_name} x 200 (批号: BATCH0005)`)
      }
    }

    console.log('\n🎉 测试数据创建完成！')
    console.log(`   报工单号: ${reportOrder.report_no}`)
    console.log(`   报工单ID: ${reportOrder.report_order_id}`)
    console.log(`   工序数量: ${reportProcesses.length}`)
    console.log(`\n   移动端访问路径: /mobile/reporting/${reportOrder.report_order_id}`)

    await sequelize.close()
    process.exit(0)
  } catch (err) {
    console.error('❌ 创建测试数据失败:', err)
    try {
      await sequelize.close()
    } catch (_) {}
    process.exit(1)
  }
}

createTestData()
