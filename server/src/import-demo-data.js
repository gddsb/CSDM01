import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sequelize from './config/database.js'
import { Material, Order } from './models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null
  const cleaned = dateStr.trim().replace(/\./g, '-')
  const date = new Date(cleaned)
  return isNaN(date.getTime()) ? null : date
}

function parseNumber(numStr) {
  if (!numStr || numStr.trim() === '') return null
  const cleaned = numStr.trim().replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseBoolean(str) {
  if (!str) return true
  return str.trim() === '√'
}

function parseTabDelimited(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split('\t').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const values = line.split('\t')
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : ''
    })
    return row
  })

  return { headers, rows }
}

async function importMaterials() {
  console.log('\n📦 开始导入料品档案数据...\n')

  const filePath = path.join(__dirname, '../../演示数据-料品档案.txt')
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 文件不存在:', filePath)
    return 0
  }

  const { headers, rows } = parseTabDelimited(filePath)
  console.log(`  📄 共读取 ${rows.length} 条记录`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const materialData = {
        category_name: row['分类名称'] || '',
        material_code: row['料号'] || '',
        material_name: row['品名'] || '',
        specification: row['规格'] || '',
        unit_name: row['单位名称'] || '',
        film_no: row['菲林编号'] || '',
        version_no: row['版本号'] || '',
        cutting_size: row['开料尺寸'] || '',
        printing_process: row['印刷工艺'] || '',
        color_separation: row['分色信息'] || '',
        blanking_diameter: parseNumber(row['落料直径']),
        material_thickness: parseNumber(row['材料厚度']),
        material_width: parseNumber(row['材料宽度']),
        material_height: parseNumber(row['材料高度']),
        scrap_weight: parseNumber(row['边角料重量']),
        unit_weight: parseNumber(row['库存单位重量']),
        unit_volume: parseNumber(row['库存单位体积']),
        weight_unit: row['重量单位'] || '',
        volume_unit: row['体积单位'] || '',
        inventory_category: row['存货分类'] || '',
        unit_code: row['单位编码'] || '',
        is_active: parseBoolean(row['是否生效']),
        effective_date: parseDate(row['生效日期']) || new Date(),
        expiry_date: parseDate(row['失效日期']) || new Date('9999-12-31'),
      }

      const existing = await Material.findOne({ where: { material_code: materialData.material_code } })
      if (existing) {
        await existing.update(materialData)
      } else {
        await Material.create(materialData)
      }
      successCount++

      if ((i + 1) % 50 === 0) {
        console.log(`  ⏳ 已处理 ${i + 1}/${rows.length} 条...`)
      }
    } catch (err) {
      errorCount++
      console.log(`  ❌ 第 ${i + 1} 条导入失败 (料号: ${row['料号']}): ${err.message}`)
    }
  }

  console.log(`\n  ✅ 料品档案导入完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`)
  return successCount
}

async function importOrders() {
  console.log('\n📋 开始导入生产订单数据...\n')

  const filePath = path.join(__dirname, '../../演示数据-生产订单.txt')
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 文件不存在:', filePath)
    return 0
  }

  const { headers, rows } = parseTabDelimited(filePath)
  console.log(`  📄 共读取 ${rows.length} 条记录`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const materialCode = row['料品料号'] || ''
      const material = await Material.findOne({ where: { material_code: materialCode } })

      const statusStr = row['单据状态'] || '开立'
      let status = 0
      if (statusStr === '开立') status = 0
      else if (statusStr === '开工' || statusStr === '已下达') status = 1
      else if (statusStr === '已关闭' || statusStr === '关闭') status = 2

      const orderData = {
        order_no: row['单据编号'] || '',
        material_id: material ? material.material_id : null,
        material_code: materialCode,
        material_name: row['料品品名'] || '',
        specification: row['规格'] || '',
        film_version: row['菲林'] || '',
        version_no: row['菲林版本'] || '',
        planned_qty: parseNumber(row['生产数量']) || 0,
        finished_qty: 0,
        plan_start_time: parseDate(row['计划开工日期']),
        plan_end_time: parseDate(row['计划完工日期']),
        status: status,
        created_by: row['业务制单人'] || '',
      }

      const existing = await Order.findOne({ where: { order_no: orderData.order_no } })
      if (existing) {
        await existing.update(orderData)
      } else {
        await Order.create(orderData)
      }
      successCount++

      if ((i + 1) % 10 === 0) {
        console.log(`  ⏳ 已处理 ${i + 1}/${rows.length} 条...`)
      }
    } catch (err) {
      errorCount++
      console.log(`  ❌ 第 ${i + 1} 条导入失败 (单据编号: ${row['单据编号']}): ${err.message}`)
    }
  }

  console.log(`\n  ✅ 生产订单导入完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`)
  return successCount
}

async function main() {
  console.log('🚀 开始导入演示数据...')

  try {
    await sequelize.authenticate()
    console.log('✅ 数据库连接成功')

    const materialCount = await importMaterials()
    const orderCount = await importOrders()

    console.log('\n🎉 演示数据导入完成！')
    console.log(`   料品档案: ${materialCount} 条`)
    console.log(`   生产订单: ${orderCount} 条`)
  } catch (err) {
    console.error('❌ 导入失败:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
