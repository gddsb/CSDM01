"""验证部署"""
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

def run(client, cmd, timeout=60):
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

# 1. 查看服务日志
run(client, 'sleep 5 && pm2 logs milk-can-mes-server --lines 30 --nostream')

# 2. 数据库字段验证
run(client, "cd /opt/milk-can-mes/server && grep -E 'DB_HOST|DB_PORT|DB_USER|DB_NAME' .env | grep -v PASSWORD")

# 3. 查询 schema
run(client, "mysql -h $(grep DB_HOST /opt/milk-can-mes/server/.env | cut -d= -f2) -u $(grep DB_USER /opt/milk-can-mes/server/.env | cut -d= -f2) -p$(grep DB_PASSWORD /opt/milk-can-mes/server/.env | cut -d= -f2) $(grep DB_NAME /opt/milk-can-mes/server/.env | cut -d= -f2) -e 'DESCRIBE quality_inspection_standard_item;' 2>&1 | grep -E 'sampling|defect' | head -20")

run(client, "mysql -h $(grep DB_HOST /opt/milk-can-mes/server/.env | cut -d= -f2) -u $(grep DB_USER /opt/milk-can-mes/server/.env | cut -d= -f2) -p$(grep DB_PASSWORD /opt/milk-can-mes/server/.env | cut -d= -f2) $(grep DB_NAME /opt/milk-can-mes/server/.env | cut -d= -f2) -e 'DESCRIBE qc_inspection_item;' 2>&1 | grep -E 'sampling|accept|reject|item_type' | head -20")

client.close()
