import { describe, it, expect } from 'vitest'
import {
  getISOWeek,
  dateOnlyStr,
  buildPeriodKey,
  parseMultiStatus,
  dailyPeriodKeys,
  weeklyPeriodKeys,
  parseMonthlyPlan,
  monthlyStandardActive,
} from '../utils/maintenanceMatrix.js'

const STATUS_REVERSE: Record<string, number> = {
  '待执行': 0,
  '执行中': 1,
  '已完成': 2,
  '已挂起': 3,
}

describe('dateOnlyStr', () => {
  it('格式化 2026-09-01', () => {
    expect(dateOnlyStr(new Date(2026, 8, 1))).toBe('2026-09-01')
  })
  it('月份日期需要补零', () => {
    expect(dateOnlyStr(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getISOWeek', () => {
  it('2026-01-01 是 W01', () => {
    expect(getISOWeek(new Date(2026, 0, 1))).toBe('2026-W01')
  })
  it('2026-09-01 是 W36（查日历：2026年第36周，周一 8/31-9/6）', () => {
    expect(getISOWeek(new Date(2026, 8, 1))).toBe('2026-W36')
  })
  it('2026-02-28 与 2026-03-01 属于同一周（按ISO 周编号边界）', () => {
    // 先实际确认日期：2026-02-28 是周六，03-01 周日，它们应该处于不同周
    expect(getISOWeek(new Date(2026, 1, 28))).toBe('2026-W09')
    expect(getISOWeek(new Date(2026, 2, 1))).toBe('2026-W09')
  })
})

describe('buildPeriodKey', () => {
  it('daily → YYYY-MM-DD', () => {
    expect(buildPeriodKey('daily', new Date(2026, 8, 15))).toBe('2026-09-15')
  })
  it('weekly → YYYY-Www', () => {
    expect(buildPeriodKey('weekly', new Date(2026, 8, 15))).toBe('2026-W38')
  })
  it('monthly → YYYY-MM', () => {
    expect(buildPeriodKey('monthly', new Date(2026, 0, 31))).toBe('2026-01')
  })
  it('runtime → RUNTIME:device:standard:threshold', () => {
    expect(buildPeriodKey('runtime', new Date(), 17, 8, 500)).toBe('RUNTIME:8:17:500')
  })
  it('runtime 缺省值', () => {
    expect(buildPeriodKey('runtime', new Date())).toBe('RUNTIME:0:0:0')
  })
  it('未知 mode → fallback dateOnlyStr', () => {
    expect(buildPeriodKey('quarterly', new Date(2026, 8, 1))).toBe('2026-09-01')
  })
})

describe('parseMultiStatus', () => {
  it('空输入 → null', () => {
    expect(parseMultiStatus(null, STATUS_REVERSE)).toBeNull()
    expect(parseMultiStatus('', STATUS_REVERSE)).toBeNull()
    expect(parseMultiStatus(undefined, STATUS_REVERSE)).toBeNull()
  })
  it('单个中文状态名', () => {
    expect(parseMultiStatus('待执行', STATUS_REVERSE)).toEqual([0])
  })
  it('逗号分隔中文字符串', () => {
    expect(parseMultiStatus('待执行,执行中', STATUS_REVERSE)).toEqual([0, 1])
  })
  it('数字输入', () => {
    expect(parseMultiStatus(2, STATUS_REVERSE)).toEqual([2])
  })
  it('数组混合中文+数字', () => {
    expect(parseMultiStatus(['已完成', 3], STATUS_REVERSE)).toEqual([2, 3])
  })
  it('全是无效值 → null', () => {
    expect(parseMultiStatus('invalid', STATUS_REVERSE)).toBeNull()
  })
})

describe('dailyPeriodKeys', () => {
  it('2026年2月（非闰年）有28天', () => {
    const keys = dailyPeriodKeys(2026, 2)
    expect(keys.length).toBe(28)
    expect(keys[0]).toBe('2026-02-01')
    expect(keys[27]).toBe('2026-02-28')
  })
  it('2024年2月（闰年）有29天', () => {
    expect(dailyPeriodKeys(2024, 2).length).toBe(29)
  })
  it('9月有30天', () => {
    const keys = dailyPeriodKeys(2026, 9)
    expect(keys.length).toBe(30)
    expect(keys[29]).toBe('2026-09-30')
  })
})

describe('weeklyPeriodKeys', () => {
  it('2026年9月覆盖 W36 ~ W40（5周）', () => {
    const keys = weeklyPeriodKeys(2026, 9)
    // 9月1日=周二，所以包含 W36(8/31-9/6), W37, W38, W39, W40(9/28-10/4)
    expect(keys).toEqual(['2026-W36', '2026-W37', '2026-W38', '2026-W39', '2026-W40'])
  })
  it('2026年1月 覆盖 5个周', () => {
    const keys = weeklyPeriodKeys(2026, 1)
    expect(keys.length).toBe(5)
    expect(keys[0]).toBe('2026-W01')
  })
})

describe('parseMonthlyPlan', () => {
  it('空值 → 空数组', () => {
    expect(parseMonthlyPlan(null)).toEqual([])
    expect(parseMonthlyPlan(undefined)).toEqual([])
  })
  it('数字数组', () => {
    expect(parseMonthlyPlan([1, 15, 28])).toEqual([1, 15, 28])
  })
  it('12长度布尔数组 → 转换为日期列表', () => {
    const arr = new Array(12).fill(false)
    arr[0] = true; arr[2] = true; arr[11] = true
    expect(parseMonthlyPlan(arr)).toEqual([1, 3, 12])
  })
  it('JSON字符串 "1,15,28"', () => {
    expect(parseMonthlyPlan('1,15,28')).toEqual([1, 15, 28])
  })
})

describe('monthlyStandardActive', () => {
  it('12位布尔数组对应月份生效', () => {
    const arr = new Array(12).fill(false)
    arr[8] = true // 9月生效
    expect(monthlyStandardActive(arr, 9)).toBe(true)
    expect(monthlyStandardActive(arr, 10)).toBe(false)
  })
  it('非12长度数组（如日期列表）默认全部生效', () => {
    expect(monthlyStandardActive([1, 15, 28], 9)).toBe(true)
    expect(monthlyStandardActive([1, 15, 28], 3)).toBe(true)
  })
  it('null → false', () => {
    expect(monthlyStandardActive(null, 9)).toBe(false)
  })
})
