import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export class CustomerModel extends Model<
  InferAttributes<CustomerModel>, InferCreationAttributes<CustomerModel>
> {
  declare id: CreationOptional<number>;
  declare taskId: string;                // 来源任务ID
  declare customerCode: string;          // 编码
  declare customerName: string;          // 名称
  declare shortName: string;             // 简称
  declare categoryId: string;            // 客户分类ID
  declare categoryName: string;          // 分类
  declare isActive: boolean;             // 有效性.是否生效
  declare expireDate: string;            // 有效性.失效日期
  declare effectiveDate: string;         // 有效性.生效日期
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineCustomerModel(seq: Sequelize) {
  CustomerModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      taskId: { type: DataTypes.STRING(64), allowNull: false },
      customerCode: { type: DataTypes.STRING(100), allowNull: false },
      customerName: { type: DataTypes.STRING(500), allowNull: true },
      shortName: { type: DataTypes.STRING(200), allowNull: true },
      categoryId: { type: DataTypes.STRING(100), allowNull: true },
      categoryName: { type: DataTypes.STRING(200), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: true },
      expireDate: { type: DataTypes.STRING(50), allowNull: true },
      effectiveDate: { type: DataTypes.STRING(50), allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: seq,
      tableName: 'u9_customers',
      indexes: [
        { fields: ['customerCode'], unique: true },
        { fields: ['taskId'] },
        { fields: ['customerName'] },
      ],
    }
  );
  return CustomerModel;
}
