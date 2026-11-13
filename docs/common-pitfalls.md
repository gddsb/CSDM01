# docs/common-pitfalls.md — 常见坑

> 默认必读；遇到奇怪问题、排查 Bug、跑脚本出意外时先翻这里。已踩过的坑别再踩。

## 已踩过的坑

| # | 坑 | 根因 | 正确做法 |
|---|------|------|---------|
| P1 | **Sequelize timezone:'local'** → `ER_UNKNOWN_TIME_ZONE` | MySQL 不认 'local'，只认 ±HH:MM / 命名时区 | 用 `'+08:00'` |
| P2 | **Sequelize Model.toJSON 吐 UTC ISO → 前端差 -8h** | Date.prototype.toJSON() 强制转 UTC | database.ts 全局 patch Model.prototype.toJSON 成墙时间字符串 |
| P3 | **RegExp 抠时间字符串遇 UTC ISO 直接偏 -8h** | 正则把 "T04:00:00Z" 的 "04" 当小时 | 统一 `new Date().getHours()` 或 dayjs |
| P4 | **deploy.sh +1 buildNumber 但 app-updater 用 buildNumber 对比 → 误提示升级** | deploy.sh 只动 H5，build-apk.sh 才动 apkBuild | app-updater 改用 `apkBuild`（build-apk.sh 才更新） |
| P5 | **Antd Mobile WebView 的 Service Worker 缓存旧 JS** | Android WebView 对 SW 更新不敏感 | main.tsx 加 SW 版本守卫：APP_BUILD 变了 → unregister + 清 caches + reload |
| P6 | **processColumns.tsx / exceptionColumns.tsx 时间列不显示 + 排序失效** | Sequelize 用 `record_time` 映射 createdAt，返回 JSON key 是 `record_time` 不是 `createdAt` | 前端统一 `getTime(row) = row.createdAt \|\| row.record_time \|\| row.created_at` |
| P7 | **沙箱 MySQL 连不上** | 容器无 systemd，没启动 MySQL | 手动拉起（见 build-deploy.md） |
| P8 | **.coze TOML 嵌套引号必 Unclosed array** | 数组语法 `["bash", "-c", "..."]` 里塞多层引号的命令 | 长命令写临时脚本再 `bash /tmp/xxx.sh` |
| P9 | **deploy.sh 和 build-apk.sh 职责分离** | deploy.sh 只动 H5 + buildNumber；build-apk.sh 才编 APK（~4min） | 不要混跑 |
| P10 | **antd-mobile-icons 是必须依赖** | package.json 里声明，移动端报工页面用到 | 别意外删了 |

## 生产服务器裸连 github.com:443 经常超时
- deploy.sh 已做双源 fallback（origin → origin-backup/gh-proxy）
- build-apk.sh 建议用 origin-backup
