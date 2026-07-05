import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Typography } from 'antd'
import {
  DatabaseOutlined, FieldNumberOutlined, FileSearchOutlined,
  EyeOutlined, TableOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { dbTables } from '../../mock/data'

const { Text, Title } = Typography

// 各表的字段结构定义（与实际数据库模型一致）
const tableFieldsMap = {
  sys_user: [
    { field_name: 'user_id', field_type: 'integer', field_length: '-', is_required: '是', description: '用户ID，主键，自增' },
    { field_name: 'username', field_type: 'string', field_length: '50', is_required: '是', description: '登录用户名，唯一' },
    { field_name: 'password', field_type: 'string', field_length: '100', is_required: '是', description: '登录密码（加密存储）' },
    { field_name: 'real_name', field_type: 'string', field_length: '50', is_required: '是', description: '真实姓名' },
    { field_name: 'employee_no', field_type: 'string', field_length: '50', is_required: '否', description: '工号' },
    { field_name: 'department', field_type: 'string', field_length: '50', is_required: '否', description: '所属部门' },
    { field_name: 'position', field_type: 'string', field_length: '50', is_required: '否', description: '岗位名称' },
    { field_name: 'role_id', field_type: 'integer', field_length: '-', is_required: '否', description: '角色ID，关联 sys_role.role_id' },
    { field_name: 'phone', field_type: 'string', field_length: '20', is_required: '否', description: '联系手机号' },
    { field_name: 'email', field_type: 'string', field_length: '100', is_required: '否', description: '邮箱地址' },
    { field_name: 'avatar_url', field_type: 'string', field_length: '255', is_required: '否', description: '头像地址' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '账户状态：1启用 0禁用' },
    { field_name: 'last_login_time', field_type: 'date', field_length: '-', is_required: '否', description: '最后登录时间' },
    { field_name: 'last_login_ip', field_type: 'string', field_length: '45', is_required: '否', description: '最后登录IP' },
    { field_name: 'pwd_reset_required', field_type: 'tinyint', field_length: '-', is_required: '是', description: '首次登录需改密：0否 1是' },
    { field_name: 'created_by', field_type: 'string', field_length: '50', is_required: '否', description: '创建人ID' },
    { field_name: 'remarks', field_type: 'string', field_length: '500', is_required: '否', description: '备注信息' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  sys_role: [
    { field_name: 'role_id', field_type: 'integer', field_length: '-', is_required: '是', description: '角色ID，主键，自增' },
    { field_name: 'role_name', field_type: 'string', field_length: '50', is_required: '是', description: '角色名称' },
    { field_name: 'role_code', field_type: 'string', field_length: '50', is_required: '是', description: '角色编码，唯一' },
    { field_name: 'type', field_type: 'string', field_length: '20', is_required: '否', description: '类型：系统默认/可选' },
    { field_name: 'is_system_default', field_type: 'tinyint', field_length: '-', is_required: '是', description: '是否系统默认角色：0否 1是' },
    { field_name: 'description', field_type: 'string', field_length: '200', is_required: '否', description: '角色描述' },
    { field_name: 'scope', field_type: 'string', field_length: '50', is_required: '否', description: '权限范围说明' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0停用' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  sys_permission: [
    { field_name: 'perm_id', field_type: 'integer', field_length: '-', is_required: '是', description: '权限ID，主键，自增' },
    { field_name: 'parent_id', field_type: 'integer', field_length: '-', is_required: '是', description: '父级权限ID，0表示顶级' },
    { field_name: 'perm_name', field_type: 'string', field_length: '50', is_required: '是', description: '权限名称' },
    { field_name: 'perm_code', field_type: 'string', field_length: '100', is_required: '是', description: '权限编码，唯一' },
    { field_name: 'type', field_type: 'string', field_length: '20', is_required: '是', description: '类型：menu/page/button/api' },
    { field_name: 'icon', field_type: 'string', field_length: '100', is_required: '否', description: '图标名称' },
    { field_name: 'path', field_type: 'string', field_length: '200', is_required: '否', description: '前端路由路径' },
    { field_name: 'component', field_type: 'string', field_length: '200', is_required: '否', description: '组件路径' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'visible', field_type: 'tinyint', field_length: '-', is_required: '是', description: '是否在菜单显示：0隐藏 1显示' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0禁用' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
  ],
  sys_role_permission: [
    { field_name: 'id', field_type: 'integer', field_length: '-', is_required: '是', description: '主键ID，自增' },
    { field_name: 'role_id', field_type: 'integer', field_length: '-', is_required: '是', description: '角色ID' },
    { field_name: 'perm_id', field_type: 'integer', field_length: '-', is_required: '是', description: '权限ID' },
  ],
  sys_operation_log: [
    { field_name: 'log_id', field_type: 'integer', field_length: '-', is_required: '是', description: '日志ID，主键，自增' },
    { field_name: 'user_id', field_type: 'integer', field_length: '-', is_required: '否', description: '操作用户ID' },
    { field_name: 'username', field_type: 'string', field_length: '50', is_required: '否', description: '操作用户名' },
    { field_name: 'module', field_type: 'string', field_length: '50', is_required: '否', description: '操作模块' },
    { field_name: 'action', field_type: 'string', field_length: '50', is_required: '否', description: '操作类型' },
    { field_name: 'operation', field_type: 'string', field_length: '100', is_required: '否', description: '操作名称' },
    { field_name: 'content', field_type: 'text', field_length: '-', is_required: '否', description: '操作内容' },
    { field_name: 'method', field_type: 'string', field_length: '10', is_required: '否', description: '请求方法：GET/POST/PUT/DELETE' },
    { field_name: 'params', field_type: 'text', field_length: '-', is_required: '否', description: '请求参数' },
    { field_name: 'ip', field_type: 'string', field_length: '45', is_required: '否', description: 'IP地址' },
    { field_name: 'ip_address', field_type: 'string', field_length: '45', is_required: '否', description: 'IP地址（冗余）' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1成功 0失败' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '操作时间' },
  ],
  sys_config: [
    { field_name: 'config_id', field_type: 'integer', field_length: '-', is_required: '是', description: '配置ID，主键，自增' },
    { field_name: 'config_key', field_type: 'string', field_length: '100', is_required: '是', description: '配置键名，唯一' },
    { field_name: 'config_value', field_type: 'text', field_length: '-', is_required: '否', description: '配置值' },
    { field_name: 'config_type', field_type: 'string', field_length: '20', is_required: '是', description: '配置类型：string/number/boolean/json' },
    { field_name: 'config_group', field_type: 'string', field_length: '50', is_required: '是', description: '配置分组：security/system/business' },
    { field_name: 'config_desc', field_type: 'string', field_length: '200', is_required: '否', description: '配置说明' },
    { field_name: 'updated_by', field_type: 'string', field_length: '50', is_required: '否', description: '更新人' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  sys_sequence: [
    { field_name: 'seq_id', field_type: 'integer', field_length: '-', is_required: '是', description: '序列ID，主键，自增' },
    { field_name: 'seq_key', field_type: 'string', field_length: '50', is_required: '是', description: '序列键，如ORDER/WORK_ORDER' },
    { field_name: 'seq_date', field_type: 'string', field_length: '20', is_required: '是', description: '序列日期，YYYYMMDD或YYYY' },
    { field_name: 'current_value', field_type: 'integer', field_length: '-', is_required: '是', description: '当前序号值' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  sys_number_rule: [
    { field_name: 'rule_id', field_type: 'integer', field_length: '-', is_required: '是', description: '规则ID，主键，自增' },
    { field_name: 'rule_name', field_type: 'string', field_length: '100', is_required: '是', description: '规则名称' },
    { field_name: 'rule_code', field_type: 'string', field_length: '50', is_required: '是', description: '规则编码，唯一' },
    { field_name: 'prefix', field_type: 'string', field_length: '20', is_required: '是', description: '前缀' },
    { field_name: 'date_format', field_type: 'string', field_length: '20', is_required: '是', description: '日期格式：none/YYMMDD/YYYYMMDD/YYYY' },
    { field_name: 'separator', field_type: 'string', field_length: '5', is_required: '是', description: '分隔符' },
    { field_name: 'seq_width', field_type: 'integer', field_length: '-', is_required: '是', description: '序号位数' },
    { field_name: 'reset_by', field_type: 'string', field_length: '20', is_required: '是', description: '重置周期：daily/yearly/never' },
    { field_name: 'target_table', field_type: 'string', field_length: '100', is_required: '否', description: '关联表名' },
    { field_name: 'target_field', field_type: 'string', field_length: '100', is_required: '否', description: '关联字段名' },
    { field_name: 'target_label', field_type: 'string', field_length: '100', is_required: '否', description: '关联字段中文说明' },
    { field_name: 'current_no', field_type: 'string', field_length: '50', is_required: '否', description: '当前最新编号' },
    { field_name: 'used_count', field_type: 'integer', field_length: '-', is_required: '是', description: '已使用记录数' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：0停用 1启用' },
    { field_name: 'is_locked', field_type: 'tinyint', field_length: '-', is_required: '是', description: '是否已审核：0否 1是' },
    { field_name: 'description', field_type: 'string', field_length: '500', is_required: '否', description: '规则说明' },
    { field_name: 'created_by', field_type: 'string', field_length: '50', is_required: '否', description: '创建人' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  bas_material: [
    { field_name: 'material_id', field_type: 'uuid', field_length: '-', is_required: '是', description: '料品ID，主键，UUID' },
    { field_name: 'category_name', field_type: 'string', field_length: '50', is_required: '是', description: '分类名称' },
    { field_name: 'material_code', field_type: 'string', field_length: '50', is_required: '是', description: '料号，唯一' },
    { field_name: 'material_name', field_type: 'string', field_length: '200', is_required: '是', description: '品名' },
    { field_name: 'specification', field_type: 'string', field_length: '200', is_required: '否', description: '规格' },
    { field_name: 'unit_name', field_type: 'string', field_length: '50', is_required: '是', description: '计量单位' },
    { field_name: 'film_no', field_type: 'string', field_length: '50', is_required: '否', description: '菲林编号' },
    { field_name: 'version_no', field_type: 'string', field_length: '50', is_required: '否', description: '版本号' },
    { field_name: 'cutting_size', field_type: 'string', field_length: '50', is_required: '否', description: '裁切尺寸' },
    { field_name: 'printing_process', field_type: 'string', field_length: '50', is_required: '否', description: '印刷工艺' },
    { field_name: 'color_separation', field_type: 'string', field_length: '50', is_required: '否', description: '分色' },
    { field_name: 'blanking_diameter', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '落料直径' },
    { field_name: 'material_thickness', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '材料厚度' },
    { field_name: 'material_width', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '材料宽度' },
    { field_name: 'material_height', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '材料高度' },
    { field_name: 'scrap_weight', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '废料重量' },
    { field_name: 'unit_weight', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '单重' },
    { field_name: 'unit_volume', field_type: 'decimal', field_length: '11,2', is_required: '否', description: '单件体积' },
    { field_name: 'weight_unit', field_type: 'string', field_length: '20', is_required: '否', description: '重量单位' },
    { field_name: 'volume_unit', field_type: 'string', field_length: '20', is_required: '否', description: '体积单位' },
    { field_name: 'inventory_category', field_type: 'string', field_length: '20', is_required: '否', description: '库存分类' },
    { field_name: 'unit_code', field_type: 'string', field_length: '20', is_required: '否', description: '单位编码' },
    { field_name: 'customer_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联客户ID' },
    { field_name: 'is_active', field_type: 'boolean', field_length: '-', is_required: '是', description: '是否启用' },
    { field_name: 'effective_date', field_type: 'date', field_length: '-', is_required: '是', description: '生效日期' },
    { field_name: 'expiry_date', field_type: 'date', field_length: '-', is_required: '是', description: '失效日期' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  bas_customer: [
    { field_name: 'customer_id', field_type: 'integer', field_length: '-', is_required: '是', description: '客户ID，主键，自增' },
    { field_name: 'customer_code', field_type: 'string', field_length: '50', is_required: '是', description: '客户编号，唯一' },
    { field_name: 'customer_name', field_type: 'string', field_length: '200', is_required: '是', description: '客户名称' },
    { field_name: 'short_name', field_type: 'string', field_length: '100', is_required: '否', description: '客户简称' },
    { field_name: 'customer_category', field_type: 'string', field_length: '50', is_required: '否', description: '客户分类' },
    { field_name: 'customer_type', field_type: 'string', field_length: '50', is_required: '否', description: '客户类型' },
    { field_name: 'contact_person', field_type: 'string', field_length: '50', is_required: '否', description: '联系人' },
    { field_name: 'phone', field_type: 'string', field_length: '50', is_required: '否', description: '联系电话' },
    { field_name: 'email', field_type: 'string', field_length: '100', is_required: '否', description: '邮箱' },
    { field_name: 'address', field_type: 'string', field_length: '300', is_required: '否', description: '联系地址' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0停用' },
    { field_name: 'effective_date', field_type: 'dateonly', field_length: '-', is_required: '否', description: '生效日期' },
    { field_name: 'expiry_date', field_type: 'dateonly', field_length: '-', is_required: '否', description: '失效日期' },
    { field_name: 'credit_level', field_type: 'string', field_length: '20', is_required: '否', description: '信用等级：A/B/C/D' },
    { field_name: 'tax_id', field_type: 'string', field_length: '50', is_required: '否', description: '纳税人识别号' },
    { field_name: 'bank_account', field_type: 'string', field_length: '50', is_required: '否', description: '银行账号' },
    { field_name: 'bank_name', field_type: 'string', field_length: '100', is_required: '否', description: '开户银行' },
    { field_name: 'remark', field_type: 'string', field_length: '500', is_required: '否', description: '备注' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'created_by', field_type: 'string', field_length: '50', is_required: '否', description: '创建人' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  master_production_line: [
    { field_name: 'line_id', field_type: 'integer', field_length: '-', is_required: '是', description: '产线ID，主键，自增' },
    { field_name: 'line_code', field_type: 'string', field_length: '50', is_required: '是', description: '产线编号，唯一' },
    { field_name: 'line_name', field_type: 'string', field_length: '100', is_required: '是', description: '产线名称' },
    { field_name: 'workshop', field_type: 'string', field_length: '50', is_required: '否', description: '所属车间' },
    { field_name: 'line_leader', field_type: 'string', field_length: '50', is_required: '否', description: '产线负责人' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1运行中 2维护中 0停用' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  master_process: [
    { field_name: 'process_id', field_type: 'integer', field_length: '-', is_required: '是', description: '工序ID，主键，自增' },
    { field_name: 'process_code', field_type: 'string', field_length: '30', is_required: '是', description: '工序编码，唯一' },
    { field_name: 'process_name', field_type: 'string', field_length: '50', is_required: '是', description: '工序名称' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0停用' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  master_device: [
    { field_name: 'device_id', field_type: 'integer', field_length: '-', is_required: '是', description: '设备ID，主键，自增' },
    { field_name: 'device_code', field_type: 'string', field_length: '50', is_required: '是', description: '设备编号，唯一' },
    { field_name: 'device_name', field_type: 'string', field_length: '100', is_required: '是', description: '设备名称' },
    { field_name: 'device_type', field_type: 'string', field_length: '50', is_required: '否', description: '设备类型' },
    { field_name: 'device_model', field_type: 'string', field_length: '100', is_required: '否', description: '设备型号' },
    { field_name: 'serial_no', field_type: 'string', field_length: '100', is_required: '否', description: '出厂编号' },
    { field_name: 'location', field_type: 'string', field_length: '100', is_required: '否', description: '安装位置' },
    { field_name: 'line_id', field_type: 'integer', field_length: '-', is_required: '否', description: '所属产线ID' },
    { field_name: 'responsible_person', field_type: 'string', field_length: '50', is_required: '否', description: '责任人' },
    { field_name: 'is_special', field_type: 'boolean', field_length: '-', is_required: '是', description: '是否特种设备' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1运行 0停用 2维修' },
    { field_name: 'last_inspection_date', field_type: 'dateonly', field_length: '-', is_required: '否', description: '上次检定日期' },
    { field_name: 'inspection_cycle', field_type: 'string', field_length: '50', is_required: '否', description: '检定周期' },
    { field_name: 'next_inspection_date', field_type: 'dateonly', field_length: '-', is_required: '否', description: '下次检定日期' },
    { field_name: 'manufacturer', field_type: 'string', field_length: '100', is_required: '否', description: '制造商' },
    { field_name: 'purchase_date', field_type: 'dateonly', field_length: '-', is_required: '否', description: '购置日期' },
    { field_name: 'warranty_end', field_type: 'dateonly', field_length: '-', is_required: '否', description: '保修截止日期' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  master_defect_type: [
    { field_name: 'defect_id', field_type: 'integer', field_length: '-', is_required: '是', description: '不良ID，主键，自增' },
    { field_name: 'defect_code', field_type: 'string', field_length: '50', is_required: '是', description: '不良编码，唯一' },
    { field_name: 'defect_name', field_type: 'string', field_length: '100', is_required: '是', description: '不良名称' },
    { field_name: 'defect_type', field_type: 'string', field_length: '50', is_required: '否', description: '分类名称，下拉可选项（来料不良/制程不良/检验报废），上级分类ID为大类名称ID' },
    { field_name: 'category_name', field_type: 'string', field_length: '50', is_required: '否', description: '大类名称（下拉可选项"来料检验类/制程检验类"），上级分类ID为0' },
    { field_name: 'parent_id', field_type: 'integer', field_length: '-', is_required: '是', description: '上级分类ID，0表示顶级' },
    { field_name: 'defect_unit', field_type: 'string', field_length: '20', is_required: '否', description: '默认单位' },
    { field_name: 'available_units', field_type: 'string', field_length: '255', is_required: '否', description: '可选单位（逗号分隔）' },
    { field_name: 'display', field_type: 'boolean', field_length: '-', is_required: '是', description: '是否显示' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0停用' },
    { field_name: 'related_processes', field_type: 'string', field_length: '255', is_required: '否', description: '关联工序ID（逗号分隔）' },
    { field_name: 'category_desc', field_type: 'string', field_length: '500', is_required: '否', description: '不良描述' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  bas_line_process: [
    { field_name: 'id', field_type: 'integer', field_length: '-', is_required: '是', description: '主键ID，自增' },
    { field_name: 'line_id', field_type: 'integer', field_length: '-', is_required: '是', description: '产线ID' },
    { field_name: 'process_id', field_type: 'integer', field_length: '-', is_required: '是', description: '工序ID' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：1启用 0停用' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  bas_line_device: [
    { field_name: 'id', field_type: 'integer', field_length: '-', is_required: '是', description: '主键ID，自增' },
    { field_name: 'line_id', field_type: 'integer', field_length: '-', is_required: '是', description: '产线ID' },
    { field_name: 'device_id', field_type: 'integer', field_length: '-', is_required: '是', description: '设备ID' },
    { field_name: 'process_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联工序ID' },
    { field_name: 'sort_order', field_type: 'integer', field_length: '-', is_required: '否', description: '排序号' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  production_order: [
    { field_name: 'order_id', field_type: 'integer', field_length: '-', is_required: '是', description: '订单ID，主键，自增' },
    { field_name: 'order_no', field_type: 'string', field_length: '50', is_required: '是', description: '订单编号，唯一' },
    { field_name: 'material_id', field_type: 'uuid', field_length: '-', is_required: '否', description: '料品ID' },
    { field_name: 'material_code', field_type: 'string', field_length: '50', is_required: '否', description: '料号（冗余）' },
    { field_name: 'material_name', field_type: 'string', field_length: '100', is_required: '否', description: '料品名称（冗余）' },
    { field_name: 'specification', field_type: 'string', field_length: '200', is_required: '否', description: '规格（冗余）' },
    { field_name: 'film_version', field_type: 'string', field_length: '50', is_required: '否', description: '菲林版本' },
    { field_name: 'version_no', field_type: 'string', field_length: '50', is_required: '否', description: '版本号' },
    { field_name: 'planned_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '计划数量' },
    { field_name: 'finished_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '完成数量' },
    { field_name: 'plan_start_time', field_type: 'date', field_length: '-', is_required: '否', description: '计划开始时间' },
    { field_name: 'plan_end_time', field_type: 'date', field_length: '-', is_required: '否', description: '计划结束时间' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：0开立 1已下达 2已关闭' },
    { field_name: 'release_time', field_type: 'date', field_length: '-', is_required: '否', description: '下达时间' },
    { field_name: 'close_time', field_type: 'date', field_length: '-', is_required: '否', description: '关闭时间' },
    { field_name: 'created_by', field_type: 'string', field_length: '50', is_required: '否', description: '创建人' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  production_work_order: [
    { field_name: 'work_order_id', field_type: 'integer', field_length: '-', is_required: '是', description: '工单ID，主键，自增' },
    { field_name: 'work_order_no', field_type: 'string', field_length: '50', is_required: '是', description: '工单编号，唯一' },
    { field_name: 'order_id', field_type: 'integer', field_length: '-', is_required: '否', description: '所属订单ID' },
    { field_name: 'order_no', field_type: 'string', field_length: '50', is_required: '否', description: '订单编号（冗余）' },
    { field_name: 'line_id', field_type: 'integer', field_length: '-', is_required: '否', description: '产线ID' },
    { field_name: 'line_name', field_type: 'string', field_length: '100', is_required: '否', description: '产线名称（冗余）' },
    { field_name: 'material_id', field_type: 'uuid', field_length: '-', is_required: '否', description: '料品ID' },
    { field_name: 'material_name', field_type: 'string', field_length: '100', is_required: '否', description: '料品名称（冗余）' },
    { field_name: 'target_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '目标数量' },
    { field_name: 'finished_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '完成数量' },
    { field_name: 'start_time', field_type: 'date', field_length: '-', is_required: '否', description: '开工时间' },
    { field_name: 'finish_time', field_type: 'date', field_length: '-', is_required: '否', description: '完工时间' },
    { field_name: 'total_hours', field_type: 'decimal', field_length: '10,2', is_required: '是', description: '总工时' },
    { field_name: 'effective_hours', field_type: 'decimal', field_length: '10,2', is_required: '是', description: '有效工时' },
    { field_name: 'labor_hours', field_type: 'decimal', field_length: '10,2', is_required: '是', description: '人工工时' },
    { field_name: 'status', field_type: 'tinyint', field_length: '-', is_required: '是', description: '状态：0开立 1开工 2关闭 3完工' },
    { field_name: 'created_by', field_type: 'string', field_length: '50', is_required: '否', description: '创建人' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
    { field_name: 'updated_at', field_type: 'date', field_length: '-', is_required: '否', description: '更新时间' },
  ],
  production_process_report: [
    { field_name: 'report_id', field_type: 'integer', field_length: '-', is_required: '是', description: '报工记录ID，主键，自增' },
    { field_name: 'work_order_id', field_type: 'integer', field_length: '-', is_required: '否', description: '工单ID' },
    { field_name: 'work_order_no', field_type: 'string', field_length: '50', is_required: '否', description: '工单编号（冗余）' },
    { field_name: 'process_id', field_type: 'integer', field_length: '-', is_required: '否', description: '工序ID' },
    { field_name: 'process_name', field_type: 'string', field_length: '100', is_required: '否', description: '工序名称（冗余）' },
    { field_name: 'input_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '投入数量' },
    { field_name: 'defect_material', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '来料不良数' },
    { field_name: 'defect_process', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '制程不良数' },
    { field_name: 'defect_scrap', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '检验报废数' },
    { field_name: 'output_qty', field_type: 'decimal', field_length: '12,2', is_required: '是', description: '产出数量' },
    { field_name: 'device_id', field_type: 'integer', field_length: '-', is_required: '否', description: '使用设备ID' },
    { field_name: 'device_name', field_type: 'string', field_length: '100', is_required: '否', description: '设备名称（冗余）' },
    { field_name: 'report_user', field_type: 'string', field_length: '50', is_required: '否', description: '报工人ID' },
    { field_name: 'report_user_name', field_type: 'string', field_length: '50', is_required: '否', description: '报工人姓名（冗余）' },
    { field_name: 'report_time', field_type: 'date', field_length: '-', is_required: '否', description: '报工时间' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
  ],
  production_manpower_record: [
    { field_name: 'record_id', field_type: 'integer', field_length: '-', is_required: '是', description: '记录ID，主键，自增' },
    { field_name: 'work_order_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联工单ID' },
    { field_name: 'work_order_no', field_type: 'string', field_length: '50', is_required: '否', description: '工单编号（冗余）' },
    { field_name: 'skilled_workers', field_type: 'integer', field_length: '-', is_required: '是', description: '技工人数' },
    { field_name: 'general_workers', field_type: 'integer', field_length: '-', is_required: '是', description: '普工人数' },
    { field_name: 'contract_workers', field_type: 'integer', field_length: '-', is_required: '是', description: '劳务工人数' },
    { field_name: 'auxiliary_workers', field_type: 'integer', field_length: '-', is_required: '是', description: '辅助人数' },
    { field_name: 'remarks', field_type: 'string', field_length: '500', is_required: '否', description: '备注' },
    { field_name: 'record_user', field_type: 'string', field_length: '50', is_required: '否', description: '记录人ID' },
    { field_name: 'record_user_name', field_type: 'string', field_length: '50', is_required: '否', description: '记录人姓名（冗余）' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
  ],
  production_exception_record: [
    { field_name: 'record_id', field_type: 'integer', field_length: '-', is_required: '是', description: '记录ID，主键，自增' },
    { field_name: 'work_order_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联工单ID' },
    { field_name: 'work_order_no', field_type: 'string', field_length: '50', is_required: '否', description: '工单编号（冗余）' },
    { field_name: 'order_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联订单ID' },
    { field_name: 'order_no', field_type: 'string', field_length: '50', is_required: '否', description: '订单编号（冗余）' },
    { field_name: 'exception_type', field_type: 'string', field_length: '50', is_required: '否', description: '异常类型' },
    { field_name: 'exception_type_name', field_type: 'string', field_length: '100', is_required: '否', description: '异常类型名称' },
    { field_name: 'device_id', field_type: 'integer', field_length: '-', is_required: '否', description: '关联设备ID' },
    { field_name: 'device_name', field_type: 'string', field_length: '100', is_required: '否', description: '设备名称（冗余）' },
    { field_name: 'start_time', field_type: 'date', field_length: '-', is_required: '否', description: '异常开始时间' },
    { field_name: 'end_time', field_type: 'date', field_length: '-', is_required: '否', description: '异常结束时间' },
    { field_name: 'duration', field_type: 'decimal', field_length: '10,2', is_required: '是', description: '时长（分钟）' },
    { field_name: 'reason', field_type: 'string', field_length: '500', is_required: '否', description: '异常原因' },
    { field_name: 'handle_result', field_type: 'string', field_length: '500', is_required: '否', description: '处理结果' },
    { field_name: 'record_user', field_type: 'string', field_length: '50', is_required: '否', description: '记录人ID' },
    { field_name: 'record_user_name', field_type: 'string', field_length: '50', is_required: '否', description: '记录人姓名（冗余）' },
    { field_name: 'created_at', field_type: 'date', field_length: '-', is_required: '是', description: '创建时间' },
  ],
}

function getTableFields(tableName) {
  return tableFieldsMap[tableName] || []
}

const categoryColorMap = { '系统表': 'blue', '基础数据表': 'green', '业务表': 'orange' }

export default function DataDictionary() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentTable, setCurrentTable] = useState(null)

  const totalFields = dbTables.reduce((sum, t) => sum + t.field_count, 0)
  const totalRecords = dbTables.reduce((sum, t) => sum + t.record_count, 0)

  const stats = [
    { label: '总表数', value: dbTables.length, icon: <DatabaseOutlined />, color: '#2196F3' },
    { label: '总字段数', value: totalFields, icon: <FieldNumberOutlined />, color: '#00BCD4' },
    { label: '总记录数', value: totalRecords.toLocaleString(), icon: <TableOutlined />, color: '#FF9800' },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索表名', col: { span: 8 } },
    {
      type: 'select', placeholder: '分类筛选', col: { span: 8 },
      options: [
        { label: '全部', value: '全部' },
        { label: '系统表', value: '系统表' },
        { label: '基础数据表', value: '基础数据表' },
        { label: '业务表', value: '业务表' },
      ],
    },
  ]

  const handleViewStructure = (record) => {
    setCurrentTable(record)
    setDrawerOpen(true)
  }

  const columns = [
    {
      title: '序号', key: 'index', width: 60,
      render: (_, __, index) => index + 1,
    },
    { title: '表名', dataIndex: 'table_name', key: 'table_name' },
    { title: '字段数', dataIndex: 'field_count', key: 'field_count', width: 80 },
    {
      title: '记录数', dataIndex: 'record_count', key: 'record_count', width: 90,
      render: v => v.toLocaleString(),
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 110,
      render: v => <Tag color={categoryColorMap[v]}>{v}</Tag>,
    },
    { title: '最后更新时间', dataIndex: 'last_update', key: 'last_update', width: 170 },
    { title: '表用途说明', dataIndex: 'purpose', key: 'purpose' },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewStructure(record)}>查看结构</Button>
      ),
    },
  ]

  const fieldColumns = [
    { title: '字段名', dataIndex: 'field_name', key: 'field_name' },
    { title: '类型', dataIndex: 'field_type', key: 'field_type', width: 90 },
    { title: '长度', dataIndex: 'field_length', key: 'field_length', width: 80 },
    {
      title: '必填', dataIndex: 'is_required', key: 'is_required', width: 70,
      render: v => v === '是' ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
    },
    { title: '说明', dataIndex: 'description', key: 'description' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="数据库字典"
        breadcrumbs="系统管理 / 数据库字典"
        stats={stats}
        filters={filters}
        table={
          <Table
            columns={columns}
            dataSource={dbTables}
            rowKey="table_name"
            size="small"
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Drawer
        title="表结构详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
      >
        {currentTable && (
          <>
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
              <Title level={5} style={{ marginBottom: 8 }}>
                <FileSearchOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />
                {currentTable.table_name}
              </Title>
              <div style={{ marginBottom: 4 }}>
                <Tag color={categoryColorMap[currentTable.category]}>{currentTable.category}</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>字段数：{currentTable.field_count}</Text>
                <Text type="secondary" style={{ marginLeft: 16 }}>记录数：{currentTable.record_count.toLocaleString()}</Text>
              </div>
              <div style={{ marginTop: 8 }}>
                <Text strong>用途说明：</Text>
                <Text>{currentTable.purpose}</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">最后更新时间：{currentTable.last_update}</Text>
              </div>
            </div>
            <Title level={5} style={{ marginBottom: 12 }}>字段列表</Title>
            <Table
              columns={fieldColumns}
              dataSource={getTableFields(currentTable.table_name)}
              rowKey="field_name"
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
