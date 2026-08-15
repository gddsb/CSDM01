import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), '..', 'backups')
const OUT_LOG = path.join(LOG_DIR, 'pm2-out.log')
const ERR_LOG = path.join(LOG_DIR, 'pm2-error.log')

const LOG_LEVEL_PRIORITY = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

function parseLogLine(line: string) {
  const match = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/)
  if (!match) return null
  const [, timestamp, level, message] = match
  return { timestamp, level: level.toUpperCase(), message }
}

async function readLogLines(filePath: string, limit: number): Promise<string[]> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve([])
      return
    }
    const lines: string[] = []
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8', start: Math.max(0, fs.statSync(filePath).size - 2 * 1024 * 1024) })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (line.trim()) {
        lines.push(line)
        if (lines.length > limit * 5) lines.shift()
      }
    })
    rl.on('close', () => resolve(lines.slice(-limit * 5)))
  })
}

export const list = async (req, res) => {
  try {
    const { level, keyword, page = 1, pageSize = 50, dateStart, dateEnd } = req.query

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit

    const [outLines, errLines] = await Promise.all([
      readLogLines(OUT_LOG, 2000),
      readLogLines(ERR_LOG, 500),
    ])

    let allParsed = []
    for (const line of [...outLines, ...errLines]) {
      const parsed = parseLogLine(line)
      if (parsed) allParsed.push(parsed)
    }

    if (level) {
      const targetLevel = String(level).toUpperCase()
      const minPriority = LOG_LEVEL_PRIORITY[targetLevel] ?? 0
      allParsed = allParsed.filter(p => LOG_LEVEL_PRIORITY[p.level] >= minPriority)
    }

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      allParsed = allParsed.filter(p => p.message.toLowerCase().includes(kw))
    }

    if (dateStart) {
      const start = new Date(String(dateStart)).getTime()
      if (!isNaN(start)) {
        allParsed = allParsed.filter(p => new Date(p.timestamp).getTime() >= start)
      }
    }
    if (dateEnd) {
      const end = new Date(String(dateEnd) + ' 23:59:59').getTime()
      if (!isNaN(end)) {
        allParsed = allParsed.filter(p => new Date(p.timestamp).getTime() <= end)
      }
    }

    allParsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const total = allParsed.length
    const data = allParsed.slice(offset, offset + limit).map((p, i) => ({
      log_id: offset + i + 1,
      timestamp: p.timestamp,
      level: p.level,
      message: p.message,
    }))

    return success(res, data, '查询成功', total)
  } catch (err) {
    console.error('查询系统日志失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list }
