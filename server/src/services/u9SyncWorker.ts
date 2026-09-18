/** u9SyncWorker —— 同步到本地业务表 */
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
import { toNumber } from './u9ExportWorker.js';
/** ========= 料品列表 ========= */
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
