/**
 * 设备文档 Service（DeviceDocumentController 下沉）
 *
 * 只处理 DB CRUD + 业务校验（类型白名单、设备关联校验）；
 * 文件系统 IO（upload/download/delete 清理文件）保留在 Controller。
 */
import { Op } from 'sequelize'
import { DeviceDocument, Device } from '../models/index.js'
import { DOC_TYPE_MAP } from '../models/DeviceDocument.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

export const ALLOWED_DOC_TYPES = new Set(Object.keys(DOC_TYPE_MAP))

// ---------- 纯函数 ----------

/** 构建文档列表 where */
export function buildDocWhere(query: any): any {
  const where: any = {}
  const { device_id, device_name, device_code, doc_type, keyword, start_date, end_date } = query

  if (device_id) where.device_id = device_id
  if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
  if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
  if (doc_type) {
    if (ALLOWED_DOC_TYPES.has(doc_type)) where.doc_type = doc_type
    else throw new AppError(`文档类型不合法，可选值：${[...ALLOWED_DOC_TYPES].join('、')}`, 10001, 400)
  }
  if (keyword) {
    where[Op.or] = [
      { doc_name: { [Op.like]: `%${keyword}%` } },
      { description: { [Op.like]: `%${keyword}%` } },
      { file_name: { [Op.like]: `%${keyword}%` } },
    ]
  }
  if (start_date || end_date) {
    where.created_at = {}
    if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
    if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }
  return where
}

// ---------- Service ----------

export const DeviceDocumentService = {
  /** 分页查询文档列表 */
  async list(query: any) {
    const where = buildDocWhere(query)
    const limit = Math.min(Number(query.page_size) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await DeviceDocument.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC'], ['doc_id', 'DESC']],
    })
  },

  /** 文档详情 */
  async detail(id: number | string) {
    const doc = await DeviceDocument.findOne({ where: { doc_id: Number(id) } })
    if (!doc) throw new AppError('文档不存在', 10002, 404)
    return doc
  },

  /** 创建文档记录（文件实体由 Controller 写入磁盘） */
  async createRecord(body: any, actor?: any) {
    if (!body.device_id) throw new AppError('设备不能为空', 10001, 400)
    if (!ALLOWED_DOC_TYPES.has(body.doc_type)) {
      throw new AppError(`文档类型不合法`, 10001, 400)
    }
    const device = await Device.findOne({ where: { device_id: body.device_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    return await DeviceDocument.create({
      device_id: body.device_id,
      device_code: (device as any).device_code,
      device_name: (device as any).device_name,
      doc_type: body.doc_type,
      doc_name: body.doc_name || body.file_name,
      file_name: body.file_name,
      file_path: body.file_path,
      file_size: body.file_size || null,
      file_format: body.file_format || '',
      description: body.description || '',
      uploaded_by: actor?.userId || null,
      uploaded_by_name: actor?.username || actor?.realName || '',
    } as any)
  },

  /** 修改文档元信息（不碰文件） */
  async updateMeta(id: number | string, body: any) {
    const doc = await DeviceDocument.findOne({ where: { doc_id: Number(id) } })
    if (!doc) throw new AppError('文档不存在', 10002, 404)

    const updateData: any = {}
    if (body.doc_type !== undefined) {
      if (!ALLOWED_DOC_TYPES.has(body.doc_type)) throw new AppError('文档类型不合法', 10001, 400)
      updateData.doc_type = body.doc_type
    }
    if (body.doc_name !== undefined) updateData.doc_name = body.doc_name
    if (body.description !== undefined) updateData.description = body.description

    if (Object.keys(updateData).length > 0) {
      await doc.update(updateData)
    }
    return doc
  },

  /** 查某设备下的所有文档 */
  async listByDevice(deviceId: number | string) {
    return await DeviceDocument.findAll({
      where: { device_id: Number(deviceId) },
      order: [['created_at', 'DESC']],
    })
  },

  // ---------- upload 事务内 DB 操作 ----------

  /** 上传前置：校验设备存在 + 统计同类型文档数量 */
  async prepareUploadContext(deviceId: number, docType: string, transaction?: any) {
    const device = await Device.findOne({
      where: { device_id: deviceId },
      transaction,
    })
    if (!device) throw new AppError('设备不存在', 10002, 404)
    const existingCount = await DeviceDocument.count({
      where: { device_id: deviceId, doc_type: docType },
      transaction,
    })
    return { device, existingCount }
  },

  /** 事务内批量创建文档记录 */
  async bulkCreate(docs: any[], transaction?: any) {
    const created: any[] = []
    for (const d of docs) {
      created.push(await DeviceDocument.create(d, { transaction }))
    }
    return created
  },

  // ---------- delete 事务内 DB 操作 ----------

  /** 查文档（返回实例 + file_path）用于 Controller 删文件 */
  async findForDelete(id: number, transaction?: any) {
    const doc = await DeviceDocument.findOne({
      where: { doc_id: id },
      transaction,
    })
    if (!doc) throw new AppError('文档不存在', 10002, 404)
    return doc
  },

  /** 事务内删除文档记录 */
  async destroy(doc: any, transaction?: any) {
    await doc.destroy({ transaction })
  },

  // ---------- download DB 操作 ----------

  /** 查文档用于下载（返回 file_path + file_name） */
  async findForDownload(id: number) {
    const doc = await DeviceDocument.findOne({ where: { doc_id: id } })
    if (!doc) throw new AppError('文档不存在', 10002, 404)
    return doc
  },
}

export default DeviceDocumentService
