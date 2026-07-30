import { Router } from 'express';
import { Op } from 'sequelize';
import { EnvAlarm } from '../models';

const router = Router();

/** GET /api/env-alarm - 查询报警记录列表（分页、搜索） */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 50));
    const factorId = (req.query.factorId as string) || '';
    const deviceAddr = req.query.deviceAddr ? Number(req.query.deviceAddr) : undefined;
    const isHandled = req.query.isHandled !== undefined ? req.query.isHandled === 'true' : undefined;
    const alarmLevel = req.query.alarmLevel ? Number(req.query.alarmLevel) : undefined;
    const startTime = (req.query.startTime as string) || '';
    const endTime = (req.query.endTime as string) || '';

    const where: any = {};
    if (factorId) where.factorId = factorId;
    if (deviceAddr) where.deviceAddr = deviceAddr;
    if (isHandled !== undefined) where.isHandled = isHandled;
    if (alarmLevel !== undefined) where.alarmLevel = alarmLevel;
    if (startTime || endTime) {
      where.alarmTime = {};
      if (startTime) where.alarmTime[Op.gte] = new Date(startTime);
      if (endTime) where.alarmTime[Op.lte] = new Date(endTime);
    }

    const { count, rows } = await EnvAlarm.findAndCountAll({
      where,
      order: [['alarmTime', 'DESC']],
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

/** GET /api/env-alarm/latest - 查询最新报警记录 */
router.get('/latest', async (req, res, next) => {
  try {
    const deviceAddr = req.query.deviceAddr ? Number(req.query.deviceAddr) : undefined;
    const where: any = { isHandled: false };
    if (deviceAddr) where.deviceAddr = deviceAddr;

    const rows = await EnvAlarm.findAll({
      where,
      order: [['alarmTime', 'DESC']],
      limit: 100,
    });

    res.json({ success: true, data: rows.map((r: any) => r.toJSON()) });
  } catch (e) { next(e); }
});

/** GET /api/env-alarm/stats - 报警统计 */
router.get('/stats', async (req, res, next) => {
  try {
    const total = await EnvAlarm.count();
    const unhandled = await EnvAlarm.count({ where: { isHandled: false } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await EnvAlarm.count({ where: { alarmTime: { [Op.gte]: today } } });

    res.json({
      success: true,
      data: { total, unhandled, todayCount },
    });
  } catch (e) { next(e); }
});

/** PUT /api/env-alarm/:id/handle - 处理报警 */
router.put('/:id/handle', async (req, res, next) => {
  try {
    const alarm = await EnvAlarm.findByPk(req.params.id);
    if (!alarm) return res.status(404).json({ success: false, message: '报警记录不存在' });
    alarm.isHandled = true;
    alarm.handleMsg = req.body.handleMsg || '';
    await alarm.save();
    res.json({ success: true, message: '已处理', data: alarm.toJSON() });
  } catch (e) { next(e); }
});

export default router;
