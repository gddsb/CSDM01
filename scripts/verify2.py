"""验证API和数据"""
import socks
import paramiko
import sys
import json

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
    print(f'\n>>> {cmd[:120]}')
    sys.stdout.flush()
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out: print(out.rstrip()[:2000])
    if err: print('[STDERR]', err.rstrip()[:500])
    return out

client = create_client()

# 获取 token
login_resp = run(client, "curl -sS -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"654321\"}'")
data = json.loads(login_resp.split('\n')[-1])
token = data['data']['token']
print('\nToken OK')

# 列出路由
run(client, "grep -r 'router' /opt/milk-can-mes/server/src/routes 2>/dev/null | head -5")
run(client, "ls /opt/milk-can-mes/server/src/routes/ 2>/dev/null")

# 找检验标准路由
run(client, "grep -rn 'inspection.standard\\|inspection-standard' /opt/milk-can-mes/server/src/routes/ 2>/dev/null | head -20")

# 检查表结构
run(client, """mysql -h $(grep DB_HOST /opt/milk-can-mes/server/.env | cut -d= -f2) -u $(grep DB_USER /opt/milk-can-mes/server/.env | cut -d= -f2) -p$(grep DB_PASSWORD /opt/milk-can-mes/server/.env | cut -d= -f2) $(grep DB_NAME /opt/milk-can-mes/server/.env | cut -d= -f2) -e "SHOW COLUMNS FROM quality_inspection_standard_item;" 2>&1""")

run(client, """mysql -h $(grep DB_HOST /opt/milk-can-mes/server/.env | cut -d= -f2) -u $(grep DB_USER /opt/milk-can-mes/server/.env | cut -d= -f2) -p$(grep DB_PASSWORD /opt/milk-can-mes/server/.env | cut -d= -f2) $(grep DB_NAME /opt/milk-can-mes/server/.env | cut -d= -f2) -e "SHOW COLUMNS FROM qc_inspection_item;" 2>&1""")

client.close()
