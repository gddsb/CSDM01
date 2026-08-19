-- ============================================================
-- 007: 检测仪器台账（quality_instrument）
-- 独立于 master_device，专用于质量检验仪器管理
-- ============================================================

CREATE TABLE IF NOT EXISTS `quality_instrument` (
  `instrument_id` INT NOT NULL AUTO_INCREMENT COMMENT '仪器ID',
  `instrument_no` VARCHAR(50) NOT NULL COMMENT '仪器编号（用户手动输入，生成后不可修改）',
  `instrument_name` VARCHAR(100) NOT NULL COMMENT '仪器名称',
  `instrument_model` VARCHAR(100) DEFAULT NULL COMMENT '型号',
  `precision` VARCHAR(50) DEFAULT NULL COMMENT '设备精度',
  `department` VARCHAR(50) DEFAULT NULL COMMENT '使用部门',
  `location` VARCHAR(100) DEFAULT NULL COMMENT '存放地点',
  `status` VARCHAR(20) NOT NULL DEFAULT '在用' COMMENT '状态：在用/停用',
  `calibration_type` VARCHAR(20) DEFAULT NULL COMMENT '校验类型：外校/内校/不需要校准',
  `calibration_cycle` INT DEFAULT NULL COMMENT '校准周期（天）',
  `last_calibration_date` DATE DEFAULT NULL COMMENT '上次校准日期',
  `next_calibration_date` DATE DEFAULT NULL COMMENT '下次校准日期',
  `remarks` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `supplier` VARCHAR(100) DEFAULT NULL COMMENT '供应商',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`instrument_id`),
  UNIQUE KEY `uk_instrument_no` (`instrument_no`),
  KEY `idx_instrument_name` (`instrument_name`),
  KEY `idx_instrument_status` (`status`),
  KEY `idx_instrument_dept` (`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测仪器台账';
