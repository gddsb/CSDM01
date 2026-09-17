// 诊断脚本：测试 OrderService.parseOrderStatusParam 对各种输入的行为
// 运行方式: npx tsx test_diag.ts
import { parseOrderStatusParam, buildOrderWhere } from './src/services/OrderService.js'

console.log('=== parseOrderStatusParam 测试 ===')
const inputs: any[] = [
  '下发',
  ['下发'],
  '开立',
  0,        // falsy!
  '0',
  '下发,开工',
  '',
  undefined,
  null,
  4,        // falsy but valid
  '开立,下发',
]
for (const inp of inputs) {
  console.log(`  input=${JSON.stringify(inp)}(typeof=${typeof inp}) => ${JSON.stringify(parseOrderStatusParam(inp))}`)
}

console.log('')
console.log('=== buildOrderWhere 测试 ===')
const queries = [
  { status: '下发', page: 1, page_size: 50 },
  { status: '开立', page: 1, page_size: 50 },
  { status: 0 as any, page: 1, page_size: 50 },
  { status: undefined, page: 1, page_size: 50 },
  { status: '', page: 1, page_size: 50 },
  { page: 1, page_size: 50 }, // 无 status
]
for (const q of queries) {
  const w = buildOrderWhere(q)
  console.log(`  status=${JSON.stringify(q.status)} => where.status=${JSON.stringify(w.status)}`)
}

console.log('')
console.log('=== ORDER_STATUS_MAP ===')
import { ORDER_STATUS_MAP } from './src/services/OrderService.js'
console.log(ORDER_STATUS_MAP)
