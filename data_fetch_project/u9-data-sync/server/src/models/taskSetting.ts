import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';
import { TaskType } from './task';
export { TaskType } from './task';

export class TaskSettingModel extends Model<
  InferAttributes<TaskSettingModel>, InferCreationAttributes<TaskSettingModel>
> {
  declare id: CreationOptional<number>;
  declare taskType: TaskType;
  declare name: string;
  declare description: string;
  declare sourceUrl: CreationOptional<string>;
  declare fieldCount: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare params: CreationOptional<Record<string, any> | null>; // 执行参数(用户名、密码等)
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineTaskSettingModel(seq: Sequelize) {
  TaskSettingModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      taskType: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      sourceUrl: { type: DataTypes.STRING(500), allowNull: true },
      fieldCount: { type: DataTypes.INTEGER, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      params: { type: DataTypes.JSON, allowNull: true, defaultValue: null, comment: '执行参数(用户名、密码等)' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize: seq, tableName: 'u9_task_settings' }
  );
  return TaskSettingModel;
}
