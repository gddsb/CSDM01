import { exportProductionOrders, exportItems, exportCustomers } from './src/services/u9Exporter';

async function test() {
  console.log('=== 测试生产订单完整采集 ===\n');

  const result = await exportProductionOrders('test-task-001', async (msg, pct) => {
    console.log(`[${pct}%] ${msg}`);
  });

  console.log('\n=== 采集结果 ===');
  console.log('总记录数:', result.totalRecords);
  console.log('任务ID:', result.taskId);
}

test().catch(e => console.error('ERROR:', e));
