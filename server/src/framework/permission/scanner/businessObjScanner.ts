/**
 * 权限引擎 V2 — 业务对象扫描器
 *
 * 扫描后端所有 @DataScope({ businessObj: 'xxx' }) / dataScope({ businessObj: 'xxx' })
 *   和 @BizStatusCheck({ businessObj: 'xxx', operateKey: 'xxx' }) / bizStatusCheck({...}) 调用
 * 对比 sys_business_object 字典
 *
 * 输出：
 *   1. 后端引用但字典缺失的 businessObj（→ 需要去字典维护页面补）
 *   2. operateKey 与 sys_biz_status_rule 的配对检查
 *
 * ⚠️ 红线：本扫描器只报告差异，**禁止自动新增 sys_business_object 字典记录**
 *   业务对象字典必须由开发者手动确认有对应的业务模块后再创建
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { BusinessObject as BOModel, BizStatusRule as RuleModel } from '../../../models/index.js'
import logger from '../../../utils/logger.js'
import type { ScannerDiff, ScannerReport } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_SRC = path.resolve(__dirname, '../../../')

/** businessObj 提取正则：匹配 dataScope({ businessObj: 'xxx' }) 或 bizStatusCheck({ businessObj: 'xxx' }) */
const OBJ_PATTERN = /(dataScope|bizStatusCheck)\s*\(\s*\{[^}]*businessObj\s*:\s*['"]([^'"]+)['"][^}]*\}/g
/** operateKey 提取正则 */
const OPERATE_PATTERN = /bizStatusCheck\s*\(\s*\{[^}]*operateKey\s*:\s*['"]([^'"]+)['"][^}]*businessObj\s*:\s*['"]([^'"]+)['"]/g

interface ObjRef {
  businessObj: string
  operateKey?: string
  file: string
  line: number
  source: 'DataScope' | 'BizStatusCheck'
}

export function scanBusinessObjectRefs(dir: string = SERVER_SRC): ObjRef[] {
  const refs: ObjRef[] = []

  function walk(current: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(current, { withFileTypes: true }) } catch { return }

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

            // dataScope({ businessObj: 'xxx' })
            const ds = new RegExp(OBJ_PATTERN.source, OBJ_PATTERN.flags)
            let m: RegExpExecArray | null
            while ((m = ds.exec(line)) !== null) {
              refs.push({
                businessObj: m[2],
                file: path.relative(SERVER_SRC, full),
                line: i + 1,
                source: m[1] === 'dataScope' ? 'DataScope' : 'BizStatusCheck',
              })
            }

            // bizStatusCheck({ businessObj: 'xxx', operateKey: 'yyy' })
            const bs = new RegExp(OPERATE_PATTERN.source, OPERATE_PATTERN.flags)
            while ((m = bs.exec(line)) !== null) {
              refs.push({
                businessObj: m[2],
                operateKey: m[1],
                file: path.relative(SERVER_SRC, full),
                line: i + 1,
                source: 'BizStatusCheck',
              })
            }
          }
        } catch (err) {
          logger.debug(`[Scan] skip ${full}`)
        }
      }
    }
  }

  walk(dir)
  return refs
}

export async function runBusinessObjectAudit(): Promise<ScannerReport> {
  const refs = scanBusinessObjectRefs()
  const backendObjs = new Map<string, ObjRef>()
  const objOpPairs = new Set<string>() // `${obj}:${op}`

  for (const ref of refs) {
    if (!backendObjs.has(ref.businessObj)) backendObjs.set(ref.businessObj, ref)
    if (ref.operateKey) objOpPairs.add(`${ref.businessObj}:${ref.operateKey}`)
  }

  // 读字典
  const dict = await BOModel.findAll({ attributes: ['obj_code', 'obj_name', 'has_data_scope', 'has_biz_status'] })
  const dictCodes = new Set(dict.map(d => d.obj_code))
  const dictMap = new Map(dict.map(d => [d.obj_code, d]))

  // 读规则表（operateKey 配对）
  const rules = await RuleModel.findAll({ attributes: ['obj_code', 'operate_key'] })
  const rulePairs = new Set(rules.map(r => `${r.obj_code}:${(r as any).operate_key}`))

  const diffs: ScannerDiff[] = []

  // 1. 后端引用但字典缺失
  for (const [code, ref] of backendObjs) {
    if (!dictCodes.has(code)) {
      diffs.push({
        type: 'missing',
        obj_code: code,
        file: ref.file,
        line: ref.line,
        message: `${ref.source} 引用 businessObj=${code} 但 sys_business_object 字典中不存在 — ${ref.file}:${ref.line}`,
      })
    } else {
      // 字典存在但 has_data_scope / has_biz_status 可能没开启
      const d = dictMap.get(code)!
      if (ref.source === 'DataScope' && !(d as any).has_data_scope) {
        diffs.push({
          type: 'extra',
          obj_code: code,
          message: `businessObj=${code} 字典存在但 has_data_scope=0 — 请检查是否需要开启数据权限`,
        })
      }
      if (ref.source === 'BizStatusCheck' && !(d as any).has_biz_status) {
        diffs.push({
          type: 'extra',
          obj_code: code,
          message: `businessObj=${code} 字典存在但 has_biz_status=0 — 请检查是否需要开启业务状态控制`,
        })
      }
    }
  }

  // 2. operateKey 配对：后端用了但 sys_biz_status_rule 里没有
  for (const pair of objOpPairs) {
    if (!rulePairs.has(pair)) {
      const [obj, op] = pair.split(':')
      diffs.push({
        type: 'missing',
        obj_code: obj,
        message: `bizStatusCheck 用了 ${pair} 但 sys_biz_status_rule 里没有对应的规则 — 需要去字典维护页面添加`,
      })
    }
  }

  return {
    scanner: 'business-object-scanner',
    generatedAt: new Date().toISOString(),
    total: diffs.length,
    diffs,
  }
}
