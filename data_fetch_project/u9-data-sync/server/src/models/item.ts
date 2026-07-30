import {
  Model, DataTypes, InferAttributes, InferCreationAttributes,
  CreationOptional, Sequelize,
} from 'sequelize';

export class ItemModel extends Model<
  InferAttributes<ItemModel>, InferCreationAttributes<ItemModel>
> {
  declare id: CreationOptional<number>;
  declare taskId: string;                // 来源任务ID
  declare mainCategoryCode: string;      // 主分类代码
  declare categoryName: string;          // 分类名称
  declare itemCode: string;              // 料号
  declare itemName: string;              // 品名
  declare specification: string;         // 规格
  declare unitName: string;              // 单位名称
  declare filmNo: string;                // 菲林编号
  declare cuttingSize: string;           // 开料尺寸
  declare printProcess: string;          // 印刷工艺
  declare colorInfo: string;             // 分色信息
  declare blankDiameter: string;         // 落料直径
  declare materialThickness: string;     // 材料厚度
  declare materialWidth: string;         // 材料宽度
  declare materialHeight: string;        // 材料高度
  declare scrapWeight: string;           // 边角料重量
  declare stockUnitWeight: string;       // 库存单位重量
  declare stockUnitVolume: string;       // 库存单位体积
  declare weightUnit: string;            // 重量单位
  declare volumeUnit: string;            // 体积单位
  declare inventoryCategory: string;     // 存货分类
  declare unitCode: string;              // 单位编码
  declare isActive: boolean;             // 是否生效
  declare effectiveDate: string;         // 生效日期
  declare expirationDate: string;        // 失效日期
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineItemModel(seq: Sequelize) {
  ItemModel.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      taskId: { type: DataTypes.STRING(64), allowNull: false },
      mainCategoryCode: { type: DataTypes.STRING(100), allowNull: true },
      categoryName: { type: DataTypes.STRING(200), allowNull: true },
      itemCode: { type: DataTypes.STRING(100), allowNull: false },
      itemName: { type: DataTypes.STRING(500), allowNull: true },
      specification: { type: DataTypes.STRING(500), allowNull: true },
      unitName: { type: DataTypes.STRING(100), allowNull: true },
      filmNo: { type: DataTypes.STRING(100), allowNull: true },
      cuttingSize: { type: DataTypes.STRING(200), allowNull: true },
      printProcess: { type: DataTypes.STRING(200), allowNull: true },
      colorInfo: { type: DataTypes.STRING(200), allowNull: true },
      blankDiameter: { type: DataTypes.STRING(100), allowNull: true },
      materialThickness: { type: DataTypes.STRING(100), allowNull: true },
      materialWidth: { type: DataTypes.STRING(100), allowNull: true },
      materialHeight: { type: DataTypes.STRING(100), allowNull: true },
      scrapWeight: { type: DataTypes.STRING(100), allowNull: true },
      stockUnitWeight: { type: DataTypes.STRING(100), allowNull: true },
      stockUnitVolume: { type: DataTypes.STRING(100), allowNull: true },
      weightUnit: { type: DataTypes.STRING(100), allowNull: true },
      volumeUnit: { type: DataTypes.STRING(100), allowNull: true },
      inventoryCategory: { type: DataTypes.STRING(100), allowNull: true },
      unitCode: { type: DataTypes.STRING(100), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: true },
      effectiveDate: { type: DataTypes.STRING(50), allowNull: true },
      expirationDate: { type: DataTypes.STRING(50), allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize: seq,
      tableName: 'u9_items',
      indexes: [
        { fields: ['itemCode'], unique: true },
        { fields: ['taskId'] },
        { fields: ['itemName'] },
      ],
    }
  );
  return ItemModel;
}
