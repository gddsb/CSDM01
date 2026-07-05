import sequelize from '../config/database.js'
import Sequence from '../models/Sequence.js'

/**
 * 业务编号生成器
 *
 * 设计要点：
 * 1. 通过 sys_sequence 表的 (seq_key, seq_date) 唯一约束保证同日同业务键的序号唯一
 * 2. 通过 Sequelize 事务保证原子性；MySQL 使用 SELECT ... FOR UPDATE 行锁，
 *    SQLite 使用 findOrCreate + 递增（事务隔离足够保证原子性）
 * 3. 按日重置的编号 seq_date = YYYYMMDD；按年重置的编号 seq_date = YYYY
 *
 * 编号格式规范（依据《奶粉罐生产管理系统开发设计文档V4.0》编号规则章节）：
 * - 订单号：MO-16 + YYMMDD + 3位序号          例：MO-16260705001
 * - 工单号：WO + YYMMDD + 3位序号              例：WO260705001
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

// 序列键 → 编号生成配置
const SEQ_CONFIG = {
  ORDER:               { prefix: 'MO-16', datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
  WORK_ORDER:          { prefix: 'WO',    datePattern: 'YYMMDD', seqWidth: 3, resetBy: 'day'    },
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

// 格式化日期片段
function formatDatePart(now, pattern) {
  const yy = String(now.getFullYear()).slice(2)
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  if (pattern === 'YYMMDD') return `${yy}${mm}${dd}`
  if (pattern === 'YYYY') return yyyy
  return ''
}

// 根据 resetBy 计算 seq_date
function computeSeqDate(now, resetBy) {
  const yyyy = String(now.getFullYear())
  if (resetBy === 'year') return yyyy
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * 生成业务编号（原子操作）
 * @param {string} seqKey 序列键，参见 SEQ_CONFIG
 * @returns {Promise<string>} 生成的业务编号
 */
export async function generateBizNo(seqKey) {
  const cfg = SEQ_CONFIG[seqKey]
  if (!cfg) {
    throw new Error(`未知的序列键: ${seqKey}`)
  }
  const now = new Date()
  const datePart = formatDatePart(now, cfg.datePattern)
  const seqDate = computeSeqDate(now, cfg.resetBy)

  // 使用事务 + findOrCreate + 递增保证原子性
  // 该方案在 SQLite 和 MySQL 均可工作：
  // - findOrCreate 在并发下只会有一个创建成功，另一个走 update 分支
  // - increment 在事务内对当前行加锁递增
  const t = await sequelize.transaction()
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
    return `${cfg.prefix}${datePart}${seqStr}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}

// 便捷方法
export const generateOrderNo            = () => generateBizNo('ORDER')
export const generateWorkOrderNo        = () => generateBizNo('WORK_ORDER')
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

export default {
  generateBizNo,
  generateOrderNo,
  generateWorkOrderNo,
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
