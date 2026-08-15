import { Model, type ModelAttributeColumnOptions, type ModelStatic, type InitOptions } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 带类型推导的模型定义辅助函数。
 *
 * 用法：
 *   interface UserAttributes { user_id: number; username: string; ... }
 *   const User = defineModel<UserAttributes>('User', { ... }, { tableName: 'sys_user' })
 *
 * 其中 attributes 通过 DataTypes 声明，运行时与 sequelize.define 完全一致，
 * 但返回的模型实例会带属性类型，消除 TS2339 错误。
 */
export function defineModel<TAttributes extends object, TCreationAttributes extends object = TAttributes>(
  modelName: string,
  attributes: Record<string, ModelAttributeColumnOptions | unknown>,
  options?: Omit<InitOptions<Model<TAttributes, TCreationAttributes>>, 'sequelize'>
): ModelStatic<Model<TAttributes, TCreationAttributes>> {
  return sequelize.define(
    modelName,
    attributes as Record<string, ModelAttributeColumnOptions>,
    { sequelize, ...options } as InitOptions<Model<TAttributes, TCreationAttributes>>
  ) as ModelStatic<Model<TAttributes, TCreationAttributes>>
}
