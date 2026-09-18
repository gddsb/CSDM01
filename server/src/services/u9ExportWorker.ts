/** u9ExportWorker —— HTML 解析 + 4 个 export 函数 */
import { AxiosInstance } from 'axios';
import { U9_CONFIG } from './u9Login';
import { loginU9, ProgressCallback } from './u9Login';
import U9Item from '../models/U9Item.js';
import U9Customer from '../models/U9Customer.js';
import U9ProductionOrder from '../models/U9ProductionOrder.js';
import U9PurchaseReceipt from '../models/U9PurchaseReceipt.js';
import Material from '../models/Material.js';
import Order from '../models/Order.js';
import { nowBeijingDate, parseDateTime } from '../utils/date.js';
import { logger } from '../utils/logger.js';
/** ========= 料品列表 ========= */
import {
  ITEM_LIST_PARAMS, CUSTOMER_LIST_PARAMS,
  PRODUCTION_ORDER_LIST_PARAMS, PURCHASE_RECEIPT_LIST_PARAMS,
} from './u9Params.js'
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
    .replace(/&nbsp;/g, ' ')
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

/** 从完整 td HTML 中提取纯文本内容（去除嵌套标签） */
function extractTdText(tdFull: string): string {
  const inner = tdFull.replace(/^<td\b[^>]*>/i, '').replace(/<\/td>\s*$/i, '');
  const text = inner.replace(/<[^>]*>/g, '').trim();
  return text ? decodeHtmlEntities(text) : '';
}

/** 判断值是否为长数字ID（需回退到文本内容） */
function isNumericId(val: string): boolean {
  return /^\d{10,}$/.test(val);
}

/** 从完整 td 块中提取值：优先 td 标签内显示的文本内容，其次 data-ca value */
function extractCellvalue(tdFull: string): string {
  const text = extractTdText(tdFull);
  if (text) return text;
  const caMatch = tdFull.match(/data-ca=\{([^}]*)\}/);
  return caMatch ? extractTdValue(caMatch[1]) : '';
}

/** 抽取料品单页数据 (25列) */
function extractItemRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<TR\b[^>]*>[\s\S]*?<\/TR>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    // 匹配完整 td 块 <td...>...</td>
    const tdBlockRe = /<td\b[^>]*>[\s\S]*?<\/td>/gi;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdBlockRe.exec(trHtml))) {
      const tdFull = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdFull)) continue;
      if (/display\s*:\s*none/i.test(tdFull)) continue;
      tds.push(extractCellvalue(tdFull));
    }
    if (tds.length >= 10) {
      const row = tds.slice(0, 30);
      while (row.length < 30) row.push('');
      rows.push(row);
    }
  }
  return rows;
}

/** 抽取客户单页数据 (8列) */
function extractCustomerRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tdBlockRe = /<td\b[^>]*>[\s\S]*?<\/td>/gi;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdBlockRe.exec(trHtml))) {
      const tdFull = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdFull)) continue;
      if (/display\s*:\s*none/i.test(tdFull)) continue;
      tds.push(extractCellvalue(tdFull));
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
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tdBlockRe = /<td\b[^>]*>[\s\S]*?<\/td>/gi;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdBlockRe.exec(trHtml))) {
      const tdFull = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdFull)) continue;
      if (/display\s*:\s*none/i.test(tdFull)) continue;
      tds.push(extractCellvalue(tdFull));
    }
    if (tds.length >= 5) {
      const row = tds.slice(0, 20);
      while (row.length < 20) row.push('');
      rows.push(row);
    }
  }
  return rows;
}

/** 抽取采购收货单页数据（列表过滤 tcc/display:none 后保留15列） */
function extractPurchaseReceiptRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const trHtml = tr[0];
    // 采购收货列表行通过 data-ca 中的 status 标识数据行
    if (!/data-ca\s*=\s*\{[^}]*status/.test(trHtml)) continue;
    const tdBlockRe = /<td\b[^>]*>[\s\S]*?<\/td>/gi;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdBlockRe.exec(trHtml))) {
      const tdFull = m[0];
      if (/class\s*=\s*"[^"]*\btcc\b/.test(tdFull)) continue;
      if (/display\s*:\s*none/i.test(tdFull)) continue;
      tds.push(extractCellvalue(tdFull));
    }
    if (tds.length >= 5) {
      const row = tds.slice(0, 15);
      while (row.length < 15) row.push('');
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
      // U9 HTML 实际25列 (r[0]~r[24])，按范例字段顺序一一对应
      main_category_code: r[0] || '',
      material_code: r[1] || '',
      material_name: r[2] || '',
      specification: r[3] || '',
      unit_name: r[4] || '',
      film_no: r[5] || '',
      version_no: r[6] || '',
      barcode: r[7] || '',
      cutting_size: r[8] || '',
      printing_process: r[9] || '',
      color_separation: r[10] || '',
      blanking_diameter: r[11] || '',
      material_thickness: r[12] || '',
      material_width: r[13] || '',
      material_height: r[14] || '',
      scrap_weight: r[15] || '',
      unit_weight: r[16] || '',
      unit_volume: r[17] || '',
      weight_unit: r[18] || '',
      volume_unit: r[19] || '',
      inventory_category: r[20] || '',
      unit_code: r[21] || '',
      is_active: r[22] === 'true' ? 1 : 0,
      effective_date: r[23] || '',
      expiry_date: r[24] || '',
    }));
    try {
      await U9Item.bulkCreate(records as any, {
        updateOnDuplicate: ['task_id', 'main_category_code', 'material_code', 'material_name', 'specification',
          'unit_name', 'film_no', 'version_no', 'barcode', 'cutting_size',
          'printing_process', 'color_separation', 'blanking_diameter',
          'material_thickness', 'material_width', 'material_height', 'scrap_weight',
          'unit_weight', 'unit_volume', 'weight_unit', 'volume_unit', 'inventory_category',
          'unit_code', 'is_active', 'effective_date', 'expiry_date', 'updated_at'],
      });
    } catch (e: any) {
      logger.warn('[exportItems] 数据库写入警告:', e.message);
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
      logger.warn('[exportCustomers] 数据库写入警告:', e.message);
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
    // 清洗 DECIMAL 字段：空格/空字符串/非数字 → '0'，避免 MySQL strict mode 报 Incorrect decimal value
    const cleanNum = (v: any): string => {
      if (v == null) return '0'
      const s = String(v).replace(/,/g, '').trim()
      return s === '' || isNaN(Number(s)) ? '0' : s
    }
    const records = uniq.map((r) => ({
      task_id: taskId || '',
      // U9 HTML 列顺序（经 raw_data 样本核对）：
      // r[0]单据类别 r[1]来源类型 r[2]制单日期 r[3]单据号 r[4]状态 r[5]料号 r[6]品名 r[7]规格
      // r[8]菲林编号 r[9]版本 r[10]条形码 r[11]排产数量 r[12]累计合格数量
      // r[13]计划开工 r[14]计划完工 r[15]制单人
      doc_type_name: r[0] || '',
      source_type: r[1] || '',
      biz_create_date: r[2] || '',
      order_no: r[3] || '',
      status: r[4] || '',
      material_code: r[5] || '',
      material_name: r[6] || '',
      specification: r[7] || '',
      film_version: r[8] || '',
      version_no: r[9] || '',
      barcode: r[10] || '',
      planned_qty: cleanNum(r[11]),
      qualified_qty: cleanNum(r[12]),
      plan_start_time: r[13] || '',
      plan_end_time: r[14] || '',
      created_by: r[15] || '',
      raw_data: JSON.stringify(r),
    }));
    // 分批写入：单批失败不影响其他批次，避免一条脏数据拖垮整批
    const BATCH = 50
    let writeFail = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      try {
        await U9ProductionOrder.bulkCreate(batch as any, {
          updateOnDuplicate: ['task_id', 'doc_type_name', 'source_type', 'biz_create_date', 'status',
            'material_code', 'material_name', 'specification', 'film_version', 'version_no', 'barcode',
            'planned_qty', 'qualified_qty', 'created_by',
            'plan_start_time', 'plan_end_time', 'raw_data', 'updated_at'],
        });
      } catch (e: any) {
        writeFail++
        logger.warn(`[exportProductionOrders] 批次 ${i / BATCH + 1} 写入失败:`, e.message);
      }
    }
    if (writeFail > 0) {
      logger.warn(`[exportProductionOrders] 共 ${writeFail} 批写入失败（每批 ${BATCH} 条），部分数据可能未同步`)
    }
  }

  await report(`数据库写入完成，共 ${uniq.length} 条记录`, 100);

  return { totalRecords: uniq.length, taskId };
}

/** ======== 采购收货全量抓取 ======== */
export async function exportPurchaseReceipts(taskId?: string, onProgress?: ProgressCallback): Promise<ExportResult> {
  const report = async (msg: string, pct: number) => { if (onProgress) await onProgress(msg, pct); };

  const { http, org } = await loginU9((m, p) => report(m, Math.floor(p * 0.15)));
  await report(`登录成功，准备拉取采购收货列表（组织: ${org.Name}）...`, 16);

  const params = { ...PURCHASE_RECEIPT_LIST_PARAMS, __curOId: String(org.ID) };
  const url = buildErpUrl(params);

  await report('请求采购收货列表首页...', 18);
  const firstResp = await http.get<string>(url);
  const firstHtml = firstResp.data;

  const pg = parsePagination(firstHtml);
  const totalPages = pg?.page_count || 1;
  const totalRows = pg?.total_rows ?? 0;
  await report(`解析到 ${totalRows} 条记录，共 ${totalPages} 页`, 22);

  let allRows = extractPurchaseReceiptRows(firstHtml);
  await report(`第 1 页提取 ${allRows.length} 条`, 24);

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    await report(`请求第 ${pageNum}/${totalPages} 页...`, 24 + Math.floor((pageNum - 1) / totalPages * 66));
    const html = await fetchPage(http, url, 'purchase_receipts', pageNum);
    const rows = extractPurchaseReceiptRows(html);
    allRows.push(...rows);
    await report(`第 ${pageNum} 页提取 ${rows.length} 条（累计 ${allRows.length}）`, 24 + Math.floor(pageNum / totalPages * 66));
  }

  await report(`抓取完成，共 ${allRows.length} 条；写入数据库...`, 92);

  // 去重：按单号+行号去重
  const seen = new Set<string>();
  const uniq = allRows.filter((r) => {
    const key = `${r[0] || ''}|${r[9] || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (U9PurchaseReceipt && uniq.length > 0) {
    const records = uniq.map((r) => ({
      task_id: taskId || '',
      // 列表过滤 tcc/display:none 后的列顺序（r[0]~r[14]）
      receipt_no: r[0] || '',
      material_code: r[1] || '',
      material_name: r[2] || '',
      specification: r[3] || '',
      business_type: r[4] || '',
      received_qty: (r[5] || '0').replace(/,/g, ''),
      receive_lot_no: r[6] || '',
      supplier_lot_no: r[7] || '',
      source_doc_no: r[8] || '',
      line_no: r[9] || '',
      supplier_code: r[10] || '',
      supplier_name: r[11] || '',
      status: r[12] || '',
      created_by: r[13] || '',
      receipt_date: r[14] || '',
      raw_data: JSON.stringify(r),
    }));
    try {
      // upsert 模式：按 (receipt_no, line_no) 唯一键存在则更新，不存在则新增
      await U9PurchaseReceipt.bulkCreate(records, {
        updateOnDuplicate: ['task_id', 'material_code', 'material_name', 'specification',
          'business_type', 'received_qty', 'receive_lot_no', 'supplier_lot_no',
          'source_doc_no', 'supplier_code', 'supplier_name', 'status', 'created_by',
          'receipt_date', 'raw_data', 'updated_at'],
        validate: false,
      });
    } catch (e: any) {
      logger.warn('[exportPurchaseReceipts] 数据库写入警告:', e.message);
    }
  }

  await report(`数据库写入完成，共 ${uniq.length} 条记录`, 100);

  return { totalRecords: uniq.length, taskId };
}

/** 翻页 */
async function fetchPage(
  http: AxiosInstance,
  url: string,
  type: 'items' | 'customers' | 'production_orders' | 'purchase_receipts',
  pageNum: number
): Promise<string> {
  const resp = await http.get<string>(url);
  const shellHtml = resp.data;
  const { viewstate, eventvalidation } = getAspnetState(shellHtml);
  const eventTargetMap: Record<string, string> = {
    items: 'u$M$p0$DataGrid1',
    customers: 'u$M$p0$DataGrid0',
    production_orders: 'u$M$p0$DataGrid1',
    purchase_receipts: 'u$M$p0$DataGrid1',
  };
  const currentFormMap: Record<string, string> = {
    items: 'CBO.Pub.Item.ItemList',
    customers: 'CBO.Pub.Customer.CustomerList',
    production_orders: 'MFG.MO.DiscreteMO.DiscreteMOList',
    purchase_receipts: 'SCM.PM.PM6010_20',
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

/** ========= task_item → bas_material 迁移 ========= */
// 将字符串安全转为数字（用于 STRING→DECIMAL 字段转换）
export function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

// 远期默认失效日期（当 task_item.expiry_date 为空时使用）
