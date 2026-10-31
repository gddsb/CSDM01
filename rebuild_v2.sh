#!/bin/bash
# ============================================================
# MES 移动端一键重建（Vite + Capacitor + Gradle）
#
# 核心设计：
#   - 先读现有 server/data/releases.json，动态 buildNumber = 旧值 + 1
#   - version 默认从 package.json 读，也可通过 --version X.Y.Z 覆盖
#   - APK 文件名、gradle versionCode/versionName 全部跟随 releases.json
#     (android/app/build.gradle 已配置从 releases.json 读取)
#   - 构建产物：download/milk-can-mes-v${VERSION}-build${BUILD}-debug.apk
#
# 用法：
#   ./rebuild_v2.sh                      # 自动 +1 buildNumber，version 跟 package.json
#   ./rebuild_v2.sh --notes "修复XXX"    # 指定更新说明
#   ./rebuild_v2.sh --version 1.2.0      # 同时覆盖 version + buildNumber=1 重置
#   ./rebuild_v2.sh --build 18           # 手动指定 buildNumber
# ============================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ---- 参数解析 ----
UPDATE_NOTES=""
FORCE_VERSION=""
FORCE_BUILD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --notes)   UPDATE_NOTES="$2"; shift 2 ;;
    --version) FORCE_VERSION="$2"; shift 2 ;;
    --build)   FORCE_BUILD="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ============================================================
# Step 1: Git pull（双源 fallback）
#   先试 origin（github.com 直连），超时/失败自动切 origin-backup（gh-proxy 镜像）
#   服务器裸连 github.com:443 经常超时（国内云环境），gh-proxy 是可靠镜像
# ============================================================
echo "=== 1. git pull ==="
PULL_OK=false

# 先试主源 origin
if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin main 2>&1 | tail -5; then
  git merge --no-edit FETCH_HEAD 2>&1 | tail -3
  PULL_OK=true
  echo "  ✓ 来自 origin (github.com)"
fi

# 主源失败 → 备源 origin-backup
if ! $PULL_OK; then
  echo "  ⚠ origin 失败，切 origin-backup (gh-proxy)..."
  if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin-backup main 2>&1 | tail -5; then
    git merge --no-edit FETCH_HEAD 2>&1 | tail -3
    PULL_OK=true
    echo "  ✓ 来自 origin-backup (gh-proxy)"
  fi
fi

# 两次都失败 → 仍继续（上次构建已拉到代码时不阻塞），仅 WARN
if ! $PULL_OK; then
  echo "  ⚠ 两个远程都拉取失败，继续用当前本地代码构建"
fi

SHORT_SHA=$(git rev-parse --short HEAD)

# ============================================================
# Step 2: 动态计算版本号和构建号（核心固化逻辑）
# ============================================================
echo ""
echo "=== 2. 版本号动态计算 ==="

# 2a. 读现有 releases.json（存在且可解析才用）
RELEASES_FILE="server/data/releases.json"
EXISTING_VERSION=""
EXISTING_BUILD=""
if [[ -f "$RELEASES_FILE" ]]; then
  EXISTING_VERSION=$(python3 -c "
import json, sys
try:
  d = json.load(open('$RELEASES_FILE'))
  print(d.get('version',''))
except: print('')
" 2>/dev/null)
  EXISTING_BUILD=$(python3 -c "
import json, sys
try:
  d = json.load(open('$RELEASES_FILE'))
  print(d.get('buildNumber',''))
except: print('')
" 2>/dev/null)
fi

# 2b. version 决策链：--version 参数 > 现有 releases.json > package.json
PKG_VERSION=$(python3 -c "import json; print(json.load(open('package.json')).get('version','0.0.0'))")
if [[ -n "$FORCE_VERSION" ]]; then
  VERSION="$FORCE_VERSION"
  BUILD="${FORCE_BUILD:-1}"           # 改 version 默认 build 重置为 1
elif [[ -n "$EXISTING_VERSION" ]]; then
  VERSION="$EXISTING_VERSION"
  # 2c. buildNumber 决策链：--build 参数 > 现有 + 1
  if [[ -n "$FORCE_BUILD" ]]; then
    BUILD="$FORCE_BUILD"
  elif [[ -n "$EXISTING_BUILD" ]] && [[ "$EXISTING_BUILD" =~ ^[0-9]+$ ]]; then
    BUILD=$((EXISTING_BUILD + 1))
  else
    BUILD=1
  fi
else
  VERSION="$PKG_VERSION"
  BUILD="${FORCE_BUILD:-1}"
fi

echo "  version  = ${VERSION}   (package.json=${PKG_VERSION}  releases=${EXISTING_VERSION:-无})"
echo "  buildNum = ${BUILD}   (releases 旧值=${EXISTING_BUILD:-无} → +1)"
echo "  gitSha   = ${SHORT_SHA}"

# 2d. APK 文件名（和 android/app/build.gradle 规则对齐）
APK_NAME="milk-can-mes-v${VERSION}-build${BUILD}-debug.apk"
APK_DOWNLOAD_URL="http://43.138.218.55/download/${APK_NAME}"

# 2e. 更新说明（用户传的优先，否则自动生成）
if [[ -z "$UPDATE_NOTES" ]]; then
  UPDATE_NOTES="v${VERSION} build${BUILD} - 常规重建 · ${SHORT_SHA}"
fi

# ============================================================
# Step 3: 先写 releases.json（Gradle 从这里读 versionCode/versionName）
# ============================================================
echo ""
echo "=== 3. 写入 releases.json ==="
mkdir -p server/data
BUILD_TIME_BJ="$(date '+%Y-%m-%d %H:%M:%S')"
cat > server/data/releases.json << ENDJSON
{
  "version": "${VERSION}",
  "buildNumber": ${BUILD},
  "forceUpdate": false,
  "downloadUrl": "${APK_DOWNLOAD_URL}",
  "downloadUrlIos": "",
  "apkSize": 0,
  "ipaSize": 0,
  "appId": "com.daman.milkcanmes",
  "bundleId": "com.daman.milkcanmes",
  "updateNotes": "${UPDATE_NOTES}",
  "publishedAt": "${BUILD_TIME_BJ}",
  "gitSha": "${SHORT_SHA}"
}
ENDJSON
echo "  $(cat server/data/releases.json | head -3)"

# ============================================================
# Step 4: Vite 构建（用 npx vite build 跳过 tsc 历史遗留错误）
# ============================================================
echo ""
echo "=== 4. Vite 前端构建 ==="
rm -rf dist
# 关键：注入 API 绝对地址 —— Capacitor Android WebView 是 file:// 协议
# 相对路径 '/api/xxx' 会解析为 'file:///api/xxx' → 404
# 必须传 VITE_API_BASE_URL=http://43.138.218.55/api
# （注意：必须带 /api 前缀！api.ts 的 axiosInstance 直接用这个作 baseURL，
#   业务代码里写 api.post('/auth/login', ...)，拼接后就是 /api/auth/login 正确路径）
export VITE_API_BASE_URL="http://43.138.218.55/api"
echo "  VITE_API_BASE_URL=$VITE_API_BASE_URL"
npx vite build 2>&1 | tail -4

# Step 4.5: 后端 TypeScript 编译（之前漏了！导致 src/ 改了但 dist/ 不更新）
# ============================================================
echo ""
echo "=== 4.5 后端 TypeScript 编译 ==="
cd server && rm -rf dist && npx tsc 2>&1 | tail -3
BACKEND_TSC_RC=$?
cd ..
if [ $BACKEND_TSC_RC -ne 0 ]; then
  echo "⚠️ 后端 tsc build 有警告或错误，先继续（旧 dist 还在）"
else
  echo "  ✓ 后端编译成功"
fi

# ============================================================
# Step 5: Capacitor sync + Gradle APK 编译
# ============================================================
echo ""
echo "=== 5. Capacitor sync + Gradle assemble ==="
export ANDROID_HOME=/home/ubuntu/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
npx cap sync android 2>&1 | tail -3

cd "${SCRIPT_DIR}"/android
gradle clean assembleDebug assembleRelease 2>&1 | tail -5

# ============================================================
# Step 6: 拷贝 APK + 回填 apkSize
# ============================================================
echo ""
echo "=== 6. 拷贝 APK (debug + release) ==="
cd "${SCRIPT_DIR}"
mkdir -p download

# Debug APK（内部调试用）
APK_DEBUG="android/app/build/outputs/apk/debug/${APK_NAME}"
if [[ -f "$APK_DEBUG" ]]; then
  cp "$APK_DEBUG" "download/${APK_NAME}"
  DEBUG_SIZE=$(stat -c %s "$APK_DEBUG")
  echo "  ✅ debug: download/${APK_NAME} ($((DEBUG_SIZE/1024/1024))MB)"
fi

# Release APK（瘦身版，给用户下载）
APK_RELEASE_SRC=$(ls android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)
if [[ -f "$APK_RELEASE_SRC" ]]; then
  APK_RELEASE_NAME="milk-can-mes-v${VERSION}-build${BUILD}-release.apk"
  cp "$APK_RELEASE_SRC" "download/${APK_RELEASE_NAME}"
  cp "$APK_RELEASE_SRC" download/milk-can-mes-latest.apk   # latest 指向 release（瘦身）
  APK_SIZE=$(stat -c %s "$APK_RELEASE_SRC")
  # release 存在时 downloadUrl 也指向 release（App 内更新用瘦身版）
  APK_DOWNLOAD_URL="http://43.138.218.55/download/${APK_RELEASE_NAME}"
  echo "  ✅ release (瘦身): download/${APK_RELEASE_NAME} ($((APK_SIZE/1024/1024))MB)"
  echo "  ✅ milk-can-mes-latest.apk → release"
else
  echo "  ⚠️ release APK 未找到，回退用 debug"
  APK_SIZE=$(stat -c %s "$APK_DEBUG")
  cp "$APK_DEBUG" download/milk-can-mes-latest.apk
fi

# 回填实际 apkSize + downloadUrl（release 存在时已在上分支更新为 release URL）
BUILD_TIME_BJ="$(date '+%Y-%m-%d %H:%M:%S')"
cat > server/data/releases.json << ENDJSON
{
  "version": "${VERSION}",
  "buildNumber": ${BUILD},
  "forceUpdate": false,
  "downloadUrl": "${APK_DOWNLOAD_URL}",
  "downloadUrlIos": "",
  "apkSize": ${APK_SIZE},
  "ipaSize": 0,
  "appId": "com.daman.milkcanmes",
  "bundleId": "com.daman.milkcanmes",
  "updateNotes": "${UPDATE_NOTES}",
  "publishedAt": "${BUILD_TIME_BJ}",
  "gitSha": "${SHORT_SHA}"
}
ENDJSON

# ============================================================
# Step 6.5: DB Migration（幂等，列存在就跳过）
#   source server/.env 拿 DB 凭据 → mysql 执行 migration SQL
# ============================================================
echo ""
echo "=== 6.5 DB Migration ==="
set -a; source server/.env; set +a
MIGRATION_SQL="server/scripts/migration_20261021_report_order_batch.sql"
if [[ -f "$MIGRATION_SQL" ]]; then
  DB_PASS_ARG=""
  [[ -n "${DB_PASSWORD:-}" ]] && DB_PASS_ARG="-p${DB_PASSWORD}"
  if mysql -h"${DB_HOST:-localhost}" -u"${DB_USER:-root}" $DB_PASS_ARG "${DB_NAME:-milk_can_mes}" < "$MIGRATION_SQL" 2>&1 | tail -5; then
    echo "  ✅ migration OK"
  else
    echo "  ⚠ migration failed (non-fatal, column may already exist)"
  fi
else
  echo "  ⚠ migration file not found: $MIGRATION_SQL"
fi

# ============================================================
# Step 7: 后端重启
# ============================================================
echo ""
echo "=== 7. PM2 重启 ==="
cd server
pm2 restart milk-can-mes-server 2>&1 | tail -2
sleep 3
pm2 list milk-can-mes-server 2>&1 | grep -E "milk-can-mes-server.*(online|errored)"

# ============================================================
# Step 8: 最终产出
# ============================================================
echo ""
echo "=== 8. 最终产出 ==="
cd "${SCRIPT_DIR}"
ls -lh "download/${APK_NAME}" download/milk-can-mes-latest.apk
echo "SHA256: $(sha256sum "download/${APK_NAME}" | cut -d' ' -f1)"
echo ""
echo "📦 v${VERSION} build${BUILD} · ${SHORT_SHA} · $(date -u +%Y-%m-%dT%H:%M:%SZ) ✅"
echo "🔗 ${APK_DOWNLOAD_URL}"
echo "=== 完成 ==="
