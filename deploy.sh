#!/bin/bash
# ============================================================
# MES 快速部署（H5 更新，~30s）
#
# 只做：git pull → 版本号 + releases.json → Vite build → tsc → PM2 restart
# 不做：Capacitor sync / Gradle / APK 编译（耗时 3.5min+，由 build-apk.sh 单独执行）
#
# 效果：所有 PC + 移动端 H5 立即生效（WebView 从服务器拉最新 dist）
#       无需重新编译 APK；只有用户下载安装新 APK 才需要跑 build-apk.sh
#
# 用法：
#   ./deploy.sh                          # 自动 +1 buildNumber，version 跟 package.json
#   ./deploy.sh --notes "更新说明"        # 指定更新说明（可用 \n 传多行）
#   ./deploy.sh --version 1.3.0           # 改主版本
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

# --notes 中的 \n 转义序列转真实换行
if [[ -n "$UPDATE_NOTES" ]] && [[ "$UPDATE_NOTES" == *\\n* ]]; then
  UPDATE_NOTES=$(printf '%b' "$UPDATE_NOTES")
fi

# ============================================================
# Step 1: Git pull（双源 fallback + dirty 守卫）
# ============================================================
echo "=== 1. git pull ==="
PULL_OK=false

DIRTY=$(git status --porcelain --untracked-files=no \
  | grep -vE 'android/(app/capacitor\.build\.gradle|capacitor\.settings\.gradle)' || true)
if [[ -n "$DIRTY" ]]; then
  echo "  ✗ 生产工作区存在未提交修改，终止部署："
  echo "$DIRTY"
  echo "  → 请把修改提交并 push 到 main 后重新部署；禁止在生产机直接改代码"
  exit 1
fi

git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle 2>/dev/null || true

if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin main > /tmp/_mes_fetch.log 2>&1; then
  tail -5 /tmp/_mes_fetch.log
  if git merge --ff-only --no-edit FETCH_HEAD > /tmp/_mes_merge.log 2>&1; then
    tail -3 /tmp/_mes_merge.log; PULL_OK=true
    echo "  ✓ 来自 origin (github.com)"
  fi
fi

if ! $PULL_OK; then
  echo "  ⚠ origin 失败，切 origin-backup (gh-proxy)..."
  if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin-backup main > /tmp/_mes_fetch.log 2>&1; then
    tail -5 /tmp/_mes_fetch.log
    if git merge --ff-only --no-edit FETCH_HEAD > /tmp/_mes_merge.log 2>&1; then
      tail -3 /tmp/_mes_merge.log; PULL_OK=true
      echo "  ✓ 来自 origin-backup (gh-proxy)"
    fi
  fi
fi

if ! $PULL_OK; then
  echo "  ✗ 两个远程都拉取失败，终止部署"
  exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD)
REMOTE_SHA=$(git rev-parse --short FETCH_HEAD 2>/dev/null || echo "")
echo "  HEAD = ${SHORT_SHA}  origin/main = ${REMOTE_SHA}"
[ "$SHORT_SHA" = "$REMOTE_SHA" ] || { echo "  ✗ HEAD != origin/main"; exit 1; }

AUDIT_LOG="server/data/deploy-audit.log"
{ echo "=== $(date '+%F %T') ==="; echo "HEAD=${SHORT_SHA}"; } >> "$AUDIT_LOG" 2>/dev/null || true

# ============================================================
# Step 2: 版本号动态计算
# ============================================================
echo ""
echo "=== 2. 版本号动态计算 ==="

RELEASES_FILE="server/data/releases.json"
EXISTING_VERSION=""
EXISTING_BUILD=""
EXISTING_GITSHA=""
if [[ -f "$RELEASES_FILE" ]]; then
  EXISTING_VERSION=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('version',''))" 2>/dev/null)
  EXISTING_BUILD=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('buildNumber',''))" 2>/dev/null)
  EXISTING_GITSHA=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('gitSha',''))" 2>/dev/null)
fi

PKG_VERSION=$(python3 -c "import json; print(json.load(open('package.json')).get('version','0.0.0'))")
if [[ -n "$FORCE_VERSION" ]]; then
  VERSION="$FORCE_VERSION"; BUILD="${FORCE_BUILD:-1}"
elif [[ -n "$EXISTING_VERSION" ]]; then
  VERSION="$EXISTING_VERSION"
  if [[ -n "$FORCE_BUILD" ]]; then
    BUILD="$FORCE_BUILD"
  elif [[ -n "$EXISTING_BUILD" ]] && [[ "$EXISTING_BUILD" =~ ^[0-9]+$ ]]; then
    BUILD=$((EXISTING_BUILD + 1))
  else
    BUILD=1
  fi
else
  VERSION="$PKG_VERSION"; BUILD="${FORCE_BUILD:-1}"
fi

echo "  version  = ${VERSION}   (package.json=${PKG_VERSION}  releases=${EXISTING_VERSION:-无})"
echo "  buildNum = ${BUILD}   (旧值=${EXISTING_BUILD:-无} → +1)"
echo "  gitSha   = ${SHORT_SHA}"
[[ -n "$EXISTING_GITSHA" ]] && echo "  上版 git = ${EXISTING_GITSHA}"

# 更新说明
if [[ -z "$UPDATE_NOTES" ]]; then
  START_SHA=""
  if [[ -n "$EXISTING_GITSHA" ]] && git cat-file -t "$EXISTING_GITSHA" >/dev/null 2>&1; then
    START_SHA="$EXISTING_GITSHA"
  fi
  if [[ -n "$START_SHA" ]]; then
    UPDATE_NOTES=$(git log --oneline "${START_SHA}..HEAD" 2>/dev/null | sed 's/^[a-f0-9]* //' | head -15 | sed '/^$/d')
  fi
  if [[ -z "$UPDATE_NOTES" ]]; then
    UPDATE_NOTES=$(git log --oneline -5 2>/dev/null | sed 's/^[a-f0-9]* //')
  fi
  if [[ -z "$UPDATE_NOTES" ]]; then
    UPDATE_NOTES="v${VERSION} build${BUILD} - 常规重建"
  fi
  echo "  更新说明  = [自动归纳 ${EXISTING_GITSHA:+from }${START_SHA:-git log -5}] "
else
  echo "  更新说明  = [用户指定] "
fi

# APK 下载地址（先写临时值，build-apk.sh 会回填真实 APK 名）
APK_DOWNLOAD_URL="http://43.138.218.55/download/milk-can-mes-v${VERSION}-build${BUILD}-release.apk"

# ============================================================
# Step 3: 写 releases.json（apkSize/checksum 暂为 0，build-apk.sh 回填）
# ============================================================
echo ""
echo "=== 3. 写入 releases.json ==="
mkdir -p server/data
_NOTES_TMP=$(mktemp)
printf '%s' "$UPDATE_NOTES" > "$_NOTES_TMP"
python3 -c "
import json
with open('$_NOTES_TMP','r',encoding='utf-8') as f: _notes = f.read().strip()
# 保留现有 apkSize/checksum/downloadUrl（可能是上一个 APK 的值）
try:
  with open('server/data/releases.json','r',encoding='utf-8') as f:
    old = json.load(f)
except: old = {}
d = {
  'version': '${VERSION}',
  'buildNumber': ${BUILD},
  'apkBuild': old.get('apkBuild', old.get('buildNumber', 0)),  # APK 实际编译版本（build-apk.sh 才会更新）
  'forceUpdate': False,
  'downloadUrl': old.get('downloadUrl', '${APK_DOWNLOAD_URL}'),
  'downloadUrlIos': '',
  'apkSize': old.get('apkSize', 0),
  'checksum': old.get('checksum', ''),
  'ipaSize': 0,
  'appId': 'com.daman.milkcanmes',
  'bundleId': 'com.daman.milkcanmes',
  'updateNotes': _notes,
  'publishedAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
  'gitSha': '${SHORT_SHA}'
}
with open('server/data/releases.json', 'w', encoding='utf-8') as f:
  json.dump(d, f, ensure_ascii=False, indent=2)
"
rm -f "$_NOTES_TMP"
echo "  $(head -3 server/data/releases.json)"

# ============================================================
# Step 4: Vite build + APP_BUILD 断言
# ============================================================
echo ""
echo "=== 4. Vite 前端构建 ==="
rm -rf dist
export VITE_API_BASE_URL="http://43.138.218.55/api"
export APP_BUILD="${BUILD}"
export APP_GIT_SHA="${SHORT_SHA}"
echo "  VITE_API_BASE_URL=$VITE_API_BASE_URL  APP_BUILD=$APP_BUILD  APP_GIT_SHA=$APP_GIT_SHA"
npx vite build > /tmp/_mes_vite.log 2>&1; tail -4 /tmp/_mes_vite.log

# APP_BUILD 注入断言
ACTUAL_BUILD_IN_JS=$(node -e "
const fs=require('fs');
const files=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js'));
for (const f of files) {
  const c=fs.readFileSync('dist/assets/'+f,'utf8');
  const m=c.match(/build:\"([0-9]+)\"/);
  if (m) { console.log(m[1]); break; }
}
" 2>/dev/null || echo "")
echo "  预期 APP_BUILD = ${BUILD}   dist JS 中实测 = ${ACTUAL_BUILD_IN_JS:-空}"
[[ "$ACTUAL_BUILD_IN_JS" == "$BUILD" ]] || { echo "  ✗ APP_BUILD 注入失败"; exit 1; }
echo "  ✓ APP_BUILD 注入一致"

# ============================================================
# Step 4.5: 后端 TypeScript 编译
# ============================================================
echo ""
echo "=== 4.5 后端 TypeScript 编译 ==="
cd server && rm -rf dist
npx tsc > /tmp/_mes_tsc.log 2>&1; BACKEND_TSC_RC=$?
tail -3 /tmp/_mes_tsc.log
cd ..
if [ $BACKEND_TSC_RC -ne 0 ]; then
  echo "⚠️ 后端 tsc 有警告/错误，先继续"
else
  echo "  ✓ 后端编译成功"
fi

# ============================================================
# Step 5: PM2 重启
# ============================================================
echo ""
echo "=== 5. PM2 重启 ==="
cd server
pm2 restart milk-can-mes-server > /tmp/_mes_pm2.log 2>&1; tail -2 /tmp/_mes_pm2.log
sleep 3
pm2 list milk-can-mes-server 2>&1 | grep -E "milk-can-mes-server.*(online|errored)"

# ============================================================
# Step 6: 最终产出（H5 更新，不含 APK）
# ============================================================
echo ""
echo "=== 6. 部署完成 ==="
cd "${SCRIPT_DIR}"
echo ""
echo "🌐  H5 已更新：v${VERSION} build${BUILD} · ${SHORT_SHA} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "   移动端 WebView 下次加载自动生效（无需重新编译 APK）"
echo ""
echo "📱  如需重新编译 APK，运行："
echo "   ./build-apk.sh"
echo ""
echo "=== 完成 ==="
