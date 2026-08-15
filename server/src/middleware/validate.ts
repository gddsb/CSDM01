import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

type RequestLocation = 'body' | 'query' | 'params';

function validate(schema: ZodSchema, location: RequestLocation, req: Request, res: Response, next: NextFunction): void {
  try {
    const data = location === 'body' ? req.body : location === 'query' ? req.query : req.params;
    const parsed = schema.parse(data);
    // 用校验后的值替换原始数据（zod 会做类型转换/默认值填充）
    if (location === 'body') req.body = parsed;
    else if (location === 'query') (req as any).validatedQuery = parsed;
    else (req as any).validatedParams = parsed;
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.errors[0] as { path?: Array<string | number>; message?: string } | undefined
      const field = first?.path?.join('.') || '参数';
      sendError(res, 400, 40000, `${field}: ${first?.message || '参数校验失败'}`);
      return;
    }
    next(e);
  }
}

export const validateBody = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) =>
  validate(schema, 'body', req, res, next);

export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) =>
  validate(schema, 'query', req, res, next);

export const validateParams = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) =>
  validate(schema, 'params', req, res, next);
