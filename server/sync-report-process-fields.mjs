import { ReportProcess, Process } from './src/models/index.js'
import { logger } from './src/utils/logger.js'

async function syncReportProcessFields() {
  logger.info('[syncReportProcessFields] 开始同步报工工序子表的 has_material 和 must_report 字段')

  const rps = await ReportProcess.findAll({
    attributes: ['id', 'report_order_id', 'process_id', 'has_material', 'must_report'],
  })
  logger.info(`共 ${rps.length} 条报工工序记录待检查`)

  const processIds = [...new Set(rps.map(rp => rp.process_id))]
  const procs = await Process.findAll({
    where: { process_id: processIds },
    attributes: ['process_id', 'process_code', 'has_material', 'must_report'],
  })
  const procMap = new Map(procs.map(p => [
    p.process_id,
    {
      has_material: p.getDataValue('has_material'),
      must_report: p.getDataValue('must_report'),
      process_code: p.process_code,
    },
  ]))

  let updatedCount = 0
  for (const rp of rps) {
    const proc = procMap.get(rp.process_id)
    if (!proc) continue

    const rpHasMat = rp.getDataValue('has_material')
    const rpMustRep = rp.getDataValue('must_report')
    const needUpdate = rpHasMat !== proc.has_material || rpMustRep !== proc.must_report

    if (needUpdate) {
      await rp.update({
        has_material: proc.has_material,
        must_report: proc.must_report,
      })
      updatedCount++
    }
  }

  logger.info(`[syncReportProcessFields] 同步完成，共更新 ${updatedCount} 条记录`)
  return updatedCount
}

syncReportProcessFields()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('同步失败:', err)
    process.exit(1)
  })
