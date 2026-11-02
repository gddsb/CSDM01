-- 013 — 保养性能索引 + 分配人员字段
-- 用途：
--   1. device_record 全量列表按 device_id/trigger_mode/period_key 分组排序 → 加覆盖索引
--   2. device_standard 加责任人/检查人分配字段（会话 1 丢失的 commit 919ea6e2 里要加的）

-- 1. device_record 性能索引（listRecords 排序直接命中，避免 filesort）
ALTER TABLE `device_record`
  ADD INDEX IF NOT EXISTS `idx_device_tm_pk` (`device_id`, `trigger_mode`, `period_key`);

-- 2. device_standard 加分配字段
ALTER TABLE `device_standard`
  ADD COLUMN `assigned_user_ids` JSON NULL COMMENT '责任人ID数组' AFTER `inspection_roles`,
  ADD COLUMN `assigned_user_names` VARCHAR(500) NULL COMMENT '责任人姓名（冗余，展示用）' AFTER `assigned_user_ids`,
  ADD COLUMN `inspector_user_ids` JSON NULL COMMENT '检查人ID数组' AFTER `assigned_user_names`,
  ADD COLUMN `inspector_user_names` VARCHAR(500) NULL COMMENT '检查人姓名（冗余，展示用）' AFTER `inspector_user_ids`;
