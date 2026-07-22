import { Op } from 'sequelize'
import { DictType, DictData } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'

export const listType = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 30 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { dict_name: { [Op.like]: `%${keyword}%` } },
        { dict_type: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '' && status !== null) {
      where.status = Number(status)
    }
    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await DictType.findAndCountAll({
      where,
      limit,
      offset,
      order: [['dict_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询字典类型失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const getType = async (req, res) => {
  try {
    const { id } = req.params
    const dict = await DictType.findOne({ where: { dict_id: id } })
    if (!dict) return fail(res, '字典类型不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, dict, '查询成功')
  } catch (err) {
    console.error('查询字典类型失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const createType = async (req, res) => {
  try {
    const { dict_name, dict_type, status, remark } = req.body
    if (!dict_name) return fail(res, '字典名称不能为空')
    if (!dict_type) return fail(res, '字典类型不能为空')
    const existing = await DictType.findOne({ where: { dict_type } })
    if (existing) return fail(res, '字典类型编码已存在')
    const dict = await DictType.create({
      dict_name,
      dict_type,
      status: status !== undefined ? Number(status) : 1,
      remark,
      created_by: req.user?.username || null,
    })
    return success(res, dict, '创建成功')
  } catch (err) {
    console.error('创建字典类型失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateType = async (req, res) => {
  try {
    const { id } = req.params
    const { dict_name, dict_type, status, remark } = req.body
    const dict = await DictType.findOne({ where: { dict_id: id } })
    if (!dict) return fail(res, '字典类型不存在', ErrorCode.RECORD_NOT_FOUND)
    if (dict_type && dict_type !== dict.dict_type) {
      const existing = await DictType.findOne({ where: { dict_type } })
      if (existing) return fail(res, '字典类型编码已存在')
    }
    await DictType.update(
      { dict_name, dict_type, status: status !== undefined ? Number(status) : undefined, remark },
      { where: { dict_id: id } }
    )
    const updated = await DictType.findOne({ where: { dict_id: id } })
    return success(res, updated, '更新成功')
  } catch (err) {
    console.error('更新字典类型失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const removeType = async (req, res) => {
  try {
    const { id } = req.params
    const dict = await DictType.findOne({ where: { dict_id: id } })
    if (!dict) return fail(res, '字典类型不存在', ErrorCode.RECORD_NOT_FOUND)
    await DictData.destroy({ where: { dict_type: dict.dict_type } })
    await DictType.destroy({ where: { dict_id: id } })
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除字典类型失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const listData = async (req, res) => {
  try {
    const { dictType, keyword, status, page = 1, pageSize = 30 } = req.query
    const where = {}
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
    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await DictData.findAndCountAll({
      where,
      limit,
      offset,
      order: [['dict_sort', 'ASC'], ['dict_code', 'ASC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const listDataByType = async (req, res) => {
  try {
    const { type } = req.params
    const data = await DictData.findAll({
      where: { dict_type: type, status: 1 },
      order: [['dict_sort', 'ASC'], ['dict_code', 'ASC']],
    })
    return success(res, data, '查询成功')
  } catch (err) {
    console.error('查询字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const getData = async (req, res) => {
  try {
    const { code } = req.params
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) return fail(res, '字典数据不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, data, '查询成功')
  } catch (err) {
    console.error('查询字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const createData = async (req, res) => {
  try {
    const { dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, remark } = req.body
    if (!dict_label) return fail(res, '字典标签不能为空')
    if (!dict_value) return fail(res, '字典键值不能为空')
    if (!dict_type) return fail(res, '字典类型不能为空')
    const data = await DictData.create({
      dict_sort: dict_sort || 0,
      dict_label,
      dict_value,
      dict_type,
      css_class,
      list_class,
      is_default: is_default ? 1 : 0,
      status: status !== undefined ? Number(status) : 1,
      remark,
    })
    return success(res, data, '创建成功')
  } catch (err) {
    console.error('创建字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateData = async (req, res) => {
  try {
    const { code } = req.params
    const { dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, remark } = req.body
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) return fail(res, '字典数据不存在', ErrorCode.RECORD_NOT_FOUND)
    await DictData.update(
      {
        dict_sort,
        dict_label,
        dict_value,
        dict_type,
        css_class,
        list_class,
        is_default: is_default ? 1 : 0,
        status: status !== undefined ? Number(status) : undefined,
        remark,
      },
      { where: { dict_code: code } }
    )
    const updated = await DictData.findOne({ where: { dict_code: code } })
    return success(res, updated, '更新成功')
  } catch (err) {
    console.error('更新字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const removeData = async (req, res) => {
  try {
    const { code } = req.params
    const data = await DictData.findOne({ where: { dict_code: code } })
    if (!data) return fail(res, '字典数据不存在', ErrorCode.RECORD_NOT_FOUND)
    await DictData.destroy({ where: { dict_code: code } })
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除字典数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}
