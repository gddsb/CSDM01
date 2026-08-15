import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

describe('JWT 工具', () => {
  it('签发并验证 token', () => {
    const token = signToken({ userId: 1, username: 'admin', roleId: 1, isAdmin: true });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(1);
    expect(payload?.username).toBe('admin');
  });

  it('篡改的 token 应返回 null', () => {
    const token = signToken({ userId: 1, username: 'admin' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(verifyToken(tampered)).toBeNull();
  });
});

describe('密码工具', () => {
  it('哈希后可正确验证', async () => {
    const password = 'S3cur3!Pass';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toContain('$pbkdf2$');
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('错误密码验证失败', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});
