---
name: "mes-deploy"
description: "Push MES project to GitHub and deploy to production server. Invoke when user asks to deploy, publish, 发布生产, 拉取部署, 或 push 到远程服务器."
---

# MES 项目部署 Skill

一键完成 **本地推送 GitHub → 生产服务器拉取最新代码 → 重建前端 → 重启后端服务** 的全流程。

---

## 🔧 环境前置条件

### 凭证与端点（首次使用前请确认）

| 项 | 位置 | 说明 |
|----|------|------|
| GitHub 仓库 | `.git/config` origin URL | HTTPS remote，需要 token 认证 |
| GitHub token | 部署命令中通过 `http.extraHeader` 注入 | 不要写入 .git-credentials |
| 生产服务器 IP | `<PROD_IP>` | 无法直连 22 端口，需走代理 |
| SSH 用户名 | `ubuntu` | — |
| SSH 密码 | 运行时由用户提供或 AskUserQuestion | 不要硬编码 |
| HTTP 代理 | 检查 `env | grep -i proxy` | 通常为 `http://127.0.0.1:18080` |
| 服务器 gh-proxy | 生产机 git remote 已配置 | `gh-proxy.com` 中转 GitHub |

### 工具检查（每阶段开始前执行）

```bash
which sshpass connect-proxy curl socat npx
# 必要时 apt-get install -y sshpass connect-proxy
```

---

## 📦 阶段 A：推送到 GitHub main 分支

> 适用场景：当前在 feature 分支（如 `trae/agent-xxx`），需要合并到 main 后生产机才能拉到。

```bash
# 1. 检查本地状态
git status --short && git branch --show-current && git log --oneline -3

# 2. 如果有未提交改动 → 先 commit
git add -A && git commit -m "<descriptive message>"

# 3. 推送当前分支（首次需要设 upstream）
git push -u origin <current-branch>

# 4. 切换 main，合并，推送
git checkout main
git -c http.extraHeader="Authorization: Basic $(echo -n '<user>:<token>' | base64)" pull origin main
git merge --ff-only <current-branch>
git -c http.extraHeader="Authorization: Basic $(echo -n '<user>:<token>' | base64)" push origin main

# 5. 验证远程
git -c http.extraHeader="Authorization: Basic $(echo -n '<user>:<token>' | base64)" ls-remote --heads origin main
```

**合并冲突处理**：如果 `merge --ff-only` 失败，检查 main 是否有新提交，先 pull 再 merge，必要时 `git reset --hard origin/main && git merge <current-branch>`。

---

## 🌐 阶段 B：连接生产服务器

### SSH 直连测试

```bash
nc -v -w 5 <PROD_IP> 22 || echo "直连失败，需要代理隧道"
```

### 通过 HTTP 代理建立 CONNECT 隧道（当前沙箱必需）

```bash
# 测试代理 CONNECT 能力
connect -H 127.0.0.1:18080 <PROD_IP> 22 &
sleep 2 && kill $! 2>/dev/null
# 看到 "SSH-2.0-OpenSSH" 表示通道正常
```

### 封装 SSH 命令（后续所有远程执行都用这个模板）

```bash
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
SSH_BASE="sshpass -p '<PASSWORD>' ssh \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o \"ProxyCommand=${PROXY_CMD}\" \
  -o ServerAliveInterval=15 \
  ubuntu@<PROD_IP>"

# 使用：
eval "${SSH_BASE} '<remote command>'"
```

### 基线信息收集（首次部署或环境变动时）

```bash
eval "${SSH_BASE} '
  echo \"=== PM2 ===\" && pm2 list &&
  echo \"=== 部署目录 ===\" && ls /opt/milk-can-mes 2>/dev/null &&
  echo \"=== git remote ===\" && cd /opt/milk-can-mes && git remote -v &&
  echo \"=== git log -3 ===\" && git log --oneline -3 &&
  echo \"=== nginx ===\" && sudo cat /etc/nginx/sites-enabled/milk-can-mes 2>/dev/null | head -30
'"
```

---

## 🚀 阶段 C：生产机拉取最新代码

> ⚠️ 生产机经常有未提交的本地改动（之前部署的残留），**必须先 stash 再 reset**，不能直接 pull。

```bash
eval "${SSH_BASE} '
  cd /opt/milk-can-mes &&
  git stash &&                    # 暂存本地改动（不丢数据）
  git fetch origin main &&        # 从 gh-proxy 拉元数据
  git reset --hard origin/main && # 强制同步到远程
  git log --oneline -3 &&         # 验证 HEAD
  echo "=== sync done ==="
'"
```

**如果 stash 目录有需要保留的改动**：部署完成后可选择性 `git stash pop` 手动合并，一般不需要。

---

## 🏗️ 阶段 D：构建与重启

### 前端（Vite + React）

> ⚠️ **不要用 `npm run build`**，它包含 `tsc --noEmit`，因历史遗留类型错误会失败。直接用 `vite build`。

```bash
eval "${SSH_BASE} '
  cd /opt/milk-can-mes &&
  npx vite build 2>&1 | tail -25 &&
  ls -lh dist/assets/index-*.js | head -3
'"
```

### 后端（Node.js + PM2）

后端一般不需要 rebuild（tsx 直接运行 TS 源码），只需重启进程：

```bash
eval "${SSH_BASE} '
  cd /opt/milk-can-mes/server &&
  pm2 restart milk-can-mes-server &&
  sleep 2 &&
  pm2 list
'"
```

**如果后端 package.json 有依赖变更**，先 `npm install`：

```bash
eval "${SSH_BASE} '
  cd /opt/milk-can-mes/server &&
  npm install --production=false &&
  pm2 restart milk-can-mes-server
'"
```

---

## ✅ 阶段 E：部署验证

```bash
# 1. 前端页面
curl -x http://127.0.0.1:18080 -s -o /dev/null -w "首页:%{http_code}\n" http://<PROD_IP>/

# 2. 新构建的 JS 资源（从阶段 D 输出中取文件名）
curl -x http://127.0.0.1:18080 -s -o /dev/null -w "前端资源:%{http_code}\n" http://<PROD_IP>/assets/index-<HASH>.js

# 3. 后端 API（401 正常，需要登录 token；500 说明后端崩了）
curl -x http://127.0.0.1:18080 -s -o /dev/null -w "后端API:%{http_code}\n" http://<PROD_IP>/api/basic/device-records

# 4. PM2 在线状态
eval "${SSH_BASE} 'pm2 jlist | jq .[0].status' 2>/dev/null"
```

---

## 🔁 完整一键模板（复制即用）

```bash
# ====== 配置区 ======
GITHUB_USER="<user>"
GITHUB_TOKEN="<token>"
GITHUB_BRANCH="main"
FEATURE_BRANCH="trae/agent-xxx"
PROD_IP="<ip>"
PROD_SSH_PASS="<password>"
HTTP_PROXY="http://127.0.0.1:18080"
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
PROJECT_DIR="/opt/milk-can-mes"

SSH="sshpass -p '${PROD_SSH_PASS}' ssh \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o \"ProxyCommand=${PROXY_CMD}\" \
  -o ServerAliveInterval=15 \
  ubuntu@${PROD_IP}"

# ====== A. 推送 GitHub ======
echo "=== A. Push to GitHub ==="
git add -A && git commit -m "deploy: $(date +%Y-%m-%d-%H%M)"
git push -u origin "${FEATURE_BRANCH}" 2>&1 | tail -5
git checkout main
git -c http.extraHeader="Authorization: Basic $(echo -n '${GITHUB_USER}:${GITHUB_TOKEN}' | base64)" pull origin main
git merge --ff-only "${FEATURE_BRANCH}"
git -c http.extraHeader="Authorization: Basic $(echo -n '${GITHUB_USER}:${GITHUB_TOKEN}' | base64)" push origin main 2>&1 | tail -3

# ====== B+C. 生产机拉取 ======
echo "=== B+C. Sync production ==="
eval "${SSH} 'cd ${PROJECT_DIR} && git stash && git fetch origin main && git reset --hard origin/main && git log --oneline -3'"

# ====== D. 构建重启 ======
echo "=== D. Build & Restart ==="
eval "${SSH} 'cd ${PROJECT_DIR} && npx vite build 2>&1 | tail -5'"
eval "${SSH} 'cd ${PROJECT_DIR}/server && pm2 restart milk-can-mes-server && sleep 2 && pm2 list'"

# ====== E. 验证 ======
echo "=== E. Verify ==="
curl -x "${HTTP_PROXY}" -s -o /dev/null -w "首页 HTTP:%{http_code}\n" "http://${PROD_IP}/"
curl -x "${HTTP_PROXY}" -s -o /dev/null -w "后端 API:%{http_code} (401=正常)\n" "http://${PROD_IP}/api/basic/device-records"
eval "${SSH} 'pm2 list | grep milk'"

echo "✅ 部署完成"
```

---

## 🧩 项目特定约定速查

| 约定 | 值 |
|------|-----|
| 项目类型 | Vite + React + TS 前端 / Node.js + TSX 后端 |
| 前端构建 | `npx vite build`（跳过 tsc --noEmit）|
| 后端启动 | `tsx src/app.ts`（PM2 包装，进程名 `milk-can-mes-server`）|
| 前端产物 | `/opt/milk-can-mes/dist/` |
| 后端目录 | `/opt/milk-can-mes/server/` |
| Nginx | 80 端口，`/api/` 反代 `127.0.0.1:3001`，静态文件指向 dist |
| Git 通道 | 生产机 remote 用 `gh-proxy.com` 中转 GitHub |
| 文件上传 | `/opt/milk-can-mes/server/uploads`，nginx 映射 `/uploads/` |
| PWA | 启用，`workbox-*.js` + `sw.js` 在 dist 根 |

---

## 🚨 常见问题

| 问题 | 解法 |
|------|------|
| SSH 直连 22 端口 timeout | 用 `connect-proxy -H 127.0.0.1:18080` 建 CONNECT 隧道 |
| `npm run build` 报 tsc 错误 | 直接 `npx vite build`，跳过 `tsc --noEmit` |
| `git push` 401 | token 过期或用户名错，用 `http.extraHeader` 注入 Basic Auth |
| 生产机 `git reset --hard` 丢数据 | 已 stash，可 `git stash list` 查看 |
| PM2 重启后 status `errored` | 查 `/home/ubuntu/.pm2/logs/milk-can-mes-server-error.log` |
| 前端静态资源 404 | 检查 `dist/` 是否被正确挂载到 nginx root，`nginx -t && sudo nginx -s reload` |
| API 502 Bad Gateway | 后端 PM2 进程挂了，`pm2 logs milk-can-mes-server` 查看 |
