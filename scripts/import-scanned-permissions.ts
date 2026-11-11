/**
 * 批量导入扫描建议的权限项到 sys_permission
 *
 * 修复点（vs 旧 Python 版）:
 *   1. UPDATE 只更新 perm_type，不覆盖已有 perm_name（仅当 perm_name 为空时回填）
 *   2. INSERT 时 type 按 perm_type 映射: 1→'page', 2/3/4→'button'
 *   3. DB 连接参数从环境变量读取，默认值兼容沙箱
 *   4. 技术栈统一为 TypeScript（与 scan-controls.ts 一致）
 *
 * 用法:
 *   npx tsx scripts/import-scanned-permissions.ts            # 实际执行
 *   npx tsx scripts/import-scanned-permissions.ts --dry-run  # 预览
 */
import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'

const REPORT_PATH = path.resolve('scripts/scan-report.json')

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'milk_can_mes',
  multipleStatements: true,
}

interface SuggestedPerm {
  perm_code: string
  perm_name: string
  perm_type: number
  perm_type_desc: string
}

interface ScanItem {
  file: string
  module: string
  page: string
  suggestedPermissions: SuggestedPerm[]
}

/** perm_type → 旧 type 字段映射 */
function permTypeToType(permType: number): string {
  switch (permType) {
    case 1:
      return 'page'
    case 2:
    case 3:
    case 4:
    default:
      return 'button'
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`扫描报告不存在: ${REPORT_PATH}`)
    console.error('请先运行: npx tsx scripts/scan-controls.ts --out scripts/scan-report.json')
    process.exit(1)
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) as { items: ScanItem[] }

  const conn = await mysql.createConnection(DB_CONFIG)

  try {
    // 1. 加载顶级菜单映射 module -> { perm_id, group_name }
    const [topMenus] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT perm_id, perm_code, group_name FROM sys_permission WHERE parent_id = 0 AND type = 'menu'"
    )
    const moduleMap = new Map<string, { perm_id: number; group_name: string }>()
    for (const m of topMenus) {
      const code = String(m.perm_code)
      moduleMap.set(code, { perm_id: Number(m.perm_id), group_name: String(m.group_name || code) })
    }
    console.log(`顶级菜单: ${moduleMap.size} 个`)
    console.log(`可匹配模块: ${[...moduleMap.keys()].sort().join(', ')}`)

    // 2. 收集建议权限项（按 perm_code 去重，保留首次出现）
    const allPerms: (SuggestedPerm & { module: string })[] = []
    const seenCodes = new Set<string>()
    let skipped = 0
    for (const item of report.items) {
      if (!moduleMap.has(item.module)) {
        skipped += item.suggestedPermissions.length
        continue
      }
      for (const p of item.suggestedPermissions) {
        if (seenCodes.has(p.perm_code)) continue
        seenCodes.add(p.perm_code)
        allPerms.push({ ...p, module: item.module })
      }
    }
    console.log(`待处理权限项: ${allPerms.length}（跳过 ${skipped} 个无主模块）`)

    // 3. 查询已存在的 perm_code（含 perm_name 用于判断是否覆盖）
    const existing = new Map<string, { perm_id: number; perm_name: string | null }>()
    if (allPerms.length > 0) {
      const codes = allPerms.map(p => p.perm_code)
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT perm_id, perm_code, perm_name FROM sys_permission WHERE perm_code IN (${codes.map(() => '?').join(',')})`,
        codes
      )
      for (const r of rows) {
        existing.set(String(r.perm_code), {
          perm_id: Number(r.perm_id),
          perm_name: r.perm_name == null ? null : String(r.perm_name),
        })
      }
    }

    let inserted = 0
    let updated = 0
    let nameSkipped = 0

    await conn.beginTransaction()
    try {
      for (const p of allPerms) {
        const parent = moduleMap.get(p.module)!
        const record = existing.get(p.perm_code)

        if (record) {
          // 已存在：只更新 perm_type；perm_name 仅在为空时回填，不覆盖已有中文名
          const nameIsEmpty = !record.perm_name || record.perm_name.trim() === ''
          if (!nameIsEmpty) nameSkipped++
          if (!dryRun) {
            if (nameIsEmpty) {
              await conn.query(
                'UPDATE sys_permission SET perm_type = ?, perm_name = ?, group_name = ?, parent_id = ? WHERE perm_id = ?',
                [p.perm_type, p.perm_name, parent.group_name, parent.perm_id, record.perm_id]
              )
            } else {
              await conn.query(
                'UPDATE sys_permission SET perm_type = ?, group_name = ?, parent_id = ? WHERE perm_id = ?',
                [p.perm_type, parent.group_name, parent.perm_id, record.perm_id]
              )
            }
          }
          updated++
        } else {
          // 不存在：插入，type 按 perm_type 映射
          if (!dryRun) {
            await conn.query(
              `INSERT INTO sys_permission
                 (perm_code, perm_name, type, perm_type, parent_id, group_name, sort_order, status, visible, is_abandon, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 1, 1, 0, NOW())`,
              [p.perm_code, p.perm_name, permTypeToType(p.perm_type), p.perm_type, parent.perm_id, parent.group_name]
            )
          }
          inserted++
        }
      }

      if (dryRun) {
        await conn.rollback()
        console.log(`\n[DRY RUN] 将插入 ${inserted} 条，更新 ${updated} 条（其中 ${nameSkipped} 条保留已有 perm_name）`)
      } else {
        await conn.commit()
        console.log(`\n完成: 插入 ${inserted} 条，更新 ${updated} 条（其中 ${nameSkipped} 条保留已有 perm_name）`)
      }
    } catch (err) {
      await conn.rollback()
      console.error('\n事务回滚:', err)
      process.exit(1)
    }
  } finally {
    await conn.end()
  }
}

main()
