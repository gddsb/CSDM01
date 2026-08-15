import type { Request, Response } from 'express'

export function safeJson<T>(value: T, fallback: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return fallback
  }
}

export interface RequestWithQuery extends Request {
  query: Record<string, any>
}

export function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || 20))
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset, limit: pageSize }
}

export type Handler = (req: Request, res: Response) => Promise<unknown> | unknown
