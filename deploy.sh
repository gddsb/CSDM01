#!/bin/bash
# 生产服务器部署脚本
SSH_PASS='ASD!@#asd'
SSH_HOST='43.138.218.55'
SSH_USER='ubuntu'
REMOTE_DIR='/opt/milk-can-mes'

run_ssh() {
    local cmd="$1"
    sshpass -p "$SSH_PASS" ssh \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ProxyCommand="connect -H 127.0.0.1:18080 %h %p" \
        -o ServerAliveInterval=30 \
        "$SSH_USER@$SSH_HOST" \
        "$cmd"
}

echo "========================================="
echo "MES 生产部署 - $(date)"
echo "========================================="

echo ""
echo "[1/5] 拉取最新代码..."
run_ssh "cd $REMOTE_DIR && git pull origin main"

echo ""
echo "[2/5] 安装依赖..."
run_ssh "cd $REMOTE_DIR && pnpm install 2>&1 | tail -5"

echo ""
echo "[3/5] 构建前端..."
run_ssh "cd $REMOTE_DIR && pnpm run build 2>&1 | tail -10"

echo ""
echo "[4/5] Capacitor sync..."
run_ssh "cd $REMOTE_DIR && npx cap sync android 2>&1 | tail -10"

echo ""
echo "[5/5] 构建 APK (Gradle)..."
run_ssh "cd $REMOTE_DIR/android && gradle assembleDebug 2>&1 | tail -40"

echo ""
echo "=== APK 文件 ==="
run_ssh "find $REMOTE_DIR/android -name '*.apk' -type f 2>/dev/null; ls -lh $REMOTE_DIR/android/app/build/outputs/apk/debug/*.apk 2>/dev/null"

echo ""
echo "=== 完成 ==="
