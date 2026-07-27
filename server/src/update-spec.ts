import sequelize from './config/database.js'
import { logger } from './utils/logger.js'

const MATERIAL_CODE = 'C05-342-0115'
const NEW_SPECIFICATION = '502×165'

async function updateSpecification() {
  try {
    console.log(`开始更新料号 ${MATERIAL_CODE} 的规格为 ${NEW_SPECIFICATION}...`)

    const dialect = sequelize.getDialect()
    console.log(`数据库类型: ${dialect}`)

    const [orderResult] = await sequelize.query(
      `UPDATE production_order SET specification = ? WHERE material_code = ?`,
      { replacements: [NEW_SPECIFICATION, MATERIAL_CODE] }
    )
    console.log(`production_order 更新了 ${(orderResult as any).affectedRows || orderResult} 条记录`)

    const [reportResult] = await sequelize.query(
      `UPDATE production_report_order SET specification = ? WHERE material_code = ?`,
      { replacements: [NEW_SPECIFICATION, MATERIAL_CODE] }
    )
    console.log(`production_report_order 更新了 ${(reportResult as any).affectedRows || reportResult} 条记录`)

    const [inspectionResult] = await sequelize.query(
      `UPDATE quality_product_inspection SET specification = ? WHERE material_code = ?`,
      { replacements: [NEW_SPECIFICATION, MATERIAL_CODE] }
    )
    console.log(`quality_product_inspection 更新了 ${(inspectionResult as any).affectedRows || inspectionResult} 条记录`)

    console.log('规格更新完成！')
    process.exit(0)
  } catch (err: any) {
    logger.error('更新规格失败:', err)
    console.error('更新规格失败:', err.message)
    process.exit(1)
  }
}

updateSpecification()
