"""
部署脚本：通过HTTP代理连接远程服务器执行部署
目标：43.138.218.55 (ubuntu/ASD!@#asd)
"""
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

def run(client, cmd, timeout=300):
    print(f'\n>>> {cmd}')
    sys.stdout.flush()
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out.rstrip())
    if err:
        print('[STDERR]', err.rstrip())
    exit_code = stdout.channel.recv_exit_status()
    print(f'[EXIT CODE: {exit_code}]')
    return exit_code, out, err

def main():
    print('Connecting to server via proxy...')
    client = create_client()
    print('Connected!')

    server_dir = '/opt/milk-can-mes'

    # 1. 拉取最新代码
    run(client, f'cd {server_dir} && git fetch origin && git reset --hard origin/main && git log -3 --oneline')

    # 2. 后端依赖安装
    run(client, f'cd {server_dir}/server && pnpm install 2>&1 | tail -15', timeout=300)

    # 3. 数据库迁移（使用 tsx 而非 ts-node，项目为 ESM）
    run(client, f'cd {server_dir}/server && pnpm exec tsx src/migrate.ts 2>&1 | tail -80', timeout=300)

    # 4. 前端构建
    run(client, f'cd {server_dir} && pnpm install 2>&1 | tail -15', timeout=300)
    run(client, f'cd {server_dir} && pnpm run build 2>&1 | tail -40', timeout=300)

    # 5. 重启服务
    run(client, f'cd {server_dir}/server && pm2 list')
    run(client, f'cd {server_dir}/server && pm2 restart all 2>&1 | tail -30', timeout=60)

    # 6. 验证
    run(client, f'pm2 list')

    client.close()
    print('\nDeployment complete!')

if __name__ == '__main__':
    main()
