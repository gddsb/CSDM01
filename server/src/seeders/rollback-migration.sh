#!/usr/bin/env bash
# 检验数据统一存储改造（阶段2.7）
# 从备份恢复 6 张迁移相关表 + 配置表
#
# 用法：
#   bash server/src/seeders/rollback-migration.sh <备份文件路径>
#   bash server/src/seeders/rollback-migration.sh /opt/milk-can-mes/backups/qcms-migration-20260819_120000.sql.gz
#
# 注意：远程非交互执行时，请加 --yes 参数跳过确认
#   bash server/src/seeders/rollback-migration.sh --yes <备份文件路径>
set -euo pipefail

# 参数解析
CONFIRM="no"
BACKUP_FILE=""
for arg in "$@"; do
  if [[ "$arg" == "--yes" ]]; then
    CONFIRM="yes"
  elif [[ -z "$BACKUP_FILE" ]]; then
    BACKUP_FILE="$arg"
  fi
done

if [[ -z "$BACKUP_FILE" ]]; then
  # 未指定备份文件，默认取最新的
  ENV_FILE="${ENV_FILE:-$(dirname "$0")/../../.env}"
  if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
  fi
  BACKUP_DIR="${BACKUP_DIR:-/opt/milk-can-mes/backups}"
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/qcms-migration-*.sql.gz 2>/dev/null | head -1)
  if [[ -z "$BACKUP_FILE" ]]; then
    echo "错误：未指定备份文件，且 ${BACKUP_DIR}/qcms-migration-*.sql.gz 不存在"
    echo "用法：bash $0 <备份文件路径> [--yes]"
    exit 1
  fi
  echo "==> 自动选用最新备份：$BACKUP_FILE"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "错误：备份文件不存在 $BACKUP_FILE"
  exit 1
fi

# 从环境变量读取数据库配置
ENV_FILE="${ENV_FILE:-$(dirname "$0")/../.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASSWORD:-${DB_PASS:-}}"
DB_NAME="${DB_NAME:-milk_can_mes}"

if [[ "$CONFIRM" != "yes" ]]; then
  echo "==> 即将从 $BACKUP_FILE 恢复，会覆盖 ${DB_NAME} 中 6 张表数据"
  echo "==> 确认请重新执行并加 --yes 参数："
  echo "    bash $0 --yes $BACKUP_FILE"
  exit 1
fi

echo "==> 恢复备份: $BACKUP_FILE"
echo "    目标 DB: ${DB_HOST}:${DB_PORT}/${DB_NAME} user=${DB_USER}"

# 备份文件是 gzip 压缩的 sql，先 gunzip 解压再管道给 mysql
gunzip -c "$BACKUP_FILE" | mysql \
  -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
  ${DB_PASS:+-p"$DB_PASS"} \
  "$DB_NAME"

echo "==> 恢复完成"
echo "==> 建议执行一致性校验：cd server && npx tsx src/seeders/verify-migration.ts"
