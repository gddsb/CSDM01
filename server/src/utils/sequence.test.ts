/**
 * 编号生成器单元测试
 *
 * 策略：只测纯函数（previewBizNo / getSeqConfig / 格式结构），
 * generateBizNo 因为依赖 DB 事务，放在集成测试里覆盖。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { previewBizNo, getSeqConfig, generateBizNo } from './sequence.js'

describe('sequence — 编号生成', () => {
  describe('getSeqConfig', () => {
    it('返回包含所有业务类型的配置', () => {
      const cfg = getSeqConfig()
      expect(cfg).toHaveProperty('ORDER')
      expect(cfg).toHaveProperty('WORK_ORDER')
      expect(cfg).toHaveProperty('INCOMING')
      expect(cfg).toHaveProperty('PROCESS')
      expect(cfg).toHaveProperty('FINISHED')
      expect(cfg).toHaveProperty('MICROBE')
      expect(cfg).toHaveProperty('ENV')
      expect(cfg).toHaveProperty('COMPLAINT')
      expect(cfg).toHaveProperty('SUPPLIER_COMPLAINT')
      expect(cfg).toHaveProperty('STANDARD')
      expect(cfg).toHaveProperty('NCR')
      expect(cfg).toHaveProperty('DEVICE_FAULT')
      expect(cfg).toHaveProperty('DEVICE_MAINTENANCE')
      expect(cfg).toHaveProperty('DEVICE_RECORD')
    })

    it('每个配置项都有 prefix/datePattern/seqWidth/resetBy', () => {
      const cfg = getSeqConfig()
      for (const [key, val] of Object.entries(cfg) as [string, any][]) {
        expect(val).toHaveProperty('prefix')
        expect(val).toHaveProperty('datePattern')
        expect(val).toHaveProperty('seqWidth')
        expect(val).toHaveProperty('resetBy')
        expect(typeof val.prefix).toBe('string')
        expect(val.seqWidth).toBeGreaterThan(0)
      }
    })

    it('配置是副本，修改不影响内部状态', () => {
      const cfg1 = getSeqConfig()
      cfg1.ORDER.prefix = 'HACKED'
      const cfg2 = getSeqConfig()
      expect(cfg2.ORDER.prefix).not.toBe('HACKED')
    })
  })

  describe('previewBizNo', () => {
    it('日重置订单号格式: MO-16 + YYMMDD + 3位序号', () => {
      const no = previewBizNo({ prefix: 'MO-16', date_format: 'YYMMDD', seq_width: 3 }, 1)
      expect(no).toMatch(/^MO-16\d{6}001$/)
    })

    it('日重置 + 序号递增', () => {
      const no1 = previewBizNo({ prefix: 'LL', date_format: 'YYMMDD', seq_width: 3 }, 1)
      const no2 = previewBizNo({ prefix: 'LL', date_format: 'YYMMDD', seq_width: 3 }, 12)
      const no3 = previewBizNo({ prefix: 'LL', date_format: 'YYMMDD', seq_width: 3 }, 999)
      const suffix1 = no1.slice(-3)
      const suffix2 = no2.slice(-3)
      const suffix3 = no3.slice(-3)
      expect(suffix1).toBe('001')
      expect(suffix2).toBe('012')
      expect(suffix3).toBe('999')
    })

    it('年重置客诉编号: TS + YYYY + 4位序号', () => {
      const no = previewBizNo({ prefix: 'TS', date_format: 'YYYY', seq_width: 4 }, 1)
      const year = new Date().getFullYear()
      expect(no).toBe(`TS${year}0001`)
    })

    it('带分隔符的标准编号: BZ-CL-2026-001', () => {
      const no = previewBizNo(
        { prefix: 'BZ-CL', date_format: 'YYYY', separator: '-', seq_width: 3 },
        1
      )
      const year = new Date().getFullYear()
      expect(no).toBe(`BZ-CL-${year}-001`)
    })

    it('YYYYMMDD 格式设备号', () => {
      const no = previewBizNo({ prefix: 'F', date_format: 'YYYYMMDD', seq_width: 3 }, 1)
      expect(no).toMatch(/^F\d{8}001$/)
    })

    it('seq_width=4 生成 4 位序号', () => {
      const no = previewBizNo({ prefix: 'GY', date_format: 'YYYY', seq_width: 4 }, 1)
      expect(no).toMatch(/0001$/)
    })
  })

  describe('generateBizNo — 错误路径', () => {
    it('未知序列键抛出明确错误', async () => {
      await expect(generateBizNo('NONEXISTENT_KEY')).rejects.toThrow(/未知的序列键/)
    })
  })
})
