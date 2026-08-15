/**
 * AuthService - 认证相关业务逻辑
 * 负责密码校验、密码修改、个人资料更新等可复用业务逻辑
 */
import { User, Role, OperationLog, Permission } from '../models/index'
import { generateToken } from '../utils/jwt'
import { nowBeijingDate } from '../utils/date'
import { verifyPassword, hashPassword } from '../utils/password'
import { AppError } from '../middleware/security'


async function getUserPermissionCodes(roleId: number): Promise<string[]> {
  const perms = await Permission.findAll({
    include: [
      {
        model: Role,
        as: 'roles',
        where: { role_id: roleId },
        required: true,
        through: { attributes: [] },
      },
    ],
    raw: true,
  })
  return perms.map((p: any) => p.perm_code).filter(Boolean)
}

const WEAK_PASSWORDS = new Set(['123456', 'password', 'admin', '12345678', 'qwerty'])

export class AuthService {

  /**
   * 用户登录：认证、登录日志、Token 与权限码组装
   */
  static async login(input: { username?: string; password?: string; ip?: string }): Promise<Record<string, unknown>> {
    const { username, password, ip = '' } = input
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
    const token = generateToken(user as any)
    const userWithRole: Record<string, any> = (user as any).toJSON()
    delete userWithRole.user_pwd
    const permCodes = await getUserPermissionCodes((user as any).role_id || userWithRole.role_id)
    userWithRole.perm_codes = permCodes

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
