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
  lnk: 'MFG.MO.DiscreteMO.DiscreteMOList',
  sId: '3025nid',
  bId: '1001101160309210',
  ShowType: 'NavigatePage',
  CardPageID: 'MFG.MO.DiscreteMO.DiscreteMO',
  IsStartMO: '0',
  ParentForm: '99dc1cbe-7014-45a9-b688-445dcf08a7af',
  __fsk: '__SK52539*__SK52539',
  __curOId: '1002406170039099',
};

/** ========= 采购收货（标准收货）列表 ========= */
// lnk=SCM.PM.PM6010_20 为列表视图，使用默认查询方案自动加载数据
export const PURCHASE_RECEIPT_LIST_PARAMS: Record<string, string> = {
  lnk: 'SCM.PM.PM6010_20',
  sId: '3016nid',
  bId: '1001101160311129',
  ShowType: 'NavigatePage',
  RCV_Type: 'PM6010',
  ParentForm: '91afbfb8-28af-44e6-9cf2-86d66ee16cb1',
  __fsk: '__SK81088*__SK81088',
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
    // 清洗 DECIMAL 字段：空格/空字符串/非数字 → '0'，避免 MySQL strict mode 报 Incorrect decimal value
    const cleanNum = (v: any): string => {
      if (v == null) return '0'
      const s = String(v).replace(/,/g, '').trim()
      return s === '' || isNaN(Number(s)) ? '0' : s
    }
    const records = uniq.map((r) => ({
      task_id: taskId || '',
      // U9 HTML 实际15列 (r[0]~r[14])，按字段含义一一对应；barcode 为扩展字段(r[15])，U9列表无此列时为空
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
      barcode: r[15] || '',
      planned_qty: cleanNum(r[10]),
      qualified_qty: cleanNum(r[11]),
      plan_start_time: r[12] || '',
      plan_end_time: r[13] || '',
      created_by: r[14] || '',
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
        console.warn(`[exportProductionOrders] 批次 ${i / BATCH + 1} 写入失败:`, e.message);
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
      console.warn('[exportPurchaseReceipts] 数据库写入警告:', e.message);
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
function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

// 远期默认失效日期（当 task_item.expiry_date 为空时使用）
const DEFAULT_EXPIRY = new Date('2099-12-31');

/**
 * 将 task_item 采集数据同步到 bas_material 业务主数据表
 * 字段名已完全对齐，只需做类型转换（STRING→DECIMAL/DATE/BOOLEAN）
 * 按 material_code 做 upsert：已存在则更新，不存在则新增
 */
export async function syncItemsToBasMaterial(): Promise<{ total: number; inserted: number; updated: number }> {
  const items = await U9Item.findAll();
  const total = items.length;
  if (total === 0) return { total: 0, inserted: 0, updated: 0 };

  const now = nowBeijingDate();
  const records = items.map((it: any) => ({
    // 字段命名已与 bas_material 完全对齐，直接赋值
    material_code: it.material_code,
    material_name: it.material_name || it.material_code,
    category_name: it.category_name || '未分类',
    specification: it.specification || null,
    unit_name: it.unit_name || '个',
    film_no: it.film_no || null,
    version_no: it.version_no || null,
    barcode: it.barcode || null,
    cutting_size: it.cutting_size || null,
    printing_process: it.printing_process || null,
    color_separation: it.color_separation || null,
    blanking_diameter: toNumber(it.blanking_diameter),
    material_thickness: toNumber(it.material_thickness),
    material_width: toNumber(it.material_width),
    material_height: toNumber(it.material_height),
    scrap_weight: toNumber(it.scrap_weight),
    unit_weight: toNumber(it.unit_weight),
    unit_volume: toNumber(it.unit_volume),
    weight_unit: it.weight_unit || null,
    volume_unit: it.volume_unit || null,
    inventory_category: it.inventory_category || null,
    unit_code: it.unit_code || null,
    is_active: it.is_active === 1,
    effective_date: parseDateTime(it.effective_date) || now,
    expiry_date: parseDateTime(it.expiry_date) || DEFAULT_EXPIRY,
  }));

  let inserted = 0;
  let updated = 0;
  for (const rec of records) {
    const [row, created] = await Material.findOrCreate({
      where: { material_code: rec.material_code },
      defaults: rec,
    });
    if (created) {
      inserted++;
    } else {
      await row.update(rec);
      updated++;
    }
  }

  logger.info(`[syncItemsToBasMaterial] 共 ${total} 条，新增 ${inserted}，更新 ${updated}`);
  return { total, inserted, updated };
}

/** ========= task_production_order → production_order 迁移 ========= */
// U9 单据状态 → production_order 状态编码
const DOC_STATUS_MAP: Record<string, number> = {
  '开立': 0, '计划': 0, '新建': 0,
  '下发': 1, '确认': 1, '批准': 1,
  '开工': 2, '执行': 2, '进行中': 2, '开始': 2,
  '完工': 3, '完成': 3, '结案': 3,
  '关闭': 4, '取消': 4, '中止': 4,
};

/**
 * 将 task_production_order 采集数据同步到 production_order 业务主数据表
 * 字段名已完全对齐，只需做类型转换（STRING→DATE/TINYINT）
 * 按 order_no 做 upsert：已存在则更新，不存在则新增
 * 通过 material_code 关联 bas_material 获取 material_id
 */
export async function syncProductionOrdersToOrder(): Promise<{ total: number; inserted: number; updated: number; skipped: number }> {
  const taskOrders = await U9ProductionOrder.findAll();
  const total = taskOrders.length;
  if (total === 0) return { total: 0, inserted: 0, updated: 0, skipped: 0 };

  // 批量查询所有相关料品，构建 material_code → material_id 映射
  const materialCodes = [...new Set(taskOrders.map((o: any) => o.material_code).filter(Boolean))];
  const materials = materialCodes.length > 0
    ? await Material.findAll({ where: { material_code: materialCodes }, attributes: ['material_id', 'material_code'] })
    : [];
  const materialMap = new Map(materials.map((m: any) => [m.material_code, m.material_id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  // 钳制 DECIMAL(12,2) 范围：超过上限或负数置 0，避免 Out of range 中断迁移
  const clampQty = (v: any): number => {
    const n = Number(v)
    if (!isFinite(n) || n < 0 || n > 9999999999.99) return 0
    return Math.round(n * 100) / 100
  }

  for (const o of taskOrders) {
    const orderNo = o.order_no;
    if (!orderNo) { skipped++; continue; }

    try {
      const materialId = o.material_code ? materialMap.get(o.material_code) || null : null;
      const statusStr = String(o.status || '').trim();
      // 采集数据 status 可能是数字编码（如"0"）或文本（如"开立"），优先按数字处理
      const statusNum = parseInt(statusStr, 10);
      const status = isNaN(statusNum) ? (DOC_STATUS_MAP[statusStr] !== undefined ? DOC_STATUS_MAP[statusStr] : 0) : statusNum;

      // 字段命名已与 production_order 完全对齐
      const payload = {
        order_no: orderNo,
        material_id: materialId,
        material_code: o.material_code || null,
        material_name: o.material_name || null,
        specification: o.specification || null,
        film_version: o.film_version || null,
        version_no: o.version_no || null,
        barcode: o.barcode || null,
        planned_qty: clampQty(o.planned_qty),
        u9_qualified: clampQty(o.qualified_qty),
        plan_start_time: parseDateTime(o.plan_start_time),
        plan_end_time: parseDateTime(o.plan_end_time),
        u9_status: o.status || null,
        status,
        created_by: o.created_by || null,
      };

      const [row, created] = await Order.findOrCreate({
        where: { order_no: orderNo },
        defaults: payload,
      });
      if (created) {
        inserted++;
      } else {
        // 仅更新业务字段，不修改 status（避免覆盖手动变更的状态）
        await row.update({
          material_id: payload.material_id,
          material_code: payload.material_code,
          material_name: payload.material_name,
          specification: payload.specification,
          film_version: payload.film_version,
          version_no: payload.version_no,
          barcode: payload.barcode,
          planned_qty: payload.planned_qty,
          u9_qualified: payload.u9_qualified,
          plan_start_time: payload.plan_start_time,
          plan_end_time: payload.plan_end_time,
          u9_status: payload.u9_status,
          created_by: payload.created_by,
        });
        updated++;
      }
    } catch (e: any) {
      // 单条迁移失败不中断整批，记录并跳过
      logger.warn(`[syncProductionOrdersToOrder] 跳过订单 ${orderNo}: ${e.message}`);
      skipped++;
    }
  }

  logger.info(`[syncProductionOrdersToOrder] 共 ${total} 条，新增 ${inserted}，更新 ${updated}，跳过 ${skipped}`);
  return { total, inserted, updated, skipped };
}
