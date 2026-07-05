import { Op } from 'sequelize'
import { NumberRule } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { previewBizNo, reloadRulesFromDB } from '../utils/sequence.js'

// 受 SEQ_CONFIG 保护的系统内置规则编码（与 utils/sequence.js 一致）
const SYSTEM_RULE_CODES = [
  'ORDER', 'WORK_ORDER', 'INCOMING', 'PROCESS', 'FINISHED',
  'MICROBE', 'ENV', 'INSTRUMENT', 'COMPLAINT',
  'SUPPLIER_COMPLAINT', 'STANDARD', 'NCR',
]

// 默认编号规则种子（首次启动时初始化）
const defaultRules = [
  { rule_name: '生产订单号', rule_code: 'ORDER', prefix: 'MO-16', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'production_order', target_field: 'order_no', target_label: '生产订单编号' },
  { rule_name: '工单号', rule_code: 'WORK_ORDER', prefix: 'WO', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'work_order', target_field: 'work_order_no', target_label: '工单编号' },
  { rule_name: '来料检验号', rule_code: 'INCOMING', prefix: 'LL', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_incoming', target_field: 'inspection_no', target_label: '来料检验编号' },
  { rule_name: '过程检验号', rule_code: 'PROCESS', prefix: 'GC', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_process', target_field: 'inspection_no', target_label: '过程检验编号' },
  { rule_name: '成品检验号', rule_code: 'FINISHED', prefix: 'CP', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_finished', target_field: 'inspection_no', target_label: '成品检验编号' },
  { rule_name: '微生物检验号', rule_code: 'MICROBE', prefix: 'WS', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_microbe', target_field: 'inspection_no', target_label: '微生物检验编号' },
  { rule_name: '环境检验号', rule_code: 'ENV', prefix: 'HJ', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_environment', target_field: 'inspection_no', target_label: '环境检验编号' },
  { rule_name: '检测仪器编号', rule_code: 'INSTRUMENT', prefix: 'YQ', date_format: 'YYYY', separator: '', seq_width: 4, reset_by: 'yearly', target_table: 'quality_instrument', target_field: 'instrument_no', target_label: '检测仪器编号' },
  { rule_name: '客诉编号', rule_code: 'COMPLAINT', prefix: 'TS', date_format: 'YYYY', separator: '', seq_width: 4, reset_by: 'yearly', target_table: 'quality_complaint', target_field: 'complaint_no', target_label: '客诉编号' },
  { rule_name: '供应商投诉编号', rule_code: 'SUPPLIER_COMPLAINT', prefix: 'GY', date_format: 'YYYY', separator: '', seq_width: 4, reset_by: 'yearly', target_table: 'quality_supplier_complaint', target_field: 'complaint_no', target_label: '供应商投诉编号' },
  { rule_name: '检验标准编号', rule_code: 'STANDARD', prefix: 'BZ', date_format: 'YYYY', separator: '', seq_width: 3, reset_by: 'yearly', target_table: 'quality_standard', target_field: 'standard_no', target_label: '检验标准编号' },
  { rule_name: '不合格品处理单号', rule_code: 'NCR', prefix: 'NCR', date_format: 'YYMMDD', separator: '', seq_width: 3, reset_by: 'daily', target_table: 'quality_ncr', target_field: 'ncr_no', target_label: '不合格品处理单编号' },
]

// 编号规则列表
export const list = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { rule_name: { [Op.like]: `%${keyword}%` } },
        { rule_code: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      where.status = Number(status)
    }
    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await NumberRule.findAndCountAll({
      where,
      limit,
      offset,
      order: [['rule_id', 'ASC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询编号规则列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 编号规则详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    return success(res, rule, '查询成功')
  } catch (err) {
    console.error('查询编号规则详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建编号规则
export const create = async (req, res) => {
  try {
    const { rule_name, rule_code, prefix, date_format, separator, seq_width, reset_by } = req.body
    if (!rule_name || !rule_code || !prefix) {
      return fail(res, '规则名称、规则编码、前缀不能为空')
    }
    if (!SYSTEM_RULE_CODES.includes(rule_code) && !/^[A-Z][A-Z0-9_]*$/.test(rule_code)) {
      return fail(res, '规则编码需由大写字母开头，可含大写字母、数字、下划线')
    }
    const exists = await NumberRule.findOne({ where: { rule_code } })
    if (exists) return fail(res, '规则编码已存在')
    const username = req.user?.username || 'system'
    const rule = await NumberRule.create({
      ...req.body,
      is_locked: 0,
      status: 1,
      current_no: null,
      used_count: 0,
      created_by: username,
    })
    // 新规则创建后立即同步到内存 SEQ_CONFIG
    await reloadRulesFromDB()
    return success(res, rule, '创建成功')
  } catch (err) {
    console.error('创建编号规则失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改编号规则（审核使用后不允许修改核心配置）
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    if (rule.is_locked === 1) {
      // 审核使用后只允许修改非核心字段（说明、关联表单字段、状态）
      const allowed = ['target_table', 'target_field', 'target_label', 'description']
      const safe = {}
      allowed.forEach(k => {
        if (req.body[k] !== undefined) safe[k] = req.body[k]
      })
      if (Object.keys(safe).length === 0) {
        return fail(res, '编号规则已审核使用，核心配置不允许修改', 400)
      }
      await rule.update(safe)
      return success(res, rule, '修改成功（核心配置已锁定）')
    }
    // 未审核使用前可修改所有字段，但 rule_code 不允许修改
    const updates = { ...req.body }
    delete updates.rule_code
    delete updates.is_locked
    delete updates.current_no
    delete updates.used_count
    await rule.update(updates)
    // 修改后重新同步到内存
    await reloadRulesFromDB()
    return success(res, rule, '修改成功')
  } catch (err) {
    console.error('修改编号规则失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除编号规则（审核使用后不允许删除）
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    if (rule.is_locked === 1) {
      return fail(res, '编号规则已审核使用，不允许删除，可改为停用', 400)
    }
    await rule.destroy()
    await reloadRulesFromDB()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除编号规则失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 停用/启用（审核使用后允许）
export const toggle = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    const next = rule.status === 1 ? 0 : 1
    await rule.update({ status: next })
    // 同步内存配置：停用规则不影响 generateBizNo（generateBizNo 直接读 SEQ_CONFIG）
    // 停用时该规则_code 不会被 reloadRulesFromDB 覆盖，但若之前已加载则保留旧值
    // 这里通过 reload 重新同步，停用的规则不会被重新加载（保持默认值）
    await reloadRulesFromDB()
    return success(res, rule, next === 1 ? '已启用' : '已停用')
  } catch (err) {
    console.error('切换编号规则状态失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 审核（锁定）编号规则 —— 审核使用后核心配置不允许修改
export const audit = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    if (rule.is_locked === 1) {
      return fail(res, '编号规则已审核使用，无需重复审核', 400)
    }
    await rule.update({ is_locked: 1 })
    // 锁定后立即同步到内存 SEQ_CONFIG
    await reloadRulesFromDB()
    return success(res, rule, '审核成功，规则已锁定使用')
  } catch (err) {
    console.error('审核编号规则失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 预览下一个编号（不消耗序号）
export const preview = async (req, res) => {
  try {
    const { id } = req.params
    const rule = await NumberRule.findOne({ where: { rule_id: id } })
    if (!rule) return fail(res, '编号规则不存在', 404)
    const nextSeq = (rule.used_count || 0) + 1
    const no = previewBizNo({
      prefix: rule.prefix,
      date_format: rule.date_format,
      separator: rule.separator,
      seq_width: rule.seq_width,
    }, nextSeq)
    return success(res, { preview_no: no, next_seq: nextSeq }, '预览成功')
  } catch (err) {
    console.error('预览编号失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 初始化默认编号规则
export const initDefaultRules = async () => {
  for (const def of defaultRules) {
    await NumberRule.findOrCreate({
      where: { rule_code: def.rule_code },
      defaults: { ...def, is_locked: 0, status: 1, used_count: 0 },
    })
  }
  // 初始化后同步到内存
  await reloadRulesFromDB()
}

export default {
  list,
  detail,
  create,
  update,
  remove,
  toggle,
  audit,
  preview,
  initDefaultRules,
}
