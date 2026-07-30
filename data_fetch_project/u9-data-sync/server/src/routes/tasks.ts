import { Router } from 'express';
import { Op } from 'sequelize';
import { TaskModel, TaskType, TaskStatus } from '../models/task';
import { TaskEngine } from '../services/taskEngine';
import { config } from '../config';

const router = Router();

function serializeTask(t: TaskModel | any) {
  const o = typeof t?.toJSON === 'function' ? t.toJSON() : { ...t };
  delete o.outputFile;
  delete o.outputSize;
  return o;
}

/** GET /api/tasks - 任务列表（最近N条） */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const type = req.query.type as TaskType | undefined;
    const where: any = {};
    if (type) where.type = type;
    const rows = await TaskModel.findAll({
      where,
      order: [['id', 'DESC']],
      limit,
    });
    res.json({
      success: true,
      data: rows.map(serializeTask),
    });
  } catch (e) { next(e); }
});

/** GET /api/tasks/:taskId - 单个任务详情 */
router.get('/:taskId', async (req, res, next) => {
  try {
    const t = await TaskModel.findOne({ where: { taskId: req.params.taskId } });
    if (!t) return res.status(404).json({ success: false, message: '任务不存在' });
    res.json({ success: true, data: serializeTask(t) });
  } catch (e) { next(e); }
});

/** GET /api/tasks/check/:type - 检查是否存在进行中的同类型任务 */
router.get('/check/:type', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const type = req.params.type as TaskType;
    if (!['items', 'customers'].includes(type)) {
      return res.status(400).json({ success: false, message: '未知任务类型' });
    }
    const dup = await TaskEngine.getInstance().findActiveSameType(type);
    res.json({ success: true, data: { hasActive: !!dup, running: dup ? serializeTask(dup) : null } });
  } catch (e) { next(e); }
});

/** POST /api/tasks - 创建任务 */
router.post('/', async (req, res, next) => {
  try {
    const type = req.body?.type as TaskType;
    if (!['items', 'customers'].includes(type)) {
      return res.status(400).json({ success: false, message: '未知任务类型' });
    }
    const result = await TaskEngine.getInstance().createTask(type);
    if (!result.success) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_ACTIVE_TASK',
        message: `已有相同类型任务执行中（ID: ${result.duplicate?.taskId}），请等待完成或稍后再试`,
        data: result.duplicate ? serializeTask(result.duplicate) : null,
      });
    }
    res.status(201).json({
      success: true,
      message: '任务已创建，已加入后台执行队列',
      data: result.task ? serializeTask(result.task) : null,
    });
  } catch (e) { next(e); }
});

/** DELETE /api/tasks/:taskId - 删除历史任务（未运行中） */
router.delete('/:taskId', async (req, res, next) => {
  try {
    const t = await TaskModel.findOne({ where: { taskId: req.params.taskId } });
    if (!t) return res.status(404).json({ success: false, message: '任务不存在' });
    if ((['pending', 'running'] as TaskStatus[]).includes(t.status)) {
      return res.status(400).json({ success: false, message: '任务进行中，不能删除' });
    }
    await t.destroy();
    res.json({ success: true, message: '已删除' });
  } catch (e) { next(e); }
});

/** SSE 订阅: GET /api/tasks/stream/watch */
router.get('/stream/watch', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': config.frontendUrl,
  });
  res.flushHeaders?.();

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  send({ type: 'connected', serverTime: new Date().toISOString() });

  const onChange = (t: any) => send({ type: 'change', task: serializeTask(t as any) });
  TaskEngine.getInstance().on('change', onChange);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 30_000);
  req.on('close', () => {
    clearInterval(keepAlive);
    TaskEngine.getInstance().off('change', onChange);
  });
});

export default router;
