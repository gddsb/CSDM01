import { User, Role, OperationLog, Permission } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateToken } from '../utils/jwt.js'
import { verifyPassword } from '../utils/password.js'
import { nowBeijingDate } from '../utils/date.js'

async function getUserPermissionCodes(roleId: number): Promise<string[]> {
  const role = await Role.findOne({
    where: { role_id: roleId },
    include: [{ model: Permission, as: 'permissions', attributes: ['perm_code'] }],
  })
  if (role && (role as any).permissions) {
    return (role as any).permissions.map((p: any) => p.perm_code)
  }
  return []
}

// 登录
export const login = async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return fail(res, '用户名和密码不能为空')
    }
    const user = await User.findOne({
      where: { username },
      include: [{ model: Role, as: 'role' }],
    })
    const forwarded = req.headers['x-forwarded-for']
    const ip = (forwarded && forwarded.split(',')[0].trim()) || req.ip || req.socket?.remoteAddress || ''

    let valid = false
    if (user) {
      valid = verifyPassword(password, user.user_pwd)
    }

    if (!user || !valid) {
      OperationLog.create({
        user_id: user?.user_id || null,
        username: username || '未知',
        module: '系统登录',
        operation: '登录失败（账号或密码错误）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      }).catch(() => {})
      return fail(res, '账号或密码错误')
    }
    if (user.status !== '启用') {
      OperationLog.create({
        user_id: user.user_id,
        username: user.username,
        module: '系统登录',
        operation: '登录失败（账号已禁用）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      }).catch(() => {})
      return fail(res, '账号已禁用')
    }
    // 更新最后登录时间
    await user.update({ last_login_time: nowBeijingDate() })
    // 生成 token
    const token = generateToken(user)
    const userWithRole = user.toJSON()
    delete userWithRole.user_pwd
    const permCodes = await getUserPermissionCodes(user.role_id || userWithRole.role_id)
    userWithRole.perm_codes = permCodes

    // 记录登录成功日志
    OperationLog.create({
      user_id: user.user_id,
      username: user.username,
      module: '系统登录',
      operation: '登录成功',
      method: 'POST',
      params: '',
      ip,
      status: 1,
    }).catch(() => {})

    return success(res, { user: userWithRole, token }, '登录成功')
  } catch (err) {
    console.error('登录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 获取当前登录用户信息
export const profile = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const user = await User.findOne({
      where: { user_id: userId },
      include: [{ model: Role, as: 'role' }],
    })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    const userData = user.toJSON()
    delete userData.user_pwd
    const permCodes = await getUserPermissionCodes(user.role_id || userData.role_id)
    userData.perm_codes = permCodes
    return success(res, userData, '获取用户信息成功')
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 登出（前端清除 token 即可）
export const logout = async (req, res) => {
  try {
    return success(res, null, '登出成功')
  } catch (err) {
    console.error('登出失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { login, profile, logout }
