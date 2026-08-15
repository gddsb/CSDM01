import { z } from 'zod';

const id = z.union([z.string().uuid(), z.coerce.number().int().positive()]);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  keyword: z.string().max(100).optional(),
  status: z.string().max(20).optional(),
});

export const idParamSchema = z.object({
  id,
});

export const materialCreateSchema = z.object({
  material_code: z.string().min(1, '料品编码不能为空').max(50),
  material_name: z.string().min(1, '料品名称不能为空').max(200),
  category_name: z.string().max(50).optional(),
  specification: z.string().max(200).optional(),
  unit_name: z.string().max(20).optional(),
  version_no: z.string().max(50).optional(),
  film_no: z.string().max(50).optional(),
  status: z.union([z.literal(0), z.literal(1), z.number().int()]).default(1),
}).passthrough();

export const materialUpdateSchema = materialCreateSchema.partial();
