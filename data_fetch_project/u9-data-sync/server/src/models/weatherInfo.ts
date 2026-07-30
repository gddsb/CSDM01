import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export class WeatherInfoModel extends Model<
  InferAttributes<WeatherInfoModel>, InferCreationAttributes<WeatherInfoModel>
> {
  declare id: CreationOptional<number>;
  declare city: string;                    // 城市/区县名称
  declare temperature: number;             // 温度 (℃)
  declare humidity: number;                // 相对湿度 (%)
  declare pressure: number;                // 大气压 (hPa)
  declare weatherTime: Date;               // 气象发布/观测时间
  declare source: string;                  // 数据来源站点URL/标识
  declare rawData?: CreationOptional<string>;  // 原始HTML片段（调试用）
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineWeatherInfoModel(seq: Sequelize) {
  WeatherInfoModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      city: { type: DataTypes.STRING(50), allowNull: false, comment: '城市/区县名称' },
      temperature: { type: DataTypes.DOUBLE, allowNull: false, comment: '温度(℃)' },
      humidity: { type: DataTypes.DOUBLE, allowNull: false, comment: '相对湿度(%)' },
      pressure: { type: DataTypes.DOUBLE, allowNull: false, comment: '大气压(hPa)' },
      weatherTime: { type: DataTypes.DATE, allowNull: false, comment: '气象发布/观测时间' },
      source: { type: DataTypes.STRING(200), allowNull: false, comment: '数据来源站点' },
      rawData: { type: DataTypes.TEXT, allowNull: true, comment: '原始片段' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: seq,
      tableName: 'weather_info',
      timestamps: true,
      indexes: [
        { fields: ['city'] },
        { fields: ['weatherTime'] },
        { fields: ['source'] },
        { fields: ['city', 'weatherTime'] },
      ],
    }
  );
  return WeatherInfoModel;
}
