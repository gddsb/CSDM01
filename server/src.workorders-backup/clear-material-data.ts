import sequelize from './config/database.js'
import { Material } from './models/index.js'

async function clearMaterialData() {
  console.log('\n🧹 开始清除料品档案数据...\n')

  try {
    const count = await Material.count()
    await Material.destroy({ where: {}, truncate: false })
    console.log(`  ✅ 料品档案 (bas_material): 已清除 ${count} 条记录`)
  } catch (err) {
    console.log(`  ❌ 料品档案 (bas_material): 清除失败 - ${err.message}`)
  }

  console.log('\n🎉 料品档案数据清除完成！\n')
  await sequelize.close()
}

clearMaterialData().catch(err => {
  console.error('清除数据出错:', err)
  process.exit(1)
})
