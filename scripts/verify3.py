"""验证检验标准 API"""
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
    if out: print(out.rstrip()[:3000])
    if err: print('[STDERR]', err.rstrip()[:500])
    return out

client = create_client()

# 获取 token
login_resp = run(client, "curl -sS -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"654321\"}'")
data = json.loads(login_resp.split('\n')[-1])
token = data['data']['token']

# 查询检验标准列表
run(client, f'''curl -sS "http://localhost:3001/api/basic/standards?page=1&pageSize=3" -H "Authorization: Bearer {token}" | python3 -m json.tool''')

# 查询第一个标准详情（含项目）
run(client, f'''curl -sS "http://localhost:3001/api/basic/standards?page=1&pageSize=1" -H "Authorization: Bearer {token}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('data') and data['data'].get('list'):
    sid = data['data']['list'][0]['id']
    print('FIRST_STANDARD_ID=' + str(sid))
"''')

# 用 bash 获取 id
out = run(client, f'''curl -sS "http://localhost:3001/api/basic/standards?page=1&pageSize=1" -H "Authorization: Bearer {token}"''')
try:
    d = json.loads(out.split('\n')[-1])
    if d.get('data') and d['data'].get('list'):
        sid = d['data']['list'][0]['id']
        print('First standard id:', sid)
        # 查询详情
        run(client, f'''curl -sS "http://localhost:3001/api/basic/standards/{sid}" -H "Authorization: Bearer {token}" | python3 -m json.tool | head -150''')
except Exception as e:
    print('Err:', e)

client.close()
