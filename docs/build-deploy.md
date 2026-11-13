# docs/build-deploy.md — 构建 & 部署 & 沙箱

> **默认必读**：任何开发任务开始前先读这份。

## 红线（违反会怎样）

| # | 红线 | 后果 |
|---|------|------|
| B1 | **前端 build 必跑 `tsc --noEmit` 且零错误** | `pnpm build` 脚本硬编码 `tsc --noEmit && vite build`，任何类型错误都会导致构建失败。**不要为了绕过而修改脚本。** |
| B2 | **沙箱前端启动命令** | 不要 `pnpm run dev`（硬编码 `--port 5173` 会被脚本内默认值抢占）。用：`node_modules/.bin/vite --host 0.0.0.0 --port ${DEPLOY_RUN_PORT}` |
| B3 | **MySQL 未运行时先手动拉起** | 容器无 systemd，直接跑后端会 DB 连不上。见下方启动命令。 |

## 沙箱 MySQL 启动

```bash
mkdir -p /var/run/mysqld && chown mysql:mysql /var/run/mysqld
nohup mysqld --user=mysql --datadir=/var/lib/mysql \
  --socket=/var/run/mysqld/mysqld.sock --port=3306 --bind-address=0.0.0.0 \
  > /app/work/logs/bypass/mysql.log 2>&1 &
```
连接：`mysql -uroot -p123456`，库 `milk_can_mes`。49 张表已预装，**无需 seed**。

## 沙箱后端启动
```bash
cd server && pnpm start    # tsx 直接跑 src/app.ts，监听 3001
```
Vite 代理 `/api` 与 `/uploads` 到 `http://localhost:3001`。

## 常用命令

```bash
# 前端（仓库根）
pnpm install
pnpm run build       # ⚠️ B1: 先 tsc --noEmit 必须零错误
pnpm run typecheck   # 独立跑 tsc --noEmit

# 后端（cd server/）
pnpm install
pnpm start           # tsx 直接跑
pnpm run dev         # tsx watch 热重载
pnpm run typecheck

# 沙箱 MySQL 启动（仅当没运行时）
# 见上方"沙箱 MySQL 启动"
```

## 生产部署（prod: 43.138.218.55）

### 流程红线（AGENTS.md E2/E3）

| 步骤 | 自动/手动 | 说明 |
|------|----------|------|
| 改完代码 → deploy H5 | **自动** | 正常流程，每次改完都跑。deploy.sh 只动 H5 + buildNumber，不动 APK。 |
| 编译 APK | **仅显式触发** | 用户明确说"编译 APK"/"构建 APK"/"打包 APP"才执行。**不要 deploy 完自动跑**（~4min 耗时）。 |

### 命令

```bash
# 日常 H5 部署（拉代码 + vite build + PM2 restart）
bash deploy.sh
# deploy.sh 只 +1 buildNumber，不动 apkBuild

# APK 编译（需 ~4min，cap sync + gradle assembleRelease）
# ⚠️ 仅用户明确要求时才执行
bash build-apk.sh
# build-apk.sh 回填 apkBuild + apkSize + checksum，不 +1 buildNumber
```

### 部署完成后验证（deploy.sh 后自动做）
- 生产服务器拉代码到最新
- vite build 产物拷贝到 dist/
- PM2 restart 后端
- 手机浏览器/APK 打开，确认 JS bundle 已更新

### APK 编译后验证（build-apk.sh 后自动做）
- APK 产物上传到 prod download/ 目录
- HTTP HEAD 验证 200 OK
- 下载 APK 本地校验 SHA256 与生产机回填 checksum 一致

> **生产服务器裸连 github.com:443 经常超时**。deploy.sh 已做双源 fallback（origin → origin-backup/gh-proxy），build-apk.sh 建议用 origin-backup。

## .coze TOML 小心引号嵌套
修改 `.coze` 时 `["bash", "-c", "..."]` 数组语法里，多层嵌套引号必报 `Unclosed array`。建议：
- 把长命令写进临时脚本文件，再 `bash /tmp/xxx.sh`
- 避免在 TOML 里塞包含多层单双引号的内联命令
