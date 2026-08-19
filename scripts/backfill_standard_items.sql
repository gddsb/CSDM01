-- 标准项目子表历史数据抽样字段回补：解决详情页抽样信息显示 "-" 需要手工重保存的问题
-- 1) sampling_plan 空 -> AQL抽样
UPDATE quality_inspection_standard_item SET sampling_plan = 'AQL抽样' WHERE sampling_plan IS NULL OR sampling_plan = '';

-- 2) AQL抽样：aql_value 默认 2.5 + need_sample_count 默认 20
UPDATE quality_inspection_standard_item SET sampling_detail = '{"aql_value":2.5}'
WHERE sampling_plan = 'AQL抽样' AND (sampling_detail IS NULL OR sampling_detail = '');

UPDATE quality_inspection_standard_item SET need_sample_count = COALESCE(need_sample_count, 20)
WHERE sampling_plan = 'AQL抽样' AND (need_sample_count IS NULL OR need_sample_count = 0);

-- 3) 固定数量抽样：默认 Ac=0 Re=1；need_sample_count 默认 5；最后生成 JSON sampling_detail
UPDATE quality_inspection_standard_item
SET accept_number = COALESCE(accept_number, 0),
    reject_number = COALESCE(reject_number, 1)
WHERE sampling_plan = '固定数量抽样';

UPDATE quality_inspection_standard_item
SET need_sample_count = CASE WHEN need_sample_count IS NULL OR need_sample_count = 0 THEN 5 ELSE need_sample_count END
WHERE sampling_plan = '固定数量抽样';

UPDATE quality_inspection_standard_item
SET sampling_detail = CONCAT('{"sample_count":', COALESCE(NULLIF(need_sample_count,0),5),
                        ',"accept_number":', COALESCE(accept_number, 0),
                        ',"reject_number":',  COALESCE(reject_number, 1), '}')
WHERE sampling_plan = '固定数量抽样' AND (sampling_detail IS NULL OR sampling_detail = '');

-- 4) 按数量抽样：默认一段 ≤100 / n=5 / Ac=0 / Re=1；need_sample_count 默认 5
UPDATE quality_inspection_standard_item
SET sampling_detail = '{"segments":[{"max_qty":100,"sample_count":5,"accept_number":0,"reject_number":1}]}'
WHERE sampling_plan = '按数量抽样' AND (sampling_detail IS NULL OR sampling_detail = '');

UPDATE quality_inspection_standard_item
SET need_sample_count = CASE WHEN need_sample_count IS NULL OR need_sample_count = 0 THEN 5 ELSE need_sample_count END
WHERE sampling_plan = '按数量抽样';

-- 5) 全检：note JSON
UPDATE quality_inspection_standard_item
SET sampling_detail = '{"note":"全检：100%逐件检验，任一NG整批拒收"}'
WHERE sampling_plan = '全检' AND (sampling_detail IS NULL OR sampling_detail = '');

-- 6) 项目类型：有上下限 -> quantitative；否则 qualitative
UPDATE quality_inspection_standard_item
SET item_type = CASE
  WHEN item_type IS NOT NULL AND item_type <> '' THEN item_type
  WHEN upper_limit IS NOT NULL OR lower_limit IS NOT NULL THEN 'quantitative'
  ELSE 'qualitative'
END
WHERE item_type IS NULL OR item_type = '';

-- 抽样分布查询（显示每个方案空/不空的数量）
SELECT '-- SUMMARY' AS step;
SELECT sampling_plan,
  COUNT(*) AS total,
  SUM(CASE WHEN sampling_detail IS NULL OR sampling_detail = '' THEN 1 ELSE 0 END) AS detail_empty,
  SUM(CASE WHEN need_sample_count IS NULL OR need_sample_count = 0 THEN 1 ELSE 0 END) AS need_sample_empty,
  SUM(CASE WHEN accept_number IS NULL THEN 1 ELSE 0 END) AS accept_empty,
  SUM(CASE WHEN reject_number IS NULL THEN 1 ELSE 0 END) AS reject_empty,
  SUM(CASE WHEN item_type IS NULL OR item_type = '' THEN 1 ELSE 0 END) AS type_empty
FROM quality_inspection_standard_item
GROUP BY sampling_plan;

SELECT '-- TOTALS' AS step;
SELECT COUNT(*) AS total_rows,
  SUM(CASE WHEN sampling_detail IS NULL OR sampling_detail = '' THEN 1 ELSE 0 END) AS detail_missing,
  SUM(CASE WHEN accept_number IS NULL THEN 1 ELSE 0 END) AS accept_missing,
  SUM(CASE WHEN reject_number IS NULL THEN 1 ELSE 0 END) AS reject_missing,
  SUM(CASE WHEN item_type IS NULL OR item_type = '' THEN 1 ELSE 0 END) AS type_missing
FROM quality_inspection_standard_item;
