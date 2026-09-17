import { parseOrderStatusParam, buildOrderWhere } from './src/services/OrderService.js'
import { Op } from 'sequelize'

console.log('=== Op.in 是 Symbol 吗？ ===')
console.log('Op.in =', Op.in)
console.log('typeof Op.in =', typeof Op.in)
console.log('isSymbol =', typeof Op.in === 'symbol')

console.log('')
console.log('=== buildOrderWhere 真实结构（不用 JSON.stringify）===')
const w = buildOrderWhere({ status: '下发', page: 1, page_size: 50 })
console.log('where.status =', w.status)
console.log('Object.keys(where.status) =', Object.keys(w.status))
console.log('Reflect.ownKeys(where.status) =', Reflect.ownKeys(w.status))
console.log('where.status[Op.in] =', w.status?.[Op.in])

console.log('')
console.log('=== 测试 DB 实际查询 ===')
import { Order } from './src/models/index.js'
async function test() {
  const q = buildOrderWhere({ status: '下发' })
  console.log('where =', q)
  try {
    const count = await Order.count({ where: q })
    console.log('status=下发 count:', count)
    
    const list = await Order.findAll({ where: q, limit: 5 })
    console.log('list:', list.map((o: any) => ({ order_id: o.order_id, order_no: o.order_no, status: o.status })))
    
    // 无过滤
    const total = await Order.count()
    console.log('total orders:', total)
    
    // 查看所有不同的 status
    const all = await Order.findAll({ attributes: ['status'], group: ['status'] })
    console.log('distinct statuses:', all.map((o: any) => o.status))
  } catch (e: any) {
    console.log('DB error:', e.message)
  }
  process.exit(0)
}
test()
