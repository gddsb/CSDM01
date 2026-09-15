/**
 * 用户 Service（UserController 下沉）
 *
 * 业务：User CRUD + 密码 bcrypt 加密 + email/phone regex + sysadmin 保护 + 头像 URL 校验
 * fs（头像上传 rename/unlink）保留在 Controller
 */
import { Op } from 'sequelize'
import { User, Role } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { hashPassword } from '../utils/password.js'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/

export function validateEmail(email: string | undefined | null): void {
  if (email === undefined || email === null || email === '') return
  if (!EMAIL_REGEX.test(email)) throw new AppError('邮箱格式不正确', 10001, 400)
}
export function validatePhone(phone: string | undefined | null): void {
  if (phone === undefined || phone === null || phone === '') return
  if (!PHONE_REGEX.test(phone)) throw new AppError('手机号格式不正确', 10001, 400)
}

function stripPwd(obj: any) { const d = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj }; delete d.user_pwd; return d }

export const UserService = {
  async list(query: any) {
    const { keyword, status, role_id, page = 1, pageSize = 20 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { real_name: { [Op.like]: `%${keyword}%` } },
        { employee_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '启用': 1, '禁用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (role_id) where.role_id = Number(role_id)
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await User.findAndCountAll({
      where, include: [{ model: Role, as: 'role' }], limit, offset, order: [['user_id', 'DESC']],
    })
    return { rows: rows.map(stripPwd), count }
  },

  async detail(id: number | string) {
    const user = await User.findOne({ where: { user_id: Number(id) }, include: [{ model: Role, as: 'role' }] })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    return stripPwd(user)
  },

  async create(body: any) {
    const { username, password, real_name, email, phone } = body
    if (!username || !password || !real_name) throw new AppError('用户名、密码和真实姓名不能为空', 10001, 400)
    validateEmail(email); validatePhone(phone)
    const exists = await User.findOne({ where: { username } })
    if (exists) throw new AppError('用户名已存在', 20001, 409)
    const user = await User.create({
      ...body, user_pwd: hashPassword(password),
      status: body.status !== undefined ? body.status : 1,
    } as any)
    return stripPwd(user)
  },

  async update(id: number | string, body: any) {
    const user = await User.findOne({ where: { user_id: Number(id) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    if ((user as any).username === 'sysadmin') throw new AppError('系统默认账户禁止编辑', 30001, 403)

    if (body.email !== undefined) validateEmail(body.email)
    if (body.phone !== undefined) validatePhone(body.phone)

    const updateData: any = {
      real_name: body.real_name, employee_no: body.employee_no, department: body.department,
      role_id: body.role_id, phone: body.phone, email: body.email, status: body.status,
    }
    if (body.username && body.username !== (user as any).username) {
      const exists = await User.findOne({ where: { username: body.username, user_id: { [Op.ne]: Number(id) } } })
      if (exists) throw new AppError('用户名已存在', 20001, 409)
      updateData.username = body.username
    }
    if (body.password) updateData.user_pwd = hashPassword(body.password)
    await user.update(updateData)
    return stripPwd(user)
  },

  async remove(id: number | string) {
    const user = await User.findOne({ where: { user_id: Number(id) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    if ((user as any).username === 'sysadmin') throw new AppError('系统默认账户禁止删除', 30001, 403)
    await user.destroy()
    return true
  },

  async toggle(id: number | string) {
    const user = await User.findOne({ where: { user_id: Number(id) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    if ((user as any).username === 'sysadmin') throw new AppError('系统默认账户禁止启停', 30001, 403)
    const newStatus = (user as any).status === '启用' ? '禁用' : '启用'
    await user.update({ status: newStatus })
    return { user_id: (user as any).user_id, status: newStatus }
  },

  /** 更新当前用户头像（不做 fs —— Controller 负责 rename/unlink） */
  async updateAvatarUrl(userId: number | string, avatarUrl: string) {
    const user = await User.findOne({ where: { user_id: Number(userId) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    const prev = (user as any).avatar_url
    await user.update({ avatar_url: avatarUrl })
    return { user: stripPwd(user), prevUrl: prev }
  },

  async getMyProfile(userId: number | string) {
    const user = await User.findOne({ where: { user_id: Number(userId) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    return user
  },

  async updateMyProfile(userId: number | string, body: any) {
    const user = await User.findOne({ where: { user_id: Number(userId) } })
    if (!user) throw new AppError('用户不存在', 10002, 404)
    if (body.email !== undefined) validateEmail(body.email)
    if (body.phone !== undefined) validatePhone(body.phone)
    const updateData: any = {}
    if (body.real_name !== undefined) updateData.real_name = body.real_name
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.email !== undefined) updateData.email = body.email
    await user.update(updateData)
    return stripPwd(user)
  },
}

export default UserService
