import { Op } from 'sequelize'
import { DefectType } from './src/models/index.js'

async function test() {
  try {
    console.log('Test 1: category_name filter')
    const list1 = await DefectType.findAll({ where: { category_name: '来料检验类' }, limit: 3, raw: true })
    console.log('  count:', list1.length)

    console.log('Test 2: defect_type filter')
    const list2 = await DefectType.findAll({ where: { defect_type: '来料不良' }, limit: 3, raw: true })
    console.log('  count:', list2.length)

    console.log('Test 3: display=0')
    const list3 = await DefectType.findAll({ where: { display: false }, limit: 3, raw: true })
    console.log('  count:', list3.length)

    console.log('Test 4: display Op.in [0, 1]')
    const list4 = await DefectType.findAll({ where: { display: { [Op.in]: [0, 1] } }, limit: 3, raw: true })
    console.log('  count:', list4.length)

    console.log('Test 5: status=0')
    const list5 = await DefectType.findAll({ where: { status: 0 }, limit: 3, raw: true })
    console.log('  count:', list5.length)

    console.log('All tests passed!')
  } catch (e) {
    console.error('Error:', e.message)
    console.error(e.stack)
  }
  process.exit(0)
}

test()
