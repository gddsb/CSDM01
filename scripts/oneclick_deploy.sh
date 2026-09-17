#!/bin/bash
set -e

PROD_IP="43.138.218.55"
PROD_SSH_PASS="ASD!@#asd"
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
SSH_BASE="sshpass -p '${PROD_SSH_PASS}' ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand='${PROXY_CMD}'"

ssh_exec() {
  eval "${SSH_BASE} ubuntu@${PROD_IP} '$1'"
}

echo "=========================================="
echo "  MES 一条龙部署脚本 - 等待 SSH 恢复"
echo "=========================================="

# ---- 等待 SSH 恢复 ----
SSH_OK=0
for i in $(seq 1 40); do
  echo "[${i}/40] $(date +%H:%M:%S) 探测中..."
  if ssh_exec "echo SSH_OK" 2>/dev/null; then
    SSH_OK=1
    echo "=== SSH 恢复！开始一条龙 ==="
    break
  fi
  sleep 30
done

if [ "$SSH_OK" = "0" ]; then
  echo "❌ SSH 20分钟内没恢复"
  exit 1
fi

# ---- A. 同步 + vite build ----
echo ""
echo "=== A. 同步代码 + vite build ==="
ssh_exec "
  cd /opt/milk-can-mes &&
  git fetch origin main &&
  git reset --hard origin/main &&
  echo 'HEAD:' && git log --oneline -1 &&
  echo '--- 内存 ---' && free -m &&
  echo '--- vite build ---' &&
  npx vite build 2>&1 | tail -8
"

# ---- B. pm2 restart ----
echo ""
echo "=== B. pm2 restart ==="
ssh_exec "
  cd /opt/milk-can-mes/server &&
  (pm2 kill 2>/dev/null || true) && sleep 2 &&
  pm2 start src/app.ts -n milk-can-mes-server &&
  sleep 5 &&
  pm2 list | grep milk-can-mes-server | head -2
"

# ---- C. cap sync + gradle ----
echo ""
echo "=== C. cap sync android + gradle clean assembleDebug ==="
ssh_exec "
  export ANDROID_HOME=/home/ubuntu/android-sdk &&
  export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools &&
  cd /opt/milk-can-mes &&
  echo '--- cap sync ---' &&
  npx cap sync android 2>&1 | tail -5 &&
  echo '--- gradle assembleDebug ---' &&
  cd android &&
  gradle clean assembleDebug 2>&1 | tail -10
"

# ---- D. 拷贝 APK + 信息 ----
echo ""
echo "=== D. 拷贝 APK + 验证 ==="
ssh_exec "
  cd /opt/milk-can-mes &&
  APK_SRC=\$(find android/app/build/outputs/apk/debug -name '*.apk' -type f | head -1) &&
  echo \"APK 源: \$APK_SRC\" &&
  mkdir -p download &&
  cp \$APK_SRC download/milk-can-mes-v1.1.0-build13-debug.apk &&
  ls -lh download/milk-can-mes-v1.1.0-build13-debug.apk &&
  APK_SIZE=\$(stat -c%s download/milk-can-mes-v1.1.0-build13-debug.apk) &&
  echo \"大小 bytes: \$APK_SIZE\" &&
  echo '--- aapt info ---' &&
  aapt dump badging download/milk-can-mes-v1.1.0-build13-debug.apk 2>/dev/null | grep -E 'package:|versionCode|versionName' | head -3
"

# ---- E. 五维验证 ----
echo ""
echo "=== E. 五维验证 ==="
echo -n "E1 首页: "; curl -s -o /dev/null -w "%{http_code}\n" --proxy http://127.0.0.1:18080 "http://${PROD_IP}/"
echo -n "E2 后端: "; curl -s --proxy http://127.0.0.1:18080 "http://${PROD_IP}/api/health" && echo ""
echo -n "E3 API:  "; curl -s -o /dev/null -w "%{http_code}\n" --proxy http://127.0.0.1:18080 "http://${PROD_IP}/api/basic/device-records"
echo -n "E4 APK:  "; curl -sI --proxy http://127.0.0.1:18080 "http://${PROD_IP}/download/milk-can-mes-v1.1.0-build13-debug.apk" | grep -E "HTTP|content-length|last-modified"
echo -n "E5 版本: "; curl -s --proxy http://127.0.0.1:18080 "http://${PROD_IP}/api/version" && echo ""

echo ""
echo "=== ✅ 全部完成 ==="
