/**
 * 权限引擎 V2 — 功能权限审查扫描器
 *
 * 功能：
 *   1. 扫描后端所有 permissionRequired('xxx') / requirePerm() / requirePermCode() 调用
 *   2. 对比 sys_permission 字典
 *   3. 输出差异报告（缺失的权限码 / 字典里存在但后端没用到的孤立节点）
 *
 * 支持两种模式：
 *   report  — 仅报告差异（默认）
 *   sync    — 自动把缺失的权限码插入 sys_permission（insert ignore）
 *
 * 注意：生产环境不建议自动 sync — 新权限码应该由开发者手动规划菜单结构后加种子
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { Permission } from '../../../models/index.js'
import logger from '../../../utils/logger.js'
import type { ScannerDiff, ScannerReport } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 要扫描的后端源码根目录 */
const SERVER_SRC = path.resolve(__dirname, '../../../')

// 匹配模式：
//   permissionRequired('code')         auth.ts 旧写法
//   requirePerm({ permCode: 'code' })  新中间件
//   requirePermCode('code')            新中间件快捷
//   requirePerm(['a','b'])             数组
//   requirePerm({ permCode: ['a','b'], logic: 'ANY' })
const CODE_PATTERNS = [
  /permissionRequired\(['"]([^'"]+)['"]\)/g,
  /requirePerm\s*\(\s*\{[^}]*permCode\s*:\s*['"]([^'"]+)['"][^}]*\}/g,
  /requirePerm\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /requirePermCode\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

/**
 * 扫描后端指定目录的 ts/js 源文件，收集所有权限码引用
 */
export function scanBackendPermissionCodes(
  dir: string = SERVER_SRC
): Array<{ permCode: string; file: string; line: number }> {
  const results: Array<{ permCode: string; file: string; line: number }> = []

  function walk(current: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'uploads') continue
        walk(full)
      } else if (/\.(ts|js)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(full, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            for (const pat of CODE_PATTERNS) {
              let m: RegExpExecArray | null
              // 每次匹配前重置 lastIndex
              const p = new RegExp(pat.source, pat.flags)
              while ((m = p.exec(line)) !== null) {
                const code = m[1]
                if (code) {
                  results.push({
                    permCode: code,
                    file: path.relative(SERVER_SRC, full),
                    line: i + 1,
                  })
                }
              }
            }
          }
        } catch (err) {
          logger.debug(`[Scan] skip ${full}: ${(err as Error).message}`)
        }
      }
    }
  }

  walk(dir)
  return results
}

/**
 * 执行完整的权限审查
 *
 * @param mode report(仅报告) | sync(自动同步到 sys_permission)
 */
export async function runPermissionAudit(
  mode: 'report' | 'sync' = 'report'
): Promise<ScannerReport> {
  const refs = scanBackendPermissionCodes()
  const uniqueBackendCodes = new Set(refs.map(r => r.permCode))

  // 读 sys_permission
  const allPerms = await Permission.findAll({ attributes: ['perm_code', 'perm_name', 'type', 'perm_id'] })
  const dictCodes = new Set(allPerms.map(p => p.perm_code))

  const diffs: ScannerDiff[] = []

  // 1. 后端引用但字典缺失
  const missing = [...uniqueBackendCodes].filter(c => !dictCodes.has(c))
  for (const code of missing) {
    const first = refs.find(r => r.permCode === code)!
    diffs.push({
      type: 'missing',
      perm_code: code,
      file: first.file,
      line: first.line,
      message: `后端引用 ${code} 但 sys_permission 字典中不存在 — 调用位置 ${first.file}:${first.line}`,
    })
  }

  // 2. 字典存在但后端完全没用（只报告，不自动删 — 这些菜单节点可能是前端路由用的）
  //    这里只报告 api/button 类型（menu 类型的节点可能是前端路由，暂不报告）
  const dictOnly = allPerms.filter(p => !uniqueBackendCodes.has(p.perm_code) && (p as any).type !== 'menu')
  for (const p of dictOnly) {
    diffs.push({
      type: 'extra',
      perm_code: (p as any).perm_code,
      message: `sys_permission 字典中存在 ${(p as any).perm_code}(type=${(p as any).type}) 但后端无 requirePerm/permissionRequired 调用 — 可能是前端菜单节点或历史遗留`,
    })
  }

  // sync 模式：自动补缺失的
  if (mode === 'sync' && missing.length > 0) {
    logger.info(`[Scan] sync 模式 — 自动插入 ${missing.length} 条缺失权限码到 sys_permission`)
    for (const code of missing) {
      await Permission.findOrCreate({
        where: { perm_code: code },
        defaults: {
          parent_id: 0,
          perm_name: `auto-sync: ${code}`,
          perm_code: code,
          type: 'api',
          sort_order: 0,
          visible: 0,
          status: 1,
          created_at: new Date(),
        },
      })
    }
  }

  return {
    scanner: 'permission-audit',
    generatedAt: new Date().toISOString(),
    total: diffs.length,
    diffs,
  }
}
