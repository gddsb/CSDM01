import { Op } from 'sequelize';
import { TaskModel, TaskType, TaskStatus, TaskProgressStep } from '../models/task';
import { exportItems, exportCustomers } from './u9Exporter';
import { EnvCollector } from './envCollector';
import { collectAndSaveWeather } from './weatherCollector';
import { EventEmitter } from 'events';

/** 生成业务任务ID：SCH + YYYYMMDD + 3位流水号 */
async function generateTaskId(type: TaskType): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;

  const prefix = type === 'items' ? 'SCHI' : type === 'customers' ? 'SCHC' : type === 'env_monitor' ? 'SCHE' : 'SCHW';
  const pattern = `${prefix}${datePart}%`;
  const last = await TaskModel.findOne({
    where: { taskId: { [Op.like]: pattern } },
    order: [['id', 'DESC']],
  });
  let seq = 1;
  if (last) {
    const m2 = last.taskId.match(/_(\d{3})$/) || last.taskId.match(/(\d{3})$/);
    if (m2) {
      seq = parseInt(m2[1], 10) + 1;
    }
  }
  return `${prefix}${datePart}${String(seq).padStart(3, '0')}`;
}

export interface CreateTaskResult {
  success: boolean;
  task?: TaskModel;
  duplicate?: TaskModel;      // 重复的进行中任务
  message?: string;
}

/**
 * 任务引擎：
 *  - 单例，管理后台 worker（并发限制：1 个，避免 U9 并发登录）
 *  - 内存级锁：同类型 running/pending 重复拦截
 *  - 进度事件 EventEmitter（SSE 广播用）
 */
export class TaskEngine extends EventEmitter {
  private static _inst: TaskEngine;
  private running = false;
  private queue: TaskModel[] = [];
  // 串行锁：保证 createTask 的“检查+创建”原子性，避免并发请求竞态创建重复任务
  private createChain: Promise<unknown> = Promise.resolve();

  private constructor() {
    super();
  }
  static getInstance() {
    if (!TaskEngine._inst) TaskEngine._inst = new TaskEngine();
    return TaskEngine._inst;
  }

  /** 启动：恢复 pending 任务（只恢复最近 1 小时内的 pending 为 failed，避免重复） */
  async start() {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const [cnt] = await TaskModel.update(
      { status: 'failed' as TaskStatus, errorMsg: '服务重启，任务中断', endedAt: new Date() },
      { where: { status: { [Op.in]: ['pending', 'running'] as TaskStatus[] }, createdAt: { [Op.gt]: cutoff } } }
    );
    if (cnt > 0) console.log(`⚠️  恢复标记：${cnt} 个旧任务标记为 failed`);
    // 启动工作循环
    setInterval(() => this.tick(), 500);
    console.log('✅ TaskEngine started');
  }

  /** 检查是否存在重复的进行中同类型任务 */
  async findActiveSameType(type: TaskType): Promise<TaskModel | null> {
    return await TaskModel.findOne({
      where: { type, status: { [Op.in]: ['pending', 'running'] as TaskStatus[] } },
      order: [['id', 'DESC']],
    });
  }

  /** 创建任务（含去重锁，串行化避免竞态） */
  async createTask(type: TaskType): Promise<CreateTaskResult> {
    // 串行化：将“检查+创建”作为临界区，后续请求必须等前一个完成才能进入
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.createChain;
    this.createChain = previous.then(() => gate);
    await previous;

    try {
      const dup = await this.findActiveSameType(type);
      if (dup) {
        return { success: false, duplicate: dup, message: '存在相同类型的进行中任务' };
      }
      const taskId = await generateTaskId(type);
      const task = await TaskModel.create({
        taskId,
        type,
        status: 'pending',
        progress: 0,
        currentStep: '已创建，等待执行...',
        steps: [{ time: new Date().toISOString(), message: '任务已创建，排队中', percent: 0 }],
      });
      this.queue.push(task);
      this.emitChange(task);
      return { success: true, task };
    } finally {
      release();
    }
  }

  private async tick() {
    if (this.running) return;
    const next = this.queue.shift() || (await this.fetchNextPending());
    if (!next) return;
    this.running = true;
    try {
      await this.runTask(next);
    } catch (e: any) {
      console.error('[TaskEngine] runTask err:', e);
    } finally {
      this.running = false;
    }
  }

  private async fetchNextPending(): Promise<TaskModel | null> {
    return await TaskModel.findOne({
      where: { status: 'pending' as TaskStatus },
      order: [['id', 'ASC']],
    });
  }

  private emitChange(task: TaskModel) {
    this.emit('change', task.toJSON());
  }

  private async appendStep(task: TaskModel, message: string, percent: number) {
    task.progress = Math.max(task.progress, Math.min(100, percent));
    task.currentStep = message;
    const steps = Array.isArray(task.steps) ? [...(task.steps as TaskProgressStep[])] : [];
    steps.push({ time: new Date().toISOString(), message, percent: task.progress });
    // 最多保留 200 条步骤
    task.steps = steps.slice(-200);
    task.changed('steps', true); // 显式标记 JSON 字段已变更
    console.log(`[Task#${task.id}] step: ${percent}% - ${message.slice(0, 50)} (steps=${steps.length})`);
    await task.save();
    this.emitChange(task);
  }

  private async runTask(task: TaskModel) {
    // 二次去重：防止DB里有同类型running（极端重启场景）
    const dup = await TaskModel.findOne({
      where: {
        type: task.type,
        status: 'running' as TaskStatus,
        id: { [Op.ne]: task.id },
      },
    });
    if (dup) {
      task.status = 'duplicate_rejected';
      task.errorMsg = `被重复任务拦截：进行中的任务 #${dup.id}`;
      task.endedAt = new Date();
      await task.save();
      this.emitChange(task);
      return;
    }

    task.status = 'running';
    task.startedAt = new Date();
    await task.save();
    this.emitChange(task);

    const onProgress = async (msg: string, pct: number) => {
      await this.appendStep(task, msg, pct);
    };

    try {
      let totalRecords = 0;

      if (task.type === 'env_monitor') {
        // 环境监测采集任务
        await onProgress('连接0531yun平台获取Token...', 10);
        const collector = new EnvCollector({
          loginName: process.env.ENV_LOGIN_NAME || 'h241120csdm',
          password: process.env.ENV_PASSWORD || 'h241120csdm',
        });
        await onProgress('获取实时数据...', 30);
        const [devices, coeffMap] = await Promise.all([
          collector.fetchRealTimeData(),
          collector.fetchDeviceList(),
        ]);
        await onProgress(`获取到 ${devices.length} 台设备数据，正在保存...`, 60);
        const records = collector.convertToRecords(devices);
        for (const r of records) {
          if (coeffMap.has(r.factorId)) r.coefficient = coeffMap.get(r.factorId);
        }
        const alarmRecords = collector.extractAlarmRecords(devices);
        if (records.length > 0) {
          const { EnvMonitor } = await import('../models');
          await EnvMonitor.bulkCreate(records);
        }
        if (alarmRecords.length > 0) {
          const { EnvAlarm } = await import('../models');
          await EnvAlarm.bulkCreate(alarmRecords);
        }
        totalRecords = records.length;
        await onProgress(`采集完成，保存 ${totalRecords} 条记录、${alarmRecords.length} 条报警`, 90);
      } else if (task.type === 'weather') {
        // 气象信息抓取任务
        await onProgress('开始抓取气象信息（中国天气网主站 + 两备用）...', 20);
        const data = await collectAndSaveWeather();
        totalRecords = 1;
        await onProgress(
          `抓取成功：${data.city} 温度${data.temperature}℃ 湿度${data.humidity}% 气压${data.pressure}hPa，来源：${data.source}`,
          100
        );
      } else {
        const result = task.type === 'items'
          ? await exportItems(task.taskId, (m, p) => onProgress(m, p))
          : await exportCustomers(task.taskId, (m, p) => onProgress(m, p));
        totalRecords = result.totalRecords;
      }

      task.status = 'completed';
      task.progress = 100;
      task.totalRecords = totalRecords;
      task.endedAt = new Date();
      task.currentStep = `完成，共 ${totalRecords} 条记录`;
      const steps = (task.steps || []) as TaskProgressStep[];
      steps.push({ time: new Date().toISOString(), message: `任务完成，共 ${totalRecords} 条`, percent: 100 });
      task.steps = steps;
      await task.save();
      this.emitChange(task);
    } catch (e: any) {
      task.status = 'failed';
      task.errorMsg = e?.message || String(e);
      task.endedAt = new Date();
      const steps = (task.steps || []) as TaskProgressStep[];
      steps.push({ time: new Date().toISOString(), message: `❌ 失败: ${e?.message || e}`, percent: task.progress });
      task.steps = steps;
      await task.save();
      this.emitChange(task);
    }
  }
}
