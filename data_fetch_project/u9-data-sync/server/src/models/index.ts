import { Sequelize, Options } from 'sequelize';
import { config } from '../config';
import { defineTaskModel, TaskModel } from './task';
import { defineItemModel, ItemModel } from './item';
import { defineCustomerModel, CustomerModel } from './customer';
import { defineScheduledTaskModel, ScheduledTaskModel } from './scheduledTask';
import { defineTaskSettingModel, TaskSettingModel } from './taskSetting';
import { defineEnvMonitorModel, EnvMonitorModel } from './envMonitor';
import { defineEnvAlarmModel, EnvAlarmModel } from './envAlarm';
import { defineWeatherInfoModel, WeatherInfoModel } from './weatherInfo';

export let sequelize: Sequelize;
export let Item: typeof ItemModel;
export let Customer: typeof CustomerModel;
export let ScheduledTask: typeof ScheduledTaskModel;
export let TaskSetting: typeof TaskSettingModel;
export let EnvMonitor: typeof EnvMonitorModel;
export let EnvAlarm: typeof EnvAlarmModel;
export let WeatherInfo: typeof WeatherInfoModel;
export const Task = TaskModel;

export async function initDB() {
  let opts: Options;
  if (config.db.dialect === 'mysql' && config.db.host) {
    opts = {
      dialect: 'mysql',
      host: config.db.host,
      port: config.db.port,
      username: config.db.username,
      password: config.db.password,
      database: config.db.database,
      logging: false,
      define: { timestamps: true },
    };
  } else {
    opts = {
      dialect: 'sqlite',
      storage: config.db.storage,
      logging: false,
      define: { timestamps: true },
    };
  }
  sequelize = new Sequelize(opts);
  defineTaskModel(sequelize);
  Item = defineItemModel(sequelize);
  Customer = defineCustomerModel(sequelize);
  ScheduledTask = defineScheduledTaskModel(sequelize);
  TaskSetting = defineTaskSettingModel(sequelize);
  EnvMonitor = defineEnvMonitorModel(sequelize);
  EnvAlarm = defineEnvAlarmModel(sequelize);
  WeatherInfo = defineWeatherInfoModel(sequelize);
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  // 初始化默认任务设置
  const existing = await TaskSetting.findAll();
  if (existing.length === 0) {
    await TaskSetting.bulkCreate([
      {
        taskType: 'items',
        name: '料品数据同步',
        description: '从U9 ERP抓取料品主数据，含主分类、料号、品名、规格、尺寸、工艺、库存信息等24个字段',
        sourceUrl: config.u9.erpUrl,
        fieldCount: 24,
        isActive: true,
      },
      {
        taskType: 'customers',
        name: '客户数据同步',
        description: '从U9 ERP抓取客户主数据，含编码、名称、简称、分类、生效状态等8个字段',
        sourceUrl: config.u9.erpUrl,
        fieldCount: 8,
        isActive: true,
      },
      {
        taskType: 'env_monitor',
        name: '环境监测采集',
        description: '从0531yun综合环境监控云平台采集实时监测数据，含因子ID、节点、寄存器、因子名称、当前值、单位、系数、状态、报警限值、采集时间等10个字段',
        sourceUrl: 'http://www.0531yun.com/',
        fieldCount: 10,
        isActive: true,
      },
      {
        taskType: 'weather',
        name: '气象信息抓取',
        description: '从中国天气网（主）、天气网（备用1）、天气24（备用2）抓取望城实时气象信息，含城市、温度、湿度、大气压、发布时间共5个字段',
        sourceUrl: 'https://weather.cma.cn/web/weather/P5600.html',
        fieldCount: 5,
        isActive: true,
      },
    ]);
    console.log('✅ 默认任务设置已初始化');
  } else {
    // 补充新增的 env_monitor 任务设置
    const hasEnv = existing.some((s: any) => s.taskType === 'env_monitor');
    if (!hasEnv) {
      await TaskSetting.create({
        taskType: 'env_monitor',
        name: '环境监测采集',
        description: '从0531yun综合环境监控云平台采集实时监测数据，含因子ID、节点、寄存器、因子名称、当前值、单位、系数、状态、报警限值、采集时间等10个字段',
        sourceUrl: 'http://www.0531yun.com/',
        fieldCount: 10,
        isActive: true,
      });
      console.log('✅ 环境监测采集任务设置已补充');
    }
    const hasWeather = existing.some((s: any) => s.taskType === 'weather');
    if (!hasWeather) {
      await TaskSetting.create({
        taskType: 'weather',
        name: '气象信息抓取',
        description: '从中国天气网（主）、天气网（备用1）、天气24（备用2）抓取望城实时气象信息，含城市、温度、湿度、大气压、发布时间共5个字段',
        sourceUrl: 'https://weather.cma.cn/web/weather/P5600.html',
        fieldCount: 5,
        isActive: true,
      });
      console.log('✅ 气象信息抓取任务设置已补充');
    }
  }

  console.log('✅ Database initialized');
}

export * from './task';
export * from './item';
export * from './customer';
export * from './scheduledTask';
export * from './taskSetting';
export * from './envMonitor';
export * from './envAlarm';
export * from './weatherInfo';
