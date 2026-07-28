import sqlite3 from 'sqlite3'
import path from 'path'

const dbPath = path.resolve('./data/milk_can_mes.sqlite')
const db = new sqlite3.Database(dbPath)

console.log('开始迁移：去掉 inspection_type 的 NOT NULL 约束...')

db.serialize(() => {
  db.run('PRAGMA foreign_keys = OFF')

  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='quality_inspection_standard_backup'", (err, row) => {
    if (row) {
      console.log('备份表已存在，跳过备份')
    } else {
      db.run('CREATE TABLE quality_inspection_standard_backup AS SELECT * FROM quality_inspection_standard', (err) => {
        if (err) console.error('备份失败:', err)
        else console.log('备份完成')
      })
    }
  })

  db.run(`
    CREATE TABLE IF NOT EXISTS quality_inspection_standard_new (
      standard_id INTEGER PRIMARY KEY AUTOINCREMENT,
      standard_no VARCHAR(50) NOT NULL UNIQUE,
      standard_name VARCHAR(200) NOT NULL,
      inspection_type VARCHAR(20),
      standard_type VARCHAR(20) NOT NULL,
      customer_code VARCHAR(50),
      material_id UUID,
      material_name VARCHAR(200),
      version_no VARCHAR(20) DEFAULT 'V1',
      effective_date DATETIME,
      status VARCHAR(20) DEFAULT '开立',
      created_by INTEGER,
      description VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('创建新表失败:', err)
    else console.log('新表创建完成')
  })

  db.run(`
    INSERT INTO quality_inspection_standard_new 
      (standard_id, standard_no, standard_name, inspection_type, standard_type, customer_code, 
       material_id, material_name, version_no, effective_date, status, created_by, description, 
       created_at, updated_at)
    SELECT standard_id, standard_no, standard_name, inspection_type, standard_type, customer_code,
           material_id, material_name, version_no, effective_date, status, created_by, description,
           created_at, updated_at
    FROM quality_inspection_standard
  `, (err) => {
    if (err) console.error('数据迁移失败:', err)
    else console.log('数据迁移完成')
  })

  db.run('DROP TABLE IF EXISTS quality_inspection_standard', (err) => {
    if (err) console.error('删除旧表失败:', err)
    else console.log('旧表已删除')
  })

  db.run('ALTER TABLE quality_inspection_standard_new RENAME TO quality_inspection_standard', (err) => {
    if (err) console.error('重命名表失败:', err)
    else console.log('表已重命名')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_standard_no ON quality_inspection_standard(standard_no)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_type ON quality_inspection_standard(inspection_type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_standard_type ON quality_inspection_standard(standard_type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON quality_inspection_standard(status)`)

  db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) console.error(err)
    else console.log('迁移完成！')
    db.close()
  })
})
