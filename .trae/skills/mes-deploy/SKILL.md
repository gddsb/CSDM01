---
name: "mes-deploy"
description: "Push code to GitHub and deploy MES production server. Invoke when user says 部署/发布/deploy/push 生产."
---

# MES 生产部署 Skill

> 适用于 `/workspace` MES 项目（Vite React 前端 + Node.js tsx 后端 + Capacitor Android APK + PM2）。
> **核心流程：本地 fetch 双向对比 → push → 生产机 `bash rebuild_v2.sh` 一键重建 → 五维验证**。
>
> 本 skill 的所有凭证（GitHub token、SSH 密码、服务器 IP）**不硬编码在此文件**，由用户 `user_rules` 注入。

---

## Phase 0：安全前置检查（经验 965734）

**不要直接 `git status` 就下结论 —— 先 fetch 再双向对比，避免远程领先被漏判。**

```bash
cd /workspace
# 0.1 刷新远程引用
git fetch origin main

# 0.2 双向提交区间对比 —— 本地 vs 远程的 hash
echo "LOCAL_HEAD: $(git rev-parse HEAD)"
echo "REMOTE_HEAD: $(git rev-parse origin/main)"
echo "--- 远程领先（AHEAD 本地需要 pull）---" && git log --oneline HEAD..origin/main
echo "--- 本地领先（BEHIND 需要 push）---"     && git log --oneline origin/main..HEAD
```

**决策树：**
- `LOCAL == REMOTE`（两个 hash 相同）→ **跳过阶段 A**，直接进 B
- `LOCAL != REMOTE` 且有 BEHIND 输出 → 进阶段 A push
- `HEAD..origin/main` 有输出 → 远程领先，先 `git pull --rebase`

### 0.3 代理 + 工具就绪

```bash
env | grep -i proxy | head -2        # HTTP_PROXY / HTTPS_PROXY
which sshpass connect                # connect-proxy (apt: connect-proxy)
```

---

## SSH 隧道构造（代理已在 user_rules 预置）

从环境/用户规则读取，**运行时动态拼接，禁止硬编码进 skill**：

```bash
# 占位符 —— 实际值由运行时 user_rules 提供：
#   PROD_IP       = 43.138.218.55
#   PROD_USER     = ubuntu
#   PROD_SSH_PASS = <password>
#   HTTP_PROXY    = http://127.0.0.1:18080

PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
SSH="sshpass -p '${PROD_SSH_PASS}' \
  ssh -o StrictHostKeyChecking=no \
      -o ProxyCommand='${PROXY_CMD}' \
      -o ServerAliveInterval=15 \
      ${PROD_USER}@${PROD_IP}"
```

**SSH 隧道测试（首次部署或代理变了才跑）：**
```bash
timeout 15 eval "${SSH} 'echo connected && uptime'"
# 期望: connected + 服务器运行时间
```

---

## Phase A：推送 GitHub（本地领先时才执行）

```bash
cd /workspace
git add -A
# 已提交过就跳过 commit
if ! git diff --cached --quiet; then
  git commit -m "<部署说明：简述本次改动>"
fi
git push origin HEAD 2>&1 | tail -3
```

**push 被拒（rejected fetch first）时：**
```bash
git fetch origin main
git log --oneline HEAD..origin/main    # 查看远程新增了什么
git pull --rebase origin main
git push origin HEAD
```

---

## Phase B：生产机一键重建（始终执行）

生产机已固化 `/opt/milk-can-mes/rebuild_v2.sh`，**直接调脚本，不要手动分步**。

脚本内部完成：
1. `git pull origin main` —— 拉最新
2. 动态读 `server/data/releases.json` → `buildNumber + 1`
3. 写回 `releases.json`（Gradle 从这里读 versionCode/versionName）
4. `npx vite build` —— 前端构建
5. `npx cap sync android` + `gradle clean assembleDebug` —— APK 编译
6. APK 拷贝到 `download/` + 回填 apkSize + 生成 SHA256
7. `pm2 restart milk-can-mes-server`

```bash
eval "${SSH} 'cd /opt/milk-can-mes && bash rebuild_v2.sh --notes \"<部署说明>\" 2>&1 | tail -40'"
```

**退出条件：以脚本 exit code == 0 且出现以下任一关键文本判定完成 —— 不要中途 StopCommand**

关键成功标志（脚本退出码 0 且日志包含）：
```
git pull origin main   ... Already up to date
BUILD SUCCESSFUL in Xs
✅ download/milk-can-mes-vX.X.X-buildXX-debug.apk (XMB)
milk-can-mes-server    ... online
📦 vX.X.X buildXX · <gitSha> · ... ✅
```

---

## Phase C：五维验证（必须全部 OK 才算完成）

```bash
# C1 本地 HEAD == 生产机 HEAD（最关键的一条）
LOCAL_SHA=$(cd /workspace && git rev-parse --short HEAD)
REMOTE_SHA=$(eval "${SSH} 'cd /opt/milk-can-mes && git rev-parse --short HEAD'")
echo "本地:${LOCAL_SHA} 生产:${REMOTE_SHA}"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || { echo "❌ hash 不一致"; exit 1; }

# C2 PM2 后端进程 online
eval "${SSH} 'pm2 list | grep milk-can-mes-server | grep -q online && echo ✅ online'"

# C3 前端 HTTP 200
curl -s -o /dev/null -w "首页:%{http_code}\n" "http://${PROD_IP}/"

# C4 后端健康检查
curl -s "http://${PROD_IP}/api/health"

# C5 APK 下载链接可达
curl -s -o /dev/null -w "APK:%{http_code}\n" "http://${PROD_IP}/download/milk-can-mes-latest.apk"
```

**全部 OK → 部署完成**。输出 APK 下载链接 + build 号给用户。

---

## 一键模板（复制即用）

```bash
# ======= Phase 0: 前置 =======
cd /workspace
git fetch origin main
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/main)
echo "LOCAL=$LOCAL"; echo "REMOTE=$REMOTE"

# ======= Phase A: Push =======
if [ "$LOCAL" != "$REMOTE" ]; then
  git add -A
  git diff --cached --quiet || git commit -m "deploy: $(date +%Y%m%d-%H%M)"
  git push origin HEAD 2>&1 | tail -3
fi

# ======= Phase B: 生产机重建 =======
PROXY_CMD="connect -H 127.0.0.1:18080 %h %p"
SSH="sshpass -p '${PROD_SSH_PASS}' ssh -o StrictHostKeyChecking=no -o ProxyCommand='${PROXY_CMD}' ubuntu@${PROD_IP}"
eval "${SSH} 'cd /opt/milk-can-mes && bash rebuild_v2.sh --notes \"deploy\" 2>&1 | tail -30'"

# ======= Phase C: 验证 =======
LOCAL_SHORT=$(git rev-parse --short HEAD)
REMOTE_SHORT=$(eval "${SSH} 'cd /opt/milk-can-mes && git rev-parse --short HEAD'")
echo "==> 本地 $LOCAL_SHORT / 生产 $REMOTE_SHORT"
curl -s -o /dev/null -w "HTTP:%{http_code} " "http://${PROD_IP}/"
curl -s "http://${PROD_IP}/api/health" | head -c 100
echo ""
echo "=== 部署完成 ==="
```

---

## 项目约定速查

| 项 | 值 |
|----|-----|
| 前端 | Vite + React + TS，**只允许 `npx vite build`**（跳过 tsc 历史错误） |
| 后端 | Node.js + tsx，入口 `server/src/app.ts`，PM2 进 `milk-can-mes-server` |
| Android | Capacitor + Gradle，`rebuild_v2.sh` 自动读 `server/data/releases.json` |
| APK 路径 | `download/milk-can-mes-latest.apk`（symlink）+ `download/milk-can-mes-vX.X.X-buildXX-debug.apk` |
| 包管理 | 生产机统一 `pnpm` |
| 代理 | 沙箱通过 `HTTP_PROXY=http://127.0.0.1:18080` 出网 |
| SSH 穿透 | `connect -H 127.0.0.1:18080 %h %p`（apt 包 `connect-proxy`） |
| 凭证来源 | **user_rules** 注入，skill 文件本身不包含任何密码/token |

---

## 常见问题（按概率排序）

| 症状 | 解法 |
|------|------|
| `ssh: connect to host ... Connection timed out` | 代理断了 → 检查 `HTTP_PROXY` 环境变量；`which connect` |
| `git push rejected (fetch first)` | 远程有人新 push → `git pull --rebase origin main` 后再推 |
| `npm run build` 报 tsc | **永远用 `npx vite build`**，绕过 tsc --noEmit 历史错误 |
| `rebuild_v2.sh` 跑到 Gradle 报 esbuild | 生产机 `cd /opt/milk-can-mes && pnpm approve-builds` |
| PM2 `errored` | `pm2 logs milk-can-mes-server --lines 30` 看错误栈 |
| `git pull` 有本地改动冲突 | 脚本里先 `git stash` 再 pull；或手动处理 |
| `git push` 401 | HTTPS remote 需要 token → `git remote set-url origin https://<user>:<token>@github.com/gddsb/CSDM01.git` |
| 中途 StopCommand 导致脚本中断 | **不要中途 Stop**。rebuild_v2.sh 幂等，重新执行即可 |
