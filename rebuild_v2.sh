#!/bin/bash
set -e
cd /opt/milk-can-mes

echo "=== 1. git pull 最新代码 ==="
git pull origin main 2>&1 | tail -5

echo ""
echo "=== 2. 版本号验证 ==="
echo "package.json version: $(python3 -c "import json; d=json.load(open('package.json')); print(d['version'])")"
grep -E "versionCode|versionName" android/app/build.gradle | head -2
echo "network_security_config.xml: $(ls -la android/app/src/main/res/xml/network_security_config.xml | awk '{print $5, $NF}')"
grep "androidScheme" capacitor.config.ts

echo ""
echo "=== 3. 全量清理 + 重新构建前端 ==="
rm -rf dist
echo "  vite build..."
npm run build 2>&1 | tail -3

echo ""
echo "=== 4. Capacitor sync ==="
export ANDROID_HOME=/home/ubuntu/android-sdk
npx cap sync android 2>&1 | tail -3

echo ""
echo "=== 5. Gradle clean + assembleDebug ==="
cd /opt/milk-can-mes/android
gradle clean assembleDebug 2>&1 | tail -5

echo ""
echo "=== 6. 后端重启 ==="
cd /opt/milk-can-mes
pm2 restart milk-can-mes-server 2>&1 | tail -2
sleep 2

echo ""
echo "=== 7. APK 验证 (aapt dump) ==="
APK="android/app/build/outputs/apk/debug/app-debug.apk"
aapt dump badging "$APK" 2>/dev/null | grep -E "package:|usesCleartext|network" | head -5

echo ""
echo "=== 8. 更新发布文件 ==="
SHORT_SHA=$(git rev-parse --short HEAD)
APK_SIZE=$(stat -c %s "$APK")
APK_NEW="milkcanmes-v1.1.0-debug.apk"

mkdir -p download
cp "$APK" "download/${APK_NEW}"
cp "$APK" download/milk-can-mes-latest.apk

cat > server/data/releases.json << ENDJSON
{
  "version": "1.1.0",
  "buildNumber": 11,
  "forceUpdate": false,
  "downloadUrl": "http://43.138.218.55/download/${APK_NEW}",
  "downloadUrlIos": "http://43.138.218.55/download/milkcanmes.ipa",
  "apkSize": ${APK_SIZE},
  "ipaSize": 0,
  "appId": "com.daman.milkcanmes",
  "bundleId": "com.daman.milkcanmes",
  "updateNotes": "v1.1.0: 全量重建; 修复网络请求被阻止问题(androidScheme改http + networkSecurityConfig); 版本号统一.",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitSha": "${SHORT_SHA}"
}
ENDJSON

echo ""
echo "=== 9. 最终产出 ==="
ls -lh "download/${APK_NEW}" download/milk-can-mes-latest.apk
echo "APK SHA256: $(sha256sum "download/${APK_NEW}" | cut -d' ' -f1)"
echo "APK 时间: $(stat -c '%y' "download/${APK_NEW}")"
echo "releases.json: v1.1.0 b11 sha=${SHORT_SHA}"
pm2 list milk-can-mes-server 2>&1 | grep online
echo ""
echo "=== 完成 ==="
