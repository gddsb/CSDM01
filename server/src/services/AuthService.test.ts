import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import { verifyPassword, hashPassword } from '../utils/password';

const { findByPkMock, updateMock } = vi.hoisted(() => ({
  findByPkMock: vi.fn(),
  updateMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../models/index', () => ({
  User: { findByPk: findByPkMock },
  Role: {},
}));

vi.mock('../utils/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(async (pwd: string) => `hashed_${pwd}`),
}));

describe('AuthService.changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockClear();
  });

  it('用户不存在应抛出 404 AppError', async () => {
    findByPkMock.mockResolvedValue(null);
    await expect(AuthService.changePassword(999, 'old', 'new123')).rejects.toMatchObject({ code: 10002 });
  });

  it('原密码错误应抛出 AppError', async () => {
    findByPkMock.mockResolvedValue({ update: updateMock });
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(AuthService.changePassword(1, 'wrong', 'new123')).rejects.toMatchObject({ code: 10003 });
  });

  it('新旧密码相同应拒绝', async () => {
    findByPkMock.mockResolvedValue({ update: updateMock });
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await expect(AuthService.changePassword(1, 'same123', 'same123')).rejects.toThrow(/相同/);
  });

  it('弱密码应拒绝', async () => {
    findByPkMock.mockResolvedValue({ update: updateMock });
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await expect(AuthService.changePassword(1, 'old1234', '123456')).rejects.toThrow(/简单/);
  });

  it('合法新密码应更新并清除首登标记', async () => {
    findByPkMock.mockResolvedValue({ update: updateMock });
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await AuthService.changePassword(1, 'oldpass', 'NewStr0ng!');
    expect(hashPassword).toHaveBeenCalledWith('NewStr0ng!');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ pwd_reset_required: 0 }),
    );
  });
});

describe('AuthService.getPasswordHint', () => {
  it('首登标记应返回提示', () => {
    expect(AuthService.getPasswordHint({ pwd_reset_required: 1 }, 'whatever')).toContain('修改密码');
  });

  it('弱密码应返回提示', () => {
    expect(AuthService.getPasswordHint({}, '123456')).toContain('弱密码');
  });

  it('强密码且无标记应返回 undefined', () => {
    expect(AuthService.getPasswordHint({}, 'Str0ng!Pass')).toBeUndefined();
  });
});
