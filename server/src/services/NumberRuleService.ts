/**
 * 编号规则 Service（NumberRuleController 下沉）
 *
 * 核心逻辑：
 *   - 规则 CRUD + 校验（rule_code 正则、系统内置编码白名单）
 *   - toggle（启用=自动审核锁定；同 target_table+target_field 只能一个启用）
 *   - audit（手动锁定已审核规则）
 *   - preview（不消耗序号的编号预览）
 *   - initDefaultRules（启动时 backfill 系统内置规则）
 *
 * 与 utils/sequence.js 协作：reloadRulesFromDB / previewBizNo
 */
import { Op } from 'sequelize'
import { NumberRule } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { previewBizNo, reloadRulesFromDB } from '../utils/sequence.js'

// 受 SEQ_CONFIG 保护的系统内置规则编码（与 utils/sequence.js 一致）
export const SYSTEM_RULE_CODES = [
  'ORDER', 'WORK_ORDER', 'INCOMING', 'PROCESS', 'FINISHED',
  'MICROBE', 'ENV', 'COMPLAINT',
  'SUPPLIER_COMPLAINT', 'STANDARD', 'NCR',
]

// 默认编号规则种子（首次启动时初始化）
export const defaultRules = [
  { rule_name: '生产订单号', rule_code: 'ORDER', prefix: 'MO-16', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'production_order', target_field: 'order_no', target_label: '生产订单编号' },
  { rule_name: '工单号', rule_code: 'WORK_ORDER', prefix: 'WO', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'work_order', target_field: 'work_order_no', target_label: '工单编号' },
  { rule_name: '来料检验号', rule_code: 'INCOMING', prefix: 'LL', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_incoming', target_field: 'inspection_no', target_label: '来料检验编号' },
  { rule_name: '过程检验号', rule_code: 'PROCESS', prefix: 'GC', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_process', target_field: 'inspection_no', target_label: '过程检验编号' },
  { rule_name: '成品检验号', rule_code: 'FINISHED', prefix: 'CP', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_finished', target_field: 'inspection_no', target_label: '成品检验编号' },
  { rule_name: '微生物检验号', rule_code: 'MICROBE', prefix: 'WS', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_microbe', target_field: 'inspection_no', target_label: '微生物检验编号' },
  { rule_name: '环境检验号', rule_code: 'ENV', prefix: 'HJ', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_environment', target_field: 'inspection_no', target_label: '环境检验编号' },
  { rule_name: '客诉编号', rule_code: 'COMPLAINT', prefix: 'TS', date_format: 'YYYY', separator: '', seq_width: 4, reset_by: 'yearly', target_table: 'quality_complaint', target_field: 'complaint_no', target_label: '客诉编号' },
  { rule_name: '供应商投诉编号', rule_code: 'SUPPLIER_COMPLAINT', prefix: 'GY', date_format: 'YYYY', separator: '', seq_width: 4, reset_by: 'yearly', target_table: 'quality_supplier_complaint', target_field: 'complaint_no', target_label: '供应商投诉编号' },
  { rule_name: '检验标准编号', rule_code: 'STANDARD', prefix: 'BZ-CL', date_format: 'YYYY', separator: '-', seq_width: 3, reset_by: 'yearly', target_table: 'quality_inspection_standard', target_field: 'standard_no', target_label: '检验标准编号' },
  { rule_name: '不合格品处理单号', rule_code: 'NCR', prefix: 'NCR', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_ncr', target_field: 'ncr_no', target_label: '不合格品处理单编号' },
]

export const NumberRuleService = {
  async list(query: any) {
    const { keyword, status, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { rule_name: { [Op.like]: `%${keyword}%` } },
        { rule_code: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      where.status = Number(status)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await NumberRule.findAndCountAll({
      where,
      limit,
      offset,
      order: [['rule_id', 'ASC']],
    })
  },

  async detail(id: number | string) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)
    return rule
  },

  /** 创建规则（默认停用、未审核；启用时自动审核） */
  async create(body: any, actor?: any) {
    const { rule_name, rule_code, prefix } = body
    if (!rule_name || !rule_code || !prefix) {
      throw new AppError('规则名称、规则编码、前缀不能为空', 10001, 400)
    }
    if (!SYSTEM_RULE_CODES.includes(rule_code) && !/^[A-Z][A-Z0-9_]*$/.test(rule_code)) {
      throw new AppError('规则编码需由大写字母开头，可含大写字母、数字、下划线', 10001, 400)
    }
    const exists = await NumberRule.findOne({ where: { rule_code } })
    if (exists) throw new AppError('规则编码已存在', 20001, 409)

    const username = actor?.username || 'system'
    return await NumberRule.create({
      ...body,
      is_locked: 0,
      status: 0,
      current_no: null,
      used_count: 0,
      created_by: username,
    } as any)
  },

  /** 修改规则（审核使用后只允许改非核心字段） */
  async update(id: number | string, body: any) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)

    if ((rule as any).is_locked === 1) {
      // 审核使用后只允许修改非核心字段
      const allowed = ['target_table', 'target_field', 'target_label', 'description']
      const safe: any = {}
      allowed.forEach(k => {
        if (body[k] !== undefined) safe[k] = body[k]
      })
      if (Object.keys(safe).length === 0) {
        throw new AppError('编号规则已审核使用，核心配置不允许修改', 10001, 400)
      }
      await rule.update(safe)
      return { rule, message: '修改成功（核心配置已锁定）' }
    }
    // 未审核使用前可修改所有字段，但 rule_code / 锁定字段不允许改
    const updates = { ...body }
    delete updates.rule_code
    delete updates.is_locked
    delete updates.current_no
    delete updates.used_count
    await rule.update(updates as any)
    await reloadRulesFromDB()
    return { rule, message: '修改成功' }
  },

  /** 删除规则（审核使用后不允许删除） */
  async remove(id: number | string) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)
    if ((rule as any).is_locked === 1) {
      throw new AppError('编号规则已审核使用，不允许删除，可改为停用', 10001, 400)
    }
    await rule.destroy()
    await reloadRulesFromDB()
    return true
  },

  /**
   * 停用/启用（启用即审核；同一表单字段只能有一个生效规则）
   * @returns { rule, message }
   */
  async toggle(id: number | string) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)

    const next = (rule as any).status === 1 ? 0 : 1
    if (next === 1) {
      // 启用即审核（自动锁定 is_locked=1）
      // 同一表单字段只能有一个生效规则，先停用同字段的其他启用规则
      if ((rule as any).target_table && (rule as any).target_field) {
        await NumberRule.update(
          { status: 0 },
          {
            where: {
              target_table: (rule as any).target_table,
              target_field: (rule as any).target_field,
              status: 1,
              rule_id: { [Op.ne]: (rule as any).rule_id },
            },
          },
        )
      }
      await rule.update({ status: 1, is_locked: 1 } as any)
    } else {
      await rule.update({ status: 0 } as any)
    }
    await reloadRulesFromDB()
    return { rule, message: next === 1 ? '已启用并审核' : '已停用' }
  },

  /** 手动审核（锁定）编号规则 */
  async audit(id: number | string) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)
    if ((rule as any).is_locked === 1) {
      throw new AppError('编号规则已审核使用，无需重复审核', 10001, 400)
    }
    await rule.update({ is_locked: 1 } as any)
    await reloadRulesFromDB()
    return rule
  },

  /** 预览下一个编号（不消耗序号） */
  async preview(id: number | string) {
    const rule = await NumberRule.findOne({ where: { rule_id: Number(id) } })
    if (!rule) throw new AppError('编号规则不存在', 10002, 404)
    const nextSeq = ((rule as any).used_count || 0) + 1
    const no = previewBizNo({
      prefix: (rule as any).prefix,
      date_format: (rule as any).date_format,
      separator: (rule as any).separator,
      seq_width: (rule as any).seq_width,
    }, nextSeq)
    return { preview_no: no, next_seq: nextSeq }
  },

  /** 启动时 backfill 系统内置规则 */
  async initDefaultRules() {
    for (const def of defaultRules) {
      const [record, created] = await NumberRule.findOrCreate({
        where: { rule_code: def.rule_code },
        defaults: { ...def, is_locked: 1, status: 1, used_count: 0 } as any,
      })
      if (!created && (record as any).is_locked !== 1) {
        await record.update({ is_locked: 1 } as any)
      }
    }
    await reloadRulesFromDB()
  },
}

export default NumberRuleService
