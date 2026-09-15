/**
 * 字典管理 Service（DictController 下沉）
 *
 * 两组实体：
 *   DictType（字典类型，dict_id 主键，dict_type 唯一编码）
 *   DictData（字典数据，dict_code 主键，dict_type 关联类型）
 *
 * 删除 DictType 时级联删除关联 DictData（同事务）
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { DictType, DictData } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

// ============================================================
// 字典类型
// ============================================================

export const DictService = {
  // ---------- Type ----------
  async listType(query: any) {
    const { keyword, status, page = 1, pageSize = 30 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { dict_name: { [Op.like]: `%${keyword}%` } },
        { dict_type: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '' && status !== null) {
      where.status = Number(status)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await DictType.findAndCountAll({
      where,
      limit,
      offset,
      order: [['dict_id', 'DESC']],
    })
  },

  async getType(id: number | string) {
    const dict = await DictType.findOne({ where: { dict_id: Number(id) } })
    if (!dict) throw new AppError('字典类型不存在', 10002, 404)
    return dict
  },

  async createType(body: any, actor?: any) {
    const { dict_name, dict_type, status, remark } = body
    if (!dict_name) throw new AppError('字典名称不能为空', 10001, 400)
    if (!dict_type) throw new AppError('字典类型不能为空', 10001, 400)
    const existing = await DictType.findOne({ where: { dict_type } })
    if (existing) throw new AppError('字典类型编码已存在', 20001, 409)

    return await DictType.create({
      dict_name,
      dict_type,
      status: status !== undefined ? Number(status) : 1,
      remark,
      created_by: actor?.username || null,
    } as any)
  },

  async updateType(id: number | string, body: any) {
    const dict = await DictType.findOne({ where: { dict_id: Number(id) } })
    if (!dict) throw new AppError('字典类型不存在', 10002, 404)
    if (body.dict_type && body.dict_type !== (dict as any).dict_type) {
      const existing = await DictType.findOne({ where: { dict_type: body.dict_type } })
      if (existing) throw new AppError('字典类型编码已存在', 20001, 409)
    }
    await DictType.update(
      {
        dict_name: body.dict_name,
        dict_type: body.dict_type,
        status: body.status !== undefined ? Number(body.status) : undefined,
        remark: body.remark,
      } as any,
      { where: { dict_id: Number(id) } },
    )
    return await DictType.findOne({ where: { dict_id: Number(id) } })
  },

  /** 删除字典类型 —— 级联删除关联字典数据（同事务） */
  async removeType(id: number | string) {
    const dict = await DictType.findOne({ where: { dict_id: Number(id) } })
    if (!dict) throw new AppError('字典类型不存在', 10002, 404)

    const t = await sequelize.transaction()
    try {
      await DictData.destroy({ where: { dict_type: (dict as any).dict_type }, transaction: t })
      await DictType.destroy({ where: { dict_id: Number(id) }, transaction: t })
      await t.commit()
      return true
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  // ---------- Data ----------
  async listData(query: any) {
    const { dictType, keyword, status, page = 1, pageSize = 30 } = query
    const where: any = {}
    if (dictType) where.dict_type = dictType
    if (keyword) {
      where[Op.or] = [
        { dict_label: { [Op.like]: `%${keyword}%` } },
        { dict_value: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '' && status !== null) {
      where.status = Number(status)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await DictData.findAndCountAll({
      where,
      limit,
      offset,
      order: [['dict_sort', 'ASC'], ['dict_code', 'ASC']],
    })
  },

  async listDataByType(type: string) {
    return await DictData.findAll({
      where: { dict_type: type, status: 1 },
      order: [['dict_sort', 'ASC'], ['dict_code', 'ASC']],
    })
  },

  async getData(code: string) {
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) throw new AppError('字典数据不存在', 10002, 404)
    return data
  },

  async createData(body: any) {
    const { dict_label, dict_value, dict_type } = body
    if (!dict_label) throw new AppError('字典标签不能为空', 10001, 400)
    if (!dict_value) throw new AppError('字典键值不能为空', 10001, 400)
    if (!dict_type) throw new AppError('字典类型不能为空', 10001, 400)

    return await DictData.create({
      dict_sort: body.dict_sort || 0,
      dict_label,
      dict_value,
      dict_type,
      css_class: body.css_class,
      list_class: body.list_class,
      is_default: body.is_default ? 1 : 0,
      status: body.status !== undefined ? Number(body.status) : 1,
      remark: body.remark,
    } as any)
  },

  async updateData(code: string, body: any) {
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) throw new AppError('字典数据不存在', 10002, 404)
    await DictData.update(
      {
        dict_sort: body.dict_sort,
        dict_label: body.dict_label,
        dict_value: body.dict_value,
        dict_type: body.dict_type,
        css_class: body.css_class,
        list_class: body.list_class,
        is_default: body.is_default ? 1 : 0,
        status: body.status !== undefined ? Number(body.status) : undefined,
        remark: body.remark,
      } as any,
      { where: { dict_code: code } },
    )
    return await DictData.findOne({ where: { dict_code: code } })
  },

  async removeData(code: string) {
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) throw new AppError('字典数据不存在', 10002, 404)
    await DictData.destroy({ where: { dict_code: code } })
    return true
  },
}

export default DictService
