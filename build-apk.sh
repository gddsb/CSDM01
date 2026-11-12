#!/bin/bash
# ============================================================
# MES APK 编译（按需跑，~4min）
#
# 从现有 server/data/releases.json 读取 VERSION/BUILD/gitSha，
# 只做：Capacitor sync → Gradle assemble → 拷贝 APK → 回填 checksum
#
# 不做：git pull / 版本号计算 / Vite build / tsc / PM2 restart
#      （这些由 deploy.sh 负责，H5 已是最新）
#
# 用法：
#   ./build-apk.sh                          # 用当前 releases.json 的版本号编译
#   ./build-apk.sh --notes "累积更新说明"    # 顺便更新 updateNotes
#   ./build-apk.sh --version 1.3.0          # 改版本号（同时 +1 buildNumber）
# ============================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ---- 参数解析（仅用于覆盖 updateNotes / version，不做版本号自动递增） ----
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
if [[ -n "$UPDATE_NOTES" ]] && [[ "$UPDATE_NOTES" == *\\n* ]]; then
  UPDATE_NOTES=$(printf '%b' "$UPDATE_NOTES")
fi

# ============================================================
# Step 1: 读现有 releases.json（所有版本信息从此处取）
# ============================================================
echo "=== 1. 读取 releases.json ==="
RELEASES_FILE="server/data/releases.json"
[[ -f "$RELEASES_FILE" ]] || { echo "  ✗ releases.json 不存在，请先跑 deploy.sh"; exit 1; }

CURRENT_VERSION=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('version',''))")
CURRENT_BUILD=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('buildNumber',''))")
CURRENT_GITSHA=$(python3 -c "import json; d=json.load(open('$RELEASES_FILE')); print(d.get('gitSha',''))")

echo "  version  = ${CURRENT_VERSION}"
echo "  buildNum = ${CURRENT_BUILD}"
echo "  gitSha   = ${CURRENT_GITSHA}"

# 如果用户传了 --version 或 --build，临时覆盖（但不自动 +1 buildNumber！这是 build-apk.sh 的原则）
VERSION="${FORCE_VERSION:-$CURRENT_VERSION}"
BUILD="${FORCE_BUILD:-$CURRENT_BUILD}"
[[ -n "$FORCE_VERSION" || -n "$FORCE_BUILD" ]] && echo "  ⚠ 用户覆盖 → version=${VERSION} build=${BUILD}"

# 不做自动 +1 buildNumber！build-apk.sh 的原则：版本号以 releases.json 为准，不自行改动
# 如果需要新版本号，请先跑 deploy.sh（它会 +1 buildNumber），再跑 build-apk.sh 编译

# ============================================================
# Step 2: 如果用户传了 --notes 或 --version，更新 releases.json
# ============================================================
if [[ -n "$UPDATE_NOTES" ]] || [[ -n "$FORCE_VERSION" ]] || [[ -n "$FORCE_BUILD" ]]; then
  echo ""
  echo "=== 2. 更新 releases.json（用户指定的 notes/version/build） ==="
  _NOTES_TMP=$(mktemp)
  printf '%s' "${UPDATE_NOTES:-}" > "$_NOTES_TMP"
  python3 -c "
import json
with open('$_NOTES_TMP','r',encoding='utf-8') as f: _notes = f.read().strip()
with open('$RELEASES_FILE','r',encoding='utf-8') as f:
  d = json.load(f)
d['updateNotes'] = _notes if _notes else d.get('updateNotes','')
d['version'] = '${VERSION}'
d['buildNumber'] = ${BUILD}
d['publishedAt'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
d['gitSha'] = '${CURRENT_GITSHA}'
with open('$RELEASES_FILE','w',encoding='utf-8') as f:
  json.dump(d, f, ensure_ascii=False, indent=2)
"
  rm -f "$_NOTES_TMP"
  echo "  ✓ releases.json 已更新"
fi

# ============================================================
# Step 3: Capacitor sync + Gradle assembleRelease
# ============================================================
echo ""
echo "=== 3. Capacitor sync + Gradle assembleRelease ==="
export ANDROID_HOME=/home/ubuntu/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

# Capacitor sync：把最新 dist 同步到 android/assets
npx cap sync android > /tmp/_mes_cap.log 2>&1; tail -3 /tmp/_mes_cap.log

# Gradle：只 assembleRelease（debug 版本一般不需要）
cd "${SCRIPT_DIR}"/android
gradle clean assembleRelease > /tmp/_mes_gradle.log 2>&1
GRADLE_RC=$?
tail -5 /tmp/_mes_gradle.log
if [ $GRADLE_RC -ne 0 ]; then
  echo "  ✗ Gradle 编译失败（见 /tmp/_mes_gradle.log）"; exit 1
fi

# ============================================================
# Step 4: 拷贝 APK + 回填 checksum 到 releases.json
# ============================================================
echo ""
echo "=== 4. 拷贝 APK + 回填 checksum ==="
cd "${SCRIPT_DIR}"
mkdir -p download

APK_RELEASE_SRC=$(ls android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)
[[ -f "$APK_RELEASE_SRC" ]] || { echo "  ✗ release APK 未找到"; exit 1; }

APK_RELEASE_NAME="milk-can-mes-v${VERSION}-build${BUILD}-release.apk"
APK_SIZE=$(stat -c %s "$APK_RELEASE_SRC")
APK_SHA256=$(sha256sum "$APK_RELEASE_SRC" | cut -d' ' -f1)
APK_DOWNLOAD_URL="http://43.138.218.55/download/${APK_RELEASE_NAME}"

cp "$APK_RELEASE_SRC" "download/${APK_RELEASE_NAME}"
cp "$APK_RELEASE_SRC" download/milk-can-mes-latest.apk
echo "  ✅ download/${APK_RELEASE_NAME} ($((APK_SIZE/1024/1024))MB)"
echo "  ✅ milk-can-mes-latest.apk → release"

# 回填 releases.json
python3 -c "
import json
with open('$RELEASES_FILE','r',encoding='utf-8') as f:
  d = json.load(f)
d['downloadUrl'] = '${APK_DOWNLOAD_URL}'
d['apkSize'] = ${APK_SIZE}
d['checksum'] = '${APK_SHA256}'
d['apkBuild'] = d.get('buildNumber', ${BUILD})  # 标记 APK 实际编译的 buildNumber
d['publishedAt'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
with open('$RELEASES_FILE','w',encoding='utf-8') as f:
  json.dump(d, f, ensure_ascii=False, indent=2)
"

# ============================================================
# Step 5: 最终产出
# ============================================================
echo ""
echo "=== 5. APK 产出 ==="
echo "📦 v${VERSION} build${BUILD} · ${CURRENT_GITSHA} · $(date -u +%Y-%m-%dT%H:%M:%SZ) ✅"
echo "🔗 ${APK_DOWNLOAD_URL}"
echo "SHA256: ${APK_SHA256}"
echo ""
echo "=== 完成 ==="
