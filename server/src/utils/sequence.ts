import sequelize from '../config/database.js'
import Sequence from '../models/Sequence.js'
import { NumberRule } from '../models/index.js'

/**
 * 业务编号生成器
 *
 * 设计要点：
 * 1. 通过 sys_sequence 表的 (seq_key, seq_date) 唯一约束保证同日同业务键的序号唯一
 * 2. 通过 Sequelize 事务保证原子性；MySQL 使用 SELECT ... FOR UPDATE 行锁，
 *    SQLite 使用 findOrCreate + 递增（事务隔离足够保证原子性）
 * 3. 按日重置的编号 seq_date = YYYYMMDD；按年重置的编号 seq_date = YYYY
 * 4. 编号规则表 sys_number_rule 提供可视化配置入口；启动时调用 reloadRulesFromDB
 *    把数据库中的规则同步到内存 SEQ_CONFIG；调用 generateBizNo 时会同步更新对应
 *    NumberRule 的 current_no 和 used_count
 *
 * 编号格式规范（依据《奶粉罐生产管理系统开发设计文档V4.0》编号规则章节）：
 * - 订单号：MO-16 + YYMMDD + 3位序号          例：MO-16260705001
 * - 报工单号：WO-16 + YYMMDD + 3位序号         例：WO-16260705001
 * - 来料检验：LL + YYMMDD + 3位序号             例：LL260705001
 * - 过程检验：GC + YYMMDD + 3位序号             例：GC260705001
 * - 成品检验：CP + YYMMDD + 3位序号             例：CP260705001
 * - 微生物检验：WS + YYMMDD + 3位序号           例：WS260705001
 * - 环境检验：HJ + YYMMDD + 3位序号             例：HJ260705001
 * - 检测仪器：YQ + YYYY + 4位序号               例：YQ20260001
 * - 客诉编号：TS + YYYY + 4位序号               例：TS20260001
 * - 供应商投诉：GY + YYYY + 4位序号             例：GY20260001
 * - 检验标准：BZ + YYYY + 3位序号               例：BZ2026001
 * - 不合格品处理单：NCR + YYMMDD + 3位序号      例：NCR260705001
 */

// 序列键 → 编号生成配置（默认值；启动时会被 reloadRulesFromDB 覆盖）
const SEQ_CONFIG: any = {
  ORDER:               { prefix: 'MO-16', datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  WORK_ORDER:          { prefix: 'WO-16', datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  PROCESS_REPORT:      { prefix: 'RG',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  INCOMING:            { prefix: 'LL',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  PROCESS:             { prefix: 'GC',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  FINISHED:            { prefix: 'CP',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  MICROBE:             { prefix: 'WS',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  ENV:                 { prefix: 'HJ',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  INSTRUMENT:          { prefix: 'YQ',    datePattern: 'YYYY',   seqWidth: 4, resetBy: 'year'   },
  COMPLAINT:           { prefix: 'TS',    datePattern: 'YYYY',   seqWidth: 4, resetBy: 'year'   },
  SUPPLIER_COMPLAINT:  { prefix: 'GY',    datePattern: 'YYYY',   seqWidth: 4, resetBy: 'year'   },
  STANDARD:            { prefix: 'BZ',    datePattern: 'YYYY',   seqWidth: 3, resetBy: 'year'   },
  NCR:                 { prefix: 'NCR',   datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
}

// NumberRule 字段 → SEQ_CONFIG 字段映射
// date_format 取值：none / YYMMDD / YYYYMMDD / YYYY
// reset_by 取值：daily / yearly / never（统一映射到 resetBy: day/year/never）
function applyRuleToConfig(rule: any): void {
  const cfg = {
    prefix: rule.prefix,
    datePattern: rule.date_format === 'YYYYMMDD' ? 'YYYYMMDD'
      : rule.date_format === 'YYYY' ? 'YYYY'
      : rule.date_format === 'YYMMDD' ? 'YYMMDD'
      : 'none',
    seqWidth: rule.seq_width,
    resetBy: rule.reset_by === 'yearly' ? 'year'
      : rule.reset_by === 'never' ? 'never'
      : 'day',
    separator: rule.separator || '',
  }
  SEQ_CONFIG[rule.rule_code] = cfg
}

/**
 * 从数据库重新加载所有启用状态的编号规则，覆盖默认 SEQ_CONFIG
 * 应在服务启动 sync 完成后调用一次
 */
export async function reloadRulesFromDB(): Promise<void> {
  try {
    const rules = await NumberRule.findAll({ where: { status: 1 } })
    rules.forEach(applyRuleToConfig)
  } catch (err: any) {
    // 数据库未初始化时静默失败，使用默认配置
    console.warn('[sequence] 从数据库加载编号规则失败，使用默认配置:', err.message)
  }
}

// 格式化日期片段
function formatDatePart(now: Date, pattern: string): string {
  const yy = String(now.getFullYear()).slice(2)
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  if (pattern === 'YYMMDD') return `${yy}${mm}${dd}`
  if (pattern === 'YYYYMMDD') return `${yyyy}${mm}${dd}`
  if (pattern === 'YYYY') return yyyy
  return ''
}

// 根据 resetBy 计算 seq_date
function computeSeqDate(now: Date, resetBy: string): string {
  const yyyy = String(now.getFullYear())
  if (resetBy === 'year') return yyyy
  if (resetBy === 'never') return 'NEVER'
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * 生成业务编号（原子操作）
 * @param seqKey 序列键，参见 SEQ_CONFIG
 * @returns 生成的业务编号
 */
export async function generateBizNo(seqKey: string): Promise<string> {
  const cfg = SEQ_CONFIG[seqKey]
  if (!cfg) {
    throw new Error(`未知的序列键: ${seqKey}`)
  }
  const now = new Date()
  const datePart = formatDatePart(now, cfg.datePattern)
  const seqDate = computeSeqDate(now, cfg.resetBy)
  const sep = cfg.separator || ''

  // 使用事务 + findOrCreate + 递增保证原子性
  // 该方案在 SQLite 和 MySQL 均可工作：
  // - findOrCreate 在并发下只会有一个创建成功，另一个走 update 分支
  // - increment 在事务内对当前行加锁递增
  const t = await sequelize.transaction()
  let finalNo: string
  try {
    const [record] = await Sequence.findOrCreate({
      where: { seq_key: seqKey, seq_date: seqDate },
      defaults: { seq_key: seqKey, seq_date: seqDate, current_value: 0 },
      transaction: t,
      lock: t.LOCK && t.LOCK.UPDATE, // MySQL 行锁；SQLite 忽略
    })
    // 重置日/年变更时 current_value 已通过 seqDate 隔离（不同日期是不同记录）
    await record.increment('current_value', { by: 1, transaction: t })
    await record.reload({ transaction: t })
    await t.commit()
    const seqStr = String(record.current_value).padStart(cfg.seqWidth, '0')
    finalNo = `${cfg.prefix}${sep}${datePart}${sep}${seqStr}`
  } catch (err) {
    await t.rollback()
    throw err
  }

  // 同步更新 NumberRule 的 current_no 和 used_count（非事务，失败不影响编号生成）
  try {
    const rule = await NumberRule.findOne({ where: { rule_code: seqKey } })
    if (rule) {
      await rule.update({
        current_no: finalNo,
        used_count: (rule.used_count || 0) + 1,
      })
    }
  } catch (err) {
    // 静默失败，不影响编号生成
  }

  return finalNo
}

/**
 * 仅预览下一个编号（不消耗序号，不写入 sys_sequence）
 * 用于编号管理页面的"预览"功能
 * @param ruleConfig 规则配置 { prefix, date_format, separator, seq_width, reset_by }
 * @param nextSeq 下一个序号值（默认 1）
 * @returns 预览编号
 */
export function previewBizNo(ruleConfig: any, nextSeq: number = 1): string {
  const now = new Date()
  const datePart = formatDatePart(now, ruleConfig.date_format)
  const sep = ruleConfig.separator || ''
  const seqStr = String(nextSeq).padStart(ruleConfig.seq_width, '0')
  return `${ruleConfig.prefix}${sep}${datePart}${sep}${seqStr}`
}

// 便捷方法
export const generateOrderNo            = () => generateBizNo('ORDER')
export const generateReportOrderNo      = () => generateBizNo('WORK_ORDER')
export const generateIncomingNo         = () => generateBizNo('INCOMING')
export const generateProcessInspectionNo = () => generateBizNo('PROCESS')
export const generateFinishedNo         = () => generateBizNo('FINISHED')
export const generateMicrobeNo          = () => generateBizNo('MICROBE')
export const generateEnvNo              = () => generateBizNo('ENV')
export const generateInstrumentNo       = () => generateBizNo('INSTRUMENT')
export const generateComplaintNo        = () => generateBizNo('COMPLAINT')
export const generateSupplierComplaintNo = () => generateBizNo('SUPPLIER_COMPLAINT')
export const generateStandardNo         = () => generateBizNo('STANDARD')
export const generateNcrNo              = () => generateBizNo('NCR')

// 暴露 SEQ_CONFIG 副本（供调试/读取）
export function getSeqConfig(): any {
  return { ...SEQ_CONFIG }
}

export default {
  generateBizNo,
  previewBizNo,
  reloadRulesFromDB,
  getSeqConfig,
  generateOrderNo,
  generateReportOrderNo,
  generateIncomingNo,
  generateProcessInspectionNo,
  generateFinishedNo,
  generateMicrobeNo,
  generateEnvNo,
  generateInstrumentNo,
  generateComplaintNo,
  generateSupplierComplaintNo,
  generateStandardNo,
  generateNcrNo,
}
