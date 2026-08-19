-- ============================================================
-- 检验数据统一存储改造迁移脚本（阶段1.4）
-- 1. 扩展 quality_inspection_standard_item 加5字段
-- 2. 新建 qc_inspection_item（统一子表，多态外键）
-- 3. 新建 qc_inspection_sample_value（样品测量值明细）
-- 注意：本脚本只建表/加字段，不迁移历史数据（阶段2单独做）
-- ============================================================

-- 1. 扩展检验标准项目表（配置层）
ALTER TABLE quality_inspection_standard_item
  ADD COLUMN item_type VARCHAR(20) NULL COMMENT '项目类型：qualitative定性/quantitative定量' AFTER inspection_types,
  ADD COLUMN need_sample_count INT NOT NULL DEFAULT 0 COMMENT '默认抽样数，0=不限制由实际抽样决定' AFTER item_type,
  ADD COLUMN nominal_value DECIMAL(15,4) NULL COMMENT '标称值（定量用）' AFTER need_sample_count,
  ADD COLUMN upper_limit DECIMAL(15,4) NULL COMMENT '上限（定量用，可空）' AFTER nominal_value,
  ADD COLUMN lower_limit DECIMAL(15,4) NULL COMMENT '下限（定量用，可空）' AFTER upper_limit;

-- 2. 新建统一检验子表（多态外键）
CREATE TABLE IF NOT EXISTS qc_inspection_item (
  item_id            INT PRIMARY KEY AUTO_INCREMENT COMMENT '统一检验项ID',
  source_type        VARCHAR(20) NOT NULL COMMENT '来源类型：来料/产品/微生物',
  inspection_id      INT NOT NULL COMMENT '多态外键，关联三主表inspection_id（无物理FK约束）',
  item_cfg_id        INT COMMENT '关联quality_inspection_standard_item.item_id（可空）',
  item_name          VARCHAR(200) NOT NULL COMMENT '检验项目名称',
  category           VARCHAR(50) COMMENT '项目大类',
  standard_value     VARCHAR(500) COMMENT '标准值（定性描述保留）',
  actual_value_text  VARCHAR(500) COMMENT '兼容旧数据/单值场景/定性值汇总',
  sample_count       INT COMMENT '实际抽样数',
  summary            VARCHAR(200) COMMENT '汇总如8件全合格',
  result             TINYINT COMMENT '0不合格/1合格',
  inspector_id       INT COMMENT '项目检验人ID',
  inspector_name     VARCHAR(50) COMMENT '冗余',
  inspection_time    DATETIME COMMENT '项目检验时间',
  unit               VARCHAR(20) COMMENT '单位',
  sort_order         INT NOT NULL DEFAULT 0 COMMENT '排序',
  remarks            VARCHAR(500) COMMENT '备注',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_qcii_source_inspection (source_type, inspection_id),
  INDEX idx_qcii_item_cfg (item_cfg_id),
  INDEX idx_qcii_result (result),
  INDEX idx_qcii_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验数据统一存储-检验子表（合并三子表）';

-- 3. 新建样品测量值明细表
CREATE TABLE IF NOT EXISTS qc_inspection_sample_value (
  value_id           INT PRIMARY KEY AUTO_INCREMENT COMMENT '测量值ID',
  item_id           INT NOT NULL COMMENT '关联qc_inspection_item.item_id',
  sample_no          INT NOT NULL COMMENT '样板序号1..N',
  dimension_code    VARCHAR(30) COMMENT '测量维度编码如D/d/b/H（单值时统一VALUE）',
  dimension_name    VARCHAR(100) COMMENT '维度名称',
  measure_value_num DECIMAL(15,4) COMMENT '定量值（可聚合，SPC用）',
  measure_value_text VARCHAR(50) COMMENT '定性值OK/NG/无缺口',
  is_qualified      TINYINT COMMENT '0不合格/1合格',
  defect_desc       VARCHAR(500) COMMENT '缺陷描述',
  measured_at       DATETIME COMMENT '测量时间',
  inspector_id      INT COMMENT '测量人ID',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_qcisv_item_sample_dim (item_id, sample_no, dimension_code),
  INDEX idx_qcisv_item (item_id),
  INDEX idx_qcisv_sample (sample_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验数据统一存储-样品测量值明细';

-- 4. 回滚脚本（如需回滚，执行以下语句，注意会丢失新表数据）
-- DROP TABLE IF EXISTS qc_inspection_sample_value;
-- DROP TABLE IF EXISTS qc_inspection_item;
-- ALTER TABLE quality_inspection_standard_item
--   DROP COLUMN item_type,
--   DROP COLUMN need_sample_count,
--   DROP COLUMN nominal_value,
--   DROP COLUMN upper_limit,
--   DROP COLUMN lower_limit;
