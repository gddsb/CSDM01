// 工序报工常量与工具函数

// 报工单状态：后端模型 getter 返回中文名称 '开工'/'完工'
export const reportOrderStatusMap: Record<string, { label: string; color: string }> = {
  '开工': { label: '开工', color: 'processing' },
  '完工': { label: '完工', color: 'success' },
}

export const exceptionCategories = [
  { label: '故障维修', value: '故障维修' },
  { label: '来料异常', value: '来料异常' },
  { label: '停机待料', value: '停机待料' },
  { label: '其它异常', value: '其它异常' },
]

// 生成前端临时 ID（新增行尚未保存时使用）
export const genTempId = (): string =>
  'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
