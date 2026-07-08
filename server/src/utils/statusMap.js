// 状态映射表：前端中文字符串 ↔ 后端数字

export const STATUS_MAPS = {
  common: {
    启用: 1,
    禁用: 0,
  },
  material: {
    启用: 1,
    试产: 2,
    停产: 0,
  },
  order: {
    开立: 0,
    下发: 1,
    完工: 2,
  },
  workOrder: {
    开立: 0,
    开工: 1,
    完工: 2,
  },
  device: {
    运行: 1,
    停用: 0,
    维修: 2,
  },
  line: {
    运行中: 1,
    维护中: 2,
    停用: 0,
  },
}

export function statusToNumber(str, type = 'common') {
  const map = STATUS_MAPS[type] || STATUS_MAPS.common
  if (str === undefined || str === null || str === '') return undefined
  if (typeof str === 'number') return str
  return map[str] !== undefined ? map[str] : 1
}

export function statusToString(num, type = 'common') {
  const map = STATUS_MAPS[type] || STATUS_MAPS.common
  if (num === undefined || num === null || num === '') return ''
  if (typeof num === 'string') return num
  const reversed = Object.entries(map).find(([, v]) => v === num)
  return reversed ? reversed[0] : String(num)
}

export function convertStatusInList(list, type = 'common') {
  return list.map(item => ({
    ...item,
    status: statusToString(item.status, type),
  }))
}

export function convertStatusInItem(item, type = 'common') {
  if (!item) return item
  return {
    ...item,
    status: statusToString(item.status, type),
  }
}
