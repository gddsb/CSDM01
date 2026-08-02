import { AxiosInstance } from 'axios';
import { U9_CONFIG } from './u9Login';
import { loginU9, ProgressCallback } from './u9Login';
import U9Item from '../models/U9Item.js';
import U9Customer from '../models/U9Customer.js';
import U9ProductionOrder from '../models/U9ProductionOrder.js';

/** ========= 料品列表 ========= */
export const ITEM_LIST_PARAMS: Record<string, string> = {
  lnk: 'CBO.Pub.Item.ItemList',
  sId: '3000nid',
  bId: '1001101159162183',
  ShowType: 'NavigatePage',
  ParentForm: '053a1be3-2c56-428b-b221-b5291644f2cb',
  __fsk: '__SK95275*__SK95275',
  __curOId: '1002406170039099',
};

/** ========= 客户列表 ========= */
export const CUSTOMER_LIST_PARAMS: Record<string, string> = {
  lnk: 'CBO.Pub.Customer.CustomerList',
  sId: '3000nid',
  bId: '1001101159162177',
  ShowType: 'NavigatePage',
  ParentForm: 'a0e3a0ab-bf8a-4e1b-9a1b-8ffd2bbf6f2e',
  __fsk: '__SK88231*__SK88231',
  __curOId: '1002406170039099',
};

/** ========= 生产订单列表 ========= */
export const PRODUCTION_ORDER_LIST_PARAMS: Record<string, string> = {
  lnk: 'CBO.Manufacture.MO.MOList',
  sId: '3000nid',
  bId: 'TBD',
  ShowType: 'NavigatePage',
  ParentForm: 'TBD',
  __fsk: '__SKPROD*__SKPROD',
  __curOId: '1002406170039099',
};

function base64DecodeIfNeed(v: string): string {
  if (v && v.startsWith('encode||:')) {
    try {
      return Buffer.from(v.slice(9), 'base64').toString('utf-8');
    } catch {
      return v;
    }
  }
  return v;
}

/** 从分页栏 data-ca 解析 pageindex/pagecount/totalrows */
function parsePagination(html: string) {
  const m = html.match(/'pageindex':'(\d+)','pagecount':'(\d+)'[,\s]*'totalrows':'(\d+)'/);
  if (m) return { page_index: Number(m[1]), page_count: Number(m[2]), total_rows: Number(m[3]) };
  return null;
}

/** 解码 HTML 实体 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** 从 td data-ca 抽取 value */
function extractTdValue(td: string): string {
  const m = td.match(/'value':'([^']*)'/);
  if (m) return decodeHtmlEntities(base64DecodeIfNeed(m[1]));
  return '';
}

/** 抽取料品单页数据 (24列) */
function extractItemRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<TR\b[^>]*>[\s\S]*?<\/TR>/gi;
  const tdRe = /<td[^>]*data-ca=\{([^}]*)\}[^>]*>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdRe.exec(trHtml))) {
      const tdTag = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdTag)) continue;
      if (/display\s*:\s*none/i.test(tdTag)) continue;
      tds.push(extractTdValue(m[1]));
    }
    if (tds.length >= 10) {
      const row = tds.slice(0, 24);
      while (row.length < 24) row.push('');
      rows.push(row);
    }
  }
  return rows;
}

/** 抽取客户单页数据 (8列) */
function extractCustomerRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  const tdRe = /<td[^>]*data-ca=\{([^}]*)\}[^>]*>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdRe.exec(trHtml))) {
      const tdTag = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdTag)) continue;
      if (/display\s*:\s*none/i.test(tdTag)) continue;
      tds.push(extractTdValue(m[1]));
    }
    if (tds.length >= 5) {
      const row = tds.slice(0, 8);
      while (row.length < 8) row.push('');
      rows.push(row);
    }
  }
  return rows;
}

/** 抽取生产订单单页数据（列数根据实际页面动态调整） */
function extractProductionOrderRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  const tdRe = /<td[^>]*data-ca=\{([^}]*)\}[^>]*>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdRe.exec(trHtml))) {
      const tdTag = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdTag)) continue;
      if (/display\s*:\s*none/i.test(tdTag)) continue;
      tds.push(extractTdValue(m[1]));
    }
    if (tds.length >= 5) {
      const row = tds.slice(0, 32);
      while (row.length < 32) row.push('');
      rows.push(row);
    }
  }
  return rows;
}

/** 获取 __VIEWSTATE / __EVENTVALIDATION */
function getAspnetState(html: string) {
  const vs = html.match(/id="__VIEWSTATE"[^>]*value="([^"]*)"/)?.[1] || '';
  const ev = html.match(/id="__EVENTVALIDATION"[^>]*value="([^"]*)"/)?.[1] || '';
  return { viewstate: vs, eventvalidation: ev };
}

function buildErpUrl(params: Record<string, string>) {
  return U9_CONFIG.erpUrl + '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

interface ExportResult {
  totalRecords: number;
  taskId?: string;
}

/** ======== 料品全量抓取 ======== */
export async function exportItems(taskId?: string, onProgress?: ProgressCallback): Promise<ExportResult> {
  const report = async (msg: string, pct: number) => { if (onProgress) await onProgress(msg, pct); };

  const { http, org } = await loginU9((m, p) => report(m, Math.floor(p * 0.15)));
  await report(`登录成功，准备拉取料品列表（组织: ${org.Name}）...`, 16);

  const params = { ...ITEM_LIST_PARAMS, __curOId: String(org.ID) };
  const url = buildErpUrl(params);

  await report('请求料品列表首页...', 18);
  const firstResp = await http.get<string>(url);
  const firstHtml = firstResp.data;

  const pg = parsePagination(firstHtml);
  const totalPages = pg?.page_count || 1;
  const totalRows = pg?.total_rows ?? 0;
  await report(`解析到 ${totalRows} 条记录，共 ${totalPages} 页`, 22);

  let allRows = extractItemRows(firstHtml);
  await report(`第 1 页提取 ${allRows.length} 条`, 24);

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    await report(`请求第 ${pageNum}/${totalPages} 页...`, 24 + Math.floor((pageNum - 1) / totalPages * 66));
    const html = await fetchPage(http, url, 'items', pageNum);
    const rows = extractItemRows(html);
    allRows.push(...rows);
    await report(`第 ${pageNum} 页提取 ${rows.length} 条（累计 ${allRows.length}）`, 24 + Math.floor(pageNum / totalPages * 66));
  }

  await report(`抓取完成，共 ${allRows.length} 条；写入数据库...`, 92);

  if (U9Item && allRows.length > 0) {
    const records = allRows.map((r) => ({
      task_id: taskId || '',
      main_category_code: r[0],
      category_name: r[1],
      item_code: r[2],
      item_name: r[3],
      specification: r[4],
      unit_name: r[5],
      film_no: r[6],
      cutting_size: r[7],
      print_process: r[8],
      color_info: r[9],
      blank_diameter: r[10],
      material_thickness: r[11],
      material_width: r[12],
      material_height: r[13],
      scrap_weight: r[14],
      stock_unit_weight: r[15],
      stock_unit_volume: r[16],
      weight_unit: r[17],
      volume_unit: r[18],
      inventory_category: r[19],
      unit_code: r[20],
      is_active: r[21] === 'true' ? 1 : 0,
      effective_date: r[22],
      expiration_date: r[23],
    }));
    try {
      await U9Item.bulkCreate(records as any, {
        updateOnDuplicate: ['task_id', 'main_category_code', 'category_name', 'item_name', 'specification',
          'unit_name', 'film_no', 'cutting_size', 'print_process', 'color_info', 'blank_diameter',
          'material_thickness', 'material_width', 'material_height', 'scrap_weight', 'stock_unit_weight',
          'stock_unit_volume', 'weight_unit', 'volume_unit', 'inventory_category', 'unit_code',
          'is_active', 'effective_date', 'expiration_date', 'updated_at'],
      });
    } catch (e: any) {
      console.warn('[exportItems] 数据库写入警告:', e.message);
    }
  }

  await report(`数据库写入完成，共 ${allRows.length} 条记录`, 100);

  return { totalRecords: allRows.length, taskId };
}

/** ========= 客户列表 ========= */
export async function exportCustomers(taskId?: string, onProgress?: ProgressCallback): Promise<ExportResult> {
  const report = async (msg: string, pct: number) => { if (onProgress) await onProgress(msg, pct); };

  const { http, org } = await loginU9((m, p) => report(m, Math.floor(p * 0.15)));
  await report(`登录成功，准备拉取客户列表（组织: ${org.Name}）...`, 16);

  const params = { ...CUSTOMER_LIST_PARAMS, __curOId: String(org.ID) };
  const url = buildErpUrl(params);

  await report('请求客户列表首页...', 18);
  const firstResp = await http.get<string>(url);
  const firstHtml = firstResp.data;

  const pg = parsePagination(firstHtml);
  const totalPages = pg?.page_count || 1;
  const totalRows = pg?.total_rows ?? 0;
  await report(`解析到 ${totalRows} 条记录，共 ${totalPages} 页`, 22);

  let allRows = extractCustomerRows(firstHtml);
  await report(`第 1 页提取 ${allRows.length} 条`, 24);

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    await report(`请求第 ${pageNum}/${totalPages} 页...`, 24 + Math.floor((pageNum - 1) / totalPages * 66));
    const h = await fetchPage(http, url, 'customers', pageNum);
    const rows = extractCustomerRows(h);
    allRows.push(...rows);
    await report(`第 ${pageNum} 页提取 ${rows.length} 条（累计 ${allRows.length}）`, 24 + Math.floor(pageNum / totalPages * 66));
  }

  const seen = new Set<string>();
  const uniq: string[][] = [];
  for (const r of allRows) {
    const k = `${r[0]}|${r[1]}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(r); }
  }

  await report(`抓取+去重后 ${uniq.length} 条，写入数据库...`, 92);

  if (U9Customer && uniq.length > 0) {
    const records = uniq.map((r) => ({
      task_id: taskId || '',
      customer_code: r[0],
      customer_name: r[1],
      short_name: r[2],
      category_id: r[3],
      category_name: r[4],
      is_active: r[5] === 'true' ? 1 : 0,
      expire_date: r[6],
      effective_date: r[7],
    }));
    try {
      await U9Customer.bulkCreate(records as any, {
        updateOnDuplicate: ['task_id', 'customer_name', 'short_name', 'category_id', 'category_name',
          'is_active', 'expire_date', 'effective_date', 'updated_at'],
      });
    } catch (e: any) {
      console.warn('[exportCustomers] 数据库写入警告:', e.message);
    }
  }

  await report(`数据库写入完成，共 ${uniq.length} 条记录`, 100);

  return { totalRecords: uniq.length, taskId };
}

/** ========= 生产订单列表 ========= */
export async function exportProductionOrders(taskId?: string, onProgress?: ProgressCallback): Promise<ExportResult> {
  const report = async (msg: string, pct: number) => { if (onProgress) await onProgress(msg, pct); };

  const { http, org } = await loginU9((m, p) => report(m, Math.floor(p * 0.15)));
  await report(`登录成功，准备拉取生产订单列表（组织: ${org.Name}）...`, 16);

  const params = { ...PRODUCTION_ORDER_LIST_PARAMS, __curOId: String(org.ID) };
  const url = buildErpUrl(params);

  await report('请求生产订单列表首页...', 18);
  const firstResp = await http.get<string>(url);
  const firstHtml = firstResp.data;

  const pg = parsePagination(firstHtml);
  const totalPages = pg?.page_count || 1;
  const totalRows = pg?.total_rows ?? 0;
  await report(`解析到 ${totalRows} 条记录，共 ${totalPages} 页`, 22);

  let allRows = extractProductionOrderRows(firstHtml);
  await report(`第 1 页提取 ${allRows.length} 条`, 24);

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    await report(`请求第 ${pageNum}/${totalPages} 页...`, 24 + Math.floor((pageNum - 1) / totalPages * 66));
    const h = await fetchPage(http, url, 'production_orders', pageNum);
    const rows = extractProductionOrderRows(h);
    allRows.push(...rows);
    await report(`第 ${pageNum} 页提取 ${rows.length} 条（累计 ${allRows.length}）`, 24 + Math.floor(pageNum / totalPages * 66));
  }

  const seen = new Set<string>();
  const uniq: string[][] = [];
  for (const r of allRows) {
    const k = r[2] || r.join('|');
    if (!seen.has(k)) { seen.add(k); uniq.push(r); }
  }

  await report(`抓取+去重后 ${uniq.length} 条，写入数据库...`, 92);

  if (U9ProductionOrder && uniq.length > 0) {
    const records = uniq.map((r) => ({
      task_id: taskId || '',
      source_type: r[0] || '',
      biz_create_date: r[1] || '',
      doc_no: r[2] || '',
      doc_status: r[3] || '',
      item_code: r[4] || '',
      item_name: r[5] || '',
      specification: r[6] || '',
      film_no: r[7] || '',
      film_version: r[8] || '',
      production_qty: r[9] || 0,
      created_by: r[10] || '',
      plan_start_date: r[11] || '',
      plan_end_date: r[12] || '',
      raw_data: JSON.stringify(r),
    }));
    try {
      await U9ProductionOrder.bulkCreate(records as any, {
        updateOnDuplicate: ['task_id', 'source_type', 'biz_create_date', 'doc_status',
          'item_code', 'item_name', 'specification', 'film_no', 'film_version',
          'production_qty', 'created_by', 'plan_start_date', 'plan_end_date',
          'raw_data', 'updated_at'],
      });
    } catch (e: any) {
      console.warn('[exportProductionOrders] 数据库写入警告:', e.message);
    }
  }

  await report(`数据库写入完成，共 ${uniq.length} 条记录`, 100);

  return { totalRecords: uniq.length, taskId };
}

/** 翻页 */
async function fetchPage(
  http: AxiosInstance,
  url: string,
  type: 'items' | 'customers' | 'production_orders',
  pageNum: number
): Promise<string> {
  const resp = await http.get<string>(url);
  const shellHtml = resp.data;
  const { viewstate, eventvalidation } = getAspnetState(shellHtml);
  const eventTargetMap: Record<string, string> = {
    items: 'u$M$p0$DataGrid1',
    customers: 'u$M$p0$DataGrid0',
    production_orders: 'u$M$p0$DataGrid1',
  };
  const currentFormMap: Record<string, string> = {
    items: 'CBO.Pub.Item.ItemList',
    customers: 'CBO.Pub.Customer.CustomerList',
    production_orders: 'CBO.Manufacture.MO.MOList',
  };
  const eventTarget = eventTargetMap[type];
  const currentForm = currentFormMap[type];

  const body = new URLSearchParams({
    __VIEWSTATE: viewstate,
    __EVENTVALIDATION: eventvalidation,
    CurrentPage: currentForm,
    txtGotoPage: String(pageNum),
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: `TURNPAGE:${pageNum}`,
  });
  const postResp = await http.post<string>(url, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return postResp.data;
}
