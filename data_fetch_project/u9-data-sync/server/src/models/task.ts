import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export type TaskType = 'items' | 'customers' | 'env_monitor' | 'weather';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'duplicate_rejected';

export interface TaskProgressStep {
  time: string;
  message: string;
  percent: number;
}

export class TaskModel extends Model<
  InferAttributes<TaskModel>, InferCreationAttributes<TaskModel>
> {
  declare id: CreationOptional<number>;
  declare taskId: string;                // 业务任务ID（UUID）
  declare type: TaskType;                // 'items' | 'customers'
  declare status: TaskStatus;
  declare progress: number;              // 0~100
  declare currentStep: string;           // 最近步骤说明
  declare steps: TaskProgressStep[];     // 步骤日志 JSON
  declare totalRecords?: CreationOptional<number>;
  declare outputFile?: CreationOptional<string>;   // CSV/JSON 相对路径
  declare outputSize?: CreationOptional<number>;   // bytes
  declare errorMsg?: CreationOptional<string>;
  declare startedAt?: CreationOptional<Date>;
  declare endedAt?: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineTaskModel(seq: Sequelize) {
  TaskModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      taskId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      type: { type: DataTypes.STRING(20), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
      progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      currentStep: { type: DataTypes.STRING(500), allowNull: true, defaultValue: '' },
      steps: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      totalRecords: { type: DataTypes.INTEGER, allowNull: true },
      outputFile: { type: DataTypes.STRING(500), allowNull: true },
      outputSize: { type: DataTypes.BIGINT, allowNull: true },
      errorMsg: { type: DataTypes.STRING(2000), allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      endedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize: seq, tableName: 'u9_tasks', indexes: [
      { fields: ['type', 'status'] },
      { fields: ['createdAt'] },
    ]}
  );
  return TaskModel;
}
