import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export class EnvAlarmModel extends Model<
  InferAttributes<EnvAlarmModel>, InferCreationAttributes<EnvAlarmModel>
> {
  declare id: CreationOptional<number>;
  declare factorId: string;              // 因子ID
  declare deviceAddr: number;            // 设备地址（关联字段）
  declare deviceName: string;            // 设备名称
  declare nodeId: number;                // 节点ID
  declare registerId: number;            // 寄存器ID
  declare factorName: string;            // 因子名称
  declare alarmInfo: string;             // 报警信息
  declare alarmLevel: number;            // 报警级别
  declare alarmRange: string | null;     // 报警限值
  declare currentValue: number | null;   // 当前报警值
  declare unit: string | null;           // 单位
  declare alarmTime: Date;               // 报警时间
  declare isHandled: CreationOptional<boolean>; // 是否已处理
  declare handleMsg: CreationOptional<string | null>; // 处理意见
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineEnvAlarmModel(seq: Sequelize) {
  EnvAlarmModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      factorId: { type: DataTypes.STRING(50), allowNull: false, comment: '因子ID' },
      deviceAddr: { type: DataTypes.INTEGER, allowNull: false, comment: '设备地址（关联字段）' },
      deviceName: { type: DataTypes.STRING(200), allowNull: true, comment: '设备名称' },
      nodeId: { type: DataTypes.INTEGER, allowNull: false, comment: '节点ID' },
      registerId: { type: DataTypes.INTEGER, allowNull: false, comment: '寄存器ID' },
      factorName: { type: DataTypes.STRING(100), allowNull: false, comment: '因子名称' },
      alarmInfo: { type: DataTypes.STRING(500), allowNull: false, comment: '报警信息' },
      alarmLevel: { type: DataTypes.INTEGER, allowNull: false, comment: '报警级别' },
      alarmRange: { type: DataTypes.STRING(100), allowNull: true, comment: '报警限值' },
      currentValue: { type: DataTypes.DOUBLE, allowNull: true, comment: '当前报警值' },
      unit: { type: DataTypes.STRING(20), allowNull: true, comment: '单位' },
      alarmTime: { type: DataTypes.DATE, allowNull: false, comment: '报警时间' },
      isHandled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: '是否已处理' },
      handleMsg: { type: DataTypes.STRING(500), allowNull: true, comment: '处理意见' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: seq,
      tableName: 'env_alarm_records',
      timestamps: true,
      indexes: [
        { fields: ['factorId'] },
        { fields: ['deviceAddr'] },
        { fields: ['alarmTime'] },
        { fields: ['alarmLevel'] },
        { fields: ['isHandled'] },
        { fields: ['factorId', 'alarmTime'] },
      ],
    }
  );
  return EnvAlarmModel;
}
