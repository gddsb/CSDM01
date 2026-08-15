import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string({ required_error: '用户名不能为空' })
    .min(1, '用户名不能为空')
    .max(50, '用户名长度不能超过50'),
  password: z
    .string({ required_error: '密码不能为空' })
    .min(1, '密码不能为空')
    .max(100, '密码长度不能超过100'),
  captcha: z.string().max(10).optional(),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '原密码不能为空'),
    newPassword: z.string().min(6, '新密码至少6位').max(50, '新密码不能超过50位'),
    confirmPassword: z.string().min(1, '确认密码不能为空'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const profileUpdateSchema = z.object({
  real_name: z.string().max(20).optional(),
  phone: z
    .string()
    .regex(/^$|^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  department: z.string().max(50).optional(),
  position: z.string().max(50).optional(),
});
