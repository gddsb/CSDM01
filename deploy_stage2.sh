#!/bin/bash
# 检验数据统一存储改造（阶段2）部署脚本
# 在测试服务器上执行：拉代码 + 备份 + 三旧子表迁移 + sample_value 迁移 + 一致性校验
#
# 用法：
#   bash /opt/milk-can-mes/deploy_stage2.sh           # 默认全流程
#   bash /opt/milk-can-mes/deploy_stage2.sh --dry-run  # 仅统计不写入
#   bash /opt/milk-can-mes/deploy_stage2.sh --skip-pull # 跳过 git pull
#   bash /opt/milk-can-mes/deploy_stage2.sh --only verify  # 仅跑校验
set -e

PROJECT_DIR="/opt/milk-can-mes"
SERVER_DIR="$PROJECT_DIR/server"
DB_NAME="milk_can_mes"
DB_USER="root"
DB_PASS="123456"
DB_HOST="127.0.0.1"

# 解析参数
DRY_RUN=""
SKIP_PULL=""
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="--dry-run"; shift ;;
    --skip-pull) SKIP_PULL="1"; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    --only=*) ONLY="${1#--only=}"; shift ;;
    *) shift ;;
  esac
done

cd "$PROJECT_DIR"

if [[ -z "$SKIP_PULL" && "$ONLY" != "verify" ]]; then
  echo "===== 1. 拉取最新代码 ====="
  git fetch origin main 2>&1 | tail -3
  git reset --hard origin/main 2>&1 | tail -2
  echo "当前 HEAD: $(git rev-parse --short HEAD)"
  echo ""
fi

# 阶段2.1 数据库备份
if [[ -z "$ONLY" || "$ONLY" == "backup" ]]; then
  echo "===== 2. 数据库备份（阶段2.1） ====="
  bash "$SERVER_DIR/src/seeders/backup-before-migration.sh"
  echo ""
fi

# 阶段2.2-2.4 三旧子表迁移
if [[ -z "$ONLY" || "$ONLY" == "items" ]]; then
  echo "===== 3. 三旧子表迁移到 qc_inspection_item（阶段2.2-2.4） ====="
  cd "$SERVER_DIR"
  echo "--- 3.1 来料子表 ---"
  npx tsx src/seeders/migrate-incoming-items.ts $DRY_RUN
  echo ""
  echo "--- 3.2 产品子表 ---"
  npx tsx src/seeders/migrate-product-items.ts $DRY_RUN
  echo ""
  echo "--- 3.3 微生物子表 ---"
  npx tsx src/seeders/migrate-microbe-items.ts $DRY_RUN
  echo ""
  cd "$PROJECT_DIR"
fi

# 阶段2.5 sample_value 迁移
if [[ -z "$ONLY" || "$ONLY" == "samples" ]]; then
  echo "===== 4. sample_value 迁移（阶段2.5） ====="
  cd "$SERVER_DIR"
  npx tsx src/seeders/migrate-sample-values.ts $DRY_RUN
  cd "$PROJECT_DIR"
  echo ""
fi

# 阶段2.6 一致性校验
if [[ -z "$ONLY" || "$ONLY" == "verify" ]]; then
  echo "===== 5. 一致性校验（阶段2.6） ====="
  cd "$SERVER_DIR"
  npx tsx src/seeders/verify-migration.ts || echo "[warn] 校验存在差异，请人工核查"
  cd "$PROJECT_DIR"
  echo ""
fi

# 直接通过 mysql 复核数量
echo "===== 6. 数据库直接复核 ====="
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null <<EOF
SELECT '来料' AS source, (SELECT COUNT(*) FROM quality_incoming_inspection_item) AS old_cnt, (SELECT COUNT(*) FROM qc_inspection_item WHERE source_type='来料') AS new_cnt
UNION ALL
SELECT '产品', (SELECT COUNT(*) FROM quality_product_inspection_item), (SELECT COUNT(*) FROM qc_inspection_item WHERE source_type='产品')
UNION ALL
SELECT '微生物', (SELECT COUNT(*) FROM quality_microbe_inspection_item), (SELECT COUNT(*) FROM qc_inspection_item WHERE source_type='微生物');
SELECT 'sample_value' AS tbl, COUNT(*) AS cnt FROM qc_inspection_sample_value;
EOF

echo ""
echo "===== 阶段2部署完成 ====="
echo "如有差异，回滚命令："
echo "  bash $SERVER_DIR/src/seeders/rollback-migration.sh --yes <备份文件>"
