/**
 * 控件扫描脚本 — 识别 src/pages 下的页面/按钮/表单/上传控件
 * 输出 JSON 报告，含建议 perm_code 与 perm_type，供菜单管理批量配置
 *
 * 用法: npx tsx scripts/scan-controls.ts [--json] [--out report.json]
 */
import fs from 'node:fs'
import path from 'node:path'

const PAGES_DIR = path.resolve('src/pages')
const EXTS = new Set(['.tsx', '.ts'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'components', 'sections', 'order', 'config-tabs', 'config-pages'])
// 根目录文件（无子目录）→ 所属顶级模块映射
const ROOT_FILE_MODULE_MAP: Record<string, string> = {
  'Dashboard.tsx': 'bigscreen',
}
// 完全跳过的文件（如登录页，无需权限控制）
const SKIP_FILES = new Set(['Login.tsx'])

type ControlType = 'view' | 'button' | 'form' | 'upload'
const PERM_TYPE_MAP: Record<ControlType, number> = {
  view: 1,
  button: 2,
  form: 3,
  upload: 4,
}

interface ScanItem {
  file: string
  module: string
  page: string
  buttonCount: number
  formCount: number
  uploadCount: number
  suggestedPermissions: {
    perm_code: string
    perm_name: string
    perm_type: number
    perm_type_desc: string
  }[]
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, files)
    } else if (EXTS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

function countTag(source: string, tag: string): number {
  // 匹配 <Tag ...> 或 <Tag>，排除自闭合的注释
  const re = new RegExp(`<${tag}(\\s|>|/)`, 'g')
  return (source.match(re) || []).length
}

function deriveModule(file: string): string {
  const rel = path.relative(PAGES_DIR, file)
  const parts = rel.split(path.sep)
  // 根目录文件（无子目录）：查 ROOT_FILE_MODULE_MAP，否则用文件名（去扩展名）
  if (parts.length === 1) {
    const base = parts[0]
    if (ROOT_FILE_MODULE_MAP[base]) return ROOT_FILE_MODULE_MAP[base]
    return path.basename(base, path.extname(base))
  }
  return parts[0]
}

function derivePage(file: string): string {
  const rel = path.relative(PAGES_DIR, file)
  const base = path.basename(rel, path.extname(rel))
  // camelCase → kebab-case 取最后一段
  const kebab = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  return kebab
}

function buildPermCode(module: string, page: string, type: ControlType): string {
  const m = module.toLowerCase()
  // 去掉常见后缀
  const p = page.replace(/-(page|list|detail|form|management|config)$/, '')
  return `${m}:${p}:${type}`
}

function scan(): ScanItem[] {
  const files = walk(PAGES_DIR)
  const items: ScanItem[] = []

  for (const file of files) {
    const baseName = path.basename(file)
    if (SKIP_FILES.has(baseName)) continue
    const source = fs.readFileSync(file, 'utf-8')
    const module = deriveModule(file)
    const page = derivePage(file)

    const buttonCount = countTag(source, 'Button')
    const formCount = countTag(source, 'Form')
    const uploadCount = countTag(source, 'Upload')

    const suggested: ScanItem['suggestedPermissions'] = []

    // 页面级（每个 .tsx 视为一个页面）
    suggested.push({
      perm_code: buildPermCode(module, page, 'view'),
      perm_name: `${page} 查看`,
      perm_type: PERM_TYPE_MAP.view,
      perm_type_desc: '页面查看',
    })

    if (buttonCount > 0) {
      suggested.push({
        perm_code: buildPermCode(module, page, 'button'),
        perm_name: `${page} 按钮`,
        perm_type: PERM_TYPE_MAP.button,
        perm_type_desc: '页面按钮',
      })
    }
    if (formCount > 0) {
      suggested.push({
        perm_code: buildPermCode(module, page, 'form'),
        perm_name: `${page} 表单`,
        perm_type: PERM_TYPE_MAP.form,
        perm_type_desc: '表单控件',
      })
    }
    if (uploadCount > 0) {
      suggested.push({
        perm_code: buildPermCode(module, page, 'upload'),
        perm_name: `${page} 上传`,
        perm_type: PERM_TYPE_MAP.upload,
        perm_type_desc: '上传控件',
      })
    }

    items.push({
      file: path.relative(process.cwd(), file),
      module,
      page,
      buttonCount,
      formCount,
      uploadCount,
      suggestedPermissions: suggested,
    })
  }

  return items
}

function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const outIdx = args.indexOf('--out')
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null

  const items = scan()
  const totalButtons = items.reduce((s, i) => s + i.buttonCount, 0)
  const totalForms = items.reduce((s, i) => s + i.formCount, 0)
  const totalUploads = items.reduce((s, i) => s + i.uploadCount, 0)
  const totalPerms = items.reduce((s, i) => s + i.suggestedPermissions.length, 0)

  const report = {
    scannedAt: new Date().toISOString(),
    summary: {
      files: items.length,
      buttons: totalButtons,
      forms: totalForms,
      uploads: totalUploads,
      suggestedPermissions: totalPerms,
    },
    items,
  }

  const output = JSON.stringify(report, null, 2)

  if (outFile) {
    fs.writeFileSync(outFile, output, 'utf-8')
    console.log(`报告已写入: ${outFile}`)
  }

  if (jsonMode || outFile) {
    if (!outFile) console.log(output)
  } else {
    // 可读摘要
    console.log('=== 控件扫描报告 ===')
    console.log(`扫描文件数: ${items.length}`)
    console.log(`Button 总数: ${totalButtons}`)
    console.log(`Form 总数: ${totalForms}`)
    console.log(`Upload 总数: ${totalUploads}`)
    console.log(`建议权限项: ${totalPerms}`)
    console.log('')
    console.log('--- 按模块统计 ---')
    const byModule = new Map<string, { buttons: number; forms: number; uploads: number; files: number }>()
    for (const i of items) {
      const m = byModule.get(i.module) || { buttons: 0, forms: 0, uploads: 0, files: 0 }
      m.buttons += i.buttonCount
      m.forms += i.formCount
      m.uploads += i.uploadCount
      m.files += 1
      byModule.set(i.module, m)
    }
    for (const [mod, stat] of [...byModule.entries()].sort((a, b) => b[1].buttons - a[1].buttons)) {
      console.log(`  ${mod.padEnd(12)} files=${stat.files}  button=${stat.buttons}  form=${stat.forms}  upload=${stat.uploads}`)
    }
    console.log('')
    console.log('提示: 加 --json 输出完整 JSON，加 --out report.json 写入文件')
  }
}

main()
