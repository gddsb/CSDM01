/**
 * DeviceService 纯函数单元测试
 *
 * 只测不依赖 DB 的函数：buildDeviceWhere / buildDeviceOrder / validateDeviceType
 * list/create/update/remove 需要 DB mock，放到集成测试
 */
import { describe, it, expect } from 'vitest'
import { Op } from 'sequelize'
import { buildDeviceWhere, buildDeviceOrder, validateDeviceType } from './DeviceService.js'
import { AppError } from '../utils/error.js'

describe('DeviceService — 纯函数', () => {
  describe('buildDeviceWhere', () => {
    it('无参数 → entity_type 默认设备', () => {
      const where = buildDeviceWhere({})
      expect(where.entity_type).toBe('设备')
    })

    it('entity_type=全部 → 不加 entity_type 过滤', () => {
      const where = buildDeviceWhere({ entity_type: '全部' })
      expect(where.entity_type).toBeUndefined()
    })

    it('entity_type=仪器 → 加 entity_type=仪器', () => {
      const where = buildDeviceWhere({ entity_type: '仪器' })
      expect(where.entity_type).toBe('仪器')
    })

    it('keyword → 四字段 OR 模糊匹配', () => {
      const where = buildDeviceWhere({ keyword: 'CNC' })
      expect((where as any)[Op.or]).toBeDefined()
      expect((where as any)[Op.or]).toHaveLength(4)
      expect((where as any)[Op.or][0]).toEqual({ device_code: { [Op.like]: '%CNC%' } })
    })

    it('keyword 空白字符串 → 忽略', () => {
      const where = buildDeviceWhere({ keyword: '  ' })
      expect((where as any)[Op.or]).toBeUndefined()
    })

    it('status 单值 → 精确匹配', () => {
      const where = buildDeviceWhere({ status: '1' })
      expect((where as any).status).toBe(1)
    })

    it('status 逗号分隔多值 → Op.in', () => {
      const where = buildDeviceWhere({ status: '1,2,0' })
      expect((where as any).status).toEqual({ [Op.in]: [1, 2, 0] })
    })

    it('device_type → 精确匹配', () => {
      const where = buildDeviceWhere({ device_type: '生产设备' })
      expect(where.device_type).toBe('生产设备')
    })

    it('line_id → 转数字', () => {
      const where = buildDeviceWhere({ line_id: '5' })
      expect(where.line_id).toBe(5)
    })

    it('is_special → 转数字', () => {
      const where = buildDeviceWhere({ is_special: '1' })
      expect(where.is_special).toBe(1)
    })

    it('is_special 空字符串 → 忽略', () => {
      const where = buildDeviceWhere({ is_special: '' })
      expect(where.is_special).toBeUndefined()
    })

    it('dateStart + dateEnd → created_at.gte/lte', () => {
      const where = buildDeviceWhere({ dateStart: '2026-01-01', dateEnd: '2026-12-31' })
      expect((where as any).created_at[Op.gte]).toBeInstanceOf(Date)
      expect((where as any).created_at[Op.lte]).toBeInstanceOf(Date)
    })

    it('所有参数组合 → 正确构建完整 where', () => {
      const where = buildDeviceWhere({
        entity_type: '设备',
        keyword: 'CNC',
        status: '1,2',
        device_type: '生产设备',
        line_id: '3',
        is_special: '0',
        dateStart: '2026-01-01',
        dateEnd: '2026-06-30',
      })
      expect(where.entity_type).toBe('设备')
      expect((where as any)[Op.or]).toBeDefined()
      expect((where as any).status).toEqual({ [Op.in]: [1, 2] })
      expect(where.device_type).toBe('生产设备')
      expect(where.line_id).toBe(3)
      expect(where.is_special).toBe(0)
      expect((where as any).created_at).toBeDefined()
    })
  })

  describe('buildDeviceOrder', () => {
    it('默认排序 → device_type ASC, device_code ASC', () => {
      const order = buildDeviceOrder()
      expect(order).toEqual([['device_type', 'ASC'], ['device_code', 'ASC']])
    })

    it('单个 sortBy ASC', () => {
      const order = buildDeviceOrder('device_name', 'asc')
      expect(order).toEqual([['device_name', 'ASC']])
    })

    it('单个 sortBy DESC', () => {
      const order = buildDeviceOrder('created_at', 'desc')
      expect(order).toEqual([['created_at', 'DESC']])
    })

    it('多个 sortBy 逗号分隔', () => {
      const order = buildDeviceOrder('device_type,status', 'asc,desc')
      expect(order).toEqual([['device_type', 'ASC'], ['status', 'DESC']])
    })

    it('不在白名单的 sortBy → 忽略，用默认排序', () => {
      const order = buildDeviceOrder('invalid_field', 'desc')
      expect(order).toEqual([['device_type', 'ASC'], ['device_code', 'ASC']])
    })

    it('空 sortBy → 默认排序', () => {
      const order = buildDeviceOrder('', '')
      expect(order).toEqual([['device_type', 'ASC'], ['device_code', 'ASC']])
    })
  })

  describe('validateDeviceType', () => {
    it('合法类型 → 不抛错', () => {
      expect(() => validateDeviceType('生产设备')).not.toThrow()
      expect(() => validateDeviceType('检测设备')).not.toThrow()
      expect(() => validateDeviceType('辅助设备')).not.toThrow()
      expect(() => validateDeviceType('其他设备')).not.toThrow()
    })

    it('undefined → 不抛错（允许不传）', () => {
      expect(() => validateDeviceType(undefined)).not.toThrow()
    })

    it('空字符串 → 不抛错', () => {
      expect(() => validateDeviceType('')).not.toThrow()
    })

    it('非法类型 → 抛 AppError', () => {
      expect(() => validateDeviceType('不存在的类型')).toThrow(AppError)
      expect(() => validateDeviceType('CNC机床')).toThrow(AppError)
    })

    it('非法类型 AppError.statusCode = 400', () => {
      try {
        validateDeviceType('非法')
        throw new Error('should throw')
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError)
        expect(err.statusCode).toBe(400)
      }
    })
  })
})
