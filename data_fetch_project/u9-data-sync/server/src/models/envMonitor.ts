import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export class EnvMonitorModel extends Model<
  InferAttributes<EnvMonitorModel>, InferCreationAttributes<EnvMonitorModel>
> {
  declare id: CreationOptional<number>;
  declare factorId: string;              // 因子ID
  declare deviceAddr: number;            // 设备地址
  declare deviceName: string;            // 设备名称
  declare nodeId: number;                // 节点ID
  declare registerId: number;            // 寄存器ID
  declare factorName: string;            // 因子名称
  declare value: number;                 // 当前值
  declare rawData: string;               // 原始数据字符串
  declare unit: string;                  // 单位
  declare coefficient: number;           // 系数
  declare deviceStatus: string;          // 设备状态
  declare collectTime: Date;             // 采集时间(平台时间戳)
  declare dataTime: Date;                // 数据时间(系统采集时间)
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineEnvMonitorModel(seq: Sequelize) {
  EnvMonitorModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      factorId: { type: DataTypes.STRING(50), allowNull: false, comment: '因子ID' },
      deviceAddr: { type: DataTypes.INTEGER, allowNull: false, comment: '设备地址' },
      deviceName: { type: DataTypes.STRING(200), allowNull: true, comment: '设备名称' },
      nodeId: { type: DataTypes.INTEGER, allowNull: false, comment: '节点ID' },
      registerId: { type: DataTypes.INTEGER, allowNull: false, comment: '寄存器ID' },
      factorName: { type: DataTypes.STRING(100), allowNull: false, comment: '因子名称' },
      value: { type: DataTypes.DOUBLE, allowNull: true, comment: '当前值' },
      rawData: { type: DataTypes.STRING(50), allowNull: true, comment: '原始数据' },
      unit: { type: DataTypes.STRING(20), allowNull: true, comment: '单位' },
      coefficient: { type: DataTypes.FLOAT, allowNull: true, comment: '系数' },
      deviceStatus: { type: DataTypes.STRING(20), allowNull: true, comment: '设备状态' },
      collectTime: { type: DataTypes.DATE, allowNull: false, comment: '采集时间(平台时间戳)' },
      dataTime: { type: DataTypes.DATE, allowNull: true, comment: '数据时间(系统采集时间)' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: seq,
      tableName: 'env_monitor_data',
      timestamps: true,
      indexes: [
        { fields: ['factorId'] },
        { fields: ['deviceAddr'] },
        { fields: ['collectTime'] },
        { fields: ['dataTime'] },
        { fields: ['factorId', 'collectTime'] },
      ],
    }
  );
  return EnvMonitorModel;
}
