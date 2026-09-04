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
import { QueryTypes } from 'sequelize'
import { logger } from './utils/logger.js'


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
      ['barcode', 'VARCHAR(100)'],
    ],
  },
  {
    table: 'production_order',
    columns: [
      ['film_version', 'VARCHAR(50)'],
      ['version_no', 'VARCHAR(50)'],
      ['barcode', 'VARCHAR(100)'],
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
    table: 'master_process',
    columns: [
      ['must_report', 'TINYINT DEFAULT 0'],
    ],
  },
  // 设备保养标准表：补齐点检角色字段（多选，存角色名称数组）
  {
    table: 'device_standard',
    columns: [
      ['inspection_roles', 'JSON NULL COMMENT \'点检角色（多选，存角色名称数组）\''],
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
      ['close_time', 'DATETIME'],
      ['report_user_id', 'INTEGER'],
      ['report_user_name', 'VARCHAR(50)'],
      ['finish_user_id', 'INTEGER'],
      ['finish_user_name', 'VARCHAR(50)'],
      ['close_user_id', 'INTEGER'],
      ['close_user_name', 'VARCHAR(50)'],
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
      ['must_report', 'TINYINT DEFAULT 0'],
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
  // 产品检测项目子表：新增 category
  {
    table: 'quality_product_inspection_item',
    columns: [
      ['category', 'VARCHAR(50)'],
    ],
  },
  // 检验标准主表：补齐 inspection_plan（检验方案）
  {
    table: 'quality_inspection_standard',
    columns: [
      ['inspection_plan', 'VARCHAR(50)'],
    ],
  },
  // 检验标准项目子表：新增抽样方案字段（补齐标准项配置驱动所需全量列）
  {
    table: 'quality_inspection_standard_item',
    columns: [
      ['defect_level', 'VARCHAR(20)'],
      ['inspection_types', 'VARCHAR(200)'],
      ['sampling_plan', "VARCHAR(20) DEFAULT 'AQL抽样'"],
      ['sampling_detail', 'TEXT'],
      // —— 标准项直接驱动的配置字段（新增：原来 migrate 漏加导致抽样信息列大量 '-')
      ['item_type', 'VARCHAR(20)'],
      ['need_sample_count', 'INT DEFAULT 0'],
      ['upper_limit', 'DECIMAL(15,4)'],
      ['lower_limit', 'DECIMAL(15,4)'],
      ['accept_number', 'INT'],
      ['reject_number', 'INT'],
    ],
  },
  // 检验数据统一存储改造：qc_inspection_item 新增抽样方案字段
  // 注意：nominal_value / sampling_ratio 在下面 obsoleteColumns 中被删除（先从模型移除），
  // 所以此处不再 ADD 它们
  {
    table: 'qc_inspection_item',
    columns: [
      ['item_type', 'VARCHAR(20)'],
      ['need_sample_count', 'INT DEFAULT 0'],
      ['upper_limit', 'DECIMAL(15,4)'],
      ['lower_limit', 'DECIMAL(15,4)'],
      ['sampling_plan', "VARCHAR(20) DEFAULT 'AQL抽样'"],
      ['sampling_detail', 'TEXT'],
      ['accept_number', 'INT'],
      ['reject_number', 'INT'],
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

// 废弃字段清单（已用 report_order_id 统一替代 / 旧抽样字段 sample_rule/sample_count_mode 已被替代）
// nominal_value / sampling_ratio：先从 Sequelize 模型（InspectionStandardItem / QcInspectionItem）中移除，
//   再通过 obsoleteColumns 从物理表中 DROP COLUMN，避免 Sequelize SELECT 时 ER_BAD_FIELD_ERROR。
const obsoleteColumns = [
  { table: 'production_process_defect', columns: ['report_id', 'work_order_id'] },
  { table: 'production_process_material', columns: ['report_id', 'work_order_id'] },
  { table: 'production_process_exception', columns: ['report_id', 'work_order_id', 'work_order_no'] },
  { table: 'production_manpower_record', columns: ['report_id', 'work_order_id', 'work_order_no'] },
  // 检验项目抽样方式改造：旧字段 sample_rule / sample_count_mode 已被替代
  { table: 'quality_inspection_standard_item', columns: ['sample_rule', 'sample_count_mode', 'nominal_value', 'sampling_ratio'] },
  { table: 'qc_inspection_item', columns: ['sample_rule', 'sample_count_mode', 'nominal_value', 'sampling_ratio'] },
]

// SQLite 与 MySQL 取列名的方式不同
async function getExistingColumns(tableName) {
  const dialect = sequelize.getDialect()
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(`PRAGMA table_info(${tableName})`)
    return (rows as any[]).map(r => r.name)
  }
  // mysql
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    { replacements: [sequelize.config.database, tableName] }
  )
  return (rows as any[]).map(r => r.COLUMN_NAME)
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

  // 4. 执行 SQL 目录中的迁移（幂等补充核心外键）
  await ensureCoreForeignKeys()

  // 5. 补齐高频查询字段的性能索引（幂等）
  await ensurePerformanceIndexes()

  // 6. 检验数据统一存储改造（回填阶段）：从检验标准同步配置到 qc_inspection_item
  await backfillQcItemConfig()
}

// 判断约束是否已存在
async function constraintExists(table: string, name: string): Promise<boolean> {
  const [rows] = await sequelize.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND CONSTRAINT_NAME = :name LIMIT 1`,
    { replacements: { table, name }, type: QueryTypes.SELECT }
  )
  return (rows as unknown[]).length > 0
}

async function ensureCoreForeignKeys(): Promise<void> {
  if (sequelize.getDialect() !== 'mysql') return
  const statements: Array<{ table: string; name: string; ddl: (name: string) => string }> = [
    {
      table: 'production_report_process',
      name: 'fk_rpp_process',
      ddl: (n) =>
        `ALTER TABLE production_report_process ADD CONSTRAINT ${n} FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      table: 'production_process_defect',
      name: 'fk_ppd_process',
      ddl: (n) =>
        `ALTER TABLE production_process_defect ADD CONSTRAINT ${n} FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      table: 'production_process_material',
      name: 'fk_ppm_process',
      ddl: (n) =>
        `ALTER TABLE production_process_material ADD CONSTRAINT ${n} FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      table: 'production_process_material',
      name: 'fk_ppm_bas_material',
      ddl: (n) =>
        `ALTER TABLE production_process_material ADD CONSTRAINT ${n} FOREIGN KEY (bas_material_id) REFERENCES bas_material(material_id) ON DELETE SET NULL ON UPDATE CASCADE`,
    },
    {
      table: 'production_process_exception',
      name: 'fk_ppe_report',
      ddl: (n) =>
        `ALTER TABLE production_process_exception ADD CONSTRAINT ${n} FOREIGN KEY (report_order_id) REFERENCES production_report_order(report_order_id) ON DELETE CASCADE ON UPDATE CASCADE`,
    },
    {
      table: 'production_report_order',
      name: 'fk_pro_line',
      ddl: (n) =>
        `ALTER TABLE production_report_order ADD CONSTRAINT ${n} FOREIGN KEY (line_id) REFERENCES master_production_line(line_id) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      table: 'master_device',
      name: 'fk_device_line',
      ddl: (n) =>
        `ALTER TABLE master_device ADD CONSTRAINT ${n} FOREIGN KEY (line_id) REFERENCES master_production_line(line_id) ON DELETE SET NULL ON UPDATE CASCADE`,
    },
    {
      table: 'quality_microbe_inspection',
      name: 'fk_micro_order',
      ddl: (n) =>
        `ALTER TABLE quality_microbe_inspection ADD CONSTRAINT ${n} FOREIGN KEY (order_id) REFERENCES production_order(order_id) ON DELETE SET NULL ON UPDATE CASCADE`,
    },
    {
      table: 'quality_microbe_inspection',
      name: 'fk_micro_report',
      ddl: (n) =>
        `ALTER TABLE quality_microbe_inspection ADD CONSTRAINT ${n} FOREIGN KEY (report_order_id) REFERENCES production_report_order(report_order_id) ON DELETE SET NULL ON UPDATE CASCADE`,
    },
    {
      table: 'sys_operation_log',
      name: 'fk_oplog_user',
      ddl: (n) =>
        `ALTER TABLE sys_operation_log ADD CONSTRAINT ${n} FOREIGN KEY (user_id) REFERENCES sys_user(user_id) ON DELETE CASCADE ON UPDATE CASCADE`,
    },
  ]

  // 先统一字段类型与字符集，避免外键因 collation/类型不兼容而失败
  try {
    await sequelize.query(
      `ALTER TABLE production_process_material MODIFY COLUMN bas_material_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT '关联基础料品表ID'`
    )
  } catch (err) {
    console.warn('  ⚠️ 统一 bas_material_id 类型失败:', err?.message)
  }

  for (const item of statements) {
    try {
      if (!(await tableExists(item.table))) continue
      if (await constraintExists(item.table, item.name)) continue
      await sequelize.query(item.ddl(item.name))
      console.log(`  🔗 ${item.table}.${item.name}`)
    } catch (err) {
      console.warn(`  ⚠️ 外键 ${item.table}.${item.name} 创建失败:`, err?.message)
    }
  }
}

// 记录已执行的 SQL 迁移
async function isSqlMigrationApplied(name: string): Promise<boolean> {
  try {
    const [rows] = await sequelize.query(
      `SELECT name FROM _sql_migrations WHERE name = :name LIMIT 1`,
      { replacements: { name } }
    )
    return (rows as unknown[]).length > 0
  } catch {
    return false
  }
}

async function recordSqlMigration(name: string): Promise<void> {
  await sequelize.query(
    `INSERT INTO _sql_migrations (name, applied_at) VALUES (:name, NOW())`,
    { replacements: { name } }
  )
}

async function runSqlMigrations(): Promise<void> {
  if (sequelize.getDialect() !== 'mysql') return
  const migrationsDir = new URL('./migrations', import.meta.url)
  // 迁移文件由 ensurePerformanceIndexes 和内联迁移覆盖；SQL 文件保留用于文档/后续扩展
}

async function ensurePerformanceIndexes(): Promise<void> {
  if (sequelize.getDialect() !== 'mysql') return

  const indexes: Array<{ table: string; name: string; ddl: string }> = [
    {
      table: 'production_order',
      name: 'idx_order_dates',
      ddl: 'CREATE INDEX idx_order_dates ON production_order (plan_start_time, plan_end_time)',
    },
    {
      table: 'production_order',
      name: 'idx_order_material',
      ddl: 'CREATE INDEX idx_order_material ON production_order (material_id)',
    },
    {
      table: 'production_report_order',
      name: 'idx_report_order',
      ddl: 'CREATE INDEX idx_report_order ON production_report_order (order_id)',
    },
    {
      table: 'production_report_order',
      name: 'idx_report_line_status',
      ddl: 'CREATE INDEX idx_report_line_status ON production_report_order (report_time, line_id, status)',
    },
    {
      table: 'production_report_process',
      name: 'idx_rp_report',
      ddl: 'CREATE INDEX idx_rp_report ON production_report_process (report_order_id)',
    },
    {
      table: 'production_report_process',
      name: 'idx_rp_order_process',
      ddl: 'CREATE INDEX idx_rp_order_process ON production_report_process (report_order_id, process_id)',
    },
    {
      table: 'production_process_material',
      name: 'idx_pm_report',
      ddl: 'CREATE INDEX idx_pm_report ON production_process_material (report_order_id)',
    },
    {
      table: 'production_process_material',
      name: 'idx_pm_process',
      ddl: 'CREATE INDEX idx_pm_process ON production_process_material (report_order_id, process_id)',
    },
    {
      table: 'production_process_defect',
      name: 'idx_pd_report',
      ddl: 'CREATE INDEX idx_pd_report ON production_process_defect (report_order_id)',
    },
    {
      table: 'production_process_defect',
      name: 'idx_pd_type',
      ddl: 'CREATE INDEX idx_pd_type ON production_process_defect (defect_type_id, record_time)',
    },
    {
      table: 'production_process_exception',
      name: 'idx_pe_report',
      ddl: 'CREATE INDEX idx_pe_report ON production_process_exception (report_order_id)',
    },
    {
      table: 'production_process_exception',
      name: 'idx_pe_time',
      ddl: 'CREATE INDEX idx_pe_time ON production_process_exception (start_time, end_time)',
    },
    {
      table: 'sys_user',
      name: 'idx_user_role',
      ddl: 'CREATE INDEX idx_user_role ON sys_user (role_id)',
    },
    {
      table: 'sys_operation_log',
      name: 'idx_oplog_user_time',
      ddl: 'CREATE INDEX idx_oplog_user_time ON sys_operation_log (user_id, created_at)',
    },
    {
      table: 'sys_operation_log',
      name: 'idx_oplog_module_time',
      ddl: 'CREATE INDEX idx_oplog_module_time ON sys_operation_log (module, created_at)',
    },
  ]

  for (const idx of indexes) {
    const exists = await sequelize.query<{ cnt: number }>(
      `SELECT COUNT(1) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :name`,
      { replacements: { table: idx.table, name: idx.name }, type: QueryTypes.SELECT }
    )
    if (Number((exists[0] as any)?.cnt) === 0) {
      try {
        await sequelize.query(idx.ddl)
        console.log(`[Migrate] created index ${idx.name} on ${idx.table}`)
      } catch (err: any) {
        console.warn(`[Migrate] create index ${idx.name} failed: ${err?.message}`)
      }
    }
  }
}

// ============================================================
// 检验数据统一存储改造（回填阶段）
// 从 quality_inspection_standard_item 同步配置字段到 qc_inspection_item
// 让旧检验单（item_cfg_id 为空，缺 item_type/limit 等）也能驱动
// 前端 InspectionItemEditor 正确渲染定量录入界面
//
// 幂等性：所有 UPDATE 用 IFNULL，已填的数据不会被覆盖，可重复执行
// ============================================================
async function backfillQcItemConfig(): Promise<void> {
  if (sequelize.getDialect() !== 'mysql') return

  // 表不存在则跳过（sync 会先建表）
  if (!(await tableExists('qc_inspection_item'))) return
  if (!(await tableExists('quality_inspection_standard_item'))) return

  const queries: Array<{ name: string; sql: string }> = [
    {
      name: 'qc_item backfill by item_cfg_id',
      // 注意：nominal_value / sampling_ratio 已废弃并已 DROP COLUMN，SQL 中不再引用
      sql: `UPDATE qc_inspection_item qci
            JOIN quality_inspection_standard_item si ON si.item_id = qci.item_cfg_id
            SET qci.item_type = IFNULL(qci.item_type, si.item_type),
                qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si.need_sample_count),
                qci.upper_limit = IFNULL(qci.upper_limit, si.upper_limit),
                qci.lower_limit = IFNULL(qci.lower_limit, si.lower_limit)
            WHERE qci.item_type IS NULL
               OR qci.upper_limit IS NULL
               OR qci.lower_limit IS NULL`,
    },
    {
      name: 'qc_item backfill incoming (item_cfg_id null)',
      sql: `UPDATE qc_inspection_item qci
            JOIN quality_incoming_inspection ii
              ON ii.inspection_id = qci.inspection_id AND qci.source_type = '来料'
            JOIN (
              SELECT MIN(item_id) AS min_item_id, standard_id,
                     CONVERT(item_name USING utf8mb4) COLLATE utf8mb4_0900_ai_ci AS item_name_ci
              FROM quality_inspection_standard_item
              GROUP BY standard_id, item_name
            ) si ON si.standard_id = ii.standard_id AND si.item_name_ci = qci.item_name
            JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
            SET qci.item_cfg_id = IFNULL(qci.item_cfg_id, si_full.item_id),
                qci.item_type = IFNULL(qci.item_type, si_full.item_type),
                qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
                qci.upper_limit = IFNULL(qci.upper_limit, si_full.upper_limit),
                qci.lower_limit = IFNULL(qci.lower_limit, si_full.lower_limit)
            WHERE qci.item_cfg_id IS NULL`,
    },
    {
      name: 'qc_item backfill product (item_cfg_id null)',
      sql: `UPDATE qc_inspection_item qci
            JOIN quality_product_inspection pi
              ON pi.inspection_id = qci.inspection_id AND qci.source_type = '产品'
            JOIN (
              SELECT MIN(item_id) AS min_item_id, standard_id,
                     CONVERT(item_name USING utf8mb4) COLLATE utf8mb4_0900_ai_ci AS item_name_ci
              FROM quality_inspection_standard_item
              GROUP BY standard_id, item_name
            ) si ON si.standard_id = pi.standard_id AND si.item_name_ci = qci.item_name
            JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
            SET qci.item_cfg_id = IFNULL(qci.item_cfg_id, si_full.item_id),
                qci.item_type = IFNULL(qci.item_type, si_full.item_type),
                qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
                qci.upper_limit = IFNULL(qci.upper_limit, si_full.upper_limit),
                qci.lower_limit = IFNULL(qci.lower_limit, si_full.lower_limit)
            WHERE qci.item_cfg_id IS NULL`,
    },
    {
      name: 'qc_item backfill microbe (item_cfg_id null)',
      sql: `UPDATE qc_inspection_item qci
            JOIN quality_microbe_inspection mi
              ON mi.inspection_id = qci.inspection_id AND qci.source_type = '微生物'
            JOIN (
              SELECT MIN(item_id) AS min_item_id, standard_id,
                     CONVERT(item_name USING utf8mb4) COLLATE utf8mb4_0900_ai_ci AS item_name_ci
              FROM quality_inspection_standard_item
              GROUP BY standard_id, item_name
            ) si ON si.standard_id = mi.standard_id AND si.item_name_ci = qci.item_name
            JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
            SET qci.item_cfg_id = IFNULL(qci.item_cfg_id, si_full.item_id),
                qci.item_type = IFNULL(qci.item_type, si_full.item_type),
                qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
                qci.upper_limit = IFNULL(qci.upper_limit, si_full.upper_limit),
                qci.lower_limit = IFNULL(qci.lower_limit, si_full.lower_limit)
            WHERE qci.item_cfg_id IS NULL`,
    },
    {
      name: 'qc_item backfill heuristic quantitative',
      sql: `UPDATE qc_inspection_item
            SET item_type = 'quantitative'
            WHERE item_type IS NULL AND standard_value REGEXP '[0-9]'`,
    },
    {
      name: 'qc_item backfill default qualitative',
      sql: `UPDATE qc_inspection_item
            SET item_type = 'qualitative'
            WHERE item_type IS NULL`,
    },

    // —— standard_item 旧数据补齐：消除详情页「抽样信息」列全是 '-' 的情况（用户不需要手工再重保存）
    // AQL抽样：填充 {aql_value:2.5} + 默认抽样数 20
    {
      name: 'std_item backfill: AQL sampling_detail',
      sql: `UPDATE quality_inspection_standard_item
            SET sampling_detail = '{"aql_value":2.5}'
            WHERE sampling_plan = 'AQL抽样' AND (sampling_detail IS NULL OR sampling_detail = '')`,
    },
    {
      name: 'std_item backfill: AQL need_sample_count default 20',
      sql: `UPDATE quality_inspection_standard_item
            SET need_sample_count = COALESCE(need_sample_count, 20)
            WHERE sampling_plan = 'AQL抽样' AND (need_sample_count IS NULL OR need_sample_count = 0)`,
    },
    // 固定数量抽样：用 need_sample_count 作为 n；如果 Ac/Re 空则默认 Ac=0 Re=1
    {
      name: 'std_item backfill: fixed sampling_detail JSON',
      sql: `UPDATE quality_inspection_standard_item
            SET sampling_detail = CONCAT('{"sample_count":', COALESCE(NULLIF(need_sample_count,0),5),
                        ',"accept_number":', COALESCE(accept_number, 0),
                        ',"reject_number":',  COALESCE(reject_number, 1), '}')
            WHERE sampling_plan = '固定数量抽样' AND (sampling_detail IS NULL OR sampling_detail = '')`,
    },
    {
      name: 'std_item backfill: fixed default Ac/Re',
      sql: `UPDATE quality_inspection_standard_item
            SET accept_number = COALESCE(accept_number, 0),
                reject_number = COALESCE(reject_number, 1)
            WHERE sampling_plan = '固定数量抽样'`,
    },
    {
      name: 'std_item backfill: fixed n (need_sample_count)',
      sql: `UPDATE quality_inspection_standard_item
            SET need_sample_count = CASE
              WHEN need_sample_count IS NULL OR need_sample_count = 0 THEN 5
              ELSE need_sample_count
            END
            WHERE sampling_plan = '固定数量抽样'`,
    },
    // 按数量抽样：默认 1 段（≤100 → n=5 Ac=0 Re=1）
    {
      name: 'std_item backfill: by_qty sampling_detail',
      sql: `UPDATE quality_inspection_standard_item
            SET sampling_detail = '{"segments":[{"max_qty":100,"sample_count":5,"accept_number":0,"reject_number":1}]}'
            WHERE sampling_plan = '按数量抽样' AND (sampling_detail IS NULL OR sampling_detail = '')`,
    },
    {
      name: 'std_item backfill: by_qty default n=5',
      sql: `UPDATE quality_inspection_standard_item
            SET need_sample_count = CASE
              WHEN need_sample_count IS NULL OR need_sample_count = 0 THEN 5
              ELSE need_sample_count
            END
            WHERE sampling_plan = '按数量抽样'`,
    },
    // 全检：need_sample_count 留 NULL 即可（展示时用"全部"表示）
    {
      name: 'std_item backfill: full_inspection sampling_detail',
      sql: `UPDATE quality_inspection_standard_item
            SET sampling_detail = '{"note":"全检：100%逐件检验，任一NG整批拒收"}'
            WHERE sampling_plan = '全检' AND (sampling_detail IS NULL OR sampling_detail = '')`,
    },
    // 项目类型：有上下限任一非空 → quantitative；否则 qualitative
    {
      name: 'std_item backfill: item_type from limits',
      sql: `UPDATE quality_inspection_standard_item
            SET item_type = CASE
              WHEN item_type IS NOT NULL AND item_type <> '' THEN item_type
              WHEN upper_limit IS NOT NULL OR lower_limit IS NOT NULL THEN 'quantitative'
              ELSE 'qualitative'
            END
            WHERE item_type IS NULL OR item_type = ''`,
    },
    // 计划名兼容：旧数据 sampling_plan 为 NULL → 默认 AQL抽样
    {
      name: 'std_item backfill: sampling_plan default AQL',
      sql: `UPDATE quality_inspection_standard_item
            SET sampling_plan = 'AQL抽样'
            WHERE sampling_plan IS NULL OR sampling_plan = ''`,
    },
  ]

  for (const q of queries) {
    try {
      const [r] = await sequelize.query(q.sql) as any
      const affected = (r as any)?.affectedRows || 0
      console.log(`  ✅ ${q.name}: ${affected} rows`)
    } catch (err: any) {
      console.warn(`  ⚠️ ${q.name} failed:`, err?.message)
    }
  }
}

