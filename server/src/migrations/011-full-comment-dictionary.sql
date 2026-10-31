-- ========================================================
-- 011-full-comment-dictionary.sql
-- 全库表/字段 COMMENT 补齐脚本
-- 来源：从 69 个 Sequelize Model 自动解析生成
-- 特点：MODIFY COLUMN 完整保留 NOT NULL/DEFAULT/PK/AI 等原始约束
-- 注意：执行前请备份，建议低峰期分批执行
-- ========================================================

SET FOREIGN_KEY_CHECKS = 0;


-- === bas_customer (Customer.ts) ===
ALTER TABLE `bas_customer` COMMENT = '客户档案表：存储企业客户基础信息、联系方式、信用/税务信息';
ALTER TABLE `bas_customer` MODIFY COLUMN `customer_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '客户ID（主键）';
ALTER TABLE `bas_customer` MODIFY COLUMN `customer_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_bas_customer_customer_code` (`customer_code`) COMMENT '客户编号（如 C001 / C002，不强制业务编号生成器，便于直接录入）';
ALTER TABLE `bas_customer` MODIFY COLUMN `customer_name` VARCHAR(200) NOT NULL COMMENT '客户全称（营业执照上的公司全称）';
ALTER TABLE `bas_customer` MODIFY COLUMN `short_name` VARCHAR(100) COMMENT '客户简称（设计文档字段名 customer_short_name，前端下拉常用简称）';
ALTER TABLE `bas_customer` MODIFY COLUMN `customer_category` VARCHAR(50) COMMENT '客户分类（如 奶粉罐 / 蛋白粉罐 / 废品回收 / 其它粉罐 / 内部客户）';
ALTER TABLE `bas_customer` MODIFY COLUMN `customer_type` VARCHAR(50) COMMENT '客户分类标签（自定义标签，如 VIP / 战略 / 普通）';
ALTER TABLE `bas_customer` MODIFY COLUMN `contact_person` VARCHAR(50) COMMENT '主要联系人姓名';
ALTER TABLE `bas_customer` MODIFY COLUMN `phone` VARCHAR(50) COMMENT '联系电话（设计文档字段名 contact_phone，手机/座机均可）';
ALTER TABLE `bas_customer` MODIFY COLUMN `email` VARCHAR(100) COMMENT '电子邮箱';
ALTER TABLE `bas_customer` MODIFY COLUMN `address` VARCHAR(300) COMMENT '联系地址（详细地址，含省市区）';
ALTER TABLE `bas_customer` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '启用状态：1=启用（可用于新建订单）, 0=停用（历史数据保留）';
ALTER TABLE `bas_customer` MODIFY COLUMN `effective_date` DATE COMMENT '客户档案生效日期（YYYY-MM-DD）';
ALTER TABLE `bas_customer` MODIFY COLUMN `expiry_date` DATE COMMENT '客户档案失效日期（有效期截止）';
ALTER TABLE `bas_customer` MODIFY COLUMN `credit_level` VARCHAR(20) COMMENT '信用等级（如 A / B / C / D，用于销售额度管控）';
ALTER TABLE `bas_customer` MODIFY COLUMN `tax_id` VARCHAR(50) COMMENT '纳税人识别号/统一社会信用代码';
ALTER TABLE `bas_customer` MODIFY COLUMN `bank_account` VARCHAR(50) COMMENT '对公银行账号（用于开票/付款）';
ALTER TABLE `bas_customer` MODIFY COLUMN `bank_name` VARCHAR(100) COMMENT '开户银行全称';
ALTER TABLE `bas_customer` MODIFY COLUMN `remark` VARCHAR(500) COMMENT '备注说明（设计文档字段名 remarks，如特殊条款、合作背景等）';
ALTER TABLE `bas_customer` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（客户列表默认排序，数值小排前）';
ALTER TABLE `bas_customer` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（操作人 username）';

-- === sys_data_dictionary (DataDictionary.ts) ===
ALTER TABLE `sys_data_dictionary` COMMENT = '数据字典登记表：登记各业务表的用途、字段元信息';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `dict_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '登记记录ID（主键）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `table_name` VARCHAR(100) NOT NULL UNIQUE KEY `uk_sys_data_dictionary_table_name` (`table_name`) COMMENT '表名（对应 MySQL 中的物理表名，如 device_fault）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `category` VARCHAR(50) NOT NULL DEFAULT '业务表' COMMENT '表分类（如 业务表 / 系统表 / U9同步表 / 日志表）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `purpose` VARCHAR(500) COMMENT '表用途说明（一句话描述本表的业务职责）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `field_count` INT DEFAULT 0 COMMENT '字段数量（冗余，便于快速统计）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `record_count` INT DEFAULT 0 COMMENT '记录行数（冗余，最后一次统计时的行数快照）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `fields` TEXT COMMENT '字段详情（JSON 数组，每项含 {name,type,comment,is_nullable,is_pk}）';
ALTER TABLE `sys_data_dictionary` MODIFY COLUMN `last_update` DATETIME COMMENT '上次刷新统计时间（field_count / record_count 何时更新）';

-- === master_defect_image (DefectImage.ts) ===
ALTER TABLE `master_defect_image` COMMENT = '不良图片表：存储每个不良分类/不良项的现场照片、标注图';
ALTER TABLE `master_defect_image` MODIFY COLUMN `image_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '图片ID（主键，不良项配图）';
ALTER TABLE `master_defect_image` MODIFY COLUMN `defect_id` INT NOT NULL COMMENT '关联不良项ID';
ALTER TABLE `master_defect_image` MODIFY COLUMN `image_url` VARCHAR(255) NOT NULL COMMENT '图片访问路径';
ALTER TABLE `master_defect_image` MODIFY COLUMN `image_name` VARCHAR(255) NOT NULL COMMENT '重命名后的文件名（不良编码+两位流水码）';
ALTER TABLE `master_defect_image` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序号';
ALTER TABLE `master_defect_image` MODIFY COLUMN `file_hash` VARCHAR(64) COMMENT '文件MD5哈希值，用于去重';

-- === master_defect_type (DefectType.ts) ===
ALTER TABLE `master_defect_type` COMMENT = '不良分类主数据表：定义质量不良分类（支持树形结构，被报工/投诉等引用）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `defect_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '不良分类ID（主键）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `defect_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_master_defect_type_defect_code` (`defect_code`) COMMENT '不良分类编码（英文唯一标识，如 DEF-SCRATCH / DEF-CRACK）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `defect_name` VARCHAR(100) NOT NULL COMMENT '不良分类名称（中文显示名，如 划痕 / 裂纹 / 色偏）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `defect_type` VARCHAR(50) COMMENT '不良大类/类型（如 外观 / 尺寸 / 重量 / 材质 / 印刷）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `category_name` VARCHAR(50) COMMENT '所属分类名（冗余，与 parent_id 配合构建分类层级）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `parent_id` INT DEFAULT 0 COMMENT '上级分类ID（自关联，0=顶级分类，形成树形结构）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `defect_unit` VARCHAR(20) COMMENT '默认计量单位（如 个 / 件 / % / mg）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `available_units` VARCHAR(255) COMMENT '可选计量单位列表（逗号分隔，如 ';
ALTER TABLE `master_defect_type` MODIFY COLUMN `display` TINYINT(1) DEFAULT 1 COMMENT '前端是否显示：true=显示（报工不良时可选）, false=隐藏（已废弃）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（同级数值小排前）';
ALTER TABLE `master_defect_type` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：1=启用（可用于新建不良记录）, 0=停用';
ALTER TABLE `master_defect_type` MODIFY COLUMN `related_processes` VARCHAR(255) COMMENT '关联工序ID列表（逗号分隔，如 ';
ALTER TABLE `master_defect_type` MODIFY COLUMN `category_desc` VARCHAR(500) COMMENT '分类详细说明（描述该不良分类包含哪些具体不良现象）';

-- === master_device (Device.ts) ===
ALTER TABLE `master_device` COMMENT = '设备/仪器主数据表：统一管理生产设备和检测仪器基础信息';
ALTER TABLE `master_device` MODIFY COLUMN `device_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '设备ID（主键，与 Instrument / 其他资产表共用）';
ALTER TABLE `master_device` MODIFY COLUMN `entity_type` ENUM('设备', '仪器') NOT NULL DEFAULT '设备' COMMENT '资产类型：设备=生产设备, 仪器=检测仪器';
ALTER TABLE `master_device` MODIFY COLUMN `device_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_master_device_device_code` (`device_code`) COMMENT '资产编号（系统内唯一，如 EQ-PRESS-001 / INS-CALI-015）';
ALTER TABLE `master_device` MODIFY COLUMN `device_name` VARCHAR(100) NOT NULL COMMENT '资产名称（中文显示名，如 1# 冲压机 / 数显卡尺-015）';
ALTER TABLE `master_device` MODIFY COLUMN `device_type` VARCHAR(50) COMMENT '资产类型/大类（如 冲压机 / 印刷机 / 灌装机 / 计量仪器）';
ALTER TABLE `master_device` MODIFY COLUMN `device_model` VARCHAR(100) COMMENT '型号规格（设备/仪器出厂型号，如 AIDA-2000）';
ALTER TABLE `master_device` MODIFY COLUMN `serial_no` VARCHAR(100) COMMENT '出厂序列号（厂家生产 SN，用于溯源）';
ALTER TABLE `master_device` MODIFY COLUMN `location` VARCHAR(100) COMMENT '放置位置（车间/工位，如 冲压车间 1#工位）';
ALTER TABLE `master_device` MODIFY COLUMN `line_id` INT COMMENT '所属产线ID（关联 master_production_line.line_id）';
ALTER TABLE `master_device` MODIFY COLUMN `responsible_person` VARCHAR(50) COMMENT '责任人/保管人（员工姓名）';
ALTER TABLE `master_device` MODIFY COLUMN `is_special` TINYINT(1) DEFAULT 0 COMMENT '是否特殊/关键设备：true=是（需重点维护和校准）, false=否';
ALTER TABLE `master_device` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '资产状态：1=正常（在用）, 0=停用, 2=维修中';
ALTER TABLE `master_device` MODIFY COLUMN `last_inspection_date` DATE COMMENT '上次点检/保养日期（DATEONLY 格式 YYYY-MM-DD）';
ALTER TABLE `master_device` MODIFY COLUMN `inspection_cycle` VARCHAR(50) COMMENT '点检/保养周期（如 每日 / 每周 / 每月 / 每季度 / 每半年）';
ALTER TABLE `master_device` MODIFY COLUMN `next_inspection_date` DATE COMMENT '下次应点检/保养日期（系统自动计算，也可手动调整）';
ALTER TABLE `master_device` MODIFY COLUMN `precision` VARCHAR(50) COMMENT '精度要求（仅仪器有值，如 ±0.01mm / ±1%FS）';
ALTER TABLE `master_device` MODIFY COLUMN `department` VARCHAR(50) COMMENT '所属部门（如 冲压车间 / 质量部 / 研发中心）';
ALTER TABLE `master_device` MODIFY COLUMN `calibration_type` VARCHAR(20) COMMENT '校准类型：外校=第三方机构 / 内校=内部校准 / 不需要校准';
ALTER TABLE `master_device` MODIFY COLUMN `calibration_cycle` INT COMMENT '校准周期（天，如 365=每年校准一次）';
ALTER TABLE `master_device` MODIFY COLUMN `last_calibration_date` DATE COMMENT '上次校准完成日期';
ALTER TABLE `master_device` MODIFY COLUMN `next_calibration_date` DATE COMMENT '下次应校准日期（到期前系统提醒）';
ALTER TABLE `master_device` MODIFY COLUMN `supplier` VARCHAR(100) COMMENT '供应商名称（购置渠道）';
ALTER TABLE `master_device` MODIFY COLUMN `manufacturer` VARCHAR(100) COMMENT '生产厂家（设备/仪器制造商）';
ALTER TABLE `master_device` MODIFY COLUMN `purchase_date` DATE COMMENT '购置/入库日期';
ALTER TABLE `master_device` MODIFY COLUMN `warranty_end` DATE COMMENT '质保到期日（超期后维修费自理）';
ALTER TABLE `master_device` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注说明（其他需要记录的信息）';

-- === device_calibration_plan (DeviceCalibrationPlan.ts) ===
ALTER TABLE `device_calibration_plan` COMMENT = '设备/仪器校准计划表：管理每台资产的校准周期和计划状态';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `plan_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '校准计划ID（主键）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `asset_id` INT NOT NULL COMMENT '资产ID（关联 master_device.device_id，设备/仪器统一）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `asset_code` VARCHAR(50) COMMENT '资产编号（冗余，来自 master_device.device_code）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `asset_name` VARCHAR(100) COMMENT '资产名称（冗余，来自 master_device.device_name）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `calibration_cycle` INT NOT NULL COMMENT '校准周期（月，如 12=每年校准一次）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `last_calibration_date` DATE COMMENT '上次校准完成日期（从最新一条 CalibrationRecord 回填）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `next_calibration_date` DATE COMMENT '下次应校准日期（到期前系统提醒）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `calibration_org` VARCHAR(200) COMMENT '建议/默认校准机构（如 国家计量院 / 内部计量室）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `calibration_items` JSON COMMENT '校准项目明细（JSON 数组，每项含 {name, requirement, method}）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '计划状态：0=待校准, 1=已校准, 2=已超期, 3=已锁定（停用）';
ALTER TABLE `device_calibration_plan` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注说明（特殊校准要求等）';

-- === device_calibration_record (DeviceCalibrationRecord.ts) ===
ALTER TABLE `device_calibration_record` COMMENT = '设备/仪器校准执行记录表：记录每次校准结果、证书、费用等';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `record_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '校准记录ID（主键）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `plan_id` INT NOT NULL COMMENT '校准计划ID（关联 device_calibration_plan.plan_id）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `asset_id` INT COMMENT '资产ID（冗余，关联 master_device.device_id）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `asset_code` VARCHAR(50) COMMENT '资产编号（冗余，来自 master_device.device_code）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `asset_name` VARCHAR(100) COMMENT '资产名称（冗余，来自 master_device.device_name）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `calibration_date` DATE NOT NULL COMMENT '校准完成日期（YYYY-MM-DD）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `calibration_org` VARCHAR(200) COMMENT '实际校准机构名称（如 国家计量院 XX 分所）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `calibration_result` TINYINT NOT NULL COMMENT '校准结果：1=合格（出校准证书）, 2=不合格（需整改或报废）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `certificate_no` VARCHAR(100) COMMENT '校准证书编号（合格时由机构颁发的唯一编号）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `certificate_path` VARCHAR(500) COMMENT '校准证书文件存储路径（PDF 上传后归档位置）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `valid_until` DATE COMMENT '校准证书有效期（到期后需重新校准）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `cost` DECIMAL(12, 2) COMMENT '校准费用（元，用于成本核算）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `calibration_items` JSON COMMENT '实际校准项目结果（JSON 数组，每项含 {item_name, result, requirement}）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `operator_id` INT COMMENT '系统录入人ID（操作人，关联 sys_user.user_id）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `operator_name` VARCHAR(50) COMMENT '系统录入人姓名（冗余，方便查询）';
ALTER TABLE `device_calibration_record` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注说明（不合格时的整改情况等）';

-- === device_document (DeviceDocument.ts) ===
ALTER TABLE `device_document` COMMENT = '设备文档表：存储设备/仪器的说明书、合格证、校准证书等附件';
ALTER TABLE `device_document` MODIFY COLUMN `doc_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '文档ID';
ALTER TABLE `device_document` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID';
ALTER TABLE `device_document` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_document` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_document` MODIFY COLUMN `doc_type` VARCHAR(30) NOT NULL COMMENT '文档类型：factory/acceptance/external_repair/internal_repair/modification';
ALTER TABLE `device_document` MODIFY COLUMN `doc_name` VARCHAR(200) NOT NULL COMMENT '文档名称（如：使用说明书、合格证、维修报告）';
ALTER TABLE `device_document` MODIFY COLUMN `file_path` VARCHAR(500) NOT NULL COMMENT '文件存储路径';
ALTER TABLE `device_document` MODIFY COLUMN `file_format` VARCHAR(20) COMMENT '文件格式：pdf/doc/xlsx/jpg/png';
ALTER TABLE `device_document` MODIFY COLUMN `file_size` INT COMMENT '文件大小（字节）';
ALTER TABLE `device_document` MODIFY COLUMN `version` VARCHAR(20) DEFAULT 'v1' COMMENT '版本号';
ALTER TABLE `device_document` MODIFY COLUMN `related_order` VARCHAR(50) COMMENT '关联工单号（故障/维护/校准）';
ALTER TABLE `device_document` MODIFY COLUMN `valid_until` DATE COMMENT '有效期至（外保合同/质保截止）';
ALTER TABLE `device_document` MODIFY COLUMN `uploaded_by` INT COMMENT '上传人ID';
ALTER TABLE `device_document` MODIFY COLUMN `uploaded_by_name` VARCHAR(50) COMMENT '上传人姓名';
ALTER TABLE `device_document` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_fault (DeviceFault.ts) ===
ALTER TABLE `device_fault` COMMENT = '设备故障工单表：记录设备故障上报、派工、维修、审批全流程';
ALTER TABLE `device_fault` MODIFY COLUMN `fault_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '故障ID';
ALTER TABLE `device_fault` MODIFY COLUMN `fault_no` VARCHAR(50) UNIQUE KEY `uk_device_fault_fault_no` (`fault_no`) COMMENT '故障编号（前缀F+日期+序号）';
ALTER TABLE `device_fault` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID';
ALTER TABLE `device_fault` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_fault` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_fault` MODIFY COLUMN `fault_level` TINYINT DEFAULT 1 COMMENT '故障等级：1=一般, 2=严重, 3=紧急';
ALTER TABLE `device_fault` MODIFY COLUMN `fault_desc` TEXT NOT NULL COMMENT '故障现象描述';
ALTER TABLE `device_fault` MODIFY COLUMN `fault_time` DATETIME NOT NULL COMMENT '故障发生时间';
ALTER TABLE `device_fault` MODIFY COLUMN `impact_desc` VARCHAR(500) COMMENT '影响描述';
ALTER TABLE `device_fault` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待派工, 1=维修中, 2=待审批, 3=已关闭, 4=已挂起';
ALTER TABLE `device_fault` MODIFY COLUMN `reporter_id` INT COMMENT '上报人ID';
ALTER TABLE `device_fault` MODIFY COLUMN `reporter_name` VARCHAR(50) COMMENT '上报人姓名（冗余）';
ALTER TABLE `device_fault` MODIFY COLUMN `repairer_id` INT COMMENT '维修人ID';
ALTER TABLE `device_fault` MODIFY COLUMN `repairer_name` VARCHAR(50) COMMENT '维修人姓名（冗余）';
ALTER TABLE `device_fault` MODIFY COLUMN `assigned_time` DATETIME COMMENT '派工时间';
ALTER TABLE `device_fault` MODIFY COLUMN `repair_start_time` DATETIME COMMENT '维修开始时间';
ALTER TABLE `device_fault` MODIFY COLUMN `repair_end_time` DATETIME COMMENT '维修结束时间';
ALTER TABLE `device_fault` MODIFY COLUMN `approver_id` INT COMMENT '审批人ID';
ALTER TABLE `device_fault` MODIFY COLUMN `approver_name` VARCHAR(50) COMMENT '审批人姓名（冗余）';
ALTER TABLE `device_fault` MODIFY COLUMN `approve_time` DATETIME COMMENT '审批时间';
ALTER TABLE `device_fault` MODIFY COLUMN `approve_remark` VARCHAR(500) COMMENT '审批意见';
ALTER TABLE `device_fault` MODIFY COLUMN `source` VARCHAR(20) DEFAULT '手工' COMMENT '来源：手工上报/点检异常自动创建';
ALTER TABLE `device_fault` MODIFY COLUMN `related_inspection_id` INT COMMENT '关联点检记录ID（点检异常自动创建时）';
ALTER TABLE `device_fault` MODIFY COLUMN `closed_time` DATETIME COMMENT '关闭时间';
ALTER TABLE `device_fault` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_fault_repair (DeviceFaultRepair.ts) ===
ALTER TABLE `device_fault_repair` COMMENT = '设备维修详情表：记录每次故障维修的具体措施、更换备件、工时';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `repair_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '维修记录ID';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `fault_id` INT NOT NULL COMMENT '关联故障ID';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `fault_cause` TEXT COMMENT '故障原因分析';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `repair_plan` TEXT COMMENT '维修方案';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `repair_detail` TEXT COMMENT '维修过程详细记录';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `spare_parts_used` JSON COMMENT '使用备件列表JSON：[{spare_part_id, name, quantity, unit_price}]';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `spare_parts_cost` DECIMAL(12, 2) DEFAULT 0 COMMENT '备件费用合计';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `labor_hours` DECIMAL(8, 2) DEFAULT 0 COMMENT '维修工时（小时）';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `labor_rate` DECIMAL(10, 2) DEFAULT 0 COMMENT '人工时薪（元/小时）';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `labor_cost` DECIMAL(12, 2) DEFAULT 0 COMMENT '人工成本';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `external_cost` DECIMAL(12, 2) DEFAULT 0 COMMENT '外协费用';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `total_cost` DECIMAL(12, 2) DEFAULT 0 COMMENT '总维修成本（备件+人工+外协）';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `approve_status` TINYINT DEFAULT 0 COMMENT '审批状态：0=待审批, 1=已通过, 2=已驳回';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `approver_id` INT COMMENT '审批人ID';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `approver_name` VARCHAR(50) COMMENT '审批人姓名';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `approve_time` DATETIME COMMENT '审批时间';
ALTER TABLE `device_fault_repair` MODIFY COLUMN `approve_remark` VARCHAR(500) COMMENT '审批意见';

-- === device_image (DeviceImage.ts) ===
ALTER TABLE `device_image` COMMENT = '设备图片表：存储设备照片、故障现场照片等图片附件';
ALTER TABLE `device_image` MODIFY COLUMN `image_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '图片ID';
ALTER TABLE `device_image` MODIFY COLUMN `doc_type` VARCHAR(30) NOT NULL COMMENT '单据类型：fault/repair/inspection/maintenance/calibration';
ALTER TABLE `device_image` MODIFY COLUMN `doc_id` INT NOT NULL COMMENT '关联单据ID';
ALTER TABLE `device_image` MODIFY COLUMN `file_path` VARCHAR(500) NOT NULL COMMENT '文件存储路径';
ALTER TABLE `device_image` MODIFY COLUMN `file_name` VARCHAR(200) COMMENT '原始文件名';
ALTER TABLE `device_image` MODIFY COLUMN `file_size` INT COMMENT '文件大小（字节）';
ALTER TABLE `device_image` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `device_image` MODIFY COLUMN `uploaded_by` INT COMMENT '上传人ID';
ALTER TABLE `device_image` MODIFY COLUMN `uploaded_by_name` VARCHAR(50) COMMENT '上传人姓名';

-- === device_maintenance_profile (DeviceMaintenanceProfile.ts) ===
ALTER TABLE `device_maintenance_profile` COMMENT = '设备保养档案表：定义每台设备的保养标准和执行周期（多对一关联 Standard）';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `profile_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '档案ID';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `device_id` INT NOT NULL UNIQUE KEY `uk_device_maintenance_profile_device_id` (`device_id`) COMMENT '设备ID（唯一，一台设备一个档案）';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT '编制' COMMENT '档案状态：编制 / 生效 / 停用';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `version` INT DEFAULT 1 COMMENT '版本号，每次重新生效递增';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `effective_date` DATE COMMENT '生效日期';
ALTER TABLE `device_maintenance_profile` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_record (DeviceMaintenanceRecord.ts) ===
ALTER TABLE `device_record` COMMENT = '设备保养执行记录表：记录每次保养的实际执行人、时间、完成情况、发现问题等';
ALTER TABLE `device_record` MODIFY COLUMN `record_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '执行记录ID';
ALTER TABLE `device_record` MODIFY COLUMN `record_no` VARCHAR(50) UNIQUE KEY `uk_device_record_record_no` (`record_no`) COMMENT '记录编号（BM + YYYYMMDD + 3位序号，自动生成）';
ALTER TABLE `device_record` MODIFY COLUMN `standard_id` INT NOT NULL COMMENT '关联保养标准ID';
ALTER TABLE `device_record` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID';
ALTER TABLE `device_record` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_record` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_record` MODIFY COLUMN `trigger_mode` VARCHAR(20) NOT NULL COMMENT '执行时的触发频率快照：daily / weekly / monthly / runtime';
ALTER TABLE `device_record` MODIFY COLUMN `period_key` VARCHAR(30) NOT NULL COMMENT '周期键：日期/周号/月号，用于定位矩阵中的格子';
ALTER TABLE `device_record` MODIFY COLUMN `executor_id` INT COMMENT '执行人ID';
ALTER TABLE `device_record` MODIFY COLUMN `executor_name` VARCHAR(50) COMMENT '执行人姓名（冗余）';
ALTER TABLE `device_record` MODIFY COLUMN `start_time` DATETIME COMMENT '执行开始时间';
ALTER TABLE `device_record` MODIFY COLUMN `end_time` DATETIME COMMENT '执行结束时间';
ALTER TABLE `device_record` MODIFY COLUMN `duration_min` INT COMMENT '总耗时（分钟）';
ALTER TABLE `device_record` MODIFY COLUMN `actual_value` VARCHAR(200) COMMENT '实测值（定量型）';
ALTER TABLE `device_record` MODIFY COLUMN `result` VARCHAR(20) COMMENT '执行结果：正常 / 异常';
ALTER TABLE `device_record` MODIFY COLUMN `abnormal_desc` VARCHAR(500) COMMENT '异常描述（执行结果为异常时）';
ALTER TABLE `device_record` MODIFY COLUMN `spare_parts_used` JSON COMMENT '使用备件 JSON：[{name, quantity, unit_price}]';
ALTER TABLE `device_record` MODIFY COLUMN `maintenance_content` TEXT COMMENT '保养/维护内容记录';
ALTER TABLE `device_record` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待执行, 1=执行中, 2=已完成, 3=跳过';
ALTER TABLE `device_record` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_standard (DeviceMaintenanceStandard.ts) ===
ALTER TABLE `device_standard` COMMENT = '设备保养标准表：定义保养项目明细（如 润滑油更换 / 紧固螺丝 / 清洁过滤网）';
ALTER TABLE `device_standard` MODIFY COLUMN `standard_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '保养标准ID';
ALTER TABLE `device_standard` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID';
ALTER TABLE `device_standard` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_standard` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_standard` MODIFY COLUMN `mechanism` VARCHAR(50) COMMENT '机构（如：压缩机冷热机、散热机构）';
ALTER TABLE `device_standard` MODIFY COLUMN `component` VARCHAR(50) COMMENT '部件（如：交换管、过滤网）';
ALTER TABLE `device_standard` MODIFY COLUMN `location` VARCHAR(50) COMMENT '部位（如：排风扇、过滤网）';
ALTER TABLE `device_standard` MODIFY COLUMN `maintenance_method` VARCHAR(50) COMMENT '保养方法（如：定期点检、定期清理）';
ALTER TABLE `device_standard` MODIFY COLUMN `maintenance_content` TEXT COMMENT '保养内容描述';
ALTER TABLE `device_standard` MODIFY COLUMN `inspection_roles` JSON COMMENT '点检角色（多选，存角色名称数组）';
ALTER TABLE `device_standard` MODIFY COLUMN `judge_type` VARCHAR(20) DEFAULT '定性' COMMENT '判定方式：定性（正常/异常）、定量（数值范围）';
ALTER TABLE `device_standard` MODIFY COLUMN `standard_value` VARCHAR(200) COMMENT '判定基准（如：冷凝器两侧干净无绒毛飞絮、≤60℃）';
ALTER TABLE `device_standard` MODIFY COLUMN `unit` VARCHAR(30) COMMENT '单位';
ALTER TABLE `device_standard` MODIFY COLUMN `point_count` INT DEFAULT 1 COMMENT '保养点位件数';
ALTER TABLE `device_standard` MODIFY COLUMN `time_per_point` INT DEFAULT 0 COMMENT '单件保养时间（分钟）';
ALTER TABLE `device_standard` MODIFY COLUMN `trigger_mode` VARCHAR(20) NOT NULL DEFAULT 'daily' COMMENT '触发频率：daily / weekly / monthly / runtime';
ALTER TABLE `device_standard` MODIFY COLUMN `monthly_plan` JSON COMMENT '月度计划矩阵：12 位布尔数组 [true,false,...] 表示1月~12月哪些月执行（trigger_mode=monthly时有效）';
ALTER TABLE `device_standard` MODIFY COLUMN `runtime_threshold` DECIMAL(12, 2) COMMENT '运行时长阈值（小时，trigger_mode=runtime时有效）';
ALTER TABLE `device_standard` MODIFY COLUMN `last_trigger_value` VARCHAR(50) COMMENT '上次触发的时间点或累计时长值（用于判断下一次触发）';
ALTER TABLE `device_standard` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `device_standard` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：1启用, 0禁用';
ALTER TABLE `device_standard` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_runtime_log (DeviceRuntimeLog.ts) ===
ALTER TABLE `device_runtime_log` COMMENT = '设备运行时长日志表：按日记录每台设备的实际运行小时数';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `log_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编号（冗余）';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称（冗余）';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `runtime_hours` DECIMAL(12, 2) NOT NULL COMMENT '当前累计运行小时数（从设备面板读取）';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `previous_hours` DECIMAL(12, 2) COMMENT '上次记录的运行小时数';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `delta_hours` DECIMAL(12, 2) COMMENT '本次增量运行小时数';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `logged_by` INT COMMENT '录入人ID';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `logged_by_name` VARCHAR(50) COMMENT '录入人姓名';
ALTER TABLE `device_runtime_log` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_spare_part (DeviceSparePart.ts) ===
ALTER TABLE `device_spare_part` COMMENT = '备件档案表：管理设备可更换的零部件基础信息和库存';
ALTER TABLE `device_spare_part` MODIFY COLUMN `part_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '备件ID';
ALTER TABLE `device_spare_part` MODIFY COLUMN `part_code` VARCHAR(50) UNIQUE KEY `uk_device_spare_part_part_code` (`part_code`) COMMENT '备件编号';
ALTER TABLE `device_spare_part` MODIFY COLUMN `part_name` VARCHAR(200) NOT NULL COMMENT '备件名称';
ALTER TABLE `device_spare_part` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格型号';
ALTER TABLE `device_spare_part` MODIFY COLUMN `unit` VARCHAR(20) DEFAULT '个' COMMENT '单位';
ALTER TABLE `device_spare_part` MODIFY COLUMN `applicable_devices` JSON COMMENT '适用设备JSON：[{device_id, device_code, device_name}]';
ALTER TABLE `device_spare_part` MODIFY COLUMN `category` VARCHAR(50) COMMENT '备件分类：机械/电气/液压/气动/电子等';
ALTER TABLE `device_spare_part` MODIFY COLUMN `safety_stock_min` INT DEFAULT 0 COMMENT '安全库存下限';
ALTER TABLE `device_spare_part` MODIFY COLUMN `safety_stock_max` INT DEFAULT 0 COMMENT '安全库存上限';
ALTER TABLE `device_spare_part` MODIFY COLUMN `current_stock` INT DEFAULT 0 COMMENT '当前库存';
ALTER TABLE `device_spare_part` MODIFY COLUMN `warehouse` VARCHAR(50) COMMENT '仓库';
ALTER TABLE `device_spare_part` MODIFY COLUMN `shelf` VARCHAR(50) COMMENT '货架';
ALTER TABLE `device_spare_part` MODIFY COLUMN `layer` VARCHAR(20) COMMENT '层位';
ALTER TABLE `device_spare_part` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：1启用, 0禁用';
ALTER TABLE `device_spare_part` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === device_spare_part_log (DeviceSparePartLog.ts) ===
ALTER TABLE `device_spare_part_log` COMMENT = '备件出入库流水表：追溯备件每次入库/出库/调整操作';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `log_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '流水ID（主键）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `part_id` INT NOT NULL COMMENT '备件ID（关联 device_spare_part.part_id）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `part_code` VARCHAR(50) COMMENT '备件编号（冗余，来自 device_spare_part.part_code）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `part_name` VARCHAR(200) COMMENT '备件名称（冗余，来自 device_spare_part.part_name）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `log_type` VARCHAR(10) NOT NULL COMMENT '流水类型：in=入库, out=出库, adjust=库存调整';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `quantity` INT NOT NULL COMMENT '本次数量（出库为正数记录减少，入库为正数记录增加）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `unit_price` DECIMAL(12, 2) COMMENT '出入库时的单价（元，用于成本核算）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `total_price` DECIMAL(12, 2) COMMENT '总金额（= quantity × unit_price）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `supplier` VARCHAR(200) COMMENT '供应商名称（入库时记录供货方）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `purchase_no` VARCHAR(50) COMMENT '关联采购单号（入库时追溯采购单）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `related_order` VARCHAR(50) COMMENT '关联工单/维修单号（出库到某维修/保养工单时记录）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `operator_id` INT COMMENT '操作人ID（关联 sys_user.user_id）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `operator_name` VARCHAR(50) COMMENT '操作人姓名（冗余，方便查询）';
ALTER TABLE `device_spare_part_log` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注说明（调整原因、特殊说明等）';

-- === sys_dict_data (DictData.ts) ===
ALTER TABLE `sys_dict_data` COMMENT = '数据字典数据表：存放具体枚举值，如故障等级=一般/严重/紧急';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `dict_code` INT AUTO_INCREMENT PRIMARY KEY COMMENT '字典数据ID（主键）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `dict_sort` INT NOT NULL DEFAULT 0 COMMENT '字典项排序序号（同级按此排序显示）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `dict_label` VARCHAR(100) NOT NULL COMMENT '字典项显示标签（如 一般 / 严重 / 紧急，前端下拉/单选显示）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `dict_value` VARCHAR(100) NOT NULL COMMENT '字典项值（如 1 / 2 / 3，后端存储用的实际值）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `dict_type` VARCHAR(100) NOT NULL COMMENT '所属字典类型编码（关联 sys_dict_type.dict_type）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `css_class` VARCHAR(100) COMMENT '前端自定义 CSS 类名（用于特殊样式展示）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `list_class` VARCHAR(100) COMMENT '前端列表样式类名（如 ant-tag-red 标签色）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否该字典类型的默认选项：0=否, 1=是';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '字典项状态：1=启用, 0=禁用（禁用后前端不下发）';
ALTER TABLE `sys_dict_data` MODIFY COLUMN `remark` VARCHAR(500) COMMENT '备注说明';

-- === sys_dict_type (DictType.ts) ===
ALTER TABLE `sys_dict_type` COMMENT = '数据字典类型表：定义字典分类，如故障等级、工单状态等';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `dict_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '字典类型ID（主键）';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `dict_name` VARCHAR(100) NOT NULL COMMENT '字典类型中文名称（如 故障等级 / 工单状态）';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `dict_type` VARCHAR(100) NOT NULL UNIQUE KEY `uk_sys_dict_type_dict_type` (`dict_type`) COMMENT '字典类型编码（英文唯一标识，如 fault_level / order_status）';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '字典状态：1=启用, 0=禁用';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `remark` VARCHAR(500) COMMENT '备注说明（用途、与哪个业务模块关联等）';
ALTER TABLE `sys_dict_type` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（操作人 username）';

-- === task_energy_meter_data (EnergyMeterData.ts) ===
ALTER TABLE `task_energy_meter_data` COMMENT = '能源抄表数据表：水/电/气等能源仪表的周期性抄表记录';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY;
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `task_setting_id` INT COMMENT '关联任务设置ID';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `reading_date` DATETIME NOT NULL COMMENT '采集时间';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `device_addr` VARCHAR(50) COMMENT '通讯地址';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '电表名称';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `forward_active_energy` DECIMAL(18, 4) COMMENT '正向有功总电能(kWh)';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `forward_reactive_energy` DECIMAL(18, 4) COMMENT '正向无功总电能(kvarh)';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `reverse_active_energy` DECIMAL(18, 4) COMMENT '反向有功总电能(kWh)';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `reverse_reactive_energy` DECIMAL(18, 4) COMMENT '反向无功总电能(kvarh)';
ALTER TABLE `task_energy_meter_data` MODIFY COLUMN `raw_data` TEXT COMMENT '原始数据片段(调试用)';

-- === task_env_alarm_record (EnvAlarm.ts) ===
ALTER TABLE `task_env_alarm_record` COMMENT = '环境报警记录表：环境参数超阈值时自动触发或手动登记的报警';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `alarm_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '报警记录ID（主键）';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `factor_id` VARCHAR(50) NOT NULL COMMENT '因子ID';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `device_addr` INT NOT NULL COMMENT '设备地址';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `device_name` VARCHAR(200) COMMENT '设备名称';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `node_id` INT NOT NULL COMMENT '节点ID';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `register_id` INT NOT NULL COMMENT '寄存器ID';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `factor_name` VARCHAR(100) NOT NULL COMMENT '因子名称';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `alarm_info` VARCHAR(500) NOT NULL COMMENT '报警信息';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `alarm_level` INT NOT NULL COMMENT '报警级别';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `alarm_range` VARCHAR(100) COMMENT '报警限值';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `current_value` DOUBLE COMMENT '当前报警值';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `unit` VARCHAR(20) COMMENT '单位';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `alarm_time` DATETIME NOT NULL COMMENT '报警时间';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `is_handled` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已处理：0-未处理 1-已处理';
ALTER TABLE `task_env_alarm_record` MODIFY COLUMN `handle_msg` VARCHAR(500) COMMENT '处理意见';

-- === task_env_monitor_data (EnvMonitor.ts) ===
ALTER TABLE `task_env_monitor_data` COMMENT = '环境监测点数据表：各监测点（温湿度传感器）的周期采样值';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `monitor_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '监测记录ID（主键）';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `factor_id` VARCHAR(50) NOT NULL COMMENT '因子ID';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `device_addr` INT NOT NULL COMMENT '设备地址';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `device_name` VARCHAR(200) COMMENT '设备名称';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `node_id` INT NOT NULL COMMENT '节点ID';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `register_id` INT NOT NULL COMMENT '寄存器ID';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `factor_name` VARCHAR(100) NOT NULL COMMENT '因子名称';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `value` DOUBLE COMMENT '当前值';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `raw_data` VARCHAR(50) COMMENT '原始数据';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `unit` VARCHAR(20) COMMENT '单位';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `coefficient` FLOAT COMMENT '系数';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `device_status` VARCHAR(20) COMMENT '设备状态';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `collect_time` DATETIME NOT NULL COMMENT '采集时间(平台时间戳)';
ALTER TABLE `task_env_monitor_data` MODIFY COLUMN `data_time` DATETIME COMMENT '数据时间(系统采集时间)';

-- === quality_incoming_inspection (IncomingInspection.ts) ===
ALTER TABLE `quality_incoming_inspection` COMMENT = '来料检验单表：记录对供应商来料的检验结果、合格判定、让步接收等';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `inspection_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '来料检验ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `inspection_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_quality_incoming_inspection_inspection_no` (`inspection_no`) COMMENT '检验编号（前缀LL+日期+序号）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `supplier_id` INT COMMENT '供应商ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `supplier_name` VARCHAR(200) COMMENT '供应商名称（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `supplier_code` VARCHAR(50) COMMENT '供应商编码（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料号（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '料品名称（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `supplier_batch_no` VARCHAR(50) COMMENT '供应商批次号';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `internal_batch_no` VARCHAR(50) COMMENT '内部批次号';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `quantity` DECIMAL(15, 4) COMMENT '到货数量';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `arrival_date` DATETIME COMMENT '到货日期';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `receipt_id` INT COMMENT '关联采购收货采集表ID（task_purchase_receipt.receipt_id）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `receipt_no` VARCHAR(100) COMMENT '采购收货单号（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `line_no` VARCHAR(50) COMMENT '采购收货单行号（冗余，用于与 receipt_no 构成唯一标识）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `receipt_status` VARCHAR(100) COMMENT '采购收货单据状态（冗余，如业务关闭/开立/审核等）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `standard_id` INT COMMENT '关联检验标准ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `standard_name` VARCHAR(200) COMMENT '检验标准名称（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `result` VARCHAR(20) COMMENT '总结果：合格/不合格';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `handle_type` VARCHAR(50) COMMENT '处理方式';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `handle_reason` VARCHAR(500) COMMENT '处理原因';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `trigger_type` VARCHAR(20) DEFAULT '手工' COMMENT '触发方式：自动/手工';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待检, 1=检验中, 2=审核中, 3=已完成, 4=已关闭';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `inspector_id` INT COMMENT '检验人ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '检验人姓名（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `reviewer_id` INT COMMENT '审核人ID';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `reviewer_name` VARCHAR(50) COMMENT '审核人姓名（冗余）';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `inspection_time` DATETIME COMMENT '检验时间';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `review_time` DATETIME COMMENT '审核时间';
ALTER TABLE `quality_incoming_inspection` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === quality_inspection_standard (InspectionStandard.ts) ===
ALTER TABLE `quality_inspection_standard` COMMENT = '检验方案主表：定义某类检验的总体要求（关联 StandardItem 明细）';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `standard_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '检验标准ID';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `standard_no` VARCHAR(50) NOT NULL COMMENT '标准编号';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `standard_name` VARCHAR(200) NOT NULL COMMENT '标准名称';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `inspection_type` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '检验类型：首件/制程/成品/其它（已废弃，移至子表 inspection_types）';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `standard_type` VARCHAR(20) NOT NULL COMMENT '标准类型：材料检验/产品检验/环境检验/微生物检验标准/其它检验';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `inspection_plan` VARCHAR(50) COMMENT '检验方案：逐批计数抽样/连续生产抽样/孤立批抽样/全检不抽样';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `customer_code` VARCHAR(50) COMMENT '客户编码';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `material_id` CHAR(36) COMMENT '参照料品ID';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '料品名称（冗余）';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `version_no` VARCHAR(20) DEFAULT 'V1' COMMENT '版本号';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `effective_date` DATETIME COMMENT '生效日期';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `expiry_date` DATETIME COMMENT '失效日期';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `status` VARCHAR(20) DEFAULT '开立' COMMENT '状态：开立/生效/失效';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `created_by` INT COMMENT '创建人ID';
ALTER TABLE `quality_inspection_standard` MODIFY COLUMN `description` VARCHAR(500) COMMENT '描述';

-- === quality_inspection_standard_item (InspectionStandardItem.ts) ===
ALTER TABLE `quality_inspection_standard_item` COMMENT = '检验方案明细表：定义每个检验项目的标准值、公差、检测方法';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `item_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '检验标准项目ID';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `standard_id` INT NOT NULL COMMENT '关联检验标准ID';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `item_name` VARCHAR(200) NOT NULL COMMENT '项目名称';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `category` VARCHAR(50) COMMENT '项目大类：外观/尺寸/性能/理化/微生物/环境';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `method` VARCHAR(200) COMMENT '检验方法';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `sampling_plan` VARCHAR(20) COMMENT '抽样方案：AQL抽样/按数量抽样/固定数量抽样/全检';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `sampling_detail` TEXT COMMENT '抽样方案详情JSON：AQL值/分段数量/固定数量/Ac/Re';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `standard_value` VARCHAR(200) NOT NULL COMMENT '标准值';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `unit` VARCHAR(20) COMMENT '单位';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `defect_level` VARCHAR(20) COMMENT '缺陷等级：A类致命缺陷、B类严重缺陷、C类次要缺陷';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `inspection_types` VARCHAR(200) COMMENT '检验类型（多选，逗号分隔：首件,制程,成品,来料,其它）';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `item_type` VARCHAR(20) COMMENT '项目类型：qualitative定性(仅判定OK/NG) / quantitative定量(记录测量数值)';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `upper_limit` DECIMAL(15, 4) COMMENT '上限（定量用，可空）';
ALTER TABLE `quality_inspection_standard_item` MODIFY COLUMN `lower_limit` DECIMAL(15, 4) COMMENT '下限（定量用，可空）';

-- === quality_instrument (Instrument.ts) ===
ALTER TABLE `quality_instrument` COMMENT = '检测仪器台账';
ALTER TABLE `quality_instrument` MODIFY COLUMN `instrument_id` INT AUTO_INCREMENT PRIMARY KEY;
ALTER TABLE `quality_instrument` MODIFY COLUMN `instrument_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_quality_instrument_instrument_no` (`instrument_no`) COMMENT '仪器编号（用户手动输入，生成后不可修改）';
ALTER TABLE `quality_instrument` MODIFY COLUMN `instrument_name` VARCHAR(100) NOT NULL COMMENT '仪器名称';
ALTER TABLE `quality_instrument` MODIFY COLUMN `instrument_model` VARCHAR(100) COMMENT '型号';
ALTER TABLE `quality_instrument` MODIFY COLUMN `precision` VARCHAR(50) COMMENT '设备精度';
ALTER TABLE `quality_instrument` MODIFY COLUMN `department` VARCHAR(50) COMMENT '使用部门';
ALTER TABLE `quality_instrument` MODIFY COLUMN `location` VARCHAR(100) COMMENT '存放地点';
ALTER TABLE `quality_instrument` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT '在用' COMMENT '状态：在用/停用';
ALTER TABLE `quality_instrument` MODIFY COLUMN `calibration_type` VARCHAR(20) COMMENT '校验类型：外校/内校/不需要校准';
ALTER TABLE `quality_instrument` MODIFY COLUMN `calibration_cycle` INT COMMENT '校准周期（天）';
ALTER TABLE `quality_instrument` MODIFY COLUMN `last_calibration_date` DATE COMMENT '上次校准日期';
ALTER TABLE `quality_instrument` MODIFY COLUMN `next_calibration_date` DATE COMMENT '下次校准日期';
ALTER TABLE `quality_instrument` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';
ALTER TABLE `quality_instrument` MODIFY COLUMN `supplier` VARCHAR(100) COMMENT '供应商';

-- === bas_line_device (LineDevice.ts) ===
ALTER TABLE `bas_line_device` COMMENT = '产线-设备关联表：配置某台设备在哪条产线上、承担哪个工序';
ALTER TABLE `bas_line_device` MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '关联记录ID（主键）';
ALTER TABLE `bas_line_device` MODIFY COLUMN `line_id` INT NOT NULL COMMENT '产线ID（关联 master_production_line.line_id）';
ALTER TABLE `bas_line_device` MODIFY COLUMN `device_id` INT NOT NULL COMMENT '设备ID（关联 device.device_id）';
ALTER TABLE `bas_line_device` MODIFY COLUMN `process_id` INT COMMENT '负责的工序ID（关联 master_process.process_id，可为空表示泛用设备）';
ALTER TABLE `bas_line_device` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（设备在产线上的展示顺序）';

-- === bas_line_process (LineProcess.ts) ===
ALTER TABLE `bas_line_process` COMMENT = '产线-工序关联表：配置柔性工艺路线（产线能执行哪些工序及顺序）';
ALTER TABLE `bas_line_process` MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '关联记录ID（主键）';
ALTER TABLE `bas_line_process` MODIFY COLUMN `line_id` INT NOT NULL COMMENT '产线ID（关联 master_production_line.line_id）';
ALTER TABLE `bas_line_process` MODIFY COLUMN `process_id` INT NOT NULL COMMENT '工序ID（关联 master_process.process_id）';
ALTER TABLE `bas_line_process` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '执行顺序号（同产线下数值小的工序先执行）';
ALTER TABLE `bas_line_process` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '启用状态：1=启用（该工序在产线上生效）, 0=停用';

-- === production_manpower_record (ManpowerRecord.ts) ===
ALTER TABLE `production_manpower_record` COMMENT = '生产报工人员工时记录表：记录每个报工单的出勤人员、班次、工时等';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `record_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID（主键，报工人员工时记录）';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `report_order_id` INT COMMENT '生产报工单ID';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `record_date` DATE COMMENT '记录日期';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `shift` VARCHAR(20) COMMENT '班次';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `start_time` DATETIME COMMENT '开始时间';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `end_time` DATETIME COMMENT '结束时间';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `hours` DECIMAL(10, 2) COMMENT '工时(MySQL STORED自动计算)';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `skilled_count` INT DEFAULT 0 COMMENT '熟手人数';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `general_count` INT DEFAULT 0 COMMENT '普工人数';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `labor_count` INT DEFAULT 0 COMMENT '劳务人数';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `other_count` INT DEFAULT 0 COMMENT '其他人数';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `total_people` INT DEFAULT 0 COMMENT '总人数';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `man_hours` DECIMAL(10, 2) COMMENT '人时(hours×人数, MySQL STORED自动计算)';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `record_user` VARCHAR(50) COMMENT '记录人';
ALTER TABLE `production_manpower_record` MODIFY COLUMN `record_user_name` VARCHAR(50) COMMENT '记录人姓名';

-- === bas_material (Material.ts) ===
ALTER TABLE `bas_material` COMMENT = '料品档案表：存储生产用物料/半成品基础信息（尺寸、重量、客户等）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_id` CHAR(36) PRIMARY KEY COMMENT '料品ID（UUID 主键，全局唯一）';
ALTER TABLE `bas_material` MODIFY COLUMN `category_name` VARCHAR(50) NOT NULL COMMENT '料品分类名称（如 盖罐头 / 底罐头 / 金属罐）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_bas_material_material_code` (`material_code`) COMMENT '料品编码（来自 U9，全系统唯一，如 P001234）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_name` VARCHAR(200) NOT NULL COMMENT '料品名称（规格化全称，如 375ml 铝制罐盖）';
ALTER TABLE `bas_material` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格型号（如 375ml / 500g / 标准型）';
ALTER TABLE `bas_material` MODIFY COLUMN `unit_name` VARCHAR(50) NOT NULL COMMENT '计量单位名称（如 个 / 罐 / 箱 / kg）';
ALTER TABLE `bas_material` MODIFY COLUMN `film_no` VARCHAR(50) COMMENT '菲林编号（印刷用菲林版号，来自 U9）';
ALTER TABLE `bas_material` MODIFY COLUMN `version_no` VARCHAR(50) COMMENT '版本号（料品设计变更版本，如 V1 / V2.1）';
ALTER TABLE `bas_material` MODIFY COLUMN `barcode` VARCHAR(100) COMMENT '料品条形码（生产追溯扫码用）';
ALTER TABLE `bas_material` MODIFY COLUMN `cutting_size` VARCHAR(50) COMMENT '裁剪尺寸（排版/开料参数，如 300×400mm）';
ALTER TABLE `bas_material` MODIFY COLUMN `printing_process` VARCHAR(50) COMMENT '印刷工艺（如 胶印 / 凹印 / 丝印 / 无印刷）';
ALTER TABLE `bas_material` MODIFY COLUMN `color_separation` VARCHAR(50) COMMENT '套色/色数（如 双色 / 四色 / 单色）';
ALTER TABLE `bas_material` MODIFY COLUMN `blanking_diameter` DECIMAL(11, 2) COMMENT '冲裁直径（mm，冲压工序关键工艺参数）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_thickness` DECIMAL(11, 2) COMMENT '材料厚度（mm，如 0.22 铝板厚度）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_width` DECIMAL(11, 2) COMMENT '材料宽度（mm，开料宽度）';
ALTER TABLE `bas_material` MODIFY COLUMN `material_height` DECIMAL(11, 2) COMMENT '材料高度/长度（mm，开料长度）';
ALTER TABLE `bas_material` MODIFY COLUMN `scrap_weight` DECIMAL(11, 2) COMMENT '单件废料重量（计算利用率/废料率用）';
ALTER TABLE `bas_material` MODIFY COLUMN `unit_weight` DECIMAL(11, 2) COMMENT '单件净重（生产核算用）';
ALTER TABLE `bas_material` MODIFY COLUMN `unit_volume` DECIMAL(11, 2) COMMENT '单件体积（包装/运输算量用）';
ALTER TABLE `bas_material` MODIFY COLUMN `weight_unit` VARCHAR(20) COMMENT '重量单位（如 g / kg）';
ALTER TABLE `bas_material` MODIFY COLUMN `volume_unit` VARCHAR(20) COMMENT '体积单位（如 cm³ / L）';
ALTER TABLE `bas_material` MODIFY COLUMN `inventory_category` VARCHAR(20) COMMENT '库存分类（如 原料 / 半成品 / 成品 / 辅料）';
ALTER TABLE `bas_material` MODIFY COLUMN `unit_code` VARCHAR(20) COMMENT '计量单位编码（对应单位字典表的 code）';
ALTER TABLE `bas_material` MODIFY COLUMN `customer_id` INT COMMENT '关联客户ID（关联 bas_customer.customer_id，定制料品归属客户）';
ALTER TABLE `bas_material` MODIFY COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：true=启用（可用于新建工单）, false=停用（历史数据保留）';
ALTER TABLE `bas_material` MODIFY COLUMN `effective_date` DATETIME NOT NULL COMMENT '生效日期（料品档案的生效起始日，用于版本追溯）';
ALTER TABLE `bas_material` MODIFY COLUMN `expiry_date` DATETIME NOT NULL COMMENT '失效日期（料品档案的有效期截止日）';

-- === quality_microbe_inspection (MicrobeInspection.ts) ===
ALTER TABLE `quality_microbe_inspection` COMMENT = '微生物检验单表：记录食品接触材料/产品的微生物检测结果';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspection_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '微生物检验ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspection_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_quality_microbe_inspection_inspection_no` (`inspection_no`) COMMENT '检验编号（前缀MB+日期+序号）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspection_type` VARCHAR(20) DEFAULT '正常' COMMENT '检验类型：正常/加严/复检';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `object_type` VARCHAR(20) NOT NULL COMMENT '检验对象：成品检验/来料检验';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `report_order_id` INT COMMENT '关联报工单ID（成品检验时）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `report_order_no` VARCHAR(50) COMMENT '报工单号（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `incoming_id` INT COMMENT '关联来料检验ID（来料检验时）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `incoming_no` VARCHAR(50) COMMENT '来料检验单号（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `order_id` INT COMMENT '关联生产订单ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `order_no` VARCHAR(50) COMMENT '订单编号（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料号（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '料品名称（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `standard_id` INT COMMENT '关联检验标准ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `standard_name` VARCHAR(200) COMMENT '检验标准名称（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `result` VARCHAR(20) COMMENT '总结果：合格/不合格';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `handle_type` VARCHAR(50) COMMENT '处理方式：入库/判退/报废/让步接收';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `trigger_type` VARCHAR(20) DEFAULT '自动' COMMENT '触发方式：自动/手工';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待检, 1=检验中, 2=审核中, 3=已完成, 4=已关闭';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspector_id` INT COMMENT '检验人ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '检验人姓名（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `reviewer_id` INT COMMENT '审核人ID';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `reviewer_name` VARCHAR(50) COMMENT '审核人姓名（冗余）';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `inspection_time` DATETIME COMMENT '检验时间';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `review_time` DATETIME COMMENT '审核时间';
ALTER TABLE `quality_microbe_inspection` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === sys_number_rule (NumberRule.ts) ===
ALTER TABLE `sys_number_rule` COMMENT = '编号规则配置表：前缀+日期+序号+分隔符的可视化编号模板';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `rule_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '编号规则ID（主键）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称（如 生产订单号 / 工单号 / 来料检验单号）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `rule_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_sys_number_rule_rule_code` (`rule_code`) COMMENT '规则编码（英文唯一标识，同时也是 sys_sequence.seq_key，如 ORDER / WORK_ORDER）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `prefix` VARCHAR(20) NOT NULL COMMENT '编号前缀（如 MO / WO / LL / F 等，生成编号时的首段）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `date_format` VARCHAR(20) NOT NULL DEFAULT 'YYMMDD' COMMENT '日期段格式：none=无日期, YYMMDD=261031, YYYYMMDD=20261031, YYYY=2026';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `separator` VARCHAR(5) NOT NULL DEFAULT '' COMMENT '各段之间的分隔符（如 - 或 / 或空字符串）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `seq_width` INT NOT NULL DEFAULT 3 COMMENT '序号位数（左侧补零，如 3 位 → 001 / 002；常用 3-6 位）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `reset_by` VARCHAR(20) NOT NULL DEFAULT 'daily' COMMENT '序号重置周期：daily=每日重置, yearly=每年重置, never=永不重置';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `target_table` VARCHAR(100) COMMENT '关联业务表名（如 production_order / work_order，便于溯源）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `target_field` VARCHAR(100) COMMENT '关联字段名（如 order_no / work_order_no，便于溯源）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `target_label` VARCHAR(100) COMMENT '关联字段中文说明（如 订单编号，前端展示用）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `current_no` VARCHAR(50) COMMENT '最新生成的完整编号（冗余，展示用；如 WO-261031-0123）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `used_count` INT NOT NULL DEFAULT 0 COMMENT '已使用的编号总数（用于统计和追溯）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '规则状态：1=启用（编号生成时使用）, 0=停用';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `is_locked` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已审核锁定：0=未锁定（可修改核心配置）, 1=已锁定（核心配置不可改）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `description` VARCHAR(500) COMMENT '规则说明（备注/用途说明）';
ALTER TABLE `sys_number_rule` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（操作人 username）';

-- === sys_operation_log (OperationLog.ts) ===
ALTER TABLE `sys_operation_log` COMMENT = '操作日志表：记录用户登录/查询/增删改等操作，用于审计追溯';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `log_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID（主键）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `user_id` INT COMMENT '操作人用户ID（关联 sys_user.user_id，冗余）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `username` VARCHAR(50) COMMENT '操作人登录账号（冗余，方便查询）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `module` VARCHAR(50) COMMENT '操作模块（如 设备管理 / 工单管理 / 系统设置）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `action` VARCHAR(50) COMMENT '操作类型（如 查询 / 新增 / 修改 / 删除 / 导出 / 登录）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `operation` VARCHAR(100) COMMENT '操作描述（简短一句话，如 新增设备故障 F20261031001）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `content` TEXT COMMENT '操作详情（较长的描述或数据快照，可选）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `method` VARCHAR(10) COMMENT 'HTTP 请求方法（GET / POST / PUT / DELETE）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `params` TEXT COMMENT '请求参数（JSON 字符串，敏感字段已脱敏）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `ip` VARCHAR(45) COMMENT '客户端 IP（兼容 IPv6）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `ip_address` VARCHAR(45) COMMENT '同上（部分调用处用 ip 部分用 ip_address，同义冗余字段）';
ALTER TABLE `sys_operation_log` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '操作结果：1=成功, 0=失败';

-- === production_order (Order.ts) ===
ALTER TABLE `production_order` COMMENT = '生产订单主表：从 U9 同步或本地创建，驱动整条生产链路';
ALTER TABLE `production_order` MODIFY COLUMN `order_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID（主键）';
ALTER TABLE `production_order` MODIFY COLUMN `order_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_production_order_order_no` (`order_no`) COMMENT '生产订单号（来自 U9 或本地生成，如 MO20261031001）';
ALTER TABLE `production_order` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID（关联 bas_material.material_id，UUID 类型主键）';
ALTER TABLE `production_order` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料品编码（冗余，来自 bas_material.material_code）';
ALTER TABLE `production_order` MODIFY COLUMN `material_name` VARCHAR(100) COMMENT '料品名称（冗余，来自 bas_material.material_name）';
ALTER TABLE `production_order` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格型号（冗余，来自 bas_material.specification）';
ALTER TABLE `production_order` MODIFY COLUMN `film_version` VARCHAR(50) COMMENT '菲林编号/版本（来自料品档案 film_no）';
ALTER TABLE `production_order` MODIFY COLUMN `version_no` VARCHAR(50) COMMENT '版本号（料品设计版本，如 V1 / V2.1）';
ALTER TABLE `production_order` MODIFY COLUMN `barcode` VARCHAR(100) COMMENT '料品条形码（生产追溯扫码用）';
ALTER TABLE `production_order` MODIFY COLUMN `planned_qty` DECIMAL(12, 2) DEFAULT 0 COMMENT '计划生产数量（订单要求数量）';
ALTER TABLE `production_order` MODIFY COLUMN `finished_qty` DECIMAL(12, 2) DEFAULT 0 COMMENT '累计完工数量（从 MES 报工单汇总回填）';
ALTER TABLE `production_order` MODIFY COLUMN `u9_qualified` DECIMAL(12, 2) DEFAULT 0 COMMENT 'U9 同步的累计合格数量（U9 端返回）';
ALTER TABLE `production_order` MODIFY COLUMN `plan_start_time` DATETIME COMMENT '计划开工时间（排产时设定）';
ALTER TABLE `production_order` MODIFY COLUMN `plan_end_time` DATETIME COMMENT '计划完工时间（排产时设定）';
ALTER TABLE `production_order` MODIFY COLUMN `u9_status` VARCHAR(50) COMMENT 'U9 原始状态字符串（如 开立 / 开工 / 完工 / 关闭，保留 U9 原始值）';
ALTER TABLE `production_order` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT 'MES 本地状态：0=开立, 1=下发, 2=开工, 3=完工, 4=关闭';
ALTER TABLE `production_order` MODIFY COLUMN `release_time` DATETIME COMMENT '下发/开工时间（订单状态转为开工时记录）';
ALTER TABLE `production_order` MODIFY COLUMN `close_time` DATETIME COMMENT '完工关闭时间（订单状态转为关闭时记录）';
ALTER TABLE `production_order` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（操作人 username，自动或手动创建时记录）';

-- === sys_permission (Permission.ts) ===
ALTER TABLE `sys_permission` COMMENT = '系统权限/菜单表：树形结构，定义菜单、按钮、接口权限';
ALTER TABLE `sys_permission` MODIFY COLUMN `perm_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '权限ID（主键）';
ALTER TABLE `sys_permission` MODIFY COLUMN `parent_id` INT DEFAULT 0 COMMENT '父级权限ID（0=顶级节点，自关联形成树形结构）';
ALTER TABLE `sys_permission` MODIFY COLUMN `perm_name` VARCHAR(50) NOT NULL COMMENT '权限名称（显示在菜单上的中文名称）';
ALTER TABLE `sys_permission` MODIFY COLUMN `perm_code` VARCHAR(100) NOT NULL UNIQUE KEY `uk_sys_permission_perm_code` (`perm_code`) COMMENT '权限编码（英文唯一标识，如 device:fault:create）';
ALTER TABLE `sys_permission` MODIFY COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'menu' COMMENT '权限类型：menu=菜单, button=按钮, api=接口';
ALTER TABLE `sys_permission` MODIFY COLUMN `icon` VARCHAR(100) COMMENT '菜单图标（Ant Design 图标名，仅 type=menu 有值）';
ALTER TABLE `sys_permission` MODIFY COLUMN `path` VARCHAR(200) COMMENT '前端路由路径（如 /device/fault，仅 type=menu 有值）';
ALTER TABLE `sys_permission` MODIFY COLUMN `component` VARCHAR(200) COMMENT '前端组件路径（如 pages/device/Fault，仅 type=menu 有值）';
ALTER TABLE `sys_permission` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '同级排序序号（数值小排前）';
ALTER TABLE `sys_permission` MODIFY COLUMN `visible` TINYINT NOT NULL DEFAULT 1 COMMENT '是否在前端菜单显示：1=显示（可见可访问）, 0=隐藏（不可见但可访问）';
ALTER TABLE `sys_permission` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '权限状态：1=启用（角色可分配）, 0=禁用（角色不可分配，接口也被拦截）';

-- === master_process (Process.ts) ===
ALTER TABLE `master_process` COMMENT = '工序主数据表：定义工厂内标准化工序（冲压/印刷/灌装等）';
ALTER TABLE `master_process` MODIFY COLUMN `process_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '工序ID（主键）';
ALTER TABLE `master_process` MODIFY COLUMN `process_code` VARCHAR(30) NOT NULL UNIQUE KEY `uk_master_process_process_code` (`process_code`) COMMENT '工序编码（英文唯一标识，如 PRESS / PRINT / FILL / QC）';
ALTER TABLE `master_process` MODIFY COLUMN `process_name` VARCHAR(50) NOT NULL COMMENT '工序名称（中文显示名，如 冲压 / 印刷 / 灌装）';
ALTER TABLE `master_process` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（工序列表默认排序，数值小排前）';
ALTER TABLE `master_process` MODIFY COLUMN `has_material` TINYINT DEFAULT 0 COMMENT '是否消耗物料：1=是（需要录入投料记录）, 0=否';
ALTER TABLE `master_process` MODIFY COLUMN `must_report` TINYINT DEFAULT 0 COMMENT '是否必须报工：1=是（必须完成报工才能流转下一工序）, 0=否';
ALTER TABLE `master_process` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '工序状态：1=启用（可分配到产线）, 0=停用';

-- === production_process_defect (ProcessDefect.ts) ===
ALTER TABLE `production_process_defect` COMMENT = '报工不良记录表：记录每次报工的不良品数量、分类、图片等';
ALTER TABLE `production_process_defect` MODIFY COLUMN `defect_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '不良记录ID（主键）';
ALTER TABLE `production_process_defect` MODIFY COLUMN `report_order_id` INT COMMENT '生产报工单ID';
ALTER TABLE `production_process_defect` MODIFY COLUMN `process_id` INT COMMENT '工序ID';
ALTER TABLE `production_process_defect` MODIFY COLUMN `defect_type_id` INT COMMENT '不良分类ID';
ALTER TABLE `production_process_defect` MODIFY COLUMN `quantity` DECIMAL(12, 2) DEFAULT 0 COMMENT '数量';
ALTER TABLE `production_process_defect` MODIFY COLUMN `unit` VARCHAR(20) COMMENT '单位';
ALTER TABLE `production_process_defect` MODIFY COLUMN `defect_images` TEXT COMMENT '不良图片(JSON数组)';

-- === production_process_exception (ProcessException.ts) ===
ALTER TABLE `production_process_exception` COMMENT = '报工异常停机记录表：记录生产过程中的设备异常、停机时间等';
ALTER TABLE `production_process_exception` MODIFY COLUMN `exception_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '异常记录ID（主键）';
ALTER TABLE `production_process_exception` MODIFY COLUMN `report_order_id` INT COMMENT '生产报工单ID';
ALTER TABLE `production_process_exception` MODIFY COLUMN `exception_type` VARCHAR(50) COMMENT '异常类型';
ALTER TABLE `production_process_exception` MODIFY COLUMN `device_id` INT COMMENT '设备ID';
ALTER TABLE `production_process_exception` MODIFY COLUMN `device_code` VARCHAR(50) COMMENT '设备编码';
ALTER TABLE `production_process_exception` MODIFY COLUMN `device_name` VARCHAR(100) COMMENT '设备名称';
ALTER TABLE `production_process_exception` MODIFY COLUMN `stop_type` VARCHAR(100) COMMENT '停机类型';
ALTER TABLE `production_process_exception` MODIFY COLUMN `confirm_user` VARCHAR(50) COMMENT '确认人';
ALTER TABLE `production_process_exception` MODIFY COLUMN `confirm_user_name` VARCHAR(50) COMMENT '确认人姓名';
ALTER TABLE `production_process_exception` MODIFY COLUMN `start_time` DATETIME COMMENT '开始时间';
ALTER TABLE `production_process_exception` MODIFY COLUMN `end_time` DATETIME COMMENT '恢复时间';
ALTER TABLE `production_process_exception` MODIFY COLUMN `duration` DECIMAL(10, 2) COMMENT '持续时长(小时-MySQL STORED自动计算)';
ALTER TABLE `production_process_exception` MODIFY COLUMN `description` VARCHAR(500) COMMENT '异常描述';
ALTER TABLE `production_process_exception` MODIFY COLUMN `exception_images` TEXT COMMENT '异常图片，JSON数组存储';
ALTER TABLE `production_process_exception` MODIFY COLUMN `record_user` VARCHAR(50) COMMENT '记录人';
ALTER TABLE `production_process_exception` MODIFY COLUMN `record_user_name` VARCHAR(50) COMMENT '记录人姓名';

-- === quality_process_inspection (ProcessInspection.ts) ===
ALTER TABLE `quality_process_inspection` COMMENT = '过程检验单表：记录生产过程中的在制品抽检结果';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `inspection_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '过程检验ID';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `inspection_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_quality_process_inspection_inspection_no` (`inspection_no`) COMMENT '检验编号（GC+YYMMDD+3位序号）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `report_order_id` INT COMMENT '关联生产报工单ID（在制品来源）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `work_order_no` VARCHAR(50) COMMENT '报工单号（冗余，便于移动端展示）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `process_name` VARCHAR(100) COMMENT '工序名称（冗余）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `product_name` VARCHAR(200) COMMENT '产品名称（冗余）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料号（冗余）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `quantity` DECIMAL(12, 2) COMMENT '检验时数量';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `temperature` VARCHAR(50) COMMENT '温度（°C）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `humidity` VARCHAR(50) COMMENT '湿度（%）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `ph` VARCHAR(50) COMMENT 'pH 值';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `params_extra` TEXT COMMENT '扩展参数 JSON（如压力、转速等附加项）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `result` VARCHAR(20) COMMENT '总结果：合格/不合格';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `handle_type` VARCHAR(50) COMMENT '处理方式';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `handle_reason` VARCHAR(500) COMMENT '处理原因';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待检, 1=检验中, 2=已完成, 3=已关闭';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `inspector_id` INT COMMENT '检验人ID';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '检验人姓名（冗余）';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `inspection_time` DATETIME COMMENT '检验时间';
ALTER TABLE `quality_process_inspection` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === production_process_material (ProcessMaterial.ts) ===
ALTER TABLE `production_process_material` COMMENT = '报工物料记录表：记录每次报工的投料物料、批次、包号等';
ALTER TABLE `production_process_material` MODIFY COLUMN `material_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '物料记录ID（主键）';
ALTER TABLE `production_process_material` MODIFY COLUMN `report_order_id` INT COMMENT '生产报工单ID';
ALTER TABLE `production_process_material` MODIFY COLUMN `process_id` INT COMMENT '工序ID';
ALTER TABLE `production_process_material` MODIFY COLUMN `material_type` VARCHAR(100) COMMENT '物料类型';
ALTER TABLE `production_process_material` MODIFY COLUMN `bas_material_id` CHAR(36) COMMENT '关联基础料品表ID';
ALTER TABLE `production_process_material` MODIFY COLUMN `material_batch` VARCHAR(100) COMMENT '物料批次';
ALTER TABLE `production_process_material` MODIFY COLUMN `package_no` VARCHAR(100) COMMENT '包号';
ALTER TABLE `production_process_material` MODIFY COLUMN `quantity` DECIMAL(12, 2) DEFAULT 0 COMMENT '数量';
ALTER TABLE `production_process_material` MODIFY COLUMN `label_images` TEXT COMMENT '标签图片(JSON)';

-- === quality_product_inspection (ProductInspection.ts) ===
ALTER TABLE `quality_product_inspection` COMMENT = '成品检验单表：记录成品出货前的最终检验结果';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspection_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '产品检测ID';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspection_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_quality_product_inspection_inspection_no` (`inspection_no`) COMMENT '检验编号（按类型两位前缀+日期+序号）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspection_type` VARCHAR(20) NOT NULL COMMENT '检验类型：首件/制程/成品/其它';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `report_order_id` INT NOT NULL COMMENT '关联报工单ID';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `report_order_no` VARCHAR(50) COMMENT '报工单号（冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID（从报工单带出）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料号（从报工单带出，冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '产品名称/料品名称（从报工单带出，冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格（从报工单带出，冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `standard_id` INT COMMENT '关联检验标准ID';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `standard_name` VARCHAR(200) COMMENT '检验标准名称（冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `result` VARCHAR(20) COMMENT '总结果：合格/不合格';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `trigger_type` VARCHAR(20) DEFAULT '手工' COMMENT '触发方式：自动/手工';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待检, 1=检验中, 2=审核中, 3=已完成, 4=已关闭';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspector_id` INT COMMENT '检验人ID';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '检验人姓名（冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `reviewer_id` INT COMMENT '审核人ID';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `reviewer_name` VARCHAR(50) COMMENT '审核人姓名（冗余）';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `inspection_time` DATETIME COMMENT '检验时间';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `review_time` DATETIME COMMENT '审核时间';
ALTER TABLE `quality_product_inspection` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === master_production_line (ProductionLine.ts) ===
ALTER TABLE `master_production_line` COMMENT = '产线主数据表：定义工厂内的生产流水线及其基本信息';
ALTER TABLE `master_production_line` MODIFY COLUMN `line_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '产线ID（主键）';
ALTER TABLE `master_production_line` MODIFY COLUMN `line_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_master_production_line_line_code` (`line_code`) COMMENT '产线编码（英文唯一标识，如 LINE_P01 / LINE_PRINT02）';
ALTER TABLE `master_production_line` MODIFY COLUMN `line_name` VARCHAR(100) NOT NULL COMMENT '产线名称（中文显示名，如 1# 冲压线 / 2# 印刷线）';
ALTER TABLE `master_production_line` MODIFY COLUMN `workshop` VARCHAR(50) COMMENT '所属车间（如 冲压车间 / 印刷车间 / 灌装车间）';
ALTER TABLE `master_production_line` MODIFY COLUMN `line_leader` VARCHAR(50) COMMENT '产线负责人（班组长姓名）';
ALTER TABLE `master_production_line` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（数值小排前）';
ALTER TABLE `master_production_line` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '产线状态：1=运行中, 2=维护中, 0=停用';

-- === qc_inspection_item (QcInspectionItem.ts) ===
ALTER TABLE `qc_inspection_item` COMMENT = '检验项目模板表：定义 QC 检验的项目库（可被多个方案引用）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `item_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '统一检验项ID';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `source_type` VARCHAR(20) NOT NULL COMMENT '来源类型：来料/产品/微生物（多态外键类型标识）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `inspection_id` INT NOT NULL COMMENT '多态外键，关联三主表inspection_id（无物理FK约束，应用层保证）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `item_cfg_id` INT COMMENT '关联quality_inspection_standard_item.item_id（可空，旧数据无）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `item_name` VARCHAR(200) NOT NULL COMMENT '检验项目名称';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `category` VARCHAR(50) COMMENT '项目大类';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `standard_value` VARCHAR(500) COMMENT '标准值（定性描述保留）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `actual_value_text` VARCHAR(500) COMMENT '兼容旧数据/单值场景/定性值汇总';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `sample_count` INT COMMENT '实际抽样数';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `summary` VARCHAR(200) COMMENT '汇总如8件全合格';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `result` TINYINT COMMENT '0不合格/1合格（综合判定）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `inspector_id` INT COMMENT '项目检验人ID';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '冗余';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `inspection_time` DATETIME COMMENT '项目检验时间';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `unit` VARCHAR(20) COMMENT '单位';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `item_type` VARCHAR(20) COMMENT '项目类型：qualitative定性(仅判定OK/NG) / quantitative定量(记录测量数值)';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `need_sample_count` INT DEFAULT 0 COMMENT '默认抽样数（来自检验标准），0=不限制由实际抽样决定';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `upper_limit` DECIMAL(15, 4) COMMENT '上限（定量用，来自检验标准）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `lower_limit` DECIMAL(15, 4) COMMENT '下限（定量用，来自检验标准）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `sampling_plan` VARCHAR(20) COMMENT '抽样方案：AQL抽样/按数量抽样/固定数量抽样/全检';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `sampling_detail` TEXT COMMENT '抽样方案详情JSON（Ac/Re等）';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `accept_number` INT COMMENT '允收值 Ac';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `reject_number` INT COMMENT '拒收值 Re';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `qc_inspection_item` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === qc_inspection_sample_value (QcInspectionSampleValue.ts) ===
ALTER TABLE `qc_inspection_sample_value` COMMENT = '检验样本值记录表：每个样本的实际测量值、判定结果';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `value_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '测量值ID';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `item_id` INT NOT NULL COMMENT '关联qc_inspection_item.item_id';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `sample_no` INT NOT NULL COMMENT '样板序号1..N（第几件样品）';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `dimension_code` VARCHAR(30) COMMENT '测量维度编码如D/d/b/H（单值时统一VALUE）';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `dimension_name` VARCHAR(100) COMMENT '维度名称如钩边外径';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `measure_value_num` DECIMAL(15, 4) COMMENT '定量值（可聚合，SPC用）';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `measure_value_text` VARCHAR(50) COMMENT '定性值OK/NG/无缺口';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `is_qualified` TINYINT COMMENT '0不合格/1合格';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `defect_desc` VARCHAR(500) COMMENT '缺陷描述';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `measured_at` DATETIME COMMENT '测量时间';
ALTER TABLE `qc_inspection_sample_value` MODIFY COLUMN `inspector_id` INT COMMENT '测量人ID';

-- === quality_complaint (QualityComplaint.ts) ===
ALTER TABLE `quality_complaint` COMMENT = '质量客诉主表：记录客户对产品质量的投诉、退货、赔偿全流程';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '客诉ID';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_no` VARCHAR(50) UNIQUE KEY `uk_quality_complaint_complaint_no` (`complaint_no`) COMMENT '客诉编号（前缀TS+日期+序号）';
ALTER TABLE `quality_complaint` MODIFY COLUMN `source` VARCHAR(50) COMMENT '来源：客户投诉/监管抽查/内部发现等';
ALTER TABLE `quality_complaint` MODIFY COLUMN `customer_id` INT COMMENT '客户ID';
ALTER TABLE `quality_complaint` MODIFY COLUMN `customer_name` VARCHAR(200) COMMENT '客户名称（冗余）';
ALTER TABLE `quality_complaint` MODIFY COLUMN `contact_person` VARCHAR(50) COMMENT '联系人';
ALTER TABLE `quality_complaint` MODIFY COLUMN `contact_phone` VARCHAR(30) COMMENT '联系电话';
ALTER TABLE `quality_complaint` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID';
ALTER TABLE `quality_complaint` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '料品名称（冗余）';
ALTER TABLE `quality_complaint` MODIFY COLUMN `batch_no` VARCHAR(50) COMMENT '批号/工单号';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_type` VARCHAR(30) COMMENT '投诉问题分类：质量问题/服务问题/交付问题等';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_desc` TEXT COMMENT '投诉描述';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_method` VARCHAR(30) COMMENT '投诉方式：电话/邮件/传真/现场';
ALTER TABLE `quality_complaint` MODIFY COLUMN `complaint_time` DATETIME COMMENT '投诉时间';
ALTER TABLE `quality_complaint` MODIFY COLUMN `require_reply` TINYINT DEFAULT 0 COMMENT '是否要求回复：0否, 1是';
ALTER TABLE `quality_complaint` MODIFY COLUMN `reply_deadline` DATETIME COMMENT '回复截止日期';
ALTER TABLE `quality_complaint` MODIFY COLUMN `handle_direction` VARCHAR(200) COMMENT '处理方向';
ALTER TABLE `quality_complaint` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=处理中, 1=已关闭';
ALTER TABLE `quality_complaint` MODIFY COLUMN `handler_id` INT COMMENT '当前处理人ID';
ALTER TABLE `quality_complaint` MODIFY COLUMN `handler_name` VARCHAR(50) COMMENT '当前处理人姓名（冗余）';
ALTER TABLE `quality_complaint` MODIFY COLUMN `registered_by` INT COMMENT '登记人ID';
ALTER TABLE `quality_complaint` MODIFY COLUMN `registered_by_name` VARCHAR(50) COMMENT '登记人姓名（冗余）';
ALTER TABLE `quality_complaint` MODIFY COLUMN `closed_time` DATETIME COMMENT '关闭时间';
ALTER TABLE `quality_complaint` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === quality_complaint_record (QualityComplaintRecord.ts) ===
ALTER TABLE `quality_complaint_record` COMMENT = '质量客诉处理记录表：记录每次客诉的处理人、处理方式、处理结果';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `record_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `complaint_id` INT COMMENT '关联客诉ID';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `stage` VARCHAR(30) COMMENT '阶段：调查/处理/原因分析/回复客户/客户反馈/关闭';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `content` TEXT COMMENT '处理内容';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `handler_id` INT COMMENT '处理人ID';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `handler_name` VARCHAR(50) COMMENT '处理人姓名（冗余）';
ALTER TABLE `quality_complaint_record` MODIFY COLUMN `attachment_url` TEXT COMMENT '附件列表（JSON 数组）或单文件 URL';

-- === quality_env_area (QualityEnvArea.ts) ===
ALTER TABLE `quality_env_area` COMMENT = '环境监测区域表：定义工厂内需要环境监测的区域（车间/仓库）';
ALTER TABLE `quality_env_area` MODIFY COLUMN `area_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '区域ID';
ALTER TABLE `quality_env_area` MODIFY COLUMN `area_code` VARCHAR(50) UNIQUE KEY `uk_quality_env_area_area_code` (`area_code`) COMMENT '区域编码';
ALTER TABLE `quality_env_area` MODIFY COLUMN `area_name` VARCHAR(100) NOT NULL COMMENT '区域名称（如：更衣室、一号车间、A线）';
ALTER TABLE `quality_env_area` MODIFY COLUMN `area_type` VARCHAR(30) COMMENT '区域类型：更衣室/车间/产线/仓库等';
ALTER TABLE `quality_env_area` MODIFY COLUMN `parent_id` INT COMMENT '父级区域ID（树形结构）';
ALTER TABLE `quality_env_area` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `quality_env_area` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：1启用, 0禁用';
ALTER TABLE `quality_env_area` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === quality_env_inspection (QualityEnvInspection.ts) ===
ALTER TABLE `quality_env_inspection` COMMENT = '环境监测巡检记录表：记录周期性的环境温湿度/洁净度实测值';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `inspection_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '环境检验ID';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `inspection_no` VARCHAR(50) UNIQUE KEY `uk_quality_env_inspection_inspection_no` (`inspection_no`) COMMENT '检验编号（前缀HJ+日期+序号）';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `area_id` INT COMMENT '关联区域ID';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `area_name` VARCHAR(100) COMMENT '区域名称（冗余）';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `trigger_type` VARCHAR(20) DEFAULT '手工' COMMENT '触发方式：自动/手工';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `result` VARCHAR(20) COMMENT '总结果：合格/不合格';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `correction_action` VARCHAR(500) COMMENT '纠正措施';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `recheck_date` DATETIME COMMENT '复查日期';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `recheck_result` VARCHAR(20) COMMENT '复查结果：合格/不合格';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=待检, 1=检验中, 2=已完成, 3=已关闭';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `inspector_id` INT COMMENT '检验人ID';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `inspector_name` VARCHAR(50) COMMENT '检验人姓名（冗余）';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `inspection_date` DATETIME COMMENT '检验日期';
ALTER TABLE `quality_env_inspection` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === quality_env_inspection_item (QualityEnvInspectionItem.ts) ===
ALTER TABLE `quality_env_inspection_item` COMMENT = '环境监测项表：定义每个区域的具体监测点（传感器位置/仪器编号）';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `item_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '子项ID';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `inspection_id` INT COMMENT '关联检验ID';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `item_name` VARCHAR(100) COMMENT '检验项目名称';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `standard_value` VARCHAR(200) COMMENT '标准值';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `actual_value` VARCHAR(100) COMMENT '实测值';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `unit` VARCHAR(30) COMMENT '单位';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `judge` VARCHAR(20) COMMENT '判定：合格/不合格';
ALTER TABLE `quality_env_inspection_item` MODIFY COLUMN `remark` VARCHAR(200) COMMENT '备注';

-- === quality_env_template (QualityEnvTemplate.ts) ===
ALTER TABLE `quality_env_template` COMMENT = '环境监测模板表：定义温湿度/洁净度等环境监测的参数标准';
ALTER TABLE `quality_env_template` MODIFY COLUMN `template_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '模板ID';
ALTER TABLE `quality_env_template` MODIFY COLUMN `template_name` VARCHAR(100) NOT NULL COMMENT '模板名称';
ALTER TABLE `quality_env_template` MODIFY COLUMN `area_id` INT COMMENT '关联区域ID';
ALTER TABLE `quality_env_template` MODIFY COLUMN `item_name` VARCHAR(100) NOT NULL COMMENT '检验项目名称（如：温度、沉降菌）';
ALTER TABLE `quality_env_template` MODIFY COLUMN `standard_value` VARCHAR(200) COMMENT '标准值（如：18-26℃、≤15 CFU/皿）';
ALTER TABLE `quality_env_template` MODIFY COLUMN `unit` VARCHAR(30) COMMENT '单位';
ALTER TABLE `quality_env_template` MODIFY COLUMN `test_method` VARCHAR(200) COMMENT '检测方法';
ALTER TABLE `quality_env_template` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序';
ALTER TABLE `quality_env_template` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '状态：1启用, 0禁用';

-- === quality_supplier_complaint (QualitySupplierComplaint.ts) ===
ALTER TABLE `quality_supplier_complaint` COMMENT = '供应商质量投诉表：记录对供应商来料质量问题的投诉与索赔';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `complaint_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '供应商投诉ID';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `complaint_no` VARCHAR(50) UNIQUE KEY `uk_quality_supplier_complaint_complaint_no` (`complaint_no`) COMMENT '投诉编号（前缀GY+日期+序号）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `supplier_id` INT COMMENT '供应商ID';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `supplier_name` VARCHAR(200) COMMENT '供应商名称（冗余）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `complaint_type` VARCHAR(30) COMMENT '投诉类型：质量问题/交付问题/服务问题等';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `complaint_reason` TEXT COMMENT '投诉原因描述';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `related_doc_type` VARCHAR(30) COMMENT '关联单据类型：生产报工单/来料检验单';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `related_doc_id` INT COMMENT '关联单据ID（通用）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `related_doc_no` VARCHAR(50) COMMENT '关联单据号（通用冗余）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `complaint_date` DATETIME COMMENT '投诉日期';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `pdf_path` VARCHAR(500) COMMENT 'PDF投诉单路径';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '状态：0=已创建, 1=已发出, 2=已回复, 3=已关闭';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `reply_content` TEXT COMMENT '供应商回复内容';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `reply_date` DATETIME COMMENT '回复日期';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `reply_by` VARCHAR(50) COMMENT '回复人';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `created_by` INT COMMENT '创建人ID';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `created_by_name` VARCHAR(50) COMMENT '创建人姓名（冗余）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `closed_by` INT COMMENT '关闭人ID';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `closed_by_name` VARCHAR(50) COMMENT '关闭人姓名（冗余）';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `closed_time` DATETIME COMMENT '关闭时间';
ALTER TABLE `quality_supplier_complaint` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';

-- === production_report_image (ReportImage.ts) ===
ALTER TABLE `production_report_image` COMMENT = '报工单图片子表：统一存储报工单的不良/标签/异常图片';
ALTER TABLE `production_report_image` MODIFY COLUMN `image_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '图片ID（主键）';
ALTER TABLE `production_report_image` MODIFY COLUMN `report_order_id` INT NOT NULL COMMENT '关联生产报工单ID';
ALTER TABLE `production_report_image` MODIFY COLUMN `category` VARCHAR(30) NOT NULL COMMENT '图片分类：defect=不良, label=标签, exception=异常';
ALTER TABLE `production_report_image` MODIFY COLUMN `image_url` VARCHAR(500) NOT NULL COMMENT '图片URL';
ALTER TABLE `production_report_image` MODIFY COLUMN `file_hash` VARCHAR(64) COMMENT '文件哈希（MD5/SHA-256，用于去重）';

-- === production_report_order (ReportOrder.ts) ===
ALTER TABLE `production_report_order` COMMENT = '生产报工单主表：记录每笔生产报工的产出数量、报工人员、工序完成情况';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_order_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '生产报工单ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `order_id` INT NOT NULL COMMENT '关联生产订单ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `order_no` VARCHAR(50) COMMENT '订单号（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_no` VARCHAR(50) NOT NULL UNIQUE KEY `uk_production_report_order_report_no` (`report_no`) COMMENT '报工单号（WO-16+YYMMDD+3位序号）';
ALTER TABLE `production_report_order` MODIFY COLUMN `line_id` INT COMMENT '生产产线ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `line_name` VARCHAR(100) COMMENT '产线名称（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `material_id` CHAR(36) COMMENT '料品ID（从订单带出）';
ALTER TABLE `production_report_order` MODIFY COLUMN `material_code` VARCHAR(50) COMMENT '料号（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `material_name` VARCHAR(200) COMMENT '料品名称（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `specification` VARCHAR(200) COMMENT '规格（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_qty` DECIMAL(12, 2) DEFAULT 0 COMMENT '报工数量';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_time` DATETIME COMMENT '报工时间（创建时间）';
ALTER TABLE `production_report_order` MODIFY COLUMN `finish_time` DATETIME COMMENT '完工时间';
ALTER TABLE `production_report_order` MODIFY COLUMN `close_time` DATETIME COMMENT '关闭时间';
ALTER TABLE `production_report_order` MODIFY COLUMN `status` TINYINT DEFAULT 0 COMMENT '工单状态：0=开工, 1=完工';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_user_id` INT COMMENT '报工人员ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `report_user_name` VARCHAR(50) COMMENT '报工人员姓名（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `finish_user_id` INT COMMENT '完工人员ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `finish_user_name` VARCHAR(50) COMMENT '完工人员姓名（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `close_user_id` INT COMMENT '关闭人员ID';
ALTER TABLE `production_report_order` MODIFY COLUMN `close_user_name` VARCHAR(50) COMMENT '关闭人员姓名（冗余）';
ALTER TABLE `production_report_order` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注';
ALTER TABLE `production_report_order` MODIFY COLUMN `production_batch` VARCHAR(100) COMMENT '生产批号（完工必填）';
ALTER TABLE `production_report_order` MODIFY COLUMN `image_first` VARCHAR(500) COMMENT '首张合格证 URL（同步 production_report_image）';
ALTER TABLE `production_report_order` MODIFY COLUMN `image_last` VARCHAR(500) COMMENT '末张合格证 URL（同步 production_report_image）';

-- === production_report_process (ReportProcess.ts) ===
ALTER TABLE `production_report_process` COMMENT = '报工工序列表：创建报工单时从产线工序表继承的工序列表（快照）';
ALTER TABLE `production_report_process` MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '工序列表ID（主键，报工工序快照）';
ALTER TABLE `production_report_process` MODIFY COLUMN `report_order_id` INT NOT NULL COMMENT '关联生产报工单ID';
ALTER TABLE `production_report_process` MODIFY COLUMN `process_id` INT NOT NULL COMMENT '工序ID';
ALTER TABLE `production_report_process` MODIFY COLUMN `process_code` VARCHAR(30) NOT NULL COMMENT '工序编码';
ALTER TABLE `production_report_process` MODIFY COLUMN `process_name` VARCHAR(50) NOT NULL COMMENT '工序名称';
ALTER TABLE `production_report_process` MODIFY COLUMN `has_material` TINYINT DEFAULT 0 COMMENT '是否引入物料：0=否, 1=是';
ALTER TABLE `production_report_process` MODIFY COLUMN `must_report` TINYINT DEFAULT 0 COMMENT '是否必须报工：0=否, 1=是';
ALTER TABLE `production_report_process` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '工序顺序';

-- === sys_role (Role.ts) ===
ALTER TABLE `sys_role` COMMENT = '系统角色表：定义角色、角色编码及状态';
ALTER TABLE `sys_role` MODIFY COLUMN `role_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '角色ID（主键）';
ALTER TABLE `sys_role` MODIFY COLUMN `role_name` VARCHAR(50) NOT NULL COMMENT '角色名称（如 系统管理员 / 生产主管）';
ALTER TABLE `sys_role` MODIFY COLUMN `role_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_sys_role_role_code` (`role_code`) COMMENT '角色编码（英文唯一标识，如 admin / production_manager）';
ALTER TABLE `sys_role` MODIFY COLUMN `type` VARCHAR(20) COMMENT '角色类型（如 system=系统角色 / custom=自定义角色）';
ALTER TABLE `sys_role` MODIFY COLUMN `is_system_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否系统预置角色：0=否（可删除）, 1=是（不可删除）';
ALTER TABLE `sys_role` MODIFY COLUMN `description` VARCHAR(200) COMMENT '角色描述/说明';
ALTER TABLE `sys_role` MODIFY COLUMN `scope` VARCHAR(50) COMMENT '数据权限范围（如 all=全部 / self=仅本人 / dept=本部门）';
ALTER TABLE `sys_role` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（数值小排前）';
ALTER TABLE `sys_role` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '角色状态：1=启用, 0=禁用';

-- === sys_role_permission (RolePermission.ts) ===
ALTER TABLE `sys_role_permission` COMMENT = '角色-权限关联表（Role ↔ Permission 多对多中间表）';
ALTER TABLE `sys_role_permission` MODIFY COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '关联记录ID（主键）';
ALTER TABLE `sys_role_permission` MODIFY COLUMN `role_id` INT NOT NULL COMMENT '角色ID（关联 sys_role.role_id）';
ALTER TABLE `sys_role_permission` MODIFY COLUMN `perm_id` INT NOT NULL COMMENT '权限ID（关联 sys_permission.perm_id）';

-- === task_scheduled (ScheduledTask.ts) ===
ALTER TABLE `task_scheduled` COMMENT = '定时调度计划表：存储用户配置的周期性/一次性定时任务';
ALTER TABLE `task_scheduled` MODIFY COLUMN `schedule_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '调度计划ID（主键）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `schedule_biz_id` VARCHAR(64) NOT NULL UNIQUE KEY `uk_task_scheduled_schedule_biz_id` (`schedule_biz_id`) COMMENT '业务调度UUID（前端创建时生成，用于唯一标识）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `name` VARCHAR(200) NOT NULL COMMENT '调度计划名称（用户自定义，如 每天凌晨导出工单报表）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `task_type` VARCHAR(20) NOT NULL COMMENT '任务类型（与 taskScheduler 中注册的 handler 名称对应，如 daily_report_export）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `exec_mode` VARCHAR(20) NOT NULL COMMENT '执行方式：periodic=周期性（cron）, scheduled=指定单次时间, once=仅执行一次';
ALTER TABLE `task_scheduled` MODIFY COLUMN `config` TEXT NOT NULL COMMENT '调度配置（JSON，含 cron 表达式、时间点、业务参数等）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `next_run_at` DATETIME COMMENT '下次计划执行时间（taskScheduler 扫描此字段触发执行）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `last_run_at` DATETIME COMMENT '上次实际执行时间';
ALTER TABLE `task_scheduled` MODIFY COLUMN `last_run_result` VARCHAR(500) COMMENT '上次执行结果（成功/失败 + 简要说明）';
ALTER TABLE `task_scheduled` MODIFY COLUMN `is_enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1=启用（taskScheduler 会扫描执行）, 0=停用（跳过）';

-- === sys_sequence (Sequence.ts) ===
ALTER TABLE `sys_sequence` COMMENT = '业务编号序列表：原子化自增编号生成器（按日/年/永不重置）';
ALTER TABLE `sys_sequence` MODIFY COLUMN `seq_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '序列记录ID（主键）';
ALTER TABLE `sys_sequence` MODIFY COLUMN `seq_key` VARCHAR(50) NOT NULL COMMENT '序列类型键（如 ORDER / WORK_ORDER / INCOMING，对应 NumberRule.rule_code）';
ALTER TABLE `sys_sequence` MODIFY COLUMN `seq_date` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '序列日期（按日重置用 YYYYMMDD，按年重置用 YYYY，永不用空字符串）';
ALTER TABLE `sys_sequence` MODIFY COLUMN `current_value` INT NOT NULL DEFAULT 0 COMMENT '当前序号值（已成功分配的最新值，下次取号时 +1）';

-- === bas_supplier (Supplier.ts) ===
ALTER TABLE `bas_supplier` COMMENT = '供应商档案表：存储原材料/设备供应商基础信息、联系方式、信用等级';
ALTER TABLE `bas_supplier` MODIFY COLUMN `supplier_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '供应商ID（主键）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `supplier_code` VARCHAR(50) NOT NULL UNIQUE KEY `uk_bas_supplier_supplier_code` (`supplier_code`) COMMENT '供应商编号（如 SUP-001 / SUP-ALUMINUM-002）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `supplier_name` VARCHAR(200) NOT NULL COMMENT '供应商全称（营业执照上的公司全称）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `short_name` VARCHAR(100) COMMENT '供应商简称（前端下拉常用简称）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `supplier_category` VARCHAR(50) COMMENT '供应商分类（如 铝材供应商 / 涂料供应商 / 设备厂商 / 检测机构）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `contact_person` VARCHAR(50) COMMENT '主要联系人姓名（采购对接人）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `phone` VARCHAR(50) COMMENT '联系电话（手机/座机均可）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `email` VARCHAR(100) COMMENT '电子邮箱';
ALTER TABLE `bas_supplier` MODIFY COLUMN `address` VARCHAR(300) COMMENT '联系地址（详细地址，含省市区）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '启用状态：1=启用（可用于新建采购单）, 0=停用';
ALTER TABLE `bas_supplier` MODIFY COLUMN `credit_level` VARCHAR(20) COMMENT '信用等级（如 A / B / C，用于付款条件设定）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `tax_id` VARCHAR(50) COMMENT '纳税人识别号/统一社会信用代码';
ALTER TABLE `bas_supplier` MODIFY COLUMN `bank_account` VARCHAR(50) COMMENT '对公银行账号（用于付款）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `bank_name` VARCHAR(100) COMMENT '开户银行全称';
ALTER TABLE `bas_supplier` MODIFY COLUMN `remark` VARCHAR(500) COMMENT '备注说明（如合作年限、付款条件、特殊条款）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `sort_order` INT DEFAULT 0 COMMENT '排序序号（供应商列表默认排序，数值小排前）';
ALTER TABLE `bas_supplier` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（操作人 username）';

-- === task_sync_log (SyncTask.ts) ===
ALTER TABLE `task_sync_log` COMMENT = '外部数据同步任务日志表：记录 U9/外部系统数据拉取任务状态、进度、错误';
ALTER TABLE `task_sync_log` MODIFY COLUMN `task_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '同步任务ID（主键）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `task_biz_id` VARCHAR(64) NOT NULL UNIQUE KEY `uk_task_sync_log_task_biz_id` (`task_biz_id`) COMMENT '业务任务UUID（前端发起时生成，用于追踪同一次请求）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `task_type` VARCHAR(20) NOT NULL COMMENT '同步任务类型：items=料品, customers=客户, env_monitor=环境监测, weather=天气';
ALTER TABLE `task_sync_log` MODIFY COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'pending' COMMENT '任务状态：pending=等待中, running=执行中, completed=已完成, failed=失败';
ALTER TABLE `task_sync_log` MODIFY COLUMN `progress` INT NOT NULL DEFAULT 0 COMMENT '当前进度百分比（0-100）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `current_step` VARCHAR(500) DEFAULT '' COMMENT '当前执行步骤的文字说明';
ALTER TABLE `task_sync_log` MODIFY COLUMN `steps` TEXT COMMENT '完整步骤日志（JSON 数组，每项含 step/index/time/status/message）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `total_records` INT COMMENT '预期/实际同步的总记录数（用于进度计算）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `output_file` VARCHAR(500) COMMENT '输出文件路径（当同步结果导出为文件时）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `output_size` BIGINT COMMENT '输出文件大小（bytes）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `error_msg` VARCHAR(2000) COMMENT '失败时的错误信息（堆栈或友好提示）';
ALTER TABLE `task_sync_log` MODIFY COLUMN `started_at` DATETIME COMMENT '任务开始执行时间';
ALTER TABLE `task_sync_log` MODIFY COLUMN `ended_at` DATETIME COMMENT '任务结束时间（完成或失败时写入）';

-- === sys_config (SystemConfig.ts) ===
ALTER TABLE `sys_config` COMMENT = '系统配置表：key-value 形式的系统级参数配置';
ALTER TABLE `sys_config` MODIFY COLUMN `config_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID（主键）';
ALTER TABLE `sys_config` MODIFY COLUMN `config_key` VARCHAR(100) NOT NULL UNIQUE KEY `uk_sys_config_config_key` (`config_key`) COMMENT '配置键名（英文唯一标识，如 token_expire_seconds / upload_max_size）';
ALTER TABLE `sys_config` MODIFY COLUMN `config_value` TEXT COMMENT '配置值（以字符串存储，按 config_type 解析）';
ALTER TABLE `sys_config` MODIFY COLUMN `config_type` VARCHAR(20) NOT NULL DEFAULT 'string' COMMENT '配置值类型（决定解析方式）：string / number / boolean / json';
ALTER TABLE `sys_config` MODIFY COLUMN `config_group` VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT '配置分组（用于前端菜单展示）：security / system / business / upload / ...';
ALTER TABLE `sys_config` MODIFY COLUMN `config_desc` VARCHAR(200) COMMENT '配置项说明（中文描述配置用途）';
ALTER TABLE `sys_config` MODIFY COLUMN `updated_by` VARCHAR(50) COMMENT '最后修改人（操作人 username）';

-- === task_setting (TaskSetting.ts) ===
ALTER TABLE `task_setting` COMMENT = '任务设置表：系统定时任务/异步任务的配置项（如日报生成时间）';
ALTER TABLE `task_setting` MODIFY COLUMN `setting_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID（主键）';
ALTER TABLE `task_setting` MODIFY COLUMN `task_type` VARCHAR(20) NOT NULL UNIQUE KEY `uk_task_setting_task_type` (`task_type`) COMMENT '任务类型：items/customers/env_monitor/weather/energy_meter';
ALTER TABLE `task_setting` MODIFY COLUMN `name` VARCHAR(100) NOT NULL COMMENT '任务名称';
ALTER TABLE `task_setting` MODIFY COLUMN `description` VARCHAR(1000) COMMENT '任务描述';
ALTER TABLE `task_setting` MODIFY COLUMN `source_url` VARCHAR(500) COMMENT '数据源URL';
ALTER TABLE `task_setting` MODIFY COLUMN `field_count` INT COMMENT '字段数量';
ALTER TABLE `task_setting` MODIFY COLUMN `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1-启用 0-停用';
ALTER TABLE `task_setting` MODIFY COLUMN `params` TEXT COMMENT '执行参数(JSON)，如用户名、密码等';

-- === task_customer (U9Customer.ts) ===
ALTER TABLE `task_customer` COMMENT = 'U9 客户同步表：从 U9 ERP 同步的客户基础数据快照';
ALTER TABLE `task_customer` MODIFY COLUMN `customer_id` INT AUTO_INCREMENT PRIMARY KEY;
ALTER TABLE `task_customer` MODIFY COLUMN `task_id` VARCHAR(64) NOT NULL COMMENT '来源同步任务ID';
ALTER TABLE `task_customer` MODIFY COLUMN `customer_code` VARCHAR(100) NOT NULL UNIQUE KEY `uk_task_customer_customer_code` (`customer_code`) COMMENT '客户编码';
ALTER TABLE `task_customer` MODIFY COLUMN `customer_name` VARCHAR(500) COMMENT '客户名称';
ALTER TABLE `task_customer` MODIFY COLUMN `short_name` VARCHAR(200) COMMENT '简称';
ALTER TABLE `task_customer` MODIFY COLUMN `category_id` VARCHAR(100) COMMENT '客户分类ID';
ALTER TABLE `task_customer` MODIFY COLUMN `category_name` VARCHAR(200) COMMENT '分类名称';
ALTER TABLE `task_customer` MODIFY COLUMN `is_active` TINYINT COMMENT '是否生效';
ALTER TABLE `task_customer` MODIFY COLUMN `expire_date` VARCHAR(50) COMMENT '失效日期';
ALTER TABLE `task_customer` MODIFY COLUMN `effective_date` VARCHAR(50) COMMENT '生效日期';

-- === task_item (U9Item.ts) ===
ALTER TABLE `task_item` COMMENT = 'U9 料品同步表：从 U9 ERP 同步的料品主数据（比 bas_material 更全）';
ALTER TABLE `task_item` MODIFY COLUMN `item_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '采集记录ID';
ALTER TABLE `task_item` MODIFY COLUMN `task_id` VARCHAR(64) NOT NULL COMMENT '来源同步任务ID';
ALTER TABLE `task_item` MODIFY COLUMN `main_category_code` VARCHAR(100) COMMENT '主分类代码（U9来源字段）';
ALTER TABLE `task_item` MODIFY COLUMN `category_name` VARCHAR(200) COMMENT '分类名称';
ALTER TABLE `task_item` MODIFY COLUMN `material_code` VARCHAR(100) NOT NULL UNIQUE KEY `uk_task_item_material_code` (`material_code`) COMMENT '料号（= 业务主表 material_code）';
ALTER TABLE `task_item` MODIFY COLUMN `material_name` VARCHAR(500) COMMENT '品名（= 业务主表 material_name）';
ALTER TABLE `task_item` MODIFY COLUMN `specification` VARCHAR(500) COMMENT '规格';
ALTER TABLE `task_item` MODIFY COLUMN `unit_name` VARCHAR(100) COMMENT '单位名称';
ALTER TABLE `task_item` MODIFY COLUMN `film_no` VARCHAR(100) COMMENT '菲林编号';
ALTER TABLE `task_item` MODIFY COLUMN `version_no` VARCHAR(50) COMMENT '版本号（对齐 bas_material.version_no）';
ALTER TABLE `task_item` MODIFY COLUMN `barcode` VARCHAR(100) COMMENT '条形码';
ALTER TABLE `task_item` MODIFY COLUMN `cutting_size` VARCHAR(200) COMMENT '开料尺寸';
ALTER TABLE `task_item` MODIFY COLUMN `printing_process` VARCHAR(200) COMMENT '印刷工艺（对齐 bas_material.printing_process）';
ALTER TABLE `task_item` MODIFY COLUMN `color_separation` VARCHAR(200) COMMENT '分色信息（对齐 bas_material.color_separation）';
ALTER TABLE `task_item` MODIFY COLUMN `blanking_diameter` VARCHAR(100) COMMENT '落料直径（对齐 bas_material.blanking_diameter，原始字符串，迁移时转 DECIMAL）';
ALTER TABLE `task_item` MODIFY COLUMN `material_thickness` VARCHAR(100) COMMENT '材料厚度';
ALTER TABLE `task_item` MODIFY COLUMN `material_width` VARCHAR(100) COMMENT '材料宽度';
ALTER TABLE `task_item` MODIFY COLUMN `material_height` VARCHAR(100) COMMENT '材料高度';
ALTER TABLE `task_item` MODIFY COLUMN `scrap_weight` VARCHAR(100) COMMENT '边角料重量';
ALTER TABLE `task_item` MODIFY COLUMN `unit_weight` VARCHAR(100) COMMENT '单位重量（对齐 bas_material.unit_weight）';
ALTER TABLE `task_item` MODIFY COLUMN `unit_volume` VARCHAR(100) COMMENT '单位体积（对齐 bas_material.unit_volume）';
ALTER TABLE `task_item` MODIFY COLUMN `weight_unit` VARCHAR(100) COMMENT '重量单位';
ALTER TABLE `task_item` MODIFY COLUMN `volume_unit` VARCHAR(100) COMMENT '体积单位';
ALTER TABLE `task_item` MODIFY COLUMN `inventory_category` VARCHAR(100) COMMENT '存货分类';
ALTER TABLE `task_item` MODIFY COLUMN `unit_code` VARCHAR(100) COMMENT '单位编码';
ALTER TABLE `task_item` MODIFY COLUMN `is_active` TINYINT COMMENT '是否生效（0/1，迁移时转 BOOLEAN）';
ALTER TABLE `task_item` MODIFY COLUMN `effective_date` VARCHAR(50) COMMENT '生效日期';
ALTER TABLE `task_item` MODIFY COLUMN `expiry_date` VARCHAR(50) COMMENT '失效日期（对齐 bas_material.expiry_date）';

-- === task_production_order (U9ProductionOrder.ts) ===
ALTER TABLE `task_production_order` COMMENT = 'U9 生产订单同步表：从 U9 ERP 同步的生产订单原始数据快照';
ALTER TABLE `task_production_order` MODIFY COLUMN `order_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '采集记录ID';
ALTER TABLE `task_production_order` MODIFY COLUMN `task_id` VARCHAR(64) NOT NULL COMMENT '来源同步任务ID';
ALTER TABLE `task_production_order` MODIFY COLUMN `source_type` VARCHAR(100) COMMENT '来源类型';
ALTER TABLE `task_production_order` MODIFY COLUMN `doc_type_name` VARCHAR(100) COMMENT '单据类别名称';
ALTER TABLE `task_production_order` MODIFY COLUMN `biz_create_date` VARCHAR(50) COMMENT '业务制单日期';
ALTER TABLE `task_production_order` MODIFY COLUMN `order_no` VARCHAR(100) NOT NULL COMMENT '单据编号';
ALTER TABLE `task_production_order` MODIFY COLUMN `status` VARCHAR(100) COMMENT '单据状态（原始字符串：开立/下发/开工/完工/关闭等，迁移时转 TINYINT）';
ALTER TABLE `task_production_order` MODIFY COLUMN `material_code` VARCHAR(100) COMMENT '料品料号';
ALTER TABLE `task_production_order` MODIFY COLUMN `material_name` VARCHAR(300) COMMENT '料品品名';
ALTER TABLE `task_production_order` MODIFY COLUMN `specification` VARCHAR(500) COMMENT '规格';
ALTER TABLE `task_production_order` MODIFY COLUMN `film_version` VARCHAR(200) COMMENT '菲林编号';
ALTER TABLE `task_production_order` MODIFY COLUMN `version_no` VARCHAR(100) COMMENT '版本';
ALTER TABLE `task_production_order` MODIFY COLUMN `barcode` VARCHAR(100) COMMENT '条形码';
ALTER TABLE `task_production_order` MODIFY COLUMN `planned_qty` DECIMAL(18, 4) COMMENT '排产数量';
ALTER TABLE `task_production_order` MODIFY COLUMN `qualified_qty` DECIMAL(18, 4) DEFAULT 0 COMMENT '累计合格数量';
ALTER TABLE `task_production_order` MODIFY COLUMN `plan_start_time` VARCHAR(50) COMMENT '计划开工日期（原始字符串）';
ALTER TABLE `task_production_order` MODIFY COLUMN `plan_end_time` VARCHAR(50) COMMENT '计划完工日期（原始字符串）';
ALTER TABLE `task_production_order` MODIFY COLUMN `created_by` VARCHAR(100) COMMENT '业务制单人';
ALTER TABLE `task_production_order` MODIFY COLUMN `raw_data` TEXT COMMENT '原始数据（JSON）';

-- === task_purchase_receipt (U9PurchaseReceipt.ts) ===
ALTER TABLE `task_purchase_receipt` COMMENT = 'U9 采购收货同步表：从 U9 ERP 同步的采购入库单数据';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `receipt_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '采集记录ID';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `task_id` VARCHAR(64) NOT NULL COMMENT '来源同步任务ID';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `receipt_no` VARCHAR(100) NOT NULL COMMENT '单据编号（r[0]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `material_code` VARCHAR(100) COMMENT '料号（r[1]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `material_name` VARCHAR(500) COMMENT '料品名称（r[2]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `specification` VARCHAR(500) COMMENT '料品规格（r[3]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `business_type` VARCHAR(100) COMMENT '业务类型（r[4]，如标准采购）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `received_qty` VARCHAR(50) COMMENT '实收数量-采购单位（r[5]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `receive_lot_no` VARCHAR(100) COMMENT '收货批号（r[6]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `supplier_lot_no` VARCHAR(100) COMMENT '供应商批号（r[7]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `source_doc_no` VARCHAR(100) COMMENT '来源采购订单号（r[8]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `line_no` VARCHAR(50) COMMENT '行号（r[9]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `supplier_code` VARCHAR(100) COMMENT '供应商编码（r[10]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `supplier_name` VARCHAR(300) COMMENT '供应商名称（r[11]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `status` VARCHAR(100) COMMENT '单据状态（r[12]，如业务关闭/开立/审核等）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `created_by` VARCHAR(100) COMMENT '创建人（r[13]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `receipt_date` VARCHAR(50) COMMENT '业务日期（r[14]）';
ALTER TABLE `task_purchase_receipt` MODIFY COLUMN `raw_data` TEXT COMMENT '原始数据（JSON）';

-- === sys_user (User.ts) ===
ALTER TABLE `sys_user` COMMENT = '系统用户表：存储登录账号、基本资料和状态';
ALTER TABLE `sys_user` MODIFY COLUMN `user_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID（主键）';
ALTER TABLE `sys_user` MODIFY COLUMN `username` VARCHAR(50) NOT NULL UNIQUE KEY `uk_sys_user_username` (`username`) COMMENT '登录账号（唯一，如 admin / zhangsan）';
ALTER TABLE `sys_user` MODIFY COLUMN `user_pwd` VARCHAR(200) NOT NULL COMMENT '登录密码（bcrypt 哈希存储）';
ALTER TABLE `sys_user` MODIFY COLUMN `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名';
ALTER TABLE `sys_user` MODIFY COLUMN `employee_no` VARCHAR(50) COMMENT '工号（企业内部编号）';
ALTER TABLE `sys_user` MODIFY COLUMN `department` VARCHAR(50) COMMENT '所属部门';
ALTER TABLE `sys_user` MODIFY COLUMN `position` VARCHAR(50) COMMENT '岗位/职务（如 生产主管 / 设备维护员 / 品检员）';
ALTER TABLE `sys_user` MODIFY COLUMN `role_id` INT COMMENT '角色ID（关联 sys_role.role_id，多用户可共享同一角色）';
ALTER TABLE `sys_user` MODIFY COLUMN `phone` VARCHAR(20) COMMENT '联系电话';
ALTER TABLE `sys_user` MODIFY COLUMN `email` VARCHAR(100) COMMENT '电子邮箱';
ALTER TABLE `sys_user` MODIFY COLUMN `avatar_url` VARCHAR(255) COMMENT '头像地址（可访问的 URL）';
ALTER TABLE `sys_user` MODIFY COLUMN `status` TINYINT DEFAULT 1 COMMENT '账号状态：1=启用, 0=禁用';
ALTER TABLE `sys_user` MODIFY COLUMN `last_login_time` DATETIME COMMENT '最后登录时间';
ALTER TABLE `sys_user` MODIFY COLUMN `last_login_ip` VARCHAR(45) COMMENT '最后登录 IP（兼容 IPv6 最长 45 位）';
ALTER TABLE `sys_user` MODIFY COLUMN `pwd_reset_required` TINYINT NOT NULL DEFAULT 0 COMMENT '首次登录是否需要修改密码：0=否, 1=是';
ALTER TABLE `sys_user` MODIFY COLUMN `created_by` VARCHAR(50) COMMENT '创建人（记录操作人 username）';
ALTER TABLE `sys_user` MODIFY COLUMN `remarks` VARCHAR(500) COMMENT '备注信息';

-- === sys_user_setting (UserSetting.ts) ===
ALTER TABLE `sys_user_setting` COMMENT = '用户个性化设置表：存储用户表格列、主题、页大小等个性化偏好';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `setting_id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '设置记录ID（主键）';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `user_id` VARCHAR(50) NOT NULL COMMENT '关联用户ID（字符串类型，支持 username 或 user_id）';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `setting_key` VARCHAR(200) NOT NULL COMMENT '设置键名（唯一标识，如 device_fault.table_columns / theme.mode）';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `setting_value` TEXT COMMENT '设置值（以字符串存储，按 setting_type 解析；json 居多）';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `setting_type` VARCHAR(20) NOT NULL DEFAULT 'json' COMMENT '设置值类型：json / string / number / boolean';
ALTER TABLE `sys_user_setting` MODIFY COLUMN `setting_group` VARCHAR(50) NOT NULL DEFAULT 'table' COMMENT '设置分组（如 table=表格 / theme=主题 / pref=通用偏好）';

-- === task_weather_info (WeatherInfo.ts) ===
ALTER TABLE `task_weather_info` COMMENT = '天气信息采集表：从外部天气 API 同步的工厂所在地温湿度数据';
ALTER TABLE `task_weather_info` MODIFY COLUMN `weather_id` INT AUTO_INCREMENT PRIMARY KEY;
ALTER TABLE `task_weather_info` MODIFY COLUMN `city` VARCHAR(50) NOT NULL COMMENT '城市/区县名称';
ALTER TABLE `task_weather_info` MODIFY COLUMN `temperature` DOUBLE NOT NULL COMMENT '温度(℃)';
ALTER TABLE `task_weather_info` MODIFY COLUMN `humidity` DOUBLE NOT NULL COMMENT '相对湿度(%)';
ALTER TABLE `task_weather_info` MODIFY COLUMN `pressure` DOUBLE NOT NULL COMMENT '大气压(hPa)';
ALTER TABLE `task_weather_info` MODIFY COLUMN `weather_time` DATETIME NOT NULL COMMENT '气象发布/观测时间';
ALTER TABLE `task_weather_info` MODIFY COLUMN `source` VARCHAR(200) NOT NULL COMMENT '数据来源站点';
ALTER TABLE `task_weather_info` MODIFY COLUMN `raw_data` TEXT COMMENT '原始片段(调试用)';

SET FOREIGN_KEY_CHECKS = 1;
