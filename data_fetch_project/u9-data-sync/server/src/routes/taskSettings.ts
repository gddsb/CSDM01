import { Router } from 'express';
import { TaskSettingModel } from '../models/taskSetting';
import { TaskEngine } from '../services/taskEngine';
import { TaskModel } from '../models/task';
import { Op } from 'sequelize';

const router = Router();

/** GET /api/task-settings - 列表 */
router.get('/', async (req, res, next) => {
  try {
    const rows = await TaskSettingModel.findAll({ order: [['id', 'ASC']] });
    res.json({ success: true, data: rows.map((r) => r.toJSON()) });
  } catch (e) { next(e); }
});

/** PUT /api/task-settings/:taskType - 更新 */
router.put('/:taskType', async (req, res, next) => {
  try {
    const setting = await TaskSettingModel.findOne({ where: { taskType: req.params.taskType } });
    if (!setting) return res.status(404).json({ success: false, message: '任务设置不存在' });
    const { name, description, sourceUrl, fieldCount, isActive, params } = req.body;
    if (name !== undefined) setting.name = name;
    if (description !== undefined) setting.description = description;
    if (sourceUrl !== undefined) setting.sourceUrl = sourceUrl;
    if (fieldCount !== undefined) setting.fieldCount = fieldCount;
    if (isActive !== undefined) setting.isActive = isActive;
    if (params !== undefined) setting.params = params;
    await setting.save();
    res.json({ success: true, data: setting.toJSON() });
  } catch (e) { next(e); }
});

/** POST /api/task-settings/:taskType/test - 测试执行任务 */
router.post('/:taskType/test', async (req, res, next) => {
  try {
    const setting = await TaskSettingModel.findOne({ where: { taskType: req.params.taskType } });
    if (!setting) return res.status(404).json({ success: false, message: '任务设置不存在' });
    if (!setting.isActive) return res.status(400).json({ success: false, message: '任务未启用' });

    // 检查是否有进行中的同类型任务
    const active = await TaskModel.findOne({
      where: {
        type: setting.taskType as any,
        status: { [Op.in]: ['pending', 'running'] as any[] },
      },
      order: [['id', 'DESC']],
    });

    if (active) {
      // 有冲突，标记延迟执行，返回当前任务信息
      return res.json({
        success: true,
        data: { taskId: active.taskId, delayed: true, message: '有进行中的任务，测试任务将在其结束后执行' },
      });
    }

    // 无冲突，直接创建测试任务
    const result = await TaskEngine.getInstance().createTask(setting.taskType as any);
    if (result.success && result.task) {
      res.json({ success: true, data: { taskId: result.task.taskId, delayed: false } });
    } else {
      res.status(409).json({
        success: false,
        message: result.message || '创建测试任务失败',
        data: result.duplicate ? { taskId: result.duplicate.taskId, delayed: true } : null,
      });
    }
  } catch (e) { next(e); }
});

/** GET /api/task-settings/:taskType/test-status - 查询测试任务状态 */
router.get('/:taskType/test-status', async (req, res, next) => {
  try {
    const task = await TaskModel.findOne({
      where: { type: req.params.taskType as any },
      order: [['id', 'DESC']],
    });
    if (!task) return res.json({ success: true, data: null });
    res.json({ success: true, data: task.toJSON() });
  } catch (e) { next(e); }
});

export default router;
