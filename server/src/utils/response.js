// 统一响应格式
export function success(res, data = null, message = '操作成功', total = null) {
  const result = { success: true, message, data }
  if (total !== null) result.total = total
  return res.json(result)
}

export function fail(res, message = '操作失败', code = 400) {
  return res.status(code).json({ success: false, message })
}

export function paginate(res, data, total, pageNum, pageSize) {
  return res.json({
    success: true,
    data,
    total,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  })
}
