import { Router } from 'express';
import { Op } from 'sequelize';
import { ScheduledTaskModel, ExecMode, TaskType, ScheduleConfig } from '../models/scheduledTask';
import { TaskEngine } from '../services/taskEngine';

const router = Router();

function generateScheduleId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `PLAN-${y}${m}${d}-${h}${min}${s}-${rand}`;
}

/** 计算下次执行时间 */
function calcNextRun(mode: ExecMode, config: ScheduleConfig, baseDate = new Date()): Date | null {
  const now = new Date(baseDate);
  switch (mode) {
    case 'periodic': {
      const interval = config.interval || 1;
      const unit = config.intervalUnit || 'hour';
      const ms = unit === 'minute' ? interval * 60_000 : unit === 'hour' ? interval * 3600_000 : interval * 86400_000;
      return new Date(now.getTime() + ms);
    }
    case 'scheduled': {
      const time = config.fixedTime || '08:00';
      const days = config.fixedDays || [1, 2, 3, 4, 5, 6, 7];
      const [hh, mm] = time.split(':').map(Number);
      // 找下一个符合条件的日期
      for (let i = 0; i <= 7; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh, mm, 0, 0);
        if (i === 0 && d.getTime() <= now.getTime()) continue;
        const wd = d.getDay() === 0 ? 7 : d.getDay();
        if (days.includes(wd)) return d;
      }
      return null;
    }
    case 'once': {
      if (!config.onceAt) return null;
      const d = new Date(config.onceAt);
      return d > now ? d : null;
    }
    default:
      return null;
  }
}

/** GET /api/scheduled-tasks - 列表 */
router.get('/', async (req, res, next) => {
  try {
    const rows = await ScheduledTaskModel.findAll({
      order: [['id', 'DESC']],
    });
    res.json({ success: true, data: rows.map((r) => r.toJSON()) });
  } catch (e) { next(e); }
});

/** POST /api/scheduled-tasks - 创建 */
router.post('/', async (req, res, next) => {
  try {
    const { name, type, execMode, config, isEnabled } = req.body;
    if (!name || !['items', 'customers', 'env_monitor'].includes(type)) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }
    if (!['periodic', 'scheduled', 'once'].includes(execMode)) {
      return res.status(400).json({ success: false, message: '执行方式错误' });
    }
    const nextRunAt = calcNextRun(execMode as ExecMode, config || {});
    const task = await ScheduledTaskModel.create({
      scheduleId: generateScheduleId(),
      name,
      type: type as TaskType,
      execMode: execMode as ExecMode,
      config: config || {},
      nextRunAt,
      isEnabled: isEnabled !== false,
    });
    res.status(201).json({ success: true, data: task.toJSON() });
  } catch (e) { next(e); }
});

/** PUT /api/scheduled-tasks/:scheduleId - 更新 */
router.put('/:scheduleId', async (req, res, next) => {
  try {
    const task = await ScheduledTaskModel.findOne({ where: { scheduleId: req.params.scheduleId } });
    if (!task) return res.status(404).json({ success: false, message: '计划任务不存在' });
    const { name, execMode, config, isEnabled } = req.body;
    if (name !== undefined) task.name = name;
    if (execMode !== undefined) task.execMode = execMode;
    if (config !== undefined) {
      task.config = config;
      task.nextRunAt = calcNextRun(task.execMode as ExecMode, config);
    }
    if (isEnabled !== undefined) {
      task.isEnabled = isEnabled;
      if (isEnabled && !task.nextRunAt) {
        task.nextRunAt = calcNextRun(task.execMode as ExecMode, task.config);
      }
    }
    await task.save();
    res.json({ success: true, data: task.toJSON() });
  } catch (e) { next(e); }
});

/** DELETE /api/scheduled-tasks/:scheduleId - 删除 */
router.delete('/:scheduleId', async (req, res, next) => {
  try {
    const task = await ScheduledTaskModel.findOne({ where: { scheduleId: req.params.scheduleId } });
    if (!task) return res.status(404).json({ success: false, message: '计划任务不存在' });
    await task.destroy();
    res.json({ success: true, message: '已删除' });
  } catch (e) { next(e); }
});

/** POST /api/scheduled-tasks/:scheduleId/trigger - 手动触发 */
router.post('/:scheduleId/trigger', async (req, res, next) => {
  try {
    const task = await ScheduledTaskModel.findOne({ where: { scheduleId: req.params.scheduleId } });
    if (!task) return res.status(404).json({ success: false, message: '计划任务不存在' });
    const result = await TaskEngine.getInstance().createTask(task.type as TaskType);
    if (result.success) {
      task.lastRunAt = new Date();
      task.lastRunResult = '手动触发成功';
      await task.save();
      res.json({ success: true, message: '已手动触发', data: result.task?.toJSON() });
    } else {
      res.status(409).json({ success: false, message: result.message || '触发失败', data: result.duplicate ? result.duplicate.toJSON() : null });
    }
  } catch (e) { next(e); }
});

export { calcNextRun };
export default router;
