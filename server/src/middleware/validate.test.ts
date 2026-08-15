import { describe, it, expect } from 'vitest';
import { validateBody } from '../middleware/validate';
import { loginSchema, changePasswordSchema } from '../validators/auth.schema';
import type { Request, Response, NextFunction } from 'express';

function mockReq(body: unknown): Request {
  return { body } as unknown as Request;
}

function mockRes() {
  const result: { statusCode: number; jsonData?: unknown } = { statusCode: 200 };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(data: unknown) {
      result.jsonData = data;
      return this;
    },
  } as unknown as Response;
  return { res, result };
}

describe('validate 校验中间件', () => {
  it('合法数据应通过并调用 next', () => {
    const req = mockReq({ username: 'admin', password: '123456' });
    const { res } = mockRes();
    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    validateBody(loginSchema)(req, res, next);
    expect(nextCalled).toBe(true);
    expect(req.body).toEqual({ username: 'admin', password: '123456' });
  });

  it('缺少字段应返回 400', () => {
    const req = mockReq({ username: 'admin' });
    const { res, result } = mockRes();
    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    validateBody(loginSchema)(req, res, next);
    expect(nextCalled).toBe(false);
    expect(result.statusCode).toBe(400);
    const body = result.jsonData as { success: boolean; code: number };
    expect(body.success).toBe(false);
    expect(body.code).toBe(40000);
  });

  it('空密码应被拒绝', () => {
    const req = mockReq({ username: 'admin', password: '' });
    const { res, result } = mockRes();
    const next = (() => {}) as NextFunction;

    validateBody(loginSchema)(req, res, next);
    expect(result.statusCode).toBe(400);
  });

  it('修改密码：新旧相同应被拒绝', () => {
    const req = mockReq({ old_password: '123456', new_password: '123456' });
    const { res, result } = mockRes();
    const next = (() => {}) as NextFunction;

    validateBody(changePasswordSchema)(req, res, next);
    expect(result.statusCode).toBe(400);
  });
});
