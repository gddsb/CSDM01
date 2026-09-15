/**
 * 检验判定逻辑单元测试
 *
 * 只测纯函数 judgeSampleValue，recalcItemAndSamples / recalcInspection 依赖 DB，
 * 放到集成测试覆盖。
 */
import { describe, it, expect } from 'vitest'
import { judgeSampleValue } from './SampleJudgeService.js'

describe('judgeSampleValue — 单个样品判定', () => {
  // ========== 定性判定 ==========
  describe('定性值（measure_value_text）', () => {
    it('"OK" → 合格(1)', () => {
      expect(judgeSampleValue({ measure_value_text: 'OK' }, {})).toBe(1)
    })
    it('"ok" → 合格(1)', () => {
      expect(judgeSampleValue({ measure_value_text: 'ok' }, {})).toBe(1)
    })
    it('"合格" → 合格(1)', () => {
      expect(judgeSampleValue({ measure_value_text: '合格' }, {})).toBe(1)
    })
    it('"pass" → 合格(1)', () => {
      expect(judgeSampleValue({ measure_value_text: 'pass' }, {})).toBe(1)
    })
    it('"NG" → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_text: 'NG' }, {})).toBe(0)
    })
    it('"ng" → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_text: 'ng' }, {})).toBe(0)
    })
    it('"不合格" → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_text: '不合格' }, {})).toBe(0)
    })
    it('"fail" → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_text: 'fail' }, {})).toBe(0)
    })
    it('"无缺口" → 不合格(0)（包含"无"关键字）', () => {
      expect(judgeSampleValue({ measure_value_text: '无缺口' }, {})).toBe(0)
    })
    it('"轻微划痕" → 不自动判定(null)（既不含合格也不含不合格关键字）', () => {
      expect(judgeSampleValue({ measure_value_text: '轻微划痕' }, {})).toBeNull()
    })
    it('空字符串 → null', () => {
      expect(judgeSampleValue({ measure_value_text: '' }, {})).toBeNull()
    })
    it('纯空白 → null', () => {
      expect(judgeSampleValue({ measure_value_text: '   ' }, {})).toBeNull()
    })
    it('带空白的"OK " → 合格(1)（trim 后判定）', () => {
      expect(judgeSampleValue({ measure_value_text: ' OK ' }, {})).toBe(1)
    })
  })

  // ========== 定量判定 ==========
  describe('定量值（measure_value_num）', () => {
    it('在上下限之间 → 合格(1)', () => {
      expect(judgeSampleValue({ measure_value_num: 50 }, { upper_limit: 100, lower_limit: 0 })).toBe(1)
    })
    it('等于上限 → 合格(1)（边界包含）', () => {
      expect(judgeSampleValue({ measure_value_num: 100 }, { upper_limit: 100, lower_limit: 0 })).toBe(1)
    })
    it('等于下限 → 合格(1)（边界包含）', () => {
      expect(judgeSampleValue({ measure_value_num: 0 }, { upper_limit: 100, lower_limit: 0 })).toBe(1)
    })
    it('超过上限 → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_num: 101 }, { upper_limit: 100, lower_limit: 0 })).toBe(0)
    })
    it('低于下限 → 不合格(0)', () => {
      expect(judgeSampleValue({ measure_value_num: -1 }, { upper_limit: 100, lower_limit: 0 })).toBe(0)
    })
    it('仅有上限 → 低于上限合格，超过不合格', () => {
      expect(judgeSampleValue({ measure_value_num: 50 }, { upper_limit: 100 })).toBe(1)
      expect(judgeSampleValue({ measure_value_num: 150 }, { upper_limit: 100 })).toBe(0)
    })
    it('仅有下限 → 高于下限合格，低于不合格', () => {
      expect(judgeSampleValue({ measure_value_num: 50 }, { lower_limit: 0 })).toBe(1)
      expect(judgeSampleValue({ measure_value_num: -5 }, { lower_limit: 0 })).toBe(0)
    })
    it('上下限都没有 → 默认合格(1)', () => {
      expect(judgeSampleValue({ measure_value_num: 50 }, {})).toBe(1)
    })
    it('measure_value_num 为 null → null', () => {
      expect(judgeSampleValue({ measure_value_num: null }, { upper_limit: 100, lower_limit: 0 })).toBeNull()
    })
    it('measure_value_num 为 undefined → null', () => {
      expect(judgeSampleValue({ measure_value_num: undefined }, { upper_limit: 100, lower_limit: 0 })).toBeNull()
    })
    it('measure_value_num 为 NaN → null', () => {
      expect(judgeSampleValue({ measure_value_num: NaN }, { upper_limit: 100, lower_limit: 0 })).toBeNull()
    })
    it('浮点数精度验证', () => {
      expect(judgeSampleValue({ measure_value_num: 49.999 }, { upper_limit: 50, lower_limit: 49 })).toBe(1)
      expect(judgeSampleValue({ measure_value_num: 50.001 }, { upper_limit: 50, lower_limit: 49 })).toBe(0)
    })
    it('零值判定', () => {
      expect(judgeSampleValue({ measure_value_num: 0 }, { upper_limit: 10, lower_limit: -10 })).toBe(1)
    })
    it('负数判定', () => {
      expect(judgeSampleValue({ measure_value_num: -5 }, { upper_limit: 0, lower_limit: -10 })).toBe(1)
      expect(judgeSampleValue({ measure_value_num: -15 }, { upper_limit: 0, lower_limit: -10 })).toBe(0)
    })
  })

  // ========== 定性优先于定量 ==========
  describe('定性优先于定量', () => {
    it('text=NG 但 num 在范围内 → 仍判不合格(0)', () => {
      expect(judgeSampleValue(
        { measure_value_num: 50, measure_value_text: 'NG' },
        { upper_limit: 100, lower_limit: 0 }
      )).toBe(0)
    })
    it('text=ok 但 num 超限 → 仍判合格(1)', () => {
      expect(judgeSampleValue(
        { measure_value_num: 150, measure_value_text: 'OK' },
        { upper_limit: 100, lower_limit: 0 }
      )).toBe(1)
    })
  })
})
