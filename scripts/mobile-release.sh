#!/usr/bin/env bash
# ==============================================================================
# mobile-release.sh — 移动端一键发布脚本
#
# 用法:
#   ./scripts/mobile-release.sh android \
#       --version 1.0.2 --build 2 \
#       --notes "成品检验 + 过程检验 + 报工历史" \
#       --force-update false
#
#   ./scripts/mobile-release.sh ios \
#       --version 1.0.2 --build 2 \
#       --notes "iOS 首次发布"
#       # (Linux 下不编译 iOS，只更新 releases.json；去 Mac 上用 Xcode Archive)
#
#   ./scripts/mobile-release.sh both --version 1.0.2 --build 2
#
# 参数:
#   <platform>         android | ios | both            (默认 android)
#   --version <v>       语义版本号                       (默认读 package.json)
#   --build <n>         构建号 (整数)                     (默认 git rev-list --count HEAD)
#   --notes "<text>"    更新说明                         (默认: "新版本发布")
#   --force-update      强制更新开关                      (默认 false)
#   --skip-build        跳过 vite build + cap sync        (用于只更 JSON)
#   --skip-upload       跳过上传                         (只构建，不传生产)
#   --env <prod|staging>  环境                          (默认 prod)
#
# 产出:
#   - dist/  (vite 构建产物)
#   - android/app/build/outputs/apk/release/*.apk (Release 签名)
#   - ios/  (Xcode 工程，Mac 上 Archive → IPA)
#   - server/data/releases.json  (版本信息)
#   - /download/*.apk / *.ipa  (生产服务器)
#
# 注意:
#   - Android Release 签名需要 android/app/build.gradle 里配置 keystore
#   - iOS 编译必须在 macOS + Xcode 上；Linux 环境只生成配置和 Mac 构建指引
#   - 生产服务器用代理 127.0.0.1:18080 (connect 跳板)
# ==============================================================================
set -euo pipefail

# ---------- 颜色 ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[release]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✅${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠️${NC} $*"; }
err()  { echo -e "${RED}  ❌${NC} $*"; exit 1; }

# ---------- 默认配置 ----------
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PROD_HOST="43.138.218.55"
PROD_USER="ubuntu"
PROD_PASS="ASD!@#asd"
PROD_PATH="/opt/milk-can-mes"
PROXY_CMD="-o ProxyCommand='connect -H 127.0.0.1:18080 %h %p'"

ANDROID_APP_ID="com.daman.milkcanmes"
IOS_BUNDLE_ID="com.daman.milkcanmes"

# ---------- 解析参数 ----------
PLATFORM="android"
SKIP_BUILD=false; SKIP_UPLOAD=false
FORCE_UPDATE=false
VERSION=""; BUILD=""; NOTES=""
ENV="prod"

while [[ $# -gt 0 ]]; do
    case "$1" in
        android|ios|both) PLATFORM="$1"; shift ;;
        --version) VERSION="$2"; shift 2 ;;
        --build) BUILD="$2"; shift 2 ;;
        --notes) NOTES="$2"; shift 2 ;;
        --force-update) FORCE_UPDATE=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-upload) SKIP_UPLOAD=true; shift ;;
        --env) ENV="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
BUILD="${BUILD:-$(git rev-list --count HEAD 2>/dev/null || echo 1)}"
NOTES="${NOTES:-新版本发布}"
FORCE_UPDATE_VAL="false"
[[ "$FORCE_UPDATE" == "true" ]] && FORCE_UPDATE_VAL="true"

SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo local)"
TAG="milk-can-mes-${VERSION}-${SHORT_SHA}"
DOWNLOAD_URL="http://${PROD_HOST}/download/${TAG}.apk"

log "=== 大满 MES 移动端发布 ==="
log "平台: ${CYAN}${PLATFORM}${NC}  版本: ${CYAN}${VERSION}${NC}  构建号: ${CYAN}${BUILD}${NC}  Tag: ${CYAN}${TAG}${NC}"
log "环境: ${ENV}"
echo ""

# ---------- 1. Vite build ----------
if [ "$SKIP_BUILD" != "true" ]; then
    log "[1/6] Vite build (mode=capacitor) ..."
    npx vite build --mode capacitor 2>&1 | tail -5
    ok "vite build 完成 ($(du -sh dist | cut -f1))"
    echo ""
fi

# ---------- 2. cap sync ----------
if [ "$SKIP_BUILD" != "true" ]; then
    if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
        log "[2/6] Capacitor sync android ..."
        npx cap sync android 2>&1 | tail -3
        ok "android 同步完成"
    fi
    if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
        log "[2/6] Capacitor sync ios ..."
        npx cap sync ios 2>&1 | tail -3
        ok "ios 同步完成"
    fi
    echo ""
fi

# ---------- 3. 平台构建 ----------
ANDROID_APK=""
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
    log "[3/6] Android 构建 (assembleDebug) ..."
    export JAVA_HOME="${JAVA_HOME:-/root/.local/share/mise/installs/java/21}"
    export ANDROID_HOME="${ANDROID_HOME:-/usr/local/android-sdk}"
    if [ ! -d "$ANDROID_HOME" ]; then
        warn "ANDROID_HOME 不存在，跳过 Android 构建"
    else
        cd android
        ./gradlew assembleDebug --no-daemon 2>&1 | tail -3
        cd "$PROJECT_DIR"
        ANDROID_APK="android/app/build/outputs/apk/debug/app-debug.apk"
        if [ -f "$ANDROID_APK" ]; then
            ok "Android APK: $(du -sh $ANDROID_APK | cut -f1)"
        else
            warn "APK 未生成（构建失败？）"
            ANDROID_APK=""
        fi
    fi
    echo ""
fi

IOS_IPA=""
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
    log "[3/6] iOS 构建 ..."
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS 上真正的 archive
        cd ios/App
        xcodebuild archive \
            -scheme App \
            -configuration Release \
            -archivePath "build/App.xcarchive" \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
        IOS_IPA="ios/App/build/App.ipa"
        xcodebuild -exportArchive \
            -archivePath "build/App.xcarchive" \
            -exportPath "build" \
            -exportOptionsPlist <(echo '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>method</key><string>ad-hoc</string></dict></plist>') 2>&1 | tail -3
        cd "$PROJECT_DIR"
        ok "iOS IPA: $IOS_IPA"
    else
        warn "当前非 macOS，跳过 iOS 编译。Mac 上执行："
        echo "    cd ios/App && xcodebuild archive -scheme App -archivePath build/App.xcarchive"
        echo "    xcrun altool --upload-app -f build/App.ipa -u 'your-apple-id' -p 'app-specific-password'"
    fi
    echo ""
fi

# ---------- 4. 更新 releases.json ----------
log "[4/6] 更新 releases.json ..."
mkdir -p server/data

ANDROID_SIZE="0"
[ -f "$ANDROID_APK" ] && ANDROID_SIZE=$(stat -c%s "$ANDROID_APK" 2>/dev/null || stat -f%z "$ANDROID_APK" 2>/dev/null || echo 0)
IOS_SIZE="0"
[ -n "$IOS_IPA" ] && IOS_SIZE=$(stat -c%s "$IOS_IPA" 2>/dev/null || stat -f%z "$IOS_IPA" 2>/dev/null || echo 0)

RELEVANT_DOWNLOAD="${DOWNLOAD_URL}"
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
    RELEVANT_DOWNLOAD="http://${PROD_HOST}/download/${TAG}.ipa"
fi

cat > server/data/releases.json << JSON
{
  "version": "${VERSION}",
  "buildNumber": ${BUILD},
  "forceUpdate": ${FORCE_UPDATE_VAL},
  "downloadUrl": "http://${PROD_HOST}/download/${TAG}.apk",
  "downloadUrlIos": "http://${PROD_HOST}/download/${TAG}.ipa",
  "apkSize": ${ANDROID_SIZE},
  "ipaSize": ${IOS_SIZE},
  "appId": "${ANDROID_APP_ID}",
  "bundleId": "${IOS_BUNDLE_ID}",
  "updateNotes": "${NOTES}",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitSha": "${SHORT_SHA}"
}
JSON
ok "releases.json 写入完成 (version=${VERSION}, build=${BUILD})"
echo ""

# ---------- 5. 上传生产服务器 ----------
if [ "$SKIP_UPLOAD" != "true" ]; then
    log "[5/6] 上传到生产服务器 ${PROD_HOST} ..."
    SSH="sshpass -p '${PROD_PASS}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${PROXY_CMD} ${PROD_USER}@${PROD_HOST}"
    SCP="sshpass -p '${PROD_PASS}' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${PROXY_CMD}"

    # 创建目录（幂等）
    eval "$SSH 'mkdir -p ${PROD_PATH}/download ${PROD_PATH}/server/data'" 2>/dev/null || true

    # 上传 APK
    if [ -n "$ANDROID_APK" ]; then
        eval "$SCP ${ANDROID_APK} ${PROD_USER}@${PROD_HOST}:${PROD_PATH}/download/${TAG}.apk" 2>&1 | tail -1
        ok "APK 上传: /download/${TAG}.apk"
    fi

    # 上传 IPA（如果有）
    if [ -n "$IOS_IPA" ] && [ -f "$IOS_IPA" ]; then
        eval "$SCP ${IOS_IPA} ${PROD_USER}@${PROD_HOST}:${PROD_PATH}/download/${TAG}.ipa" 2>&1 | tail -1
        ok "IPA 上传: /download/${TAG}.ipa"
    fi

    # 上传 releases.json — 放在 git pull 之后，避免被 reset --hard 覆盖
    ok "APK/IPA 上传完成，准备拉代码 + 写 releases.json"

    # 先拉代码 + vite build（此时 releases.json 是仓库里的旧版本）
    log "  生产服务器拉代码 + build ..."
    eval "$SSH 'cd ${PROD_PATH} && git fetch origin main && git reset --hard origin/main >/dev/null 2>&1 && npx vite build 2>&1 | tail -3'" 2>&1 | tail -5
    ok "代码拉取 + vite build 完成"

    # 再上传 releases.json（写入覆盖掉仓库里的旧版本号）
    eval "$SCP server/data/releases.json ${PROD_USER}@${PROD_HOST}:${PROD_PATH}/server/data/releases.json" 2>&1 | tail -1
    ok "releases.json 已上传（version=${VERSION}, build=${BUILD}, sha=${SHORT_SHA}）"

    # reload PM2（让 Node 进程重新读最新 releases.json）
    eval "$SSH 'pm2 reload milk-can-mes-server --update-env 2>/dev/null || pm2 restart milk-can-mes-server'" 2>&1 | tail -2
    ok "PM2 reload 完成"
    echo ""
fi

# ---------- 6. 最终输出 ----------
log "[6/6] ✨ 发布完成！"
echo ""
cat << DONE
┌─────────────────────────────────────────────────────────┐
│  版本     ${VERSION}  (build ${BUILD})
│  Git SHA  ${SHORT_SHA}
│  平台     ${PLATFORM}
├─────────────────────────────────────────────────────────┤
│  📱 APK    ${DOWNLOAD_URL}
│  🍎 IPA    http://${PROD_HOST}/download/${TAG}.ipa
├─────────────────────────────────────────────────────────┤
│  API 校验  curl http://${PROD_HOST}/api/version
│  PC 入口   http://${PROD_HOST}/  → 侧边栏底部"📱 移动端下载"
└─────────────────────────────────────────────────────────┘
DONE
