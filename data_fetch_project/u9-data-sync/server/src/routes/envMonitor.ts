import { Router } from 'express';
import { Op } from 'sequelize';
import { EnvMonitor } from '../models';

const router = Router();

/** GET /api/env-monitor - 查询监测数据列表（分页、搜索） */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 50));
    const factorId = (req.query.factorId as string) || '';
    const deviceAddr = req.query.deviceAddr ? Number(req.query.deviceAddr) : undefined;
    const startTime = (req.query.startTime as string) || '';
    const endTime = (req.query.endTime as string) || '';

    const where: any = {};
    if (factorId) where.factorId = factorId;
    if (deviceAddr) where.deviceAddr = deviceAddr;
    if (startTime || endTime) {
      where.collectTime = {};
      if (startTime) where.collectTime[Op.gte] = new Date(startTime);
      if (endTime) where.collectTime[Op.lte] = new Date(endTime);
    }

    const { count, rows } = await EnvMonitor.findAndCountAll({
      where,
      order: [['collectTime', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({
      success: true,
      data: {
        list: rows.map((r: any) => r.toJSON()),
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil(count / pageSize),
        },
      },
    });
  } catch (e) { next(e); }
});

/** GET /api/env-monitor/latest - 查询最新监测数据（按因子分组） */
router.get('/latest', async (req, res, next) => {
  try {
    const deviceAddr = req.query.deviceAddr ? Number(req.query.deviceAddr) : undefined;
    const where: any = {};
    if (deviceAddr) where.deviceAddr = deviceAddr;

    // 获取每个因子的最新一条记录
    const rows = await EnvMonitor.findAll({
      where,
      order: [['collectTime', 'DESC']],
    });

    // 按 factorId 去重取最新
    const latestMap = new Map<string, any>();
    for (const row of rows) {
      const json = (row as any).toJSON();
      if (!latestMap.has(json.factorId)) {
        latestMap.set(json.factorId, json);
      }
    }

    res.json({
      success: true,
      data: Array.from(latestMap.values()),
    });
  } catch (e) { next(e); }
});

/** GET /api/env-monitor/factors - 查询所有因子列表 */
router.get('/factors', async (req, res, next) => {
  try {
    const rows = await EnvMonitor.findAll({
      attributes: ['factorId', 'factorName', 'unit', 'deviceAddr', 'deviceName', 'nodeId', 'registerId', 'coefficient'],
      group: ['factorId'],
      order: [['deviceAddr', 'ASC'], ['nodeId', 'ASC'], ['registerId', 'ASC']],
    });
    res.json({ success: true, data: rows.map((r: any) => r.toJSON()) });
  } catch (e) { next(e); }
});

/** POST /api/env-monitor/batch - 批量保存监测数据 */
router.post('/batch', async (req, res, next) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records 必须是数组' });
    }
    const result = await EnvMonitor.bulkCreate(records);
    res.json({ success: true, message: `已保存 ${result.length} 条`, data: { count: result.length } });
  } catch (e) { next(e); }
});

export default router;
