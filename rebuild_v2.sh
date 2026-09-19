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
cd /opt/milk-can-mes

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
# Step 1: Git pull
# ============================================================
echo "=== 1. git pull ==="
git pull origin main 2>&1 | tail -5
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
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
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
npx vite build 2>&1 | tail -4

# ============================================================
# Step 5: Capacitor sync + Gradle APK 编译
# ============================================================
echo ""
echo "=== 5. Capacitor sync + Gradle assembleDebug ==="
export ANDROID_HOME=/home/ubuntu/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
npx cap sync android 2>&1 | tail -3

cd /opt/milk-can-mes/android
gradle clean assembleDebug 2>&1 | tail -5

# ============================================================
# Step 6: 拷贝 APK + 回填 apkSize
# ============================================================
echo ""
echo "=== 6. 拷贝 APK ==="
cd /opt/milk-can-mes
APK_SRC="android/app/build/outputs/apk/debug/${APK_NAME}"
if [[ ! -f "$APK_SRC" ]]; then
  echo "❌ APK 未找到: ${APK_SRC}"
  ls -lh android/app/build/outputs/apk/debug/
  exit 1
fi
APK_SIZE=$(stat -c %s "$APK_SRC")
mkdir -p download
cp "$APK_SRC" "download/${APK_NAME}"
cp "$APK_SRC" download/milk-can-mes-latest.apk
echo "  ✅ download/${APK_NAME} ($((APK_SIZE/1024/1024))MB)"

# 回填实际 apkSize
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
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitSha": "${SHORT_SHA}"
}
ENDJSON

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
cd /opt/milk-can-mes
ls -lh "download/${APK_NAME}" download/milk-can-mes-latest.apk
echo "SHA256: $(sha256sum "download/${APK_NAME}" | cut -d' ' -f1)"
echo ""
echo "📦 v${VERSION} build${BUILD} · ${SHORT_SHA} · $(date -u +%Y-%m-%dT%H:%M:%SZ) ✅"
echo "🔗 ${APK_DOWNLOAD_URL}"
echo "=== 完成 ==="
