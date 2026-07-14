/**
 * 数据库列迁移工具
 *
 * 由于 Sequelize 的 sync() 默认只创建不存在的表，不会为已有表添加新列。
 * 本工具在启动时检查每个模型的字段，对已有表执行 ALTER TABLE ADD COLUMN
 * 以补齐缺失字段，避免开发库字段缺失导致的报错。
 *
 * 仅在 SQLite/MySQL 上执行 ADD COLUMN（不删除已有列，不修改列类型），
 * 对于已存在但类型不同的列保持原样，避免数据丢失。
 */
import sequelize from './config/database.js'
import { User, Role, Permission, OperationLog, SystemConfig, Customer, Material, DefectType } from './models/index.js'

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
  {
    table: 'production_work_order',
    columns: [
      ['planned_qty', 'DECIMAL(12,2) DEFAULT 0'],
      ['plan_start_time', 'DATETIME'],
      ['plan_end_time', 'DATETIME'],
      ['remarks', 'VARCHAR(500)'],
      ['start_qty', 'DECIMAL(12,2) DEFAULT 0'],
      ['qualified_qty', 'DECIMAL(12,2) DEFAULT 0'],
      ['defect_material', 'DECIMAL(12,2) DEFAULT 0'],
      ['defect_process', 'DECIMAL(12,2) DEFAULT 0'],
      ['defect_scrap', 'DECIMAL(12,2) DEFAULT 0'],
    ],
  },
  {
    table: 'production_manpower_record',
    columns: [
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
  {
    table: 'production_process_exception',
    columns: [
      ['exception_images', 'TEXT'],
      ['report_id', 'INTEGER'],
    ],
  },
  {
    table: 'production_process_report',
    columns: [
      ['line_id', 'INTEGER'],
      ['line_name', 'VARCHAR(100)'],
      ['material_id', 'VARCHAR(36)'],
      ['material_code', 'VARCHAR(50)'],
      ['material_name', 'VARCHAR(100)'],
      ['specification', 'VARCHAR(200)'],
      ['unit', 'VARCHAR(20)'],
      ['planned_qty', 'DECIMAL(12,2) DEFAULT 0'],
      ['report_date', 'DATE'],
      ['shift', 'VARCHAR(20)'],
      ['team', 'VARCHAR(50)'],
    ],
  },
  {
    table: 'production_process_defect',
    columns: [
      ['report_id', 'INTEGER'],
    ],
  },
  {
    table: 'production_process_material',
    columns: [
      ['report_id', 'INTEGER'],
    ],
  },
  {
    table: 'production_manpower_record',
    columns: [
      ['report_id', 'INTEGER'],
    ],
  },
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

export async function runMigrations() {
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
          } catch (e) {
            // 列已存在或语法不兼容，跳过
          }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ 迁移 ${m.table} 时出错:`, err.message)
    }
  }
}

export default { runMigrations }
