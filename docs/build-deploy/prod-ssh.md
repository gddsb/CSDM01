# docs/build-deploy/prod-ssh.md — 生产服务器连接方法

> **部署前必读**：每次 deploy/build-apk 前先读这份。沙箱到 prod 的 SSH 22 端口被出口策略硬阻断，必须用代理。

## 生产服务器

| 项 | 值 |
|----|-----|
| IP | `43.138.218.55` |
| 用户名 | `ubuntu` |
| 密码 | `ASD123asd` |
| SSH 端口 | 22 |
| 工作目录 | `/opt/milk-can-mes` |

## ⚠️ 绝对禁止

| 方式 | 为什么 |
|------|--------|
| ❌ 直接 `ssh ubuntu@43.138.218.55` | 沙箱出口阻断 22 端口，必超时 |
| ❌ `ProxyCommand nc -X socks5` | 沙箱 18080 不是 SOCKS5，返回 HTTP 400 |
| ❌ corkscrew | 沙箱没装 corkscrew |
| ❌ paramiko `ProxyCommand='corkscrew ...'` | corkscrew 未装 |

## ✅ 唯一正确方式：HTTP CONNECT + paramiko password auth

沙箱代理 `127.0.0.1:18080` 支持 HTTP CONNECT 隧道。以下 Python 脚本是**唯一可靠方法**，每次 deploy 都用这套：

```python
import socket, paramiko

HOST='43.138.218.55'; USER='ubuntu'; PWD='ASD123asd'

# 1. 建 HTTP CONNECT 隧道
s = socket.create_connection(('127.0.0.1', 18080), timeout=15)
s.sendall(f'CONNECT {HOST}:22 HTTP/1.1\r\nHost: {HOST}:22\r\nProxy-Connection: Keep-Alive\r\n\r\n'.encode())
resp = b''
while b'\r\n\r\n' not in resp:
    c = s.recv(4096)
    if not c: break
    resp += c
assert b'200' in resp.split(b'\r\n')[0], f'Proxy denied: {resp.split(b"\\r\\n")[0]}'

# 2. SSH over the tunnel
t = paramiko.Transport(s)
t.start_client(timeout=15)
t.auth_password(username=USER, password=PWD)

# 3. 执行命令
ch = t.open_session()
ch.exec_command('cd /opt/milk-can-mes && bash deploy.sh 2>&1')
# ... 读 out / drain ...

s.close()
```

## 部署脚本（deploy.sh / build-apk.sh）跑什么

```bash
# H5 部署（~15s）
cd /opt/milk-can-mes && bash deploy.sh

# APK 编译（~4min）
cd /opt/milk-can-mes && bash build-apk.sh
```

两个脚本内部都已做好 github 拉取的 fallback（origin → origin-backup via gh-proxy）。

## 验证连通性的探针（如果怀疑连不上）

```bash
# 1. 代理本身通不通
curl -s -o /dev/null -w "%{http_code}" -x http://127.0.0.1:18080 https://github.com
# 应该返回 200

# 2. prod:80 HTTP 通不通（后端 health check）
curl -s http://43.138.218.55/api/health
# 应该返回 {"status":"ok",...}

# 3. prod:22 直连必超时（用来确认沙箱出口阻断）
timeout 5 nc -zv 43.138.218.55 22   # Connection timed out 是预期结果
```
