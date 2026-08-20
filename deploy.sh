#!/bin/bash
# ============================================================
# 奶粉罐MES 部署脚本
# 功能：拉取最新代码 → 构建前端 → 重启后端服务
# 适用：Ubuntu 服务器 /opt/milk-can-mes/ 目录
# ============================================================

set -e

APP_DIR="/opt/milk-can-mes"
BRANCH="main"
LOG_FILE="$APP_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
MIRROR_PREFIX="https://mirror.ghproxy.com/"

echo "================================================" | tee -a "$LOG_FILE"
echo "开始部署 - $(date)" | tee -a "$LOG_FILE"
echo "================================================" | tee -a "$LOG_FILE"

cd "$APP_DIR"

# 1. 检查 Node.js 环境
echo "" | tee -a "$LOG_FILE"
echo "[1/6] 检查运行环境..." | tee -a "$LOG_FILE"
node_version=$(node --version 2>/dev/null || echo "NOT_FOUND")
npm_version=$(npm --version 2>/dev/null || echo "NOT_FOUND")
echo "  Node.js: $node_version" | tee -a "$LOG_FILE"
echo "  npm: $npm_version" | tee -a "$LOG_FILE"

if [[ "$node_version" == "NOT_FOUND" ]]; then
    echo "  [ERROR] Node.js 未安装" | tee -a "$LOG_FILE"
    exit 1
fi

# 2. 拉取最新代码（优先使用国内镜像）
echo "" | tee -a "$LOG_FILE"
echo "[2/6] 拉取最新代码..." | tee -a "$LOG_FILE"

cd "$APP_DIR"

# 保存本地改动（如有）
if [[ -d .git ]]; then
    git fetch origin 2>/dev/null || true
    git stash 2>/dev/null || true
    git pull origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE" || {
        echo "  [WARN] 直接拉取失败，尝试使用镜像..." | tee -a "$LOG_FILE"
        # 镜像方式：通过镜像 URL 克隆
        REPO_URL="https://github.com/gddsb/CSDM01.git"
        MIRROR_URL="${MIRROR_PREFIX}${REPO_URL}"
        echo "  尝试镜像: $MIRROR_URL" | tee -a "$LOG_FILE"
        git remote set-url origin "$MIRROR_URL" 2>/dev/null || true
        git pull origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE" || {
            echo "  [ERROR] 代码拉取失败" | tee -a "$LOG_FILE"
            exit 1
        }
        # 恢复原始 remote
        git remote set-url origin "$REPO_URL" 2>/dev/null || true
    }
else
    echo "  [ERROR] 非 git 仓库，无法拉取" | tee -a "$LOG_FILE"
    exit 1
fi

LATEST_COMMIT=$(git log --oneline -1 2>/dev/null)
echo "  最新提交: $LATEST_COMMIT" | tee -a "$LOG_FILE"

# 3. 安装前端依赖
echo "" | tee -a "$LOG_FILE"
echo "[3/6] 安装前端依赖..." | tee -a "$LOG_FILE"
cd "$APP_DIR"
if [[ -f pnpm-lock.yaml ]]; then
    pnpm install --frozen-lockfile 2>&1 | tail -5 | tee -a "$LOG_FILE"
elif [[ -f package-lock.json ]]; then
    npm ci 2>&1 | tail -5 | tee -a "$LOG_FILE"
elif [[ -f yarn.lock ]]; then
    yarn install --frozen-lockfile 2>&1 | tail -5 | tee -a "$LOG_FILE"
else
    npm install 2>&1 | tail -5 | tee -a "$LOG_FILE"
fi

# 4. 构建前端
echo "" | tee -a "$LOG_FILE"
echo "[4/6] 构建前端..." | tee -a "$LOG_FILE"
cd "$APP_DIR"
npm run build 2>&1 | tail -10 | tee -a "$LOG_FILE"
echo "  前端构建完成" | tee -a "$LOG_FILE"

# 5. 安装后端依赖
echo "" | tee -a "$LOG_FILE"
echo "[5/6] 安装后端依赖..." | tee -a "$LOG_FILE"
cd "$APP_DIR/server"
if [[ -f pnpm-lock.yaml ]]; then
    pnpm install --frozen-lockfile 2>&1 | tail -5 | tee -a "$LOG_FILE"
elif [[ -f package-lock.json ]]; then
    npm ci 2>&1 | tail -5 | tee -a "$LOG_FILE"
else
    npm install 2>&1 | tail -5 | tee -a "$LOG_FILE"
fi

# 6. 重启服务
echo "" | tee -a "$LOG_FILE"
echo "[6/6] 重启后端服务..." | tee -a "$LOG_FILE"

cd "$APP_DIR"

# 查找进程管理器
if command -v pm2 &> /dev/null; then
    echo "  使用 PM2 重启..." | tee -a "$LOG_FILE"
    pm2 restart all 2>&1 | tee -a "$LOG_FILE"
    pm2 save 2>&1 | tee -a "$LOG_FILE"
    echo "  PM2 服务已重启" | tee -a "$LOG_FILE"
elif command -v systemctl &> /dev/null; then
    # 尝试查找服务名
    SERVICE_NAME=$(systemctl list-units --type=service --state=running 2>/dev/null | grep -i milk\|can\|mes\|milk-can | head -1 | awk '{print $1}')
    if [[ -n "$SERVICE_NAME" ]]; then
        echo "  使用 systemctl 重启服务: $SERVICE_NAME" | tee -a "$LOG_FILE"
        sudo systemctl restart "$SERVICE_NAME" 2>&1 | tee -a "$LOG_FILE"
    else
        echo "  未找到 systemd 服务，尝试直接启动..." | tee -a "$LOG_FILE"
        cd server
        nohup node src/app.js > /dev/null 2>&1 &
        echo "  服务已在后台启动 (PID: $!)" | tee -a "$LOG_FILE"
    fi
elif command -v supervisorctl &> /dev/null; then
    echo "  使用 Supervisor 重启..." | tee -a "$LOG_FILE"
    supervisorctl restart all 2>&1 | tee -a "$LOG_FILE"
else
    echo "  无进程管理器，直接启动..." | tee -a "$LOG_FILE"
    cd server
    pkill -f "node.*app.js" 2>/dev/null || true
    sleep 1
    nohup node src/app.js > /dev/null 2>&1 &
    echo "  服务已在后台启动 (PID: $!)" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "================================================" | tee -a "$LOG_FILE"
echo "部署完成 - $(date)" | tee -a "$LOG_FILE"
echo "日志文件: $LOG_FILE" | tee -a "$LOG_FILE"
echo "================================================" | tee -a "$LOG_FILE"
echo ""
echo "验证:"
echo "  HTTP API: curl http://localhost:3001/api/health"
echo "  前端页面: http://43.138.218.55/"
