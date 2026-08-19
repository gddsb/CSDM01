#!/bin/bash
set -e
cd /opt/milk-can-mes
echo "===== 1. 拉取最新代码 ====="
git fetch origin main 2>&1 | tail -3
git reset --hard origin/main 2>&1 | tail -2
echo "当前 HEAD: $(git rev-parse --short HEAD)"

echo ""
echo "===== 2. 数据库备份 ====="
DB_NAME="milk_can_mes"
DB_USER="root"
DB_PASS="123456"
DB_HOST="127.0.0.1"
BACKUP_DIR="/opt/milk-can-mes/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre_unified_inspection_$(date +%Y%m%d_%H%M%S).sql"
echo "备份到: $BACKUP_FILE"
mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null
ls -lh "$BACKUP_FILE"

echo ""
echo "===== 3. 运行迁移SQL（建表+加字段）====="
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < /opt/milk-can-mes/server/src/migrations/005-quality-unified-inspection.sql 2>&1 | grep -v "Warning"
echo "迁移SQL执行完成"

echo ""
echo "===== 4. 验证表结构 ====="
echo "--- qc_inspection_item ---"
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESC qc_inspection_item;" 2>/dev/null
echo "--- qc_inspection_sample_value ---"
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESC qc_inspection_sample_value;" 2>/dev/null
echo "--- quality_inspection_standard_item 新字段 ---"
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW COLUMNS FROM quality_inspection_standard_item LIKE 'item_type'; SHOW COLUMNS FROM quality_inspection_standard_item LIKE 'upper_limit';" 2>/dev/null
