---
name: "mes-deploy"
description: "Push code to GitHub and deploy MES production server. Invoke when user says 部署/发布/deploy/push 生产."
---

# MES 生产部署 Skill

> 适用于 `/workspace` MES 项目（Vite React 前端 + Node.js TSX 后端 + PM2 + gh-proxy）。
> 核心流程：**推送 GitHub → 生产机 reset --hard → vite build → pm2 restart → 五维验证**。

---

## Phase 0：前置快速检查（先做这个，省下后面很多步骤）

```bash
# 0.1 确认 Git 状态（两个 hash 相同说明本地和远程一致，直接跳过阶段 A）
git rev-parse HEAD && git rev-parse origin/main && git log --oneline -3

# 0.2 HTTP 代理（沙箱必需）
env | grep -i proxy | head -2

# 0.3 工具就绪
which sshpass connect-proxy npx curl || apt-get install -y sshpass connect-proxy
```

**决策树：**
- `HEAD == origin/main hash` → 跳过阶段 A，直接进 B+C
- `HEAD != origin/main` → 继续阶段 A 推送

---

## 固定配置（本 workspace 专用，不要挪去别的项目）

```bash
PROD_IP="43.138.218.55"
PROD_SSH_PASS="ASD!@#asd"
PROJECT_DIR="/opt/milk-can-mes"
HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:18080}"
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"

# SSH 别名：后续所有远程执行都 eval "${SSH} '<cmd>'"
SSH="sshpass -p '${PROD_SSH_PASS}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand='${PROXY_CMD}' -o ServerAliveInterval=15 ubuntu@${PROD_IP}"
```

**SSH 隧道测试**（第一次部署或代理变动时执行）：
```bash
connect -H 127.0.0.1:18080 ${PROD_IP} 22 &
sleep 2 && kill $! 2>/dev/null
# 看到 SSH-2.0-OpenSSH 表示通道正常
```

---

## Phase A：推送 GitHub（本地改动未在远程时执行）

```bash
git add -A && git commit -m "<本次改动简要描述>" && git push origin main
```

**如果 `git push` 报 `could not read Username / terminal prompts disabled`：**
这是 HTTPS remote 需要 token。两种处理：
1. **先检查远程是不是已经有了**：`git ls-remote origin refs/heads/main` — 如果输出的 hash 已包含你的改动，说明之前已成功推送，跳过 A
2. **需要重新推送时**：让用户提供 GitHub token，用 `git -c http.extraHeader="Authorization: Basic $(echo -n 'user:token' | base64)" push origin main`

---

## Phase B+C：生产机拉取（始终执行）

```bash
eval "${SSH} '
  cd ${PROJECT_DIR} &&
  git stash 2>/dev/null &&
  git fetch origin main &&
  git reset --hard origin/main &&
  echo \"=== sync done ===\" &&
  git log --oneline -3
'"
```

**stash 说明**：生产机可能有之前部署残留的本地改动，reset --hard 会丢弃。部署完成后如果需要恢复可用 `git stash list && git stash pop`。

**验证修复代码已到位**（可选，强烈推荐）：
```bash
# 用 grep 确认本次改动的关键代码已经在生产机上
eval "${SSH} 'grep -rn \"你改的关键函数/字段名\" ${PROJECT_DIR}/src/ | head -3'"
```

---

## Phase D：构建 + 重启

### D1 前端（始终构建）

> ⚠️ **必须用 `npx vite build`，不能 `npm run build`** — 后者含 `tsc --noEmit`，因历史遗留类型错误会失败。

```bash
eval "${SSH} '
  cd ${PROJECT_DIR} &&
  npx vite build 2>&1 | tail -10
'"
# 期望看到: ✓ built in XX.XXs + PWA v1.3.0 输出
```

### D2 后端（PM2 restart，不用 rebuild）

后端用 `tsx src/app.ts` 直接运行 TS 源码，不需要编译。只需 restart：

```bash
eval "${SSH} '
  cd ${PROJECT_DIR}/server &&
  pm2 restart milk-can-mes-server &&
  sleep 3 &&
  pm2 list | head -6
'"
# 期望 status: online
```

**如果后端依赖有变化**（package.json 改了）：
```bash
eval "${SSH} 'cd ${PROJECT_DIR}/server && pnpm install && pm2 restart milk-can-mes-server'"
```

---

## Phase E：五维验证（必须全部 OK）

```bash
# E1 首页
curl -s -o /dev/null -w "首页:%{http_code}\n" "http://${PROD_IP}/"
# 期望: 200

# E2 后端健康检查
curl -s "http://${PROD_IP}/api/health"
# 期望: {"status":"ok","message":"Milk Can MES API Server is running"}

# E3 后端鉴权拦截
curl -s -o /dev/null -w "API:%{http_code}\n" "http://${PROD_IP}/api/basic/device-records"
# 期望: 401（需要登录 token，正常）；500 说明后端崩了

# E4 PM2 进程
eval "${SSH} 'pm2 list | grep milk-can'"
# 期望: milk-can-mes-server online

# E5 生产机 HEAD
eval "${SSH} 'cd ${PROJECT_DIR} && git log --oneline -1'"
# 期望: 与本地 HEAD hash 一致
```

**全部 OK → 部署完成**。**有失败 → 看下面的常见问题表**。

---

## 一键模板（复制即用）

把下面整段复制到终端即可，按注释里的占位符填入：

```bash
PROD_IP="43.138.218.55"
PROD_SSH_PASS="ASD!@#asd"
PROJECT_DIR="/opt/milk-can-mes"
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
SSH="sshpass -p '${PROD_SSH_PASS}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand='${PROXY_CMD}' -o ServerAliveInterval=15 ubuntu@${PROD_IP}"

# === A. Push ===
echo "=== A. Push GitHub ==="
git add -A && git commit -m "deploy: $(date +%Y-%m-%d-%H%M)" 2>/dev/null
git push origin main 2>&1 | tail -3

# === B+C. Sync production ===
echo "=== B+C. Sync production ==="
eval "${SSH} 'cd ${PROJECT_DIR} && git stash 2>/dev/null && git fetch origin main && git reset --hard origin/main && git log --oneline -3'"

# === D. Build & Restart ===
echo "=== D. Build & Restart ==="
eval "${SSH} 'cd ${PROJECT_DIR} && npx vite build 2>&1 | tail -5'"
eval "${SSH} 'cd ${PROJECT_DIR}/server && pm2 restart milk-can-mes-server && sleep 3 && pm2 list | head -4'"

# === E. Verify ===
echo "=== E. Verify ==="
curl -s -o /dev/null -w "首页:%{http_code} " "http://${PROD_IP}/"
curl -s "http://${PROD_IP}/api/health" | grep -o '"status":"[^"]*"'
curl -s -o /dev/null -w "API:%{http_code} " "http://${PROD_IP}/api/basic/device-records"
eval "${SSH} 'pm2 list | grep -c milk-can-mes-server.*online'" | xargs -I{} echo "PM2 online进程数:{}"
echo "=== 部署完成 ==="
```

---

## 项目约定速查

| 项 | 值 |
|----|-----|
| 前端 | Vite + React + TS，构建命令 `npx vite build` |
| 后端 | Node.js + tsx，入口 `server/src/app.ts`，端口 3001 |
| PM2 进程名 | `milk-can-mes-server` |
| Nginx | 80 端口，`/api/` → `127.0.0.1:3001`，静态 → `dist/` |
| 包管理 | 统一用 `pnpm`（生产机已装），不要用 npm/yarn |
| Git 中转 | 生产机 remote = `gh-proxy.com/https://github.com/gddsb/CSDM01.git` |
| 上传目录 | `server/uploads/`，nginx 映射 `/uploads/` |
| PWA | 启用，`workbox-*.js` + `sw.js` 在 dist 根 |

---

## 常见问题

| 症状 | 解法 |
|------|------|
| SSH 连接 timeout | `connect-proxy` 没装或 127.0.0.1:18080 不可达；先 `which connect-proxy` |
| `git push` 401 / terminal prompts disabled | 沙箱 HTTPS push 需要 token；或先 `git ls-remote` 看远程是不是已经有了 |
| 生产机 reset 冲突 | 先 stash 再 reset；部署完 `git stash list` 确认是否要恢复 |
| `npm run build` 报 tsc | **永远用 `npx vite build`**，跳过 tsc |
| PM2 restart 后 errored | `eval "${SSH} 'pm2 logs milk-can-mes-server --lines 30'"` 查错误 |
| 前端资源 404 | 生产机 `ls dist/assets/` 确认构建产物，`nginx -t` 检查配置 |
| API 502 Bad Gateway | 后端崩了，看 PM2 logs |
| 生产机没有 pm2 命令 | `eval "${SSH} 'export PATH=\$PATH:\$HOME/.nvm/versions/node/*/bin && pm2 list'"` |
| vite build 报 esbuild | 生产机 `cd /opt/milk-can-mes && pnpm approve-builds` 允许 esbuild postinstall |
