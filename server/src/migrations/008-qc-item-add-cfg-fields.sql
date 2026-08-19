-- ============================================================
-- 检验数据统一存储改造（回填阶段）迁移脚本 008
-- 目的：让旧检验单（阶段2迁移而来，item_cfg_id 为空，缺 item_type/limit 等配置）
--       的 qc_inspection_item 行也能正确驱动 InspectionItemEditor 渲染定量录入界面
--
-- 步骤：
-- 1. 扩展 qc_inspection_item 加 5 个配置字段（与 quality_inspection_standard_item 同构）
-- 2. 优先回填：item_cfg_id 非空时，直接 JOIN 检验标准子表同步配置
-- 3. 兜底回填：item_cfg_id 为空时，通过 source_type + inspection_id 反查主表 standard_id
--    再用 standard_id + item_name 匹配检验标准子表
-- 4. 启发式兜底：仍未匹配且 standard_value 含数字 ± → quantitative
-- ============================================================

-- 1. 扩展 qc_inspection_item 表
ALTER TABLE qc_inspection_item
  ADD COLUMN item_type VARCHAR(20) NULL COMMENT '项目类型：qualitative定性/quantitative定量' AFTER unit,
  ADD COLUMN need_sample_count INT NOT NULL DEFAULT 0 COMMENT '默认抽样数（来自检验标准）' AFTER item_type,
  ADD COLUMN nominal_value DECIMAL(15,4) NULL COMMENT '标称值（定量用，来自检验标准）' AFTER need_sample_count,
  ADD COLUMN upper_limit DECIMAL(15,4) NULL COMMENT '上限（定量用，来自检验标准）' AFTER nominal_value,
  ADD COLUMN lower_limit DECIMAL(15,4) NULL COMMENT '下限（定量用，来自检验标准）' AFTER upper_limit;

-- 2. 回填：优先用 item_cfg_id 直接 JOIN
UPDATE qc_inspection_item qci
JOIN quality_inspection_standard_item si ON si.item_id = qci.item_cfg_id
SET
  qci.item_type        = IFNULL(qci.item_type, si.item_type),
  qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si.need_sample_count),
  qci.nominal_value    = IFNULL(qci.nominal_value, si.nominal_value),
  qci.upper_limit      = IFNULL(qci.upper_limit, si.upper_limit),
  qci.lower_limit      = IFNULL(qci.lower_limit, si.lower_limit)
WHERE qci.item_type IS NULL
   OR qci.nominal_value IS NULL
   OR qci.upper_limit IS NULL
   OR qci.lower_limit IS NULL;

-- 3. 兜底回填：来料
UPDATE qc_inspection_item qci
JOIN quality_incoming_inspection ii
  ON ii.inspection_id = qci.inspection_id AND qci.source_type = '来料'
JOIN (
  SELECT MIN(item_id) AS min_item_id, standard_id, item_name
  FROM quality_inspection_standard_item
  GROUP BY standard_id, item_name
) si ON si.standard_id = ii.standard_id AND si.item_name = qci.item_name
JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
SET
  qci.item_cfg_id      = IFNULL(qci.item_cfg_id, si_full.item_id),
  qci.item_type        = IFNULL(qci.item_type, si_full.item_type),
  qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
  qci.nominal_value    = IFNULL(qci.nominal_value, si_full.nominal_value),
  qci.upper_limit      = IFNULL(qci.upper_limit, si_full.upper_limit),
  qci.lower_limit      = IFNULL(qci.lower_limit, si_full.lower_limit)
WHERE qci.item_cfg_id IS NULL;

-- 3.1 兜底回填：产品
UPDATE qc_inspection_item qci
JOIN quality_product_inspection pi
  ON pi.inspection_id = qci.inspection_id AND qci.source_type = '产品'
JOIN (
  SELECT MIN(item_id) AS min_item_id, standard_id, item_name
  FROM quality_inspection_standard_item
  GROUP BY standard_id, item_name
) si ON si.standard_id = pi.standard_id AND si.item_name = qci.item_name
JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
SET
  qci.item_cfg_id      = IFNULL(qci.item_cfg_id, si_full.item_id),
  qci.item_type        = IFNULL(qci.item_type, si_full.item_type),
  qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
  qci.nominal_value    = IFNULL(qci.nominal_value, si_full.nominal_value),
  qci.upper_limit      = IFNULL(qci.upper_limit, si_full.upper_limit),
  qci.lower_limit      = IFNULL(qci.lower_limit, si_full.lower_limit)
WHERE qci.item_cfg_id IS NULL;

-- 3.2 兜底回填：微生物
UPDATE qc_inspection_item qci
JOIN quality_microbe_inspection mi
  ON mi.inspection_id = qci.inspection_id AND qci.source_type = '微生物'
JOIN (
  SELECT MIN(item_id) AS min_item_id, standard_id, item_name
  FROM quality_inspection_standard_item
  GROUP BY standard_id, item_name
) si ON si.standard_id = mi.standard_id AND si.item_name = qci.item_name
JOIN quality_inspection_standard_item si_full ON si_full.item_id = si.min_item_id
SET
  qci.item_cfg_id      = IFNULL(qci.item_cfg_id, si_full.item_id),
  qci.item_type        = IFNULL(qci.item_type, si_full.item_type),
  qci.need_sample_count = IFNULL(NULLIF(qci.need_sample_count, 0), si_full.need_sample_count),
  qci.nominal_value    = IFNULL(qci.nominal_value, si_full.nominal_value),
  qci.upper_limit      = IFNULL(qci.upper_limit, si_full.upper_limit),
  qci.lower_limit      = IFNULL(qci.lower_limit, si_full.lower_limit)
WHERE qci.item_cfg_id IS NULL;

-- 4. 启发式兜底：未匹配到检验标准配置，但 standard_value 形如「数值 ± 数值」→ 视为定量
UPDATE qc_inspection_item
SET item_type = 'quantitative'
WHERE item_type IS NULL
  AND standard_value REGEXP '[0-9]';

-- 5. 最终兜底：仍无 item_type → 默认定性（避免前端 NULL）
UPDATE qc_inspection_item
SET item_type = 'qualitative'
WHERE item_type IS NULL;

-- ============================================================
-- 回滚脚本
-- ALTER TABLE qc_inspection_item
--   DROP COLUMN item_type,
--   DROP COLUMN need_sample_count,
--   DROP COLUMN nominal_value,
--   DROP COLUMN upper_limit,
--   DROP COLUMN lower_limit;
-- ============================================================
