#!/bin/bash
set -e
set -u
set -o pipefail
# ============================================================
# 奶粉罐生产管理系统 - 部署工具 setup.sh
# 固定公网IP：43.138.218.55
# 技术栈: React + Vite | Express + Sequelize + TypeScript(tsx) | MySQL | PM2 | Nginx
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
PROJECT_DIR="/opt/milk-can-mes"
BACKUP_DIR="/opt/backups"
LOG_FILE="$BACKUP_DIR/deploy.log"
GITHUB_TIMEOUT=30
GIT_RETRY_COUNT=3
DB_NAME="milk_can_mes"
DB_USER="milk_can_mes"
DB_DEFAULT_PASSWORD="milk-can-2026"
JWT_SECRET="milk-can-mes-jwt-secret-key-2026"
DEFAULT_PORT=3001
# 全局固定服务器公网IP，仅需修改此处更换IP
FIX_SERVER_IP="43.138.218.55"
MIN_DISK_GB=5
MIN_MEM_MB=1024
GITHUB_REPOS=(
    "https://github.com/gddsb/CSDM01.git"
    "https://gh-proxy.com/https://github.com/gddsb/CSDM01.git"
    "https://github.moeyy.xyz/https://github.com/gddsb/CSDM01.git"
)
# ============================================================
# 日志函数
# ============================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}
log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
    echo "[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}
log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE" 2>/dev/null || true
}
# ============================================================
# 基础工具函数
# ============================================================
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
fix_dir_owner() {
    local target="$1"
    log_info "修正目录权限属主: $target"
    $SUDO chown -R $(whoami):$(whoami) "$target"
}
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "创建备份目录: $BACKUP_DIR"
        $SUDO mkdir -p "$BACKUP_DIR"
        fix_dir_owner "$BACKUP_DIR"
    fi
    touch "$LOG_FILE" 2>/dev/null || $SUDO touch "$LOG_FILE"
    fix_dir_owner "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
    echo "操作开始: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
}
# 前置资源校验：磁盘/内存/node
pre_check_resource() {
    log_info "执行前置资源校验..."
    local disk_free_gb
    disk_free_gb=$(df -P / | awk 'NR==2 {print $4/1024/1024}')
    if (( $(echo "$disk_free_gb < $MIN_DISK_GB" | bc -l) )); then
        log_error "根分区剩余空间不足${MIN_DISK_GB}GB，当前剩余${disk_free_gb:0:4}GB"
        exit 1
    fi
    local mem_free_mb
    mem_free_mb=$(free -m | awk '/^Mem:/{print $7}')
    if [ "$mem_free_mb" -lt "$MIN_MEM_MB" ]; then
        log_error "可用内存不足${MIN_MEM_MB}MB，当前可用${mem_free_mb}MB"
        exit 1
    fi
    if command -v node &> /dev/null; then
        local node_ver
        node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$node_ver" -lt 20 ]; then
            log_warn "当前Node版本v${node_ver}，推荐Node20.x，继续可能存在兼容问题"
            confirm "是否忽略版本警告继续？"
        fi
    fi
    log_success "资源校验通过"
}
# npm国内镜像统一配置（仅npm官方合法参数，无废弃配置）
set_npm_mirror() {
    log_info "配置npm国内镜像加速"
    npm config set registry https://registry.npmmirror.com
    npm config set cache ~/.npm
}
# ============================================================
# 备份函数
# ============================================================
backup_current_version() {
    log_info "备份当前版本..."
    CURRENT_COMMIT=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_info "当前版本: $CURRENT_COMMIT"
    BACKUP_FILE="$BACKUP_DIR/milk-can-mes_$(date +%Y%m%d_%H%M%S).tar.gz"
    log_info "备份到: $BACKUP_FILE"
    $SUDO tar -czf "$BACKUP_FILE" -C "$(dirname $PROJECT_DIR)" "$(basename $PROJECT_DIR)" 2>/dev/null || true
    fix_dir_owner "$BACKUP_FILE"
    log_success "备份完成"
}
backup_database() {
    log_info "备份数据库 (MySQL)..."
    if [ ! -f "$PROJECT_DIR/server/.env" ]; then
        log_warn "未找到 .env 文件，跳过数据库备份"
        return
    fi
    local db_password
    db_password=$(grep "DB_PASSWORD" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
    DB_BACKUP="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
    log_info "导出 MySQL: $DB_NAME"
    $SUDO mysqldump -u "$DB_USER" -p"$db_password" "$DB_NAME" > "$DB_BACKUP" 2>/dev/null || {
        log_warn "mysqldump 失败，尝试 root 用户..."
        $SUDO mysqldump -u root "$DB_NAME" > "$DB_BACKUP" 2>/dev/null || log_warn "数据库备份失败"
    }
    [ -f "$DB_BACKUP" ] && fix_dir_owner "$DB_BACKUP" && log_success "数据库备份完成: $DB_BACKUP"
}
# ============================================================
# GitHub 连接函数（3次重试）
# ============================================================
test_github_connection() {
    local repo_url="$1"
    log_info "测试连接: $repo_url"
    timeout "$GITHUB_TIMEOUT" git ls-remote --quiet "$repo_url" main >/dev/null 2>&1
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "连接成功"
        return 0
    elif [ $exit_code -eq 124 ]; then
        log_warn "连接超时（超过${GITHUB_TIMEOUT}秒）"
        return 1
    else
        log_warn "连接失败（错误码: $exit_code）"
        return 1
    fi
}
find_working_repo() {
    log_info "检测 GitHub 仓库连接..."
    for repo_url in "${GITHUB_REPOS[@]}"; do
        if test_github_connection "$repo_url"; then
            echo "$repo_url"
            return 0
        fi
        log_info "尝试下一个连接..."
        sleep 2
    done
    log_error "所有 GitHub 连接方案均失败"
    return 1
}
git_clone_with_retry() {
    local dest="$1"
    local working_repo
    working_repo=$(find_working_repo) || {
        log_error "无法连接到 GitHub 仓库"
        exit 1
    }
    log_info "使用仓库地址: $working_repo"
    local try=1
    while [ $try -le $GIT_RETRY_COUNT ]; do
        log_info "克隆尝试 $try/$GIT_RETRY_COUNT"
        timeout "$((GITHUB_TIMEOUT * 3))" git clone -b main "$working_repo" "$dest" 2>&1
        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            log_success "克隆成功"
            return 0
        fi
        log_warn "克隆失败，等待2秒重试"
        rm -rf "$dest"
        sleep 2
        try=$((try+1))
    done
    log_error "克隆多次重试全部失败"
    return 1
}
git_pull_with_retry() {
    local working_repo
    working_repo=$(find_working_repo) || {
        log_error "无法连接到 GitHub 仓库"
        exit 1
    }
    cd "$PROJECT_DIR"
    git remote set-url origin "$working_repo" 2>/dev/null || true
    log_info "使用仓库地址: $working_repo"
    log_info "拉取最新代码..."
    local try=1
    while [ $try -le $GIT_RETRY_COUNT ]; do
        log_info "拉取尝试 $try/$GIT_RETRY_COUNT"
        timeout "$((GITHUB_TIMEOUT * 3))" git pull origin main --force 2>&1
        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            log_success "拉取成功"
            return 0
        fi
        log_warn "拉取失败，等待2秒重试"
        sleep 2
        try=$((try+1))
    done
    log_error "拉取多次重试失败，强制重置代码"
    timeout "$((GITHUB_TIMEOUT * 3))" git reset --hard origin/main 2>&1
    return $?
}
# ============================================================
# 环境安装函数
# ============================================================
install_system_deps() {
    log_info "更新系统并安装依赖..."
    $SUDO apt update -y
    confirm "是否执行apt full-upgrade（线上生产建议选N）"
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $SUDO apt full-upgrade -y
    fi
    $SUDO apt install -y build-essential python3 git nginx mysql-server
    log_info "安装 Node.js 20.x..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        $SUDO apt install -y nodejs
    fi
    log_info "Node.js: $(node -v), npm: $(npm -v)"
    log_info "安装 PM2..."
    set_npm_mirror
    $SUDO npm install -g pm2
    log_success "系统依赖安装完成"
}
setup_mysql() {
    local db_password="$1"
    log_info "配置 MySQL..."
    $SUDO systemctl start mysql
    $SUDO systemctl enable mysql
    $SUDO mysql -u root -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    $SUDO mysql -u root -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${db_password}';"
    $SUDO mysql -u root -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    $SUDO mysql -u root -e "FLUSH PRIVILEGES;"
    log_success "MySQL 配置完成"
}
setup_mysql_fresh() {
    local db_password="$1"
    log_info "配置 MySQL（全新初始化）..."
    $SUDO systemctl start mysql
    $SUDO systemctl enable mysql
    $SUDO mysql -u root -e "DROP DATABASE IF EXISTS ${DB_NAME};"
    $SUDO mysql -u root -e "CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    $SUDO mysql -u root -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';"
    $SUDO mysql -u root -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${db_password}';"
    $SUDO mysql -u root -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    $SUDO mysql -u root -e "FLUSH PRIVILEGES;"
    log_success "MySQL 全新初始化完成"
}
# ============================================================
# 项目构建函数
# ============================================================
build_frontend() {
    log_info "安装前端依赖并构建..."
    cd "$PROJECT_DIR"
    fix_dir_owner "$PROJECT_DIR"
    set_npm_mirror
    rm -rf node_modules package-lock.json
    npm install
    npm run build
    log_success "前端构建完成"
}
install_backend_deps() {
    log_info "安装后端依赖..."
    cd "$PROJECT_DIR/server"
    fix_dir_owner "$PROJECT_DIR/server"
    set_npm_mirror
    rm -rf node_modules package-lock.json
    npm install
    log_success "后端依赖安装完成"
}
write_env_file() {
    local api_port="$1"
    local db_password="$2"
    log_info "配置环境变量..."
    cat > "$PROJECT_DIR/server/.env" <<EOF
# 服务端口
PORT=${api_port}
# 数据库配置（MySQL）
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${db_password}
# JWT 密钥
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
EOF
    fix_dir_owner "$PROJECT_DIR/server/.env"
    log_success "环境变量配置完成"
}
write_ecosystem_config() {
    local api_port="$1"
    local db_password="$2"
    log_info "配置 PM2（tsx直跑源码，完全不依赖dist目录）"
    cat > "$PROJECT_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: 'milk-can-mes-server',
    script: './server/src/app.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    cwd: '$PROJECT_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: ${api_port},
      DB_DIALECT: 'mysql',
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_NAME: '${DB_NAME}',
      DB_USER: '${DB_USER}',
      DB_PASSWORD: '${db_password}',
      JWT_SECRET: '${JWT_SECRET}',
      UPLOAD_DIR: './uploads'
    },
    error_file: '$BACKUP_DIR/pm2-error.log',
    out_file: '$BACKUP_DIR/pm2-out.log',
    time: true
  }]
}
EOF
    fix_dir_owner "$PROJECT_DIR/ecosystem.config.cjs"
    log_success "PM2 配置完成"
}
setup_nginx() {
    local server_ip="$1"
    local api_port="$2"
    log_info "配置 Nginx，绑定IP：$server_ip"
    $SUDO cat > /etc/nginx/sites-available/milk-can-mes <<EOF
server {
    listen 80;
    server_name $server_ip;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    location / {
        root $PROJECT_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    location /api {
        proxy_pass http://127.0.0.1:$api_port;
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
        proxy_pass http://127.0.0.1:$api_port;
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
    log_success "Nginx 配置完成"
}
setup_firewall() {
    log_info "配置防火墙，放行80/443/22端口"
    $SUDO ufw allow 80/tcp
    $SUDO ufw allow 443/tcp
    $SUDO ufw allow 22/tcp
    if ! $SUDO ufw status | grep -q "active"; then
        $SUDO ufw --force enable
    fi
    log_success "防火墙配置完成"
}
start_pm2_service() {
    log_info "启动 PM2（清空旧进程缓存，杜绝dist报错）"
    cd "$PROJECT_DIR"
    # 彻底删除旧PM2进程记录，清除dist相关旧配置缓存
    pm2 stop milk-can-mes-server 2>/dev/null || true
    pm2 delete milk-can-mes-server 2>/dev/null || true
    pm2 flush
    pm2 start ecosystem.config.cjs
    sleep 3
    if pm2 status | grep "milk-can-mes-server" | grep -q "online"; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败，查看日志:"
        pm2 logs milk-can-mes-server --lines 30 --nostream
        exit 1
    fi
    if [ ! -f /etc/systemd/system/pm2-root.service ] && [ ! -f ~/.config/systemd/user/pm2.service ]; then
        $SUDO pm2 startup
    fi
    pm2 save
}
restart_pm2_service() {
    log_info "重启 PM2 服务，清除旧缓存"
    pm2 stop milk-can-mes-server 2>/dev/null || true
    pm2 delete milk-can-mes-server 2>/dev/null || true
    pm2 flush
    pm2 start ecosystem.config.cjs
    sleep 3
    if pm2 status | grep "milk-can-mes-server" | grep -q "online"; then
        log_success "服务重启成功"
    else
        log_error "服务重启失败，查看日志:"
        pm2 logs milk-can-mes-server --lines 30 --nostream
        exit 1
    fi
}
# ============================================================
# 验证函数
# ============================================================
verify_deployment() {
    local server_ip="$1"
    local api_port="$2"
    log_info "验证部署..."
    sleep 3
    if pm2 status | grep "milk-can-mes-server" | grep -q "online"; then
        log_success "服务运行正常"
    else
        log_error "服务运行异常"
        log_info "===== 服务错误日志 ====="
        pm2 logs milk-can-mes-server --lines 50 --nostream 2>&1 || true
        log_info "========================"
        return 1
    fi
    API_RESPONSE=$(curl -s "http://127.0.0.1:$api_port/api/health" 2>/dev/null)
    if echo "$API_RESPONSE" | grep -q "ok"; then
        log_success "API 正常: $API_RESPONSE"
    else
        log_warn "API 异常: $API_RESPONSE"
    fi
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$server_ip/" 2>/dev/null)
    if [[ "$HTTP_CODE" == "200" ]]; then
        log_success "前端正常: HTTP $HTTP_CODE"
    else
        log_warn "前端异常: HTTP $HTTP_CODE"
    fi
    log_info "=========================================="
    log_info "部署完成！访问地址: http://$server_ip"
    log_info "默认账号: admin / 密码: 123456"
    log_info "常用命令："
    log_info "  pm2 status        查看服务状态"
    log_info "  pm2 logs milk-can-mes-server 查看日志"
    log_info "  pm2 restart milk-can-mes-server 重启服务"
    log_success "操作成功完成！"
}
# ============================================================
# 部署函数
# ============================================================
deploy_new() {
    log_info "=========================================="
    log_info "全新部署（清空项目+数据库）固定IP:${FIX_SERVER_IP}"
    log_info "=========================================="
    pre_check_resource
    OS=$(lsb_release -si 2>/dev/null || echo "Unknown")
    RELEASE=$(lsb_release -sr 2>/dev/null || echo "Unknown")
    log_info "系统: $OS $RELEASE"
    if [[ "$OS" != "Ubuntu" ]]; then
        log_warn "推荐 Ubuntu 22.04 LTS"
        confirm "是否继续？"
    fi
    read -p "服务器公网IP(默认${FIX_SERVER_IP}，回车直接使用): " SERVER_IP
    SERVER_IP=${SERVER_IP:-${FIX_SERVER_IP}}
    read -p "数据库密码(默认${DB_DEFAULT_PASSWORD}): " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-$DB_DEFAULT_PASSWORD}
    read -p "API端口(默认${DEFAULT_PORT}): " API_PORT
    API_PORT=${API_PORT:-$DEFAULT_PORT}
    log_warn "警告：全新部署会清空项目与数据库！"
    confirm "确认继续全新部署？"
    pm2 stop milk-can-mes-server 2>/dev/null || true
    pm2 delete milk-can-mes-server 2>/dev/null || true
    $SUDO rm -rf "$PROJECT_DIR"
    log_info "步骤1/6 系统依赖"
    install_system_deps
    log_info "步骤2/6 MySQL全新初始化"
    setup_mysql_fresh "$DB_PASSWORD"
    log_info "步骤3/6 拉取代码并构建前后端"
    git_clone_with_retry "$PROJECT_DIR"
    fix_dir_owner "$PROJECT_DIR"
    build_frontend
    install_backend_deps
    log_info "步骤4/6 生成环境文件+数据库种子"
    write_env_file "$API_PORT" "$DB_PASSWORD"
    cd "$PROJECT_DIR/server"
    if ! npm run seed; then
        log_warn "种子数据初始化失败，可手动进入server目录执行 npm run seed"
    fi
    log_info "步骤5/6 生成PM2配置并启动服务"
    write_ecosystem_config "$API_PORT" "$DB_PASSWORD"
    start_pm2_service
    log_info "步骤6/6 Nginx反向代理+防火墙"
    setup_nginx "$SERVER_IP" "$API_PORT"
    setup_firewall
    verify_deployment "$SERVER_IP" "$API_PORT"
}
deploy_redeploy() {
    log_info "=========================================="
    log_info "重新部署（清空项目，保留数据库）固定IP:${FIX_SERVER_IP}"
    log_info "=========================================="
    pre_check_resource
    local server_ip=${FIX_SERVER_IP}
    local api_port db_password
    if [ -f "$PROJECT_DIR/server/.env" ]; then
        api_port=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
        db_password=$(grep "DB_PASSWORD" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
        log_info "固定公网IP:$server_ip 原有API端口:$api_port"
    else
        log_error "未检测到.env环境文件，请执行全新部署"
        exit 1
    fi
    log_warn "仅清空项目代码，数据库数据保留"
    confirm "确认执行重新部署？"
    pm2 stop milk-can-mes-server 2>/dev/null || true
    pm2 delete milk-can-mes-server 2>/dev/null || true
    backup_current_version
    $SUDO rm -rf "$PROJECT_DIR"
    git_clone_with_retry "$PROJECT_DIR"
    fix_dir_owner "$PROJECT_DIR"
    build_frontend
    install_backend_deps
    write_env_file "$api_port" "$db_password"
    write_ecosystem_config "$api_port" "$db_password"
    restart_pm2_service
    verify_deployment "$server_ip" "$api_port"
}
deploy_update() {
    log_info "=========================================="
    log_info "增量更新（拉取GitHub最新代码）固定IP:${FIX_SERVER_IP}"
    log_info "=========================================="
    pre_check_resource
    cd "$PROJECT_DIR"
    if ! git fetch origin main 2>/dev/null; then
        working_repo=$(find_working_repo)
        git remote set-url origin "$working_repo"
        git fetch origin main 2>/dev/null
    fi
    LOCAL_COMMIT=$(git rev-parse --short HEAD)
    REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || git rev-parse --short origin/HEAD)
    if [ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]; then
        log_success "当前已是最新版本，无需更新"
        exit 0
    fi
    log_info "本地提交:$LOCAL_COMMIT 远程提交:$REMOTE_COMMIT"
    git log --oneline HEAD..origin/main | head -10
    confirm "确认执行代码更新？"
    local server_ip=${FIX_SERVER_IP}
    local api_port
    api_port=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
    pm2 stop milk-can-mes-server 2>/dev/null || true
    backup_current_version
    backup_database
    git stash 2>/dev/null || true
    git checkout main 2>/dev/null || true
    git_pull_with_retry
    build_frontend
    install_backend_deps
    restart_pm2_service
    verify_deployment "$server_ip" "$api_port"
}
reset_data() {
    log_info "=========================================="
    log_info "重置数据库（清空所有业务数据）固定IP:${FIX_SERVER_IP}"
    log_info "=========================================="
    pre_check_resource
    log_warn "警告：所有业务数据将被清除，无法恢复！"
    confirm "确认重置数据库？"
    local server_ip=${FIX_SERVER_IP}
    local api_port
    api_port=$(grep "PORT" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
    pm2 stop milk-can-mes-server 2>/dev/null || true
    backup_database
    cd "$PROJECT_DIR/server"
    if ! npm run seed; then
        log_warn "种子数据初始化失败，请手动执行 npm run seed"
    fi
    restart_pm2_service
    verify_deployment "$server_ip" "$api_port"
}
rollback() {
    log_error "部署过程异常，自动执行回滚操作"
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/milk-can-mes_*.tar.gz 2>/dev/null | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "无备份文件，无法回滚"
        exit 1
    fi
    pm2 stop milk-can-mes-server 2>/dev/null || true
    pm2 delete milk-can-mes-server 2>/dev/null || true
    $SUDO rm -rf "$PROJECT_DIR"
    $SUDO tar -xzf "$LATEST_BACKUP" -C "$(dirname $PROJECT_DIR)"
    fix_dir_owner "$PROJECT_DIR"
    LATEST_DB=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -1)
    if [ -n "$LATEST_DB" ] && [ -f "$PROJECT_DIR/server/.env" ]; then
        local db_password=$(grep "DB_PASSWORD" "$PROJECT_DIR/server/.env" | cut -d'=' -f2 | tr -d ' ')
        $SUDO mysql -u "$DB_USER" -p"$db_password" "$DB_NAME" < "$LATEST_DB" 2>/dev/null || $SUDO mysql -u root "$DB_NAME" < "$LATEST_DB" 2>/dev/null
    fi
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.cjs 2>/dev/null || true
    log_success "回滚完成，服务已重启"
}
# ============================================================
# 主菜单入口
# ============================================================
show_menu() {
    echo
    log_info "=========================================="
    log_info "奶粉罐MES部署脚本 setup.sh | 固定公网IP:43.138.218.55"
    log_info "=========================================="
    check_root
    create_backup_dir
    if [ -d "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR/.git" ]; then
        CURRENT_VERSION=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || unknown)
        CURRENT_BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || unknown)
        log_info "项目路径: $PROJECT_DIR | 版本:$CURRENT_VERSION | 分支:$CURRENT_BRANCH"
        echo "1 更新升级 | 2 全新部署 | 3 重新部署 | 4 重置数据库 | 5 退出"
        read -p "输入操作选项: " -n1 -r; echo
        case $REPLY in
            1) deploy_update ;;
            2) deploy_new ;;
            3) deploy_redeploy ;;
            4) reset_data ;;
            5) exit 0 ;;
            *) log_error "无效选项"; exit 1 ;;
        esac
    else
        log_info "未检测到项目代码，仅支持全新部署"
        echo "1 全新部署 | 2 退出"
        read -p "输入操作选项: " -n1 -r; echo
        case $REPLY in
            1) deploy_new ;;
            2) exit 0 ;;
            *) log_error "无效选项"; exit 1 ;;
        esac
    fi
}
# 全局异常捕获：报错/强制Ctrl+C中断自动回滚
trap 'rollback; exit 1' ERR SIGINT SIGTERM
# 程序启动入口
show_menu
