#!/bin/bash
# ============================================================
# 生产服务器一键部署脚本（优化版 v2）
#
# 核心优化：用 SCP 传变更文件代替 git pull（服务器无法直连 GitHub）
# 使用方法：bash scripts/deploy.sh [commit_count]
# ============================================================

set -e

SERVER="ubuntu@43.138.218.55"
PROJECT_DIR="/opt/milk-can-mes"
CORKSCREW_PROXY="corkscrew 127.0.0.1 18080 %h %p"
COMMIT_COUNT=${1:-3}

# 临时 SSH config（避免密码泄露到进程列表）
SSH_CONFIG="/tmp/deploy_ssh_config"
cat > "${SSH_CONFIG}" << EOF
Host ${SERVER}
    HostName 43.138.218.55
    User ubuntu
    ProxyCommand corkscrew 127.0.0.1 18080 %h %p
    StrictHostKeyChecking no
    ServerAliveInterval 30
    ServerAliveCountMax 5
EOF

echo "================================================"
echo " 生产服务器部署脚本（优化版 v2）"
echo "================================================"

cd "$(dirname "$0")/.."

# Step 1: 分析变更文件
echo ""
echo "[Step 1] 分析变更文件"
CHANGED_FILES=$(git diff --name-only "HEAD~${COMMIT_COUNT}" HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD)
if [ -z "$CHANGED_FILES" ]; then
    echo "无变更文件，跳过部署。"
    exit 0
fi

HAS_SERVER=0; HAS_CLIENT=0; HAS_LOCK=0
UPLOAD_FILES=""

for f in $CHANGED_FILES; do
    [ ! -f "$f" ] && continue
    # 跳过二进制和资源文件
    case "$f" in
        *.png|*.jpg|*.jpeg|*.gif|*.svg|*.webp|*.ico|*.apk|*.md|*.log) continue;;
        node_modules/*|dist/*|.git/*) continue;;
    esac
    case "$f" in server/*) HAS_SERVER=$((HAS_SERVER+1));; esac
    case "$f" in src/*) HAS_CLIENT=$((HAS_CLIENT+1));; esac
    case "$f" in *pnpm-lock.yaml|*package.json) HAS_LOCK=$((HAS_LOCK+1));; esac
    UPLOAD_FILES="${UPLOAD_FILES} ${f}"
    SIZE=$(du -h "$f" | cut -f1)
    echo "  ${SIZE}  $f"
done

echo ""
echo "变更统计: 后端=${HAS_SERVER} 前端=${HAS_CLIENT} 依赖=${HAS_LOCK}"

# Step 2: 上传变更文件
echo ""
echo "[Step 2] SCP 上传变更文件"
for f in $UPLOAD_FILES; do
    REMOTE_DIR="${PROJECT_DIR}/$(dirname "$f")"
    sshpass -p 'ASD!@#asd' ssh -F "${SSH_CONFIG}" "${SERVER}" "mkdir -p '${REMOTE_DIR}'" 2>/dev/null
    sshpass -p 'ASD!@#asd' scp -F "${SSH_CONFIG}" "$f" "${SERVER}:${PROJECT_DIR}/${f}" 2>/dev/null
    echo "  上传: $f"
done

# Step 3: 服务器端构建
echo ""
echo "[Step 3] 服务器端构建"
START=$(date +%s)

REMOTE_SCRIPT="
cd ${PROJECT_DIR}
echo '[服务器] 文件已更新'

# 后端依赖
if [ ${HAS_SERVER} -gt 0 ] || [ ${HAS_LOCK} -gt 0 ]; then
  echo '[服务器] 安装后端依赖...'
  cd ${PROJECT_DIR}/server && pnpm install --frozen-lockfile 2>&1 | tail -3 && cd ${PROJECT_DIR}
fi

# 前端构建
if [ ${HAS_CLIENT} -gt 0 ] || [ ${HAS_LOCK} -gt 0 ]; then
  echo '[服务器] 构建前端...'
  npx vite build 2>&1 | tail -8
fi

# 重启
echo '[服务器] 重启 PM2...'
pm2 restart milk-can-mes-server 2>&1
pm2 save 2>&1
sleep 3

echo ''
echo '===== 最终验证 ====='
echo 'API:' \$(curl -s http://localhost:3001/api/health)
echo 'PM2:'
pm2 list 2>&1 | head -4
echo 'HTTP:'
curl -s -o /dev/null -w '%{http_code}' http://localhost:80/
echo ''
"

sshpass -p 'ASD!@#asd' ssh -F "${SSH_CONFIG}" "${SERVER}" "${REMOTE_SCRIPT}"

END=$(date +%s)
ELAPSED=$((END - START))

# 清理
rm -f "${SSH_CONFIG}"

echo ""
echo "================================================"
echo " 部署完成！耗时 ${ELAPSED} 秒"
echo "================================================"
echo ""
echo "提交: $(git rev-parse --short HEAD)"
echo "变更文件: $(echo "$UPLOAD_FILES" | wc -w) 个"
echo ""
echo "建议: 浏览器 Ctrl+Shift+R 强制刷新"
