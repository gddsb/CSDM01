"""通过 API 验证部署后的抽样方案功能"""
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

# 1. 健康检查
run(client, 'curl -sS http://localhost:3001/api/health')

# 2. 获取 token（需要使用 admin 账号）
login_resp = run(client, '''curl -sS -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"654321"}' ''')

# 解析 token
token = None
try:
    data = json.loads(login_resp.split('\\n')[-1])
    if data.get('code') == 0:
        token = data['data']['token']
        print('\\nToken obtained:', token[:30] + '...')
except Exception as e:
    print('Parse error:', e, 'raw:', login_resp[:300])

if token:
    # 3. 查询检验标准列表（查看抽样方案字段）
    run(client, f'''curl -sS "http://localhost:3001/api/inspection-standards?page=1&pageSize=5" -H "Authorization: Bearer {token}" | python3 -m json.tool | head -80''')

    # 4. 查询一个检验标准的详情（包含检验项目）
    run(client, f'''curl -sS "http://localhost:3001/api/inspection-standards?page=1&pageSize=1" -H "Authorization: Bearer {token}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('data') and data['data'].get('list'):
    sid = data['data']['list'][0]['id']
    print('First standard id:', sid)
"''')

    # 5. 查询所有检验标准项目的抽样方案
    run(client, f'''mysql -h $(grep DB_HOST /opt/milk-can-mes/server/.env | cut -d= -f2) -u $(grep DB_USER /opt/milk-can-mes/server/.env | cut -d= -f2) -p$(grep DB_PASSWORD /opt/milk-can-mes/server/.env | cut -d= -f2) $(grep DB_NAME /opt/milk-can-mes/server/.env | cut -d= -f2) -e "SELECT id, item_name, sampling_plan, sampling_ratio, sampling_detail, accept_number, reject_number FROM quality_inspection_standard_item WHERE sampling_plan IS NOT NULL LIMIT 10;" 2>&1''')

client.close()
