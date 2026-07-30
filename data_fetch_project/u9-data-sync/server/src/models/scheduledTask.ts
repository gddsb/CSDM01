import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';
import { TaskType } from './task';
export { TaskType } from './task';

export type ExecMode = 'periodic' | 'scheduled' | 'once';

export interface ScheduleConfig {
  interval?: number;       // 定期：间隔数值
  intervalUnit?: 'minute' | 'hour' | 'day'; // 定期：间隔单位
  fixedTime?: string;      // 定时：固定时间如 "08:00"
  fixedDays?: number[];    // 定时：周几执行 [1,2,3,4,5]
  onceAt?: string;         // 单次：执行日期时间 ISO字符串
}

export class ScheduledTaskModel extends Model<
  InferAttributes<ScheduledTaskModel>, InferCreationAttributes<ScheduledTaskModel>
> {
  declare id: CreationOptional<number>;
  declare scheduleId: string;
  declare name: string;
  declare type: TaskType;
  declare execMode: ExecMode;
  declare config: ScheduleConfig;
  declare nextRunAt: CreationOptional<Date | null>;
  declare lastRunAt: CreationOptional<Date | null>;
  declare lastRunResult: CreationOptional<string | null>;
  declare isEnabled: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineScheduledTaskModel(seq: Sequelize) {
  ScheduledTaskModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      scheduleId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      type: { type: DataTypes.STRING(20), allowNull: false },
      execMode: { type: DataTypes.STRING(20), allowNull: false },
      config: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      nextRunAt: { type: DataTypes.DATE, allowNull: true },
      lastRunAt: { type: DataTypes.DATE, allowNull: true },
      lastRunResult: { type: DataTypes.STRING(500), allowNull: true },
      isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize: seq, tableName: 'u9_scheduled_tasks', indexes: [
      { fields: ['isEnabled', 'nextRunAt'] },
      { fields: ['type'] },
    ]}
  );
  return ScheduledTaskModel;
}
