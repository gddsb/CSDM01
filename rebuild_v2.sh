#!/bin/bash
# ============================================================
# MES 一键重建（deploy.sh + build-apk.sh 组合）
#
# 向后兼容：习惯 ./rebuild_v2.sh 的用户继续用这个入口，
# 实际上拆成两步：
#   1. deploy.sh    → git pull + Vite build + tsc + PM2 restart（~30s）
#   2. build-apk.sh → Capacitor sync + Gradle assembleRelease（~4min）
#
# 如果只想快速部署 H5（不编译 APK），直接跑 ./deploy.sh 即可
# 如果只想单独编译 APK（H5 已部署过），直接跑 ./build-apk.sh 即可
#
# 所有参数（--notes / --version / --build）会同时传给两个脚本
# ============================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "============================================================"
echo "  MES 一键重建 → deploy.sh + build-apk.sh"
echo "============================================================"
echo ""

# Step 1: H5 快速部署
echo "→ 第一步：deploy.sh (H5 更新, ~30s)"
bash deploy.sh "$@"

echo ""
echo "============================================================"
echo "→ 第二步：build-apk.sh (APK 编译, ~4min)"
echo "============================================================"
echo ""

# Step 2: APK 编译
bash build-apk.sh "$@"

echo ""
echo "============================================================"
echo "  全部完成！H5 + APK 均已更新"
echo "============================================================"
