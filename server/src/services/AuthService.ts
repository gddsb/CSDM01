/**
 * AuthService - 认证相关业务逻辑
 * 负责密码校验、密码修改、个人资料更新等可复用业务逻辑
 */
import { User, Role, OperationLog, Permission } from '../models/index'
import sequelize from '../config/database'
import { generateToken } from '../utils/jwt'
import { nowBeijingDate } from '../utils/date'
import { verifyPassword, hashPassword } from '../utils/password'
import { AppError } from '../middleware/security'


/** 把扁平权限码数组按 prefix:module:submodule 聚合分组 */
export function buildPermGroups(codes: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {}
  for (const code of codes) {
    if (!code || code === '*') continue
    const parts = code.split(':')
    // 取前 3 段作为 group key（pc:device:fault），只有两段时用 pc:module
    const key = parts.length >= 3 ? parts.slice(0, 3).join(':') : parts.join(':')
    if (!groups[key]) groups[key] = []
    groups[key].push(code)
  }
  // 排序让 key 和每个 group 内的 codes 稳定
  for (const k of Object.keys(groups)) groups[k].sort()
  return groups
}

/**
 * Phase 2: 加载指定终端下的权限码（加 terminal 过滤）
 * —— 直接用 raw SQL 避免 Sequelize belongsToMany through.where 各种不生效的陷阱
 * —— 注意 sequelize.query 有 type 参数时直接返回 rows 数组，不是 [rows, metadata] 二元组
 */
export async function getUserPermissionCodes(roleId: number, terminal: number = 1): Promise<string[]> {
  const rows: any[] = await sequelize.query(
    `SELECT p.perm_code FROM sys_permission p
     INNER JOIN sys_role_permission rp ON rp.perm_id = p.perm_id
     WHERE rp.role_id = :roleId AND rp.terminal = :terminal
     ORDER BY p.perm_code`,
    { replacements: { roleId, terminal }, type: 'SELECT' as any }
  )
  return rows.map((r: any) => r.perm_code).filter(Boolean)
}

const WEAK_PASSWORDS = new Set(['123456', 'password', 'admin', '12345678', 'qwerty'])

export class AuthService {

  /**
   * 用户登录：认证、登录日志、Token 与权限码组装
   * Phase 2: 加 terminal 终端标识，写入 JWT payload
   */
  static async login(input: { username?: string; password?: string; ip?: string; terminal?: number | string }): Promise<Record<string, unknown>> {
    const { username, password, ip = '', terminal = 1 } = input
    if (!username || !password) {
      throw new AppError('用户名和密码不能为空', 10001, 400)
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Role, as: 'role' }],
    })

    let valid = false
    if (user) {
      valid = await verifyPassword(password, (user as any).user_pwd)
    }

    if (!user || !valid) {
      OperationLog.create({
        user_id: (user as any)?.user_id || null,
        username: username || '未知',
        module: '系统登录',
        operation: '登录失败（账号或密码错误）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      } as any).catch(() => {})
      throw new AppError('账号或密码错误', 10001, 401)
    }

    if ((user as any).status !== '启用') {
      OperationLog.create({
        user_id: (user as any).user_id,
        username: (user as any).username,
        module: '系统登录',
        operation: '登录失败（账号已禁用）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      } as any).catch(() => {})
      throw new AppError('账号已禁用', 10004, 403)
    }

    await (user as any).update({ last_login_time: nowBeijingDate() })
    // Phase 2: 把 terminal 写入 JWT payload，authRequired 中间件可直接读取
    const numericTerminal = Number(terminal) || 1
    // 注意：Sequelize instance 直接 spread 是空对象，必须 .toJSON()
    const token = generateToken({ ...(user as any).toJSON(), terminal: numericTerminal })
    const userWithRole: Record<string, any> = (user as any).toJSON()
    delete userWithRole.user_pwd
    // Phase 2: 权限码按终端过滤（只返回该终端下的权限）
    const permCodes = await getUserPermissionCodes((user as any).role_id || userWithRole.role_id, numericTerminal)
    userWithRole.perm_codes = permCodes
    userWithRole.perm_groups = buildPermGroups(permCodes)

    const pwdResetRequired = Number(userWithRole.pwd_reset_required) === 1 || WEAK_PASSWORDS.has(String(password))
    const securityHint = pwdResetRequired ? '当前密码为初始/弱密码，建议尽快修改密码' : undefined

    OperationLog.create({
      user_id: (user as any).user_id,
      username: (user as any).username,
      module: '系统登录',
      operation: '登录成功',
      method: 'POST',
      params: '',
      ip,
      status: 1,
    } as any).catch(() => {})

    return { user: userWithRole, token, pwd_reset_required: pwdResetRequired ? 1 : 0, security_hint: securityHint }
  }

  /**
   * 修改密码：校验旧密码、新密码强度，更新后清除首次改密标记
   */
  static async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = await User.findByPk(userId)
    if (!user) {
      throw new AppError('用户不存在', 10002, 404)
    }

    const isValid = await verifyPassword(oldPassword, user.user_pwd)
    if (!isValid) {
      throw new AppError('原密码错误', 10003, 400)
    }

    if (oldPassword === newPassword) {
      throw new AppError('新密码不能与原密码相同', 10003, 400)
    }

    if (newPassword.length < 6) {
      throw new AppError('新密码长度至少为6位', 10003, 400)
    }

    if (WEAK_PASSWORDS.has(newPassword)) {
      throw new AppError('新密码过于简单，请勿使用常见弱密码', 10003, 400)
    }

    const hash = await hashPassword(newPassword)
    await user.update({ user_pwd: hash, pwd_reset_required: 0 } as any)
  }

  /**
   * 获取当前登录用户信息（含角色、权限码、权限分组）
   */
  static async getCurrentUser(userId: number): Promise<Record<string, unknown>> {
    const user = await User.findOne({
      where: { user_id: userId },
      include: [{ model: Role, as: 'role' }],
    })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    const userData: Record<string, any> = (user as any).toJSON()
    delete userData.user_pwd
    const codes = await getUserPermissionCodes(userData.role_id)
    userData.perm_codes = codes
    userData.perm_groups = buildPermGroups(codes)
    return userData
  }

  /**
   * 更新个人资料（仅允许更新安全字段，忽略角色/状态等敏感字段）
   */
  static async updateProfile(
    userId: number,
    data: { real_name?: string; phone?: string; email?: string; avatar_url?: string },
  ): Promise<Record<string, unknown>> {
    const user = await User.findByPk(userId)
    if (!user) {
      throw new AppError('用户不存在', 10002, 404)
    }

    const allowed: Record<string, unknown> = {}
    if (data.real_name !== undefined) allowed.real_name = data.real_name
    if (data.phone !== undefined) allowed.phone = data.phone
    if (data.email !== undefined) allowed.email = data.email
    if (data.avatar_url !== undefined) allowed.avatar_url = data.avatar_url

    if (Object.keys(allowed).length > 0) {
      await user.update(allowed)
    }

    const updated = await User.findByPk(userId, {
      include: [{ model: Role, as: 'role' }],
    })
    return (updated as any).toJSON()
  }

  /**
   * 检查用户是否使用弱密码，返回需要改密的提示信息
   */
  static getPasswordHint(user: { pwd_reset_required?: number }, plainPassword: string): string | undefined {
    if (user.pwd_reset_required) {
      return '首次登录或管理员要求修改密码，请尽快修改密码'
    }
    if (WEAK_PASSWORDS.has(plainPassword)) {
      return '检测到弱密码，建议修改为更复杂的密码'
    }
    return undefined
  }
}
