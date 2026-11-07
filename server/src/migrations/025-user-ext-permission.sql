-- Migration 025: 用户附加权限表 sys_user_ext_permission
-- 规范 3.7 — 用户级 add/deny 双轨 + terminal 终端维度
-- 幂等实现：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS sys_user_ext_permission (
  id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  user_id       BIGINT       NOT NULL COMMENT '用户标识',
  perm_id       INT          NOT NULL COMMENT '权限标识(对齐 sys_permission.perm_id INT)',
  ext_type      TINYINT      NOT NULL COMMENT '1=add额外授予, 2=deny额外排除',
  terminal      TINYINT      NOT NULL DEFAULT 1 COMMENT '终端: 1=PC端, 2=移动端APP — 规范 3.7',
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1=有效, 0=失效(保留用于审计回溯)',
  create_by     VARCHAR(64)  NULL COMMENT '创建人',
  create_time   DATETIME     NULL COMMENT '创建时间',
  update_by     VARCHAR(64)  NULL COMMENT '更新人',
  update_time   DATETIME     NULL COMMENT '更新时间',
  UNIQUE INDEX uk_user_perm_ext (user_id, perm_id, ext_type, terminal) COMMENT '规范 3.7 唯一约束',
  INDEX idx_user_terminal (user_id, terminal) COMMENT '按用户+终端快速查询',
  INDEX idx_perm (perm_id) COMMENT '按权限查询(审查清理用)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户附加权限表（规范 3.7）— add/deny 双轨 + terminal 维度';
