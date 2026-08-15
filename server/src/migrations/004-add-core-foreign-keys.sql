-- 004 统一 material_id 字段类型并补全关键外键约束
-- 1. 将 production_process_material.bas_material_id 从 varchar(255) 收敛为 char(36)，并对齐 bas_material.material_id 的字符集/排序规则
ALTER TABLE production_process_material
  MODIFY COLUMN bas_material_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT '关联基础料品表ID';

-- 2. 补全核心外键（重复执行会报错，建议在迁移层通过 information_schema 判断后执行）
ALTER TABLE production_report_process
  ADD CONSTRAINT fk_rpp_process FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE production_process_defect
  ADD CONSTRAINT fk_ppd_process FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE production_process_material
  ADD CONSTRAINT fk_ppm_process FOREIGN KEY (process_id) REFERENCES master_process(process_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_ppm_bas_material FOREIGN KEY (bas_material_id) REFERENCES bas_material(material_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE production_process_exception
  ADD CONSTRAINT fk_ppe_report FOREIGN KEY (report_order_id) REFERENCES production_report_order(report_order_id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE production_report_order
  ADD CONSTRAINT fk_pro_line FOREIGN KEY (line_id) REFERENCES master_production_line(line_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE master_device
  ADD CONSTRAINT fk_device_line FOREIGN KEY (line_id) REFERENCES master_production_line(line_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE quality_microbe_inspection
  ADD CONSTRAINT fk_micro_order FOREIGN KEY (order_id) REFERENCES production_order(order_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_micro_report FOREIGN KEY (report_order_id) REFERENCES production_report_order(report_order_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sys_operation_log
  ADD CONSTRAINT fk_oplog_user FOREIGN KEY (user_id) REFERENCES sys_user(user_id) ON DELETE CASCADE ON UPDATE CASCADE;
