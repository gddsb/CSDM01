/**
 * DeviceMaintenanceProfileService —— 保养档案模块入口
 *
 * 已按职责拆分为子模块：
 * - MaintenanceProfileCrud  档案 CRUD + 共享常量/辅助函数
 * - MaintenanceGenerator    工单生成 + 保养矩阵
 * - MaintenanceRecordCrud   执行记录 CRUD
 * - MaintenanceRuntime      运行时长 + 图片辅助 + 档案初始化
 *
 * 本文件仅做 re-export，保持外部 import 路径不变。
 */

// ---------- MaintenanceProfileCrud ----------
export {
  UNFINISHED_STATUS,
  rawStatus,
  loadDeviceFields,
  getLatestRuntime,
  getRecordDetail,
  listProfiles,
  listAvailableDevices,
  createProfile,
  detailProfile,
  updateProfileStatus,
  deleteProfile,
} from './MaintenanceProfileCrud.js'

// ---------- MaintenanceGenerator ----------
export { generateRecords, getMatrix } from './MaintenanceGenerator.js'

// ---------- MaintenanceRecordCrud ----------
export {
  listRecords,
  detailRecord,
  startRecord,
  submitRecord,
  batchSubmit,
  skipRecord,
  deleteRecord,
} from './MaintenanceRecordCrud.js'

// ---------- MaintenanceRuntime ----------
export {
  getImages,
  logRuntime,
  getRuntimeLog,
  initProfiles,
  uploadImageRecord,
  assertRecordExists,
  countImagesByRecord,
  findExistingImagesByRecord,
  createMaintenanceImage,
} from './MaintenanceRuntime.js'

// ---------- default export ----------
import * as all from './MaintenanceProfileCrud.js'
import * as gen from './MaintenanceGenerator.js'
import * as rec from './MaintenanceRecordCrud.js'
import * as rt from './MaintenanceRuntime.js'
export default {
  ...all,
  ...gen,
  ...rec,
  ...rt,
  getRuntimeLog: rt.getRuntimeLog,
}
