#!/bin/bash
set -e
set -u
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/milk-can-mes"
BACKUP_DIR="/opt/backups"
LOG_FILE="$BACKUP_DIR/deploy.log"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}

check_root() {
    if [ "$(id -u)" != "0" ]; then
        SUDO="sudo"
        log_info "使用 sudo 执行需要权限的操作"
    else
        SUDO=""
        log_info "当前用户是 root"
    fi
}

confirm() {
    read -p "$1 (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "用户取消操作"
        exit 0
    fi
}

create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "创建备份目录: $BACKUP_DIR"
        $SUDO mkdir -p "$BACKUP_DIR"
        $SUDO chown -R $(whoami):$(whoami) "$BACKUP_DIR"
    fi
    touch "$LOG_FILE" 2>/dev/null || $SUDO touch "$LOG_FILE"
    $SUDO chown $(whoami):$(whoami) "$LOG_FILE" 2>/dev/null || true
    echo "========================================" >> "$LOG_FILE"
    echo "操作开始: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
}

backup_current_version() {
    log_info "备份当前版本..."

    CURRENT_COMMIT=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_info "当前版本: $CURRENT_COMMIT"

    BACKUP_FILE="$BACKUP_DIR/milk-can-mes_$(date +%Y%m%d_%H%M%S).tar.gz"
    log_info "备份到: $BACKUP_FILE"
    $SUDO tar -czf "$BACKUP_FILE" -C "$(dirname $PROJECT_DIR)" "$(basename $PROJECT_DIR)" 2>/dev/null || true

    log_success "备份完成"
}

backup_database() {
    log_info "备份数据库..."

    if [ -f "$PROJECT_DIR/server/.env" ]; then
        DB_TYPE=$(grep "DB_DIALECT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ' || echo "sqlite")

        if [ "$DB_TYPE" == "mysql" ]; then
            DB_NAME=$(grep "DB_NAME" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
            DB_USER=$(grep "DB_USER" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
            DB_BACKUP="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
            log_info "导出 MySQL: $DB_NAME"
            $SUDO mysqldump -u "$DB_USER" "$DB_NAME" > "$DB_BACKUP" 2>/dev/null || true
            log_success "数据库备份完成"
        else
            DB_FILE=$(find "$PROJECT_DIR/server" -name "*.sqlite" -o -name "database.sqlite" 2>/dev/null | head -1)
            if [ -n "$DB_FILE" ] && [ -f "$DB_FILE" ]; then
                DB_BACKUP="$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sqlite"
                $SUDO cp "$DB_FILE" "$DB_BACKUP"
                log_success "数据库备份完成"
            fi
        fi
    fi
}

deploy_new() {
    log_info "=========================================="
    log_info "执行全新部署"
    log_info "=========================================="

    log_info "检测系统环境..."
    OS=$(lsb_release -si 2>/dev/null || echo "Unknown")
    RELEASE=$(lsb_release -sr 2>/dev/null || echo "Unknown")
    log_info "系统: $OS $RELEASE"

    if [[ "$OS" != "Ubuntu" ]]; then
        log_warn "推荐在 Ubuntu 22.04 LTS 上部署"
        confirm "是否继续？"
    fi

    read -p "请输入服务器公网IP (默认: 43.138.218.55): " SERVER_IP
    SERVER_IP=${SERVER_IP:-43.138.218.55}

    read -p "请输入数据库密码 (默认: milk-can-2026): " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-milk-can-2026}

    read -p "请输入API端口 (默认: 3001): " API_PORT
    API_PORT=${API_PORT:-3001}

    confirm "即将开始部署，是否继续？"

    log_info "步骤1: 更新系统并安装依赖"
    $SUDO apt update -y
    $SUDO apt upgrade -y
    $SUDO apt install -y build-essential python3 git nginx mysql-server

    log_info "安装 Node.js 20.x..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        $SUDO apt install -y nodejs
    fi
    log_info "Node.js: $(node -v), npm: $(npm -v)"

    $SUDO npm install -g pm2
    log_success "步骤1完成"

    log_info "步骤2: 配置 MySQL"
    $SUDO systemctl start mysql
    $SUDO systemctl enable mysql
    $SUDO mysql -u root -e "CREATE DATABASE IF NOT EXISTS milk_can_mes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    $SUDO mysql -u root -e "DROP USER IF EXISTS 'milk_can_mes'@'localhost';"
    $SUDO mysql -u root -e "CREATE USER 'milk_can_mes'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"
    $SUDO mysql -u root -e "GRANT ALL PRIVILEGES ON milk_can_mes.* TO 'milk_can_mes'@'localhost';"
    $SUDO mysql -u root -e "FLUSH PRIVILEGES;"
    log_success "步骤2完成"

    log_info "步骤3: 克隆项目代码（main分支）"
    $SUDO git clone -b main https://github.com/gddsb/CSDM01.git "$PROJECT_DIR"

    log_info "修改项目目录所有权..."
    $SUDO chown -R $(whoami):$(whoami) "$PROJECT_DIR"

    log_info "安装前端依赖并构建..."
    cd "$PROJECT_DIR"
    npm install
    npm run build

    log_info "安装后端依赖..."
    cd "$PROJECT_DIR/server"
    npm install
    npm rebuild sqlite3 2>/dev/null || true

    log_info "配置环境变量..."
    cat > .env <<EOF
PORT=$API_PORT
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=milk_can_mes
DB_USER=milk_can_mes
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=milk-can-mes-secret-key-2026
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
EOF

    log_info "初始化数据库..."
    node src/seed.js
    log_success "步骤3完成"

    log_info "步骤4: 配置 PM2"
    cd "$PROJECT_DIR"
    cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: 'milk-can-mes-server',
    cwd: '$PROJECT_DIR/server',
    script: 'src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: $API_PORT,
      DB_DIALECT: 'mysql',
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_NAME: 'milk_can_mes',
      DB_USER: 'milk_can_mes',
      DB_PASSWORD: '$DB_PASSWORD'
    }
  }]
}
EOF

    pm2 start ecosystem.config.cjs
    $SUDO pm2 startup
    pm2 save
    log_success "步骤4完成"

    log_info "步骤5: 配置 Nginx"
    $SUDO cat > /etc/nginx/sites-available/milk-can-mes <<EOF
server {
    listen 80;
    server_name $SERVER_IP;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {
        root $PROJECT_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        expires 7d;
    }
}
EOF

    $SUDO rm -f /etc/nginx/sites-enabled/default
    $SUDO ln -sf /etc/nginx/sites-available/milk-can-mes /etc/nginx/sites-enabled/
    $SUDO nginx -t
    $SUDO systemctl restart nginx
    $SUDO systemctl enable nginx
    log_success "步骤5完成"

    log_info "步骤6: 配置防火墙"
    $SUDO ufw allow 80/tcp
    $SUDO ufw allow 443/tcp
    $SUDO ufw allow 22/tcp
    $SUDO ufw --force enable
    log_success "步骤6完成"

    verify_deployment "$SERVER_IP" "$API_PORT"
}

deploy_redeploy() {
    log_info "=========================================="
    log_info "执行重新部署"
    log_info "=========================================="

    if [ -f "$PROJECT_DIR/server/.env" ]; then
        SERVER_IP=$(grep "server_name" /etc/nginx/sites-available/milk-can-mes 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || echo "43.138.218.55")
        API_PORT=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
        DB_PASSWORD=$(grep "DB_PASSWORD" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')

        log_info "检测到现有配置:"
        log_info "  IP: $SERVER_IP"
        log_info "  端口: $API_PORT"
    fi

    confirm "即将清空项目目录并重新部署，是否继续？"

    log_info "停止服务..."
    pm2 stop milk-can-mes-server 2>/dev/null || true

    log_info "备份并清空..."
    backup_current_version
    backup_database
    $SUDO rm -rf "$PROJECT_DIR"

    log_info "克隆项目代码（main分支）..."
    $SUDO git clone -b main https://github.com/gddsb/CSDM01.git "$PROJECT_DIR"

    log_info "修改项目目录所有权..."
    $SUDO chown -R $(whoami):$(whoami) "$PROJECT_DIR"

    log_info "安装前端依赖并构建..."
    cd "$PROJECT_DIR"
    npm install
    npm run build

    log_info "安装后端依赖..."
    cd "$PROJECT_DIR/server"
    npm install
    npm rebuild sqlite3 2>/dev/null || true

    log_info "恢复环境变量..."
    cat > .env <<EOF
PORT=$API_PORT
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=milk_can_mes
DB_USER=milk_can_mes
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=milk-can-mes-secret-key-2026
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
EOF

    log_info "重启服务..."
    pm2 restart milk-can-mes-server || pm2 start "$PROJECT_DIR/ecosystem.config.cjs"

    verify_deployment "$SERVER_IP" "$API_PORT"
}

deploy_update() {
    log_info "=========================================="
    log_info "执行更新升级"
    log_info "=========================================="

    cd "$PROJECT_DIR"

    log_info "检查远程更新..."
    git fetch origin main 2>/dev/null || git fetch origin 2>/dev/null

    LOCAL_COMMIT=$(git rev-parse --short HEAD)
    REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || git rev-parse --short origin/HEAD 2>/dev/null)

    if [ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]; then
        log_success "当前已是最新版本，无需更新"
        log_info "本地: $LOCAL_COMMIT, 远程: $REMOTE_COMMIT"
        exit 0
    fi

    log_info "发现新版本:"
    log_info "  本地: $LOCAL_COMMIT"
    log_info "  远程: $REMOTE_COMMIT"

    log_info "更新内容:"
    git log --oneline HEAD..origin/main 2>/dev/null | head -10

    confirm "是否继续更新？"

    SERVER_IP=$(grep "server_name" /etc/nginx/sites-available/milk-can-mes 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || echo "43.138.218.55")
    API_PORT=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')

    log_info "停止服务..."
    pm2 stop milk-can-mes-server 2>/dev/null || true

    backup_current_version
    backup_database

    log_info "拉取最新代码（main分支）..."
    git stash 2>/dev/null || true
    git checkout main 2>/dev/null || true
    git pull origin main --force 2>/dev/null || git reset --hard origin/main 2>/dev/null
    git stash pop 2>/dev/null || true

    log_info "更新前端..."
    cd "$PROJECT_DIR"
    npm install
    npm run build

    log_info "更新后端..."
    cd "$PROJECT_DIR/server"
    npm install
    npm rebuild sqlite3 2>/dev/null || true

    log_info "重启服务..."
    pm2 restart milk-can-mes-server || pm2 start "$PROJECT_DIR/ecosystem.config.cjs"

    verify_deployment "$SERVER_IP" "$API_PORT"
}

verify_deployment() {
    SERVER_IP="$1"
    API_PORT="$2"

    log_info "步骤7: 验证部署"
    sleep 3

    log_info "检查服务状态..."
    if pm2 status | grep "milk-can-mes-server" | grep -q "online"; then
        log_success "服务运行正常"
    else
        log_error "服务运行异常"
        pm2 logs milk-can-mes-server --lines 20
        return 1
    fi

    log_info "检查 API..."
    API_RESPONSE=$(curl -s "http://127.0.0.1:$API_PORT/api/health" 2>/dev/null)
    if echo "$API_RESPONSE" | grep -q "ok"; then
        log_success "API 正常: $API_RESPONSE"
    else
        log_warn "API 异常: $API_RESPONSE"
    fi

    log_info "检查前端..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/" 2>/dev/null)
    if [[ "$HTTP_CODE" == "200" ]]; then
        log_success "前端正常: HTTP $HTTP_CODE"
    else
        log_warn "前端异常: HTTP $HTTP_CODE"
    fi

    log_info "=========================================="
    log_info "部署完成！"
    log_info "=========================================="
    log_info "访问地址: http://$SERVER_IP"
    log_info "账号: admin / 密码: 123456"
    echo
    log_info "常用命令:"
    log_info "  状态: pm2 status"
    log_info "  日志: pm2 logs milk-can-mes-server"
    log_info "  重启: pm2 restart milk-can-mes-server"
    log_info "  日志文件: cat $LOG_FILE"
    echo
    log_success "操作成功完成！"
}

reset_data() {
    log_info "=========================================="
    log_info "执行数据重置"
    log_info "=========================================="

    log_warn "警告: 此操作将清除所有业务数据并重新初始化！"
    confirm "确定要重置数据吗？"

    log_info "停止服务..."
    pm2 stop milk-can-mes-server 2>/dev/null || true

    log_info "备份当前数据库..."
    backup_database

    log_info "清除现有数据..."
    cd "$PROJECT_DIR/server"
    node src/clean-init.js 2>/dev/null || log_warn "clean-init.js 执行失败，跳过"

    log_info "重新初始化数据..."
    node src/seed.js

    log_info "重启服务..."
    pm2 restart milk-can-mes-server || pm2 start "$PROJECT_DIR/ecosystem.config.cjs"

    SERVER_IP=$(grep "server_name" /etc/nginx/sites-available/milk-can-mes 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || echo "localhost")
    API_PORT=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')

    verify_deployment "$SERVER_IP" "$API_PORT"
}

rollback() {
    log_error "部署失败，执行回滚..."

    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/milk-can-mes_*.tar.gz 2>/dev/null | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "未找到备份"
        exit 1
    fi

    log_info "使用备份: $LATEST_BACKUP"
    pm2 stop milk-can-mes-server 2>/dev/null || true
    $SUDO rm -rf "$PROJECT_DIR"
    $SUDO tar -xzf "$LATEST_BACKUP" -C "$(dirname $PROJECT_DIR)"

    LATEST_DB=$(ls -t "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sqlite 2>/dev/null | head -1)
    if [ -n "$LATEST_DB" ]; then
        DB_TYPE=$(grep "DB_DIALECT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ' || echo "sqlite")
        if [ "$DB_TYPE" == "mysql" ]; then
            DB_NAME=$(grep "DB_NAME" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
            DB_USER=$(grep "DB_USER" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
            $SUDO mysql -u "$DB_USER" "$DB_NAME" < "$LATEST_DB"
        else
            DB_FILE=$(find "$PROJECT_DIR/server" -name "*.sqlite" 2>/dev/null | head -1)
            [ -n "$DB_FILE" ] && $SUDO cp "$LATEST_DB" "$DB_FILE"
        fi
    fi

    pm2 restart milk-can-mes-server || pm2 start "$PROJECT_DIR/ecosystem.config.cjs"
    log_success "回滚完成"
}

show_menu() {
    echo
    log_info "=========================================="
    log_info "    奶粉罐生产管理系统 - 部署工具"
    log_info "    版本: V1.0.0.109"
    log_info "=========================================="

    check_root
    create_backup_dir

    if [ -d "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR/.git" ]; then
        log_info "项目已部署在: $PROJECT_DIR"
        CURRENT_VERSION=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        CURRENT_BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo "unknown")
        log_info "当前版本: $CURRENT_VERSION (分支: $CURRENT_BRANCH)"

        echo
        log_info "请选择操作:"
        echo "  1) 更新升级 - 从 GitHub main 分支拉取最新代码"
        echo "  2) 重新部署 - 清空并重新部署（保留数据库）"
        echo "  3) 重置数据 - 清除所有业务数据并重新初始化"
        echo "  4) 退出"
        echo

        read -p "请输入选项 (1/2/3/4): " -n 1 -r
        echo

        case $REPLY in
            1)
                deploy_update
                ;;
            2)
                deploy_redeploy
                ;;
            3)
                reset_data
                ;;
            4)
                log_info "退出"
                exit 0
                ;;
            *)
                log_error "无效选项"
                exit 1
                ;;
        esac
    else
        log_info "项目未部署"
        echo
        log_info "请选择操作:"
        echo "  1) 全新部署 - 安装系统环境并部署项目"
        echo "  2) 退出"
        echo

        read -p "请输入选项 (1/2): " -n 1 -r
        echo

        case $REPLY in
            1)
                deploy_new
                ;;
            2)
                log_info "退出"
                exit 0
                ;;
            *)
                log_error "无效选项"
                exit 1
                ;;
        esac
    fi
}

main() {
    show_menu
}

trap 'rollback' ERR

main