import { Model, type ModelStatic } from 'sequelize'

/**
 * Sequelize 模型实例的宽松类型。
 *
 * 项目使用 sequelize.define 定义模型，未逐个声明 Attributes 接口，
 * 导致模型实例上访问业务字段（如 user.user_pwd、order.status）报 TS2339。
 * 此类型通过索引签名允许任意字段访问（值类型为 any），同时保留 Model 内置方法类型，
 * 在保证运行时安全（全部由 Sequelize ORM 参数化）的前提下消除类型错误。
 *
 * 后续重构时，可逐步为核心模型定义精确的 Attributes 接口，替换此宽松类型。
 */
export type AnyModel = Model<Record<string, any>, Record<string, any>> & {
  [key: string]: any
}

export type AnyModelStatic = ModelStatic<AnyModel>
