"""
通过 socks 代理 SSH 连接，执行 backfill_standard_items.sql + API 验证抽样详情
"""
import socks
import paramiko
import json
import os

PROXY_HOST, PROXY_PORT = '127.0.0.1', 18080
TARGET_HOST, TARGET_PORT = '43.138.218.55', 22
USERNAME, PASSWORD = 'ubuntu', 'ASD!@#asd'

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

def run(client, cmd, timeout=180):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').rstrip()
    err = stderr.read().decode('utf-8', errors='replace').rstrip()
    code = stdout.channel.recv_exit_status()
    return code, out, err

def main():
    client = create_client()
    print('Connected to', TARGET_HOST)

    # 上传 SQL
    sftp = client.open_sftp()
    sftp.put('/workspace/scripts/backfill_standard_items.sql', '/tmp/backfill.sql')
    sftp.close()
    print('SQL uploaded -> /tmp/backfill.sql')

    # 找配置文件
    for p in ['/opt/milk-can-mes/server/conf/config.yaml',
              '/opt/milk-can-mes/server/config.yaml',
              '/opt/milk-can-mes/server/config/config.yaml',
              '/opt/milk-can-mes/server/conf/prod.yaml',
              '/opt/milk-can-mes/conf/config.yaml']:
        c, out, _ = run(client, f'ls -la "{p}" 2>/dev/null && echo __EXIST__ || echo __NOPE__')
        if '__EXIST__' in out:
            cfg_path = p; break
    else:
        # 直接找 server 下所有 yaml
        c, out, _ = run(client, 'find /opt/milk-can-mes/server -maxdepth 3 -name "*.yaml" -o -name "*.yml" 2>/dev/null | head -20')
        print('找不到标准 config 文件。发现 yaml 列表:')
        print(out)
        cfg_path = None

    db_info = {}
    if cfg_path:
        c, cfg_txt, _ = run(client, f'cat "{cfg_path}" | head -50')
        print('---', cfg_path, '---\n', cfg_txt)
        for line in cfg_txt.splitlines():
            s = line.strip()
            mapping = [('DB_HOST', ('host:',)),
                       ('DB_USER', ('user:', 'username:', 'login:')),
                       ('DB_PASS', ('pass:', 'password:', 'pwd:')),
                       ('DB_NAME', ('name:', 'database:', 'dbname:'))]
            for k, tags in mapping:
                for tag in tags:
                    if s.startswith(tag):
                        v = s[len(tag):].strip().strip("'\"")
                        db_info.setdefault(k, v)

    if len(db_info) < 4:
        # 用 .env 兜底
        c, env_txt, _ = run(client, 'find /opt/milk-can-mes/server -maxdepth 2 \( -name ".env*" -o -name ".env.*" \) 2>/dev/null | head -10')
        print('.env list:', env_txt)
        for p in env_txt.strip().splitlines():
            p = p.strip()
            if not p: continue
            c, txt, _ = run(client, f'cat "{p}" 2>/dev/null | head -30')
            print('---', p, '---\n', txt)
            for line in txt.splitlines():
                line = line.strip()
                if '=' not in line: continue
                k, v = line.split('=', 1)
                k = k.strip(); v = v.strip().strip("'\"")
                up = k.upper()
                if 'DB_HOST' in up: db_info.setdefault('DB_HOST', v)
                elif up.endswith('DB_USER') or up == 'USERNAME': db_info.setdefault('DB_USER', v)
                elif up.endswith('DB_PASS') or up.endswith('PASSWORD'): db_info.setdefault('DB_PASS', v)
                elif up.endswith('DB_NAME') or up == 'DATABASE': db_info.setdefault('DB_NAME', v)

    print('\nFinal DB info keys available:', list(db_info.keys()))
    if len(db_info) < 4:
        # 让服务器端 node 打印 config（sequelize config）
        c, out, _ = run(client, """cd /opt/milk-can-mes/server && node -e "
const cfg = require('./dist/config/config.js').default || require('./dist/config/config.js');
console.log(JSON.stringify({host: cfg.db?.host||cfg.database?.host, user: cfg.db?.username||cfg.database?.username, pass: cfg.db?.password||cfg.database?.password, name: cfg.db?.database||cfg.database?.database}, null, 2));
" 2>&1 | tail -20""")
        print('node require config:', out)
        return

    mysql_prefix = f"mysql -h {db_info['DB_HOST']} -u {db_info['DB_USER']} -p'{db_info['DB_PASS']}' {db_info['DB_NAME']} --default-character-set=utf8mb4"

    c, out, err = run(client, f"bash -lc {json.dumps(f'{mysql_prefix} 2>&1 < /tmp/backfill.sql')}", timeout=120)
    print('\n=== SQL OUTPUT (exit=%d) ===' % c)
    print(out[:6000])
    if err: print('\n--- SQL STDERR tail 2000 ---')
    print(err[-2000:])

    # Login
    c, body, _ = run(client, """curl -sS -X POST http://127.0.0.1:3001/api/auth/login \
-H 'Content-Type: application/json' \
-d '{"username":"admin","password":"123456","captcha":"any","captchaId":"none"}'""")
    print('\n=== LOGIN RESPONSE ===')
    print(body[-300:])
    token = json.loads(body)['data']['token']

    c, body, _ = run(client, f"""curl -sS -H 'Authorization: Bearer {token}' http://127.0.0.1:3001/api/basic/standards/21""")
    try:
        d = json.loads(body)
        items = d.get('data', {}).get('items', [])
        print(f'\n=== standard_id=21 抽样信息统计: 共 {len(items)} 项 ===')
        empty = 0
        plans = {}
        dash_situation = []
        for i, it in enumerate(items):
            plan = it.get('sampling_plan') or 'NULL'
            plans[plan] = plans.get(plan, 0) + 1
            sd = it.get('sampling_detail')
            n = it.get('need_sample_count')
            ac = it.get('accept_number')
            re_ = it.get('reject_number')
            t = it.get('item_type')
            is_dash = (not sd and (not n or n == 0))
            if is_dash: empty += 1
            dash_situation.append({'#': i+1, 'name': (it.get('item_name') or '')[:14],
                                   'plan': plan, 'detail_len': len(sd or ''), 'n': n, 'ac': ac, 're': re_,
                                   'type': t, 'would_dash': is_dash})
        print('按方案分布:', plans)
        print('renderSamplingSummary 会输出 \'-\' 的项目数:', empty, f' / {len(items)}')
        print()
        print('前 8 项明细:')
        for r in dash_situation[:8]: print(' ', r)
    except Exception as e:
        print('STANDARD DETAIL parse err:', e)
        print(body[:1000])

    client.close()
    print('\nDone.')

if __name__ == '__main__':
    main()
