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

# ---- 代理环境变量（git fetch / curl 等网络命令需要） ----
# 生产机云环境裸连 github.com 偶发超时，代理走本地 squid（经 connect -H 桥接）
# 即使 origin-backup gh-proxy 镜像生效，显式 export 也能兜底覆盖 git/curl 默认
export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:18080}"
export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:18080}"
export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16}"

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

# 1a. 部署前守卫：生产工作区不允许存在未提交的代码修改。
#     android/app/capacitor.build.gradle 与 android/capacitor.settings.gradle 是
#     `npx cap sync` 每次构建都会重写的生成文件，允许其处于修改状态；
#     其余任何 tracked 文件改动都必须先提交回仓库，否则拒绝部署。
DIRTY=$(git status --porcelain --untracked-files=no \
  | grep -vE 'android/(app/capacitor\.build\.gradle|capacitor\.settings\.gradle)' || true)
if [[ -n "$DIRTY" ]]; then
  echo "  ✗ 生产工作区存在未提交修改，终止部署："
  echo "$DIRTY"
  echo "  → 请把修改提交并 push 到 main 后重新部署；禁止在生产机直接改代码"
  exit 1
fi

# 1b. cap sync 生成文件在仓库里同样会被更新：合并前丢弃服务器本地副本（构建时会按插件版本重新生成）
git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle 2>/dev/null || true

# 1c. 只允许 fast-forward：出现分叉/冲突立即中止，禁止 reset --hard 覆盖本地改动
if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin main 2>&1 | tail -5; then
  if git merge --ff-only --no-edit FETCH_HEAD > /tmp/_mes_merge.log 2>&1; then
    tail -3 /tmp/_mes_merge.log
    PULL_OK=true
    echo "  ✓ 来自 origin (github.com)"
  else
    tail -10 /tmp/_mes_merge.log
    echo "  ✗ merge 失败（本地分叉或工作区冲突），终止部署"
    exit 1
  fi
fi

# 主源失败 → 备源 origin-backup（同样只允许 fast-forward）
if ! $PULL_OK; then
  echo "  ⚠ origin 失败，切 origin-backup (gh-proxy)..."
  if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin-backup main 2>&1 | tail -5; then
    if git merge --ff-only --no-edit FETCH_HEAD > /tmp/_mes_merge.log 2>&1; then
      tail -3 /tmp/_mes_merge.log
      PULL_OK=true
      echo "  ✓ 来自 origin-backup (gh-proxy)"
    else
      tail -10 /tmp/_mes_merge.log
      echo "  ✗ merge 失败，终止部署"
      exit 1
    fi
  fi
fi

# 两次都失败 → 终止部署，禁止用旧代码构建（这正是"修好的 bug 又回来"的通道）
if ! $PULL_OK; then
  echo "  ✗ 两个远程都拉取失败，终止部署（禁止用旧代码构建）"
  exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD)
REMOTE_SHA=$(git rev-parse --short FETCH_HEAD 2>/dev/null || echo "")
echo "  HEAD = ${SHORT_SHA}  origin/main = ${REMOTE_SHA}"
# 三方一致性：生产 HEAD 必须等于刚拉取的远程 main（ff-only 已保证，这里显式断言）
if [ -z "$REMOTE_SHA" ] || [ "$SHORT_SHA" != "$REMOTE_SHA" ]; then
  echo "  ✗ 生产 HEAD(${SHORT_SHA}) != origin/main(${REMOTE_SHA})，终止部署"
  exit 1
fi
# 部署审计日志：记录每次部署的三方 git 信息与工作区状态
AUDIT_LOG="/opt/milk-can-mes/server/data/deploy-audit.log"
{
  echo "=== $(date '+%F %T') ==="
  echo "HEAD=${SHORT_SHA} origin/main=${REMOTE_SHA}"
  echo "tracked 改动（不含 cap sync 生成文件）: $(git status --porcelain --untracked-files=no | grep -vE 'android/(app/capacitor\.build\.gradle|capacitor\.settings\.gradle)' | wc -l) 个"
} >> "$AUDIT_LOG" 2>/dev/null || true

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
# 关键：注入 API 绝对地址 —— Capacitor Android WebView 是 file:// 协议
# 相对路径 '/api/xxx' 会解析为 'file:///api/xxx' → 404
# 必须传 VITE_API_BASE_URL=http://43.138.218.55/api
# （注意：必须带 /api 前缀！api.ts 的 axiosInstance 直接用这个作 baseURL，
#   业务代码里写 api.post('/auth/login', ...)，拼接后就是 /api/auth/login 正确路径）
export VITE_API_BASE_URL="http://43.138.218.55/api"
# 关键：把 releases.json 的 buildNumber 注入前端 __APP_BUILD__，
# 否则 Vite 回退到 git rev-list --count HEAD（提交总数），与 buildNumber 不一致
# → APK 内“检查更新”永远无法正确比较版本
export APP_BUILD="${BUILD}"
# 注入 git 短哈希，供移动端"检查更新"显示安装版本来源
export APP_GIT_SHA="${SHORT_SHA}"
echo "  VITE_API_BASE_URL=$VITE_API_BASE_URL  APP_BUILD=$APP_BUILD  APP_GIT_SHA=$APP_GIT_SHA"
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
  APK_SHA256=$(sha256sum "$APK_RELEASE_SRC" | cut -d' ' -f1)
  # release 存在时 downloadUrl 也指向 release（App 内更新用瘦身版）
  APK_DOWNLOAD_URL="http://43.138.218.55/download/${APK_RELEASE_NAME}"
  echo "  ✅ release (瘦身): download/${APK_RELEASE_NAME} ($((APK_SIZE/1024/1024))MB)"
  echo "  ✅ milk-can-mes-latest.apk → release"
else
  echo "  ⚠️ release APK 未找到，回退用 debug"
  APK_SIZE=$(stat -c %s "$APK_DEBUG")
  APK_SHA256=$(sha256sum "$APK_DEBUG" | cut -d' ' -f1)
  cp "$APK_DEBUG" download/milk-can-mes-latest.apk
fi

# 回填实际 apkSize + downloadUrl（release 存在时已在上分支更新为 release URL）
cat > server/data/releases.json << ENDJSON
{
  "version": "${VERSION}",
  "buildNumber": ${BUILD},
  "forceUpdate": false,
  "downloadUrl": "${APK_DOWNLOAD_URL}",
  "downloadUrlIos": "",
  "apkSize": ${APK_SIZE},
  "checksum": "${APK_SHA256}",
  "ipaSize": 0,
  "appId": "com.daman.milkcanmes",
  "bundleId": "com.daman.milkcanmes",
  "updateNotes": "${UPDATE_NOTES}",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitSha": "${SHORT_SHA}"
}
ENDJSON

# ============================================================
# Step 6.5: DB Migration（由 app.ts 启动时通过 Umzug 自动执行 src/migrations/*.sql）
#   这里只做提示，不再手动跑任何 SQL 文件
#   Umzug state 文件在 server/data/migration-state.json，已执行的 SQL 不会重复跑
# ============================================================
echo ""
echo "=== 6.5 DB Migration ==="
echo "  ℹ Umzug 管理 server/src/migrations/*.sql，PM2 重启后 app.ts 会自动执行"
echo "  ℹ 如需立即手动执行：cd server && npx tsx src/migrate.ts"

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
echo "SHA256: $(sha256sum download/milk-can-mes-latest.apk | cut -d' ' -f1)"
echo ""
echo "📦 v${VERSION} build${BUILD} · ${SHORT_SHA} · $(date -u +%Y-%m-%dT%H:%M:%SZ) ✅"
echo "🔗 ${APK_DOWNLOAD_URL}"
echo "=== 完成 ==="
