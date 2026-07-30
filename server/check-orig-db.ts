import sqlite3 from 'sqlite3'

const dbPath = '/tmp/u9-orig/u9-data-sync/server/data/u9tasks.db'

const db = new sqlite3.Database(dbPath)

console.log('📋 原项目数据库表结构及数据量:\n')

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('查询失败:', err)
    db.close()
    return
  }
  
  const tableNames = tables.map(t => t.name)
  console.log(`共 ${tableNames.length} 张表: ${tableNames.join(', ')}\n`)
  
  let done = 0
  tableNames.forEach(name => {
    db.all(`PRAGMA table_info(${name})`, (err, cols) => {
      if (err) {
        console.error(`${name} 结构查询失败:`, err)
        return
      }
      console.log(`=== ${name} ===`)
      console.log('列名:')
      cols.forEach(c => {
        console.log(`  ${c.name} (${c.type}${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' PK' : ''})`)
      })
      
      db.get(`SELECT COUNT(*) as cnt FROM ${name}`, (err, row) => {
        if (!err) {
          console.log(`记录数: ${row.cnt}`)
        }
        db.all(`SELECT * FROM ${name} LIMIT 3`, (err, rows) => {
          if (!err && rows.length > 0) {
            console.log('样例数据:')
            rows.forEach((r, i) => {
              console.log(`  [${i}] ${JSON.stringify(r).substring(0, 200)}`)
            })
          }
          console.log('')
          done++
          if (done >= tableNames.length) {
            db.close()
          }
        })
      })
    })
  })
})
