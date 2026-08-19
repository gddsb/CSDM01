"""查找服务器上的项目目录"""
import socks
import paramiko
import sys

PROXY_HOST = '127.0.0.1'
PROXY_PORT = 18080
TARGET_HOST = '43.138.218.55'
TARGET_PORT = 22
USERNAME = 'ubuntu'
PASSWORD = 'ASD!@#asd'

def create_client():
    sock = socks.socksocket()
    sock.set_proxy(socks.HTTP, PROXY_HOST, PROXY_PORT)
    sock.connect((TARGET_HOST, TARGET_PORT))
    transport = paramiko.Transport(sock)
    transport.start_client()
    transport.auth_password(USERNAME, PASSWORD)
    client = paramiko.SSHClient()
    client._transport = transport
    return client

def run(client, cmd, timeout=120):
    print(f'\n>>> {cmd}')
    sys.stdout.flush()
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out: print(out.rstrip())
    if err: print('[STDERR]', err.rstrip())
    print(f'[EXIT: {stdout.channel.recv_exit_status()}]')
    return out

client = create_client()
# 检查 package.json scripts 和 tsconfig
run(client, 'cd /opt/milk-can-mes/server && cat package.json')
run(client, 'cd /opt/milk-can-mes/server && ls -la tsconfig*.json 2>&1')
run(client, 'cd /opt/milk-can-mes/server && cat tsconfig.json 2>/dev/null | head -30')
# 查找迁移入口
run(client, 'cd /opt/milk-can-mes/server && grep -E "migrate|sequelize" package.json')
client.close()
