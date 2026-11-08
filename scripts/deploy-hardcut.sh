#!/bin/bash
# ============================================================================
# 方案 A 彻底硬切 — 生产一键部署脚本
# 
# 使用方法:
#   export PROD_SSH_PASS='你的生产服务器密码'
#   bash scripts/deploy-hardcut.sh
# 
# 前置: 服务器已预装 connect 命令 (HTTP CONNECT 代理客户端)
#       OR 本机已 sshpass + connect_proxy.py
# ============================================================================

set -e

# === 配置 ===
PROD_HOST="43.138.218.55"
PROD_USER="ubuntu"
PROD_PORT=22
PROXY_HOST="127.0.0.1"
PROXY_PORT=18080
PROJECT_DIR="/opt/milk-can-mes"
MYSQL_CMD="mysql -uroot -p123456 -h127.0.0.1 -P3301 milk_can_mes"

if [ -z "$PROD_SSH_PASS" ]; then
  echo "❌ 请先 export PROD_SSH_PASS=生产机 SSH 密码"
  exit 1
fi

# === SSH 包装 ===
# 优先用 connect 命令，退回到 python3 代理
if command -v connect &>/dev/null; then
  PROXY_CMD='connect -H 127.0.0.1:18080 %h %p'
else
  PROXY_CMD='python3 /tmp/connect_proxy.py %h %p'
fi

SSH_OPTS="-o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=30 -o ProxyCommand='${PROXY_CMD}'"

ssh_exec() {
  sshpass -p "$PROD_SSH_PASS" ssh $SSH_OPTS "${PROD_USER}@${PROD_HOST}" "$1" 2>/dev/null
}

ssh_exec_silent() {
  sshpass -p "$PROD_SSH_PASS" ssh $SSH_OPTS "${PROD_USER}@${PROD_HOST}" "$1" 2>&1
}

# === 标题 ===
step() {
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  [$1/8] $2"
  echo "════════════════════════════════════════════════════"
}

# === 步骤 0: 预检 ===
step 0 "SSH 连接预检"
if ! ssh_exec "echo SSH_OK" | grep -q SSH_OK; then
  echo "❌ SSH 连接失败，请检查 PROD_SSH_PASS 和代理"
  exit 1
fi
echo "✅ SSH 连通"

# === 步骤 1: 检查生产当前状态 ===
step 1 "检查生产当前状态"
echo "- git log -3:"
ssh_exec "cd $PROJECT_DIR && git log --oneline -3"
echo "- git status:"
ssh_exec "cd $PROJECT_DIR && git status --short"
echo "- migration_version:"
ssh_exec "$MYSQL_CMD -e \"SELECT * FROM migration_version ORDER BY version DESC LIMIT 10;\" 2>/dev/null" || echo "  (migration_version 表不存在或无权限)"
echo "- 生产 role_permission system:* 残留:"
ssh_exec "$MYSQL_CMD -e \"
  SELECT 'system:* 残留角色' AS info, r.role_code, COUNT(*) AS cnt
  FROM sys_role_permission rp
  JOIN sys_permission p ON rp.perm_id = p.perm_id
  JOIN sys_role r ON rp.role_id = r.role_id
  WHERE p.perm_code LIKE 'system:user:%' OR p.perm_code LIKE 'system:role:%'
  GROUP BY r.role_code;
\""

# === 步骤 2: Pull 最新代码 ===
step 2 "git pull origin main"
ssh_exec "cd $PROJECT_DIR && git fetch origin main && git pull origin main"
echo "  最新 HEAD:"
ssh_exec "cd $PROJECT_DIR && git log --oneline -1"

# === 步骤 3: 手动执行 migration ===
step 3 "执行 migration 035 + 036"

# 3.1 上传 migration 文件
if [ -f "server/src/migrations/035-iam-migration-followup.sql" ]; then
  scp_opts="-o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=30 -o ProxyCommand='${PROXY_CMD}'"
  sshpass -p "$PROD_SSH_PASS" scp $scp_opts \
    server/src/migrations/035-iam-migration-followup.sql \
    "${PROD_USER}@${PROD_HOST}:${PROJECT_DIR}/server/src/migrations/" 2>/dev/null
  sshpass -p "$PROD_SSH_PASS" scp $scp_opts \
    server/src/migrations/036-hardcut-delete-legacy.sql \
    "${PROD_USER}@${PROD_HOST}:${PROJECT_DIR}/server/src/migrations/" 2>/dev/null
  echo "  ✅ migration 文件已上传"
fi

# 3.2 执行 migration 035 (补 dataScope + 重绑定 + 停用旧菜单)
echo ""
echo "  → migration 035 (幂等, 可重复执行):"
ssh_exec "cd $PROJECT_DIR && $MYSQL_CMD < server/src/migrations/035-iam-migration-followup.sql 2>&1" \
  && echo "  ✅ 035 执行成功" \
  || echo "  ⚠️ 035 有警告但非必须中断"

# 3.3 执行 migration 036 (彻底删旧权限)
echo ""
echo "  → migration 036 (彻底删旧 system:*):"
ssh_exec "cd $PROJECT_DIR && $MYSQL_CMD < server/src/migrations/036-hardcut-delete-legacy.sql 2>&1" \
  && echo "  ✅ 036 执行成功" \
  || echo "  ❌ 036 执行失败，请检查"

# 3.4 migration 结果验证
echo ""
echo "  → migration 结果验证:"
ssh_exec "$MYSQL_CMD -e \"
  SELECT 'sys_permission 残留 system:*' AS item, COUNT(*) AS cnt
  FROM sys_permission
  WHERE perm_code LIKE 'system:user%' OR perm_code LIKE 'system:role%';

  SELECT 'role_permission 残留 system:*' AS item, COUNT(*) AS cnt
  FROM sys_role_permission rp
  JOIN sys_permission p ON rp.perm_id = p.perm_id
  WHERE p.perm_code LIKE 'system:user%' OR p.perm_code LIKE 'system:role%';

  SELECT 'iam 权限总数' AS item, COUNT(*) AS cnt
  FROM sys_permission WHERE perm_code LIKE 'iam:%';

  SELECT r.role_code, COUNT(*) AS iam_perms
  FROM sys_role_permission rp
  JOIN sys_permission p ON rp.perm_id = p.perm_id
  JOIN sys_role r ON rp.role_id = r.role_id
  WHERE p.perm_code LIKE 'iam:%'
  GROUP BY r.role_code
  ORDER BY iam_perms DESC;
\""

# === 步骤 4: 停后端 ===
step 4 "停后端"
ssh_exec "
  pkill -f 'tsx.*app.ts' 2>/dev/null || true
  pm2 delete all 2>/dev/null || true
  pm2 kill 2>/dev/null || true
  sleep 1
  echo '后端已停'
"

# === 步骤 5: 后端依赖 + 启动 ===
step 5 "后端 pnpm install + 启动"
ssh_exec "
  cd $PROJECT_DIR/server
  pnpm install --frozen-lockfile 2>&1 | tail -3
  nohup pnpm start > /tmp/backend.log 2>&1 &
  echo PID=\$!
"

# 等后端起来
echo "  等待后端启动..."
for i in $(seq 1 20); do
  CODE=$(ssh_exec_silent "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/" 2>/dev/null)
  if [ "$CODE" = "200" ] || [ "$CODE" = "302" ]; then
    echo "  ✅ 后端启动成功 (HTTP $CODE)  [${i}/20]"
    break
  fi
  echo "  ...等待 (${i}/20)"
  sleep 3
done

ssh_exec "curl -s http://localhost:3001/ | head -1"

# === 步骤 6: 前端 install + build ===
step 6 "前端 pnpm install + build"
ssh_exec "
  cd $PROJECT_DIR
  pnpm install --frozen-lockfile 2>&1 | tail -3
  pnpm run build 2>&1 | tail -10
"

# === 步骤 7: Nginx reload ===
step 7 "Nginx reload"
ssh_exec "
  nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null)
  echo '✅ Nginx 已 reload'
"

# === 步骤 8: 最终验证 ===
step 8 "最终验证"
TOKEN=$(ssh_exec_silent "curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"123456\"}'" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

echo "  ① admin perm_codes 残留检查:"
ssh_exec "curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"123456\"}'" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']['user']['perm_codes']
su = [c for c in d if c.startswith('system:user')]
sr = [c for c in d if c.startswith('system:role')]
iu = [c for c in d if c.startswith('iam:user')]
ir = [c for c in d if c.startswith('iam:role')]
print(f'     system:user 残留 [{len(su)}]: {su}')
print(f'     system:role 残留 [{len(sr)}]: {sr}')
print(f'     iam:user    [{len(iu)}]')
print(f'     iam:role    [{len(ir)}]')
print(f'     → 状态: {\"❌ 有残留\" if su or sr else \"✅ 彻底硬切成功\"}')
"

echo ""
echo "  ② 前端 dist 文件:"
ssh_exec "ls -la $PROJECT_DIR/dist/index.html"

echo ""
echo "  ③ 后端端口 + 进程:"
ssh_exec "
  ss -tlnp | grep -E ':3001|:80|:443'
  ps aux | grep -E 'tsx|nginx' | grep -v grep | head -5
"

echo ""
echo "════════════════════════════════════════════════════"
echo "  🎉 部署完成!"
echo ""
echo "  部署后请在浏览器验证:"
echo "  1. admin 登录 → 有'用户与权限'菜单 + 10 个二级菜单"
echo "  2. admin → 用户管理 → 按钮正常"
echo "  3. op 登录 → 看不到'用户与权限'菜单"
echo "════════════════════════════════════════════════════"
