/**
 * DatabaseMigrationService —— 数据库迁移模块入口
 *
 * 已按职责拆分为子模块：
 * - MigrationMeta    静态元数据（表分类 + 列注释）
 * - MigrationWorker   表结构采集 + .env 读写 + 迁移执行
 *
 * 本文件仅做 re-export，保持外部 import 路径不变。
 */
export { tableCategoryMap, columnCommentMap, type CollectSchemaOptions } from './MigrationMeta.js'
export {
  collectDatabaseSchema,
  getMigrationTargets,
  migrateDatabase,
} from './MigrationWorker.js'
