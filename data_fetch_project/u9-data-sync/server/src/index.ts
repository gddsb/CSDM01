import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDB, ScheduledTask } from './models';
import taskRoutes from './routes/tasks';
import archiveRoutes from './routes/archive';
import scheduledTaskRoutes from './routes/scheduledTasks';
import taskSettingRoutes from './routes/taskSettings';
import envMonitorRoutes from './routes/envMonitor';
import envAlarmRoutes from './routes/envAlarm';
import dashboardRoutes from './routes/dashboard';
import { TaskEngine } from './services/taskEngine';
import { calcNextRun } from './routes/scheduledTasks';
import { EnvCollector } from './services/envCollector';

async function bootstrap() {
  // 创建目录
  [config.outputDir, config.dataDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // 初始化数据库
  await initDB();

  // 启动任务引擎（恢复未完成任务等）
  TaskEngine.getInstance().start();

  // 启动计划任务调度器（每分钟检查一次）
  setInterval(async () => {
    try {
      const now = new Date();
      const tasks = await ScheduledTask.findAll({
        where: { isEnabled: true, nextRunAt: { [require('sequelize').Op.lte]: now } },
      });
      for (const st of tasks) {
        const result = await TaskEngine.getInstance().createTask(st.type as any);
        if (result.success) {
          st.lastRunAt = now;
          st.lastRunResult = '自动执行成功';
        } else {
          st.lastRunAt = now;
          st.lastRunResult = result.message || '自动执行失败（可能有进行中任务）';
        }
        // 更新下次执行时间
        if (st.execMode === 'once') {
          st.isEnabled = false;
          st.nextRunAt = null;
        } else {
          st.nextRunAt = calcNextRun(st.execMode as any, st.config, now);
        }
        await st.save();
      }
    } catch (e) {
      console.error('[Scheduler] error:', e);
    }
  }, 60_000);
  console.log('✅ Scheduler started (every 60s)');

  const app = express();

  // 中间件
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // 静态文件（下载临时文件）
  // app.use('/downloads', express.static(config.outputDir));  // CSV已移除，暂不需要

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
  });

  // 路由
  app.use('/api/tasks', taskRoutes);
  app.use('/api/archive', archiveRoutes);
  app.use('/api/scheduled-tasks', scheduledTaskRoutes);
  app.use('/api/task-settings', taskSettingRoutes);
  app.use('/api/env-monitor', envMonitorRoutes);
  app.use('/api/env-alarm', envAlarmRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Not Found' });
  });

  // 错误处理
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[ERROR]', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
    });
  });

  app.listen(config.port, () => {
    console.log(`🚀 U9 Data Sync Server running on http://localhost:${config.port}`);
    console.log(`📦 Output dir: ${config.outputDir}`);
    console.log(`🗄️  DB: ${config.db.dialect} | ${config.db.dialect === 'sqlite' ? config.db.storage : config.db.database}`);
  });

  // 启动环境监控数据采集器（每5分钟采集一次）
  const envCollector = new EnvCollector({
    loginName: process.env.ENV_LOGIN_NAME || 'h241120csdm',
    password: process.env.ENV_PASSWORD || 'h241120csdm',
  });
  envCollector.startInterval(5);
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed:', e);
  process.exit(1);
});
