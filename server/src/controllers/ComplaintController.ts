import { Op } from 'sequelize'
import {
  QualityComplaint,
  QualityComplaintRecord,
  Customer,
  Material,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateComplaintNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { STAGE_MAP, STAGE_REVERSE } from '../models/QualityComplaintRecord.js'

const STATUS_REVERSE: Record<string, number> = { '处理中': 0, '已关闭': 1 }

const parseStatusParam = (status: any): number[] | null => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

const STAGE_ORDER: string[] = ['调查', '处理', '原因分析', '回复客户', '客户反馈', '关闭']

async function getDetail(id: number) {
  const record = await QualityComplaint.findOne({
    where: { complaint_id: id },
    include: [
      {
        model: QualityComplaintRecord,
        as: 'records',
        required: false,
        separate: true,
        order: [['record_id', 'ASC']],
      },
      {
        model: Customer,
        as: 'customer',
        required: false,
      },
      {
        model: Material,
        as: 'material',
        required: false,
      },
    ],
  })
  if (!record) return null
  return record.toJSON()
}

export default {
  /**
   * 分页查询客诉列表
   * 支持按编号、客户、状态、日期过滤
   */
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        complaint_no,
        customer_name,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (complaint_no) where.complaint_no = { [Op.like]: `%${complaint_no}%` }
      if (customer_name) where.customer_name = { [Op.like]: `%${customer_name}%` }

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.complaint_time = {}
        if (start_date) where.complaint_time[Op.gte] = new Date(String(start_date))
        if (end_date) where.complaint_time[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await QualityComplaint.findAndCountAll({
        where,
        order: [['complaint_time', 'DESC'], ['complaint_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[QualityComplaint] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取详情（包含处理记录时间线）
   */
  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '客诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[QualityComplaint] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建客诉（自动编号 TS+日期+序号）
   */
  async create(req: any, res: any) {
    const t = await QualityComplaint.sequelize.transaction()
    try {
      const userInfo: any = (req as any).user || {}
      const {
        customer_id,
        source,
        customer_name,
        contact_person,
        contact_phone,
        material_id,
        material_name,
        batch_no,
        complaint_type,
        complaint_desc,
        complaint_method,
        complaint_time,
        require_reply,
        reply_deadline,
        handle_direction,
        handler_id,
        handler_name,
        remarks,
      } = req.body

      if (!complaint_desc) {
        return fail(res, '投诉描述不能为空', ErrorCode.PARAM_INVALID)
      }

      // 自动生成编号
      const complaint_no = await generateComplaintNo()

      const record = await QualityComplaint.create({
        complaint_no,
        source: source || '客户投诉',
        customer_id: customer_id || null,
        customer_name: customer_name || '',
        contact_person: contact_person || '',
        contact_phone: contact_phone || '',
        material_id: material_id || null,
        material_name: material_name || '',
        batch_no: batch_no || '',
        complaint_type: complaint_type || '质量问题',
        complaint_desc,
        complaint_method: complaint_method || '电话',
        complaint_time: complaint_time || new Date(),
        require_reply: require_reply ?? 0,
        reply_deadline: reply_deadline || null,
        handle_direction: handle_direction || '',
        status: 0,
        handler_id: handler_id || null,
        handler_name: handler_name || '',
        registered_by: userInfo.userId || null,
        registered_by_name: userInfo.username || '',
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(record.complaint_id)
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[QualityComplaint] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新客诉信息
   */
  async update(req: any, res: any) {
    const t = await QualityComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await QualityComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '客诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const allowed = [
        'customer_id', 'customer_name', 'contact_person', 'contact_phone',
        'material_id', 'material_name', 'batch_no', 'complaint_type',
        'complaint_desc', 'complaint_method', 'complaint_time',
        'require_reply', 'reply_deadline', 'handle_direction',
        'handler_id', 'handler_name', 'remarks',
      ]
      const updateData: any = {}
      allowed.forEach((k) => {
        if (req.body[k] !== undefined) updateData[k] = req.body[k]
      })

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[QualityComplaint] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 添加处理记录（推进流程阶段）
   * stage 支持：调查/处理/原因分析/回复客户/客户反馈/关闭
   */
  async addRecord(req: any, res: any) {
    const t = await QualityComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { stage, content, attachment_url } = req.body

      const record = await QualityComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '客诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      if (!stage || !STAGE_MAP[stage]) {
        return fail(res, `阶段无效，可选值：${STAGE_ORDER.join('/')}`, ErrorCode.PARAM_INVALID)
      }
      if (!content) {
        return fail(res, '处理内容不能为空', ErrorCode.PARAM_INVALID)
      }

      // 阶段推进校验：只能进入当前阶段之后的阶段
      const existingRecords = await QualityComplaintRecord.findAll({
        where: { complaint_id: id },
        order: [['record_id', 'ASC']],
      })
      if (existingRecords.length > 0) {
        const lastStage = existingRecords[existingRecords.length - 1].stage
        const lastIdx = STAGE_ORDER.indexOf(lastStage)
        const nextIdx = STAGE_ORDER.indexOf(stage)
        if (nextIdx <= lastIdx) {
          return fail(res, '阶段只能向前推进', ErrorCode.PARAM_INVALID)
        }
      } else if (stage !== '调查') {
        // 第一条记录必须为"调查"
        return fail(res, '首个处理记录必须为"调查"阶段', ErrorCode.PARAM_INVALID)
      }

      await QualityComplaintRecord.create({
        complaint_id: record.complaint_id,
        stage,
        content,
        handler_id: userInfo.userId || null,
        handler_name: userInfo.username || '',
        attachment_url: attachment_url || '',
      }, { transaction: t })

      // 如果添加的是"关闭"阶段，同时把客诉状态改为已关闭
      if (stage === '关闭') {
        await record.update({
          status: 1,
          closed_time: new Date(),
        }, { transaction: t })
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '添加成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[QualityComplaint] addRecord error:', err)
      fail(res, err.message || '添加处理记录失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 关闭客诉
   */
  async close(req: any, res: any) {
    const t = await QualityComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { content } = req.body

      const record = await QualityComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '客诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      if (record.getDataValue('status') === 1 || (record as any).status === '已关闭') {
        return fail(res, '客诉已关闭', ErrorCode.PARAM_INVALID)
      }

      // 如果没有关闭阶段记录，自动追加一条
      const lastRecord = await QualityComplaintRecord.findOne({
        where: { complaint_id: id },
        order: [['record_id', 'DESC']],
      })
      const lastStage = lastRecord ? lastRecord.stage : null
      if (!lastStage || lastStage !== '关闭') {
        await QualityComplaintRecord.create({
          complaint_id: record.complaint_id,
          stage: '关闭',
          content: content || '客诉关闭',
          handler_id: userInfo.userId || null,
          handler_name: userInfo.username || '',
          attachment_url: '',
        }, { transaction: t })
      }

      await record.update({
        status: 1,
        closed_time: new Date(),
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '关闭成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[QualityComplaint] close error:', err)
      fail(res, err.message || '关闭失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除客诉（级联删除处理记录）
   */
  async delete(req: any, res: any) {
    const t = await QualityComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await QualityComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '客诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 级联删除处理记录
      await QualityComplaintRecord.destroy({
        where: { complaint_id: record.complaint_id },
        transaction: t,
      })
      await record.destroy({ transaction: t })

      await t.commit()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[QualityComplaint] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
