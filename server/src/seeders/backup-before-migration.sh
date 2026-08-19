#!/usr/bin/env bash
# 检验数据统一存储改造（阶段2.1）
# 迁移前全量备份：三旧子表 + 新子表 + 配置表，失败可回滚
#
# 用法：
#   bash server/src/seeders/backup-before-migration.sh
# 可通过环境变量覆盖：BACKUP_DIR / DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
set -euo pipefail

# 从 server/.env 读取数据库配置（兼容 BACKUP_DIR 自定义）
# 脚本位于 server/src/seeders/，需 ../../ 才到 server/
ENV_FILE="${ENV_FILE:-$(dirname "$0")/../../.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
# 兼容 DB_PASSWORD 与 DB_PASS 两种命名
DB_PASS="${DB_PASSWORD:-${DB_PASS:-}}"
DB_NAME="${DB_NAME:-milk_can_mes}"

BACKUP_DIR="${BACKUP_DIR:-/opt/milk-can-mes/backups}"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/qcms-migration-${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "==> 备份数据库 ${DB_NAME} 至 ${BACKUP_FILE}"
echo "    DB_HOST=${DB_HOST} DB_USER=${DB_USER} DB_NAME=${DB_NAME}"

# 全量备份 6 张迁移相关表 + 配置表（迁移前后对比与回滚用）
mysqldump \
  -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
  ${DB_PASS:+-p"$DB_PASS"} \
  --single-transaction --quick --routines --triggers --no-tablespaces \
  "${DB_NAME}" \
  quality_incoming_inspection_item \
  quality_product_inspection_item \
  quality_microbe_inspection_item \
  qc_inspection_item \
  qc_inspection_sample_value \
  quality_inspection_standard_item \
  | gzip > "$BACKUP_FILE"

SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
echo "==> 备份完成: ${BACKUP_FILE} (${SIZE} bytes)"
echo "==> 回滚命令:"
echo "    bash $(dirname "$0")/rollback-migration.sh ${BACKUP_FILE}"
