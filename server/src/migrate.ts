/**
 * 数据库列迁移工具
 *
 * 由于 Sequelize 的 sync() 默认只创建不存在的表，不会为已有表添加新列。
 * 本工具在启动时检查每个模型的字段，对已有表执行 ALTER TABLE ADD COLUMN
 * 以补齐缺失字段，避免开发库字段缺失导致的报错。
 *
 * 仅在 SQLite/MySQL 上执行 ADD COLUMN（不删除已有列，不修改列类型），
 * 对于已存在但类型不同的列保持原样，避免数据丢失。
 *
 * 另外提供 dropObsoleteTables 清理废弃表（生产业务重构后遗留的工单/报工表）
 */
import sequelize from './config/database.js'
import { logger } from '../utils/logger.js'


// 各模型需要保证存在的列（仅列出新增/补齐的列，避免对类型变更产生影响）
// 字段定义参考对应模型文件
const migrations = [
  {
    table: 'sys_user',
    columns: [
      ['position', 'VARCHAR(50)'],
      ['avatar_url', 'VARCHAR(255)'],
      ['last_login_ip', 'VARCHAR(45)'],
      ['pwd_reset_required', 'TINYINT DEFAULT 0'],
      ['created_by', 'VARCHAR(50)'],
      ['remarks', 'VARCHAR(500)'],
    ],
  },
  {
    table: 'sys_role',
    columns: [
      ['is_system_default', 'TINYINT DEFAULT 0'],
      ['description', 'VARCHAR(200)'],
    ],
  },
  {
    table: 'sys_permission',
    columns: [
      ['visible', 'TINYINT DEFAULT 1'],
    ],
  },
  {
    table: 'sys_operation_log',
    columns: [
      ['action', 'VARCHAR(50)'],
      ['content', 'TEXT'],
      ['ip_address', 'VARCHAR(45)'],
    ],
  },
  {
    table: 'sys_config',
    columns: [
      ['config_type', 'VARCHAR(20) DEFAULT \'string\''],
      ['config_group', 'VARCHAR(50) DEFAULT \'system\''],
    ],
  },
  {
    table: 'bas_customer',
    columns: [
      ['customer_category', 'VARCHAR(50)'],
      ['customer_type', 'VARCHAR(50)'],
      ['effective_date', 'DATE'],
      ['expiry_date', 'DATE'],
      ['credit_level', 'VARCHAR(20)'],
      ['tax_id', 'VARCHAR(50)'],
      ['bank_account', 'VARCHAR(50)'],
      ['bank_name', 'VARCHAR(100)'],
    ],
  },
  {
    table: 'bas_material',
    columns: [
      ['customer_id', 'INTEGER'],
    ],
  },
  {
    table: 'master_defect_type',
    columns: [
      ['parent_id', 'INTEGER DEFAULT 0'],
    ],
  },
  {
    table: 'master_defect_image',
    columns: [
      ['file_hash', 'VARCHAR(64)'],
    ],
  },
  // 生产报工单主表（订单下发后直接创建）
  {
    table: 'production_report_order',
    columns: [
      ['order_no', 'VARCHAR(50)'],
      ['line_id', 'INTEGER'],
      ['line_name', 'VARCHAR(100)'],
      ['material_id', 'VARCHAR(36)'],
      ['material_code', 'VARCHAR(50)'],
      ['material_name', 'VARCHAR(200)'],
      ['specification', 'VARCHAR(200)'],
      ['report_qty', 'DECIMAL(12,2) DEFAULT 0'],
      ['report_time', 'DATETIME'],
      ['finish_time', 'DATETIME'],
      ['report_user_id', 'INTEGER'],
      ['report_user_name', 'VARCHAR(50)'],
      ['finish_user_id', 'INTEGER'],
      ['finish_user_name', 'VARCHAR(50)'],
      ['remarks', 'VARCHAR(500)'],
    ],
  },
  // 报工工序子表（创建报工单时从产线工序表继承）
  {
    table: 'production_report_process',
    columns: [
      ['process_code', 'VARCHAR(30) NOT NULL'],
      ['process_name', 'VARCHAR(50) NOT NULL'],
      ['has_material', 'TINYINT DEFAULT 0'],
      ['sort_order', 'INTEGER DEFAULT 0'],
    ],
  },
  // 报工单图片记录子表（统一存储不良/标签/异常图片）
  {
    table: 'production_report_image',
    columns: [
      ['category', 'VARCHAR(30) NOT NULL'],
      ['image_url', 'VARCHAR(500) NOT NULL'],
      ['file_hash', 'VARCHAR(64)'],
    ],
  },
  // 报工不良记录子表：新增 report_order_id（替代原 report_id/work_order_id）
  {
    table: 'production_process_defect',
    columns: [
      ['report_order_id', 'INTEGER'],
      ['process_id', 'INTEGER'],
      ['defect_type_id', 'INTEGER'],
      ['quantity', 'DECIMAL(12,2) DEFAULT 0'],
      ['unit', 'VARCHAR(20)'],
      ['defect_images', 'TEXT'],
    ],
  },
  // 报工物料记录子表：新增 report_order_id（替代原 report_id/work_order_id）
  {
    table: 'production_process_material',
    columns: [
      ['report_order_id', 'INTEGER'],
      ['process_id', 'INTEGER'],
      ['material_type', 'VARCHAR(100)'],
      ['bas_material_id', 'VARCHAR(255)'],
      ['material_batch', 'VARCHAR(100)'],
      ['package_no', 'VARCHAR(100)'],
      ['quantity', 'DECIMAL(12,2) DEFAULT 0'],
      ['label_images', 'TEXT'],
    ],
  },
  // 异常工时记录子表：新增 report_order_id（替代原 report_id/work_order_id/work_order_no）
  {
    table: 'production_process_exception',
    columns: [
      ['report_order_id', 'INTEGER'],
      ['exception_images', 'TEXT'],
    ],
  },
  // 人员使用记录子表：新增 report_order_id（替代原 report_id/work_order_id/work_order_no）
  {
    table: 'production_manpower_record',
    columns: [
      ['report_order_id', 'INTEGER'],
      ['record_date', 'DATE'],
      ['shift', 'VARCHAR(20)'],
      ['start_time', 'DATETIME'],
      ['end_time', 'DATETIME'],
      ['hours', 'DECIMAL(10,2) DEFAULT 0'],
      ['skilled_count', 'INTEGER DEFAULT 0'],
      ['general_count', 'INTEGER DEFAULT 0'],
      ['labor_count', 'INTEGER DEFAULT 0'],
      ['other_count', 'INTEGER DEFAULT 0'],
      ['total_people', 'INTEGER DEFAULT 0'],
      ['man_hours', 'DECIMAL(10,2) DEFAULT 0'],
    ],
  },
]

// 废弃表清单（生产业务重构后遗留，启动时尝试删除）
const obsoleteTables = [
  'production_work_order',
  'production_work_order_process',
  'production_process_report',
  'production_report_exception_image',
]

// 废弃字段清单（已用 report_order_id 统一替代）
const obsoleteColumns = [
  { table: 'production_process_defect', columns: ['report_id', 'work_order_id'] },
  { table: 'production_process_material', columns: ['report_id', 'work_order_id'] },
  { table: 'production_process_exception', columns: ['report_id', 'work_order_id', 'work_order_no'] },
  { table: 'production_manpower_record', columns: ['report_id', 'work_order_id', 'work_order_no'] },
]

// SQLite 与 MySQL 取列名的方式不同
async function getExistingColumns(tableName) {
  const dialect = sequelize.getDialect()
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(`PRAGMA table_info(${tableName})`)
    return rows.map(r => r.name)
  }
  // mysql
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    { replacements: [sequelize.config.database, tableName] }
  )
  return rows.map(r => r.COLUMN_NAME)
}

// 检查表是否存在
async function tableExists(tableName) {
  const dialect = sequelize.getDialect()
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      { replacements: [tableName] }
    )
    return rows.length > 0
  }
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    { replacements: [sequelize.config.database, tableName] }
  )
  return rows.length > 0
}

// 将模型类型字符串映射到目标方言的 DDL
function toDialectType(decl) {
  const dialect = sequelize.getDialect()
  if (dialect === 'sqlite') {
    // SQLite 类型亲和：VARCHAR/N -> TEXT，TINYINT/INTEGER -> INTEGER，DATE -> TEXT，TEXT -> TEXT
    return decl
      .replace(/VARCHAR\(\d+\)/g, 'VARCHAR')
      .replace(/TINYINT/g, 'INTEGER')
  }
  return decl
}

// 删除废弃表
async function dropObsoleteTables() {
  for (const tableName of obsoleteTables) {
    try {
      const exists = await tableExists(tableName)
      if (exists) {
        await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`)
        console.log(`  🗑️  删除废弃表 ${tableName}`)
      }
    } catch (err) {
      console.warn(`  ⚠️ 删除废弃表 ${tableName} 时出错:`, err.message)
    }
  }
}

// 删除废弃字段
async function dropObsoleteColumns() {
  for (const { table, columns } of obsoleteColumns) {
    try {
      const exists = await tableExists(table)
      if (!exists) continue
      const existing = await getExistingColumns(table)
      for (const col of columns) {
        if (existing.includes(col)) {
          try {
            await sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${col}`)
            console.log(`  🗑️  删除 ${table}.${col}`)
          } catch (err) {
        logger.warn('[SilentCatch] // 列删除失败时跳过', err?.message)
    }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ 清理 ${table} 字段时出错:`, err.message)
    }
  }
}

export async function runMigrations() {
  // 1. 先删除废弃表（避免外键约束干扰）
  await dropObsoleteTables()

  // 2. 补齐缺失字段
  for (const m of migrations) {
    try {
      const existing = await getExistingColumns(m.table)
      if (existing.length === 0) {
        // 表不存在，sync() 会创建，跳过
        continue
      }
      for (const [col, type] of m.columns) {
        if (!existing.includes(col)) {
          const ddl = toDialectType(type)
          try {
            await sequelize.query(`ALTER TABLE ${m.table} ADD COLUMN ${col} ${ddl}`)
            console.log(`  ➕ ${m.table}.${col} (${ddl})`)
          } catch (err) {
        logger.warn('[SilentCatch] // 列已存在或语法不兼容，跳过', err?.message)
    }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ 迁移 ${m.table} 时出错:`, err.message)
    }
  }

  // 3. 删除废弃字段（必须在新增 report_order_id 后才能删除旧外键字段）
  await dropObsoleteColumns()
}

export default { runMigrations }
