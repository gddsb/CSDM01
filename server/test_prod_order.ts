import { loginU9 } from './src/services/u9Login';
import { PRODUCTION_ORDER_LIST_PARAMS, ITEM_LIST_PARAMS, exportItems, exportProductionOrders } from './src/services/u9Exporter';
import { U9_CONFIG } from './src/services/u9Login';

function parsePagination(html: string) {
  const m = html.match(/'pageindex':'(\d+)','pagecount':'(\d+)'[,\s]*'totalrows':'(\d+)'/);
  if (m) return { page_index: Number(m[1]), page_count: Number(m[2]), total_rows: Number(m[3]) };
  return null;
}

async function test() {
  console.log('=== 测试生产订单采集 ===');
  const { http, org } = await loginU9();
  console.log('登录成功，组织:', org.Name, org.ID);

  // 先测试料品（作为对照）
  console.log('\n--- 测试料品列表 ---');
  const itemParams = { ...ITEM_LIST_PARAMS, __curOId: String(org.ID) };
  const itemUrl = U9_CONFIG.erpUrl + '?' + Object.entries(itemParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const itemResp = await http.get(itemUrl);
  console.log('料品响应长度:', itemResp.data.length);
  console.log('料品分页:', parsePagination(itemResp.data));

  // 测试生产订单 - 当前参数
  console.log('\n--- 测试生产订单列表 (当前参数) ---');
  const prodParams = { ...PRODUCTION_ORDER_LIST_PARAMS, __curOId: String(org.ID) };
  const prodUrl = U9_CONFIG.erpUrl + '?' + Object.entries(prodParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  console.log('生产订单URL:', prodUrl);
  const prodResp = await http.get(prodUrl);
  console.log('生产订单响应长度:', prodResp.data.length);
  console.log('生产订单分页:', parsePagination(prodResp.data));

  // 测试 - 去掉bId和ParentForm
  console.log('\n--- 测试生产订单 (去掉bId/ParentForm) ---');
  const prodParams2: any = { ...PRODUCTION_ORDER_LIST_PARAMS, __curOId: String(org.ID) };
  delete prodParams2.bId;
  delete prodParams2.ParentForm;
  const prodUrl2 = U9_CONFIG.erpUrl + '?' + Object.entries(prodParams2).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  console.log('URL:', prodUrl2);
  const prodResp2 = await http.get(prodUrl2);
  console.log('响应长度:', prodResp2.data.length);
  console.log('分页:', parsePagination(prodResp2.data));

  // 检查HTML中是否有数据
  const hasData = prodResp2.data.indexOf('data-ca') > -1 || prodResp2.data.indexOf('DataGrid') > -1;
  console.log('HTML中是否有表格数据标识:', hasData);
  
  // 看看有没有分页信息
  const hasPage = prodResp2.data.indexOf('pageindex') > -1 || prodResp2.data.indexOf('totalrows') > -1;
  console.log('HTML中是否有分页信息:', hasPage);

  // 输出一段HTML看看
  console.log('\n--- HTML 3000-6000字符 ---');
  console.log(prodResp2.data.substring(3000, 6000));
}

test().catch(e => console.error('ERROR:', e));
