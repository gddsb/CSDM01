-- Umzug migration: 创建 sys_system_log 表（系统日志表）
-- 方案 B：系统日志改为从 DB 读取，替代 pm2 文件解析（已废弃）
-- pino logger 通过 DB hook 批量写入，不阻塞主流程
-- 同时修复旧 SystemLogController 读错路径 + pino JSON 解析问题

CREATE TABLE IF NOT EXISTS `sys_system_log` (
  `log_id`      int NOT NULL AUTO_INCREMENT COMMENT '日志ID（主键）',
  `level`       varchar(10) NOT NULL COMMENT '日志级别（INFO/WARN/ERROR）',
  `category`    varchar(50) DEFAULT NULL COMMENT '日志分类（request/auth/migration/sync 等）',
  `message`     text COMMENT '日志消息（人类可读摘要）',
  `details`     text COMMENT '完整 JSON 载荷（pino 原始 log 对象）',
  `duration_ms` int DEFAULT NULL COMMENT '请求耗时（毫秒，仅 request 类日志）',
  `path`        varchar(255) DEFAULT NULL COMMENT '请求路径（仅 request 类日志）',
  `method`      varchar(10) DEFAULT NULL COMMENT 'HTTP 方法（仅 request 类日志）',
  `status`      int DEFAULT NULL COMMENT 'HTTP 状态码（仅 request 类日志）',
  `source`      varchar(100) DEFAULT NULL COMMENT '日志来源模块',
  `created_at`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`log_id`),
  KEY `idx_ssl_level` (`level`),
  KEY `idx_ssl_created_at` (`created_at`),
  KEY `idx_ssl_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统日志表：记录 pino 结构化日志，用于运维诊断';
