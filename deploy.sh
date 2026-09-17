#!/bin/bash
# ============================================================
# MES 生产部署脚本 - 全新编译
# 服务器: 43.138.218.55, SSH: ubuntu, Proxy: 本地connect
# 代码源: origin-backup (gh-proxy.com 代理)
# ============================================================
SSH_PASS='ASD!@#asd'
SSH_HOST='43.138.218.55'
SSH_USER='ubuntu'
REMOTE_DIR='/opt/milk-can-mes'

ssh_exec() {
    sshpass -p "$SSH_PASS" ssh \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ProxyCommand="connect -H 127.0.0.1:18080 %h %p" \
        -o ServerAliveInterval=30 \
        -o ConnectTimeout=20 \
        "$SSH_USER@$SSH_HOST" \
        "$1"
}

log() { echo ""; echo ">>> $*"; echo "============================================================"; }

log "MES 生产部署开始 - $(date '+%Y-%m-%d %H:%M:%S')"

# ===== Step 1: 拉代码 =====
log "[1/5] Git pull (via origin-backup proxy)"
ssh_exec "cd $REMOTE_DIR && git fetch origin-backup && git reset --hard origin-backup/main && git log --oneline -3"

# ===== Step 2: 全新安装依赖 =====
log "[2/5] pnpm install (全新)"
ssh_exec "cd $REMOTE_DIR && rm -rf node_modules && pnpm install --frozen-lockfile 2>&1 | tail -8"

# ===== Step 3: 构建前端 =====
log "[3/5] pnpm run build (全新构建前端)"
ssh_exec "cd $REMOTE_DIR && rm -rf dist && pnpm run build 2>&1 | tail -15"

# ===== Step 4: Capacitor sync + APK 全新编译 =====
log "[4/5] Capacitor sync + Gradle clean assembleDebug"
ssh_exec "cd $REMOTE_DIR && npx cap sync android 2>&1 | tail -10 && cd android && gradle clean assembleDebug 2>&1 | tail -20"

# ===== Step 5: 结果 & 后端 =====
log "[5/5] APK 产物 + 后端状态"
ssh_exec "
  echo '--- APK 产物 ---'
  ls -lh $REMOTE_DIR/android/app/build/outputs/apk/debug/*.apk 2>/dev/null
  echo ''
  echo '--- 后端 PM2 状态 ---'
  which pm2 2>/dev/null && pm2 list 2>&1 | head -15 || echo 'pm2 不可用，尝试手动重启'
  echo ''
  echo '--- HTTP 服务状态 ---'
  curl -s http://localhost/api/ -o /dev/null -w 'API HTTP状态: %{http_code}\n' --connect-timeout 3 -m 5 || echo 'API 端口无响应'
"

log "MES 部署完成 - $(date '+%Y-%m-%d %H:%M:%S')"
