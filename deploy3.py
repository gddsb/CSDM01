#!/usr/bin/env python3
import paramiko
import socket

HOST = '43.138.218.55'
PORT = 22
USER = 'ubuntu'
PWD = 'ASD!@#asd'
PROXY_HOST = '127.0.0.1'
PROXY_PORT = 18080

def http_connect_tunnel(proxy_host, proxy_port, target_host, target_port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((proxy_host, proxy_port))
    connect_req = f'CONNECT {target_host}:{target_port} HTTP/1.1\r\nHost: {target_host}:{target_port}\r\n\r\n'
    sock.sendall(connect_req.encode())
    response = b''
    while b'\r\n\r\n' not in response:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    resp_text = response.decode('utf-8', errors='replace')
    if '200' not in resp_text:
        raise Exception(f'Proxy connection failed: {resp_text}')
    return sock

def run_cmd(client, cmd, timeout=600):
    print(f'\n=== $ {cmd} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    result = out + err
    print(result[-3000:] if len(result) > 3000 else result)
    return out

print(f'Connecting...')
sock = http_connect_tunnel(PROXY_HOST, PROXY_PORT, HOST, PORT)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PWD, sock=sock, timeout=30, banner_timeout=30)
sftp = client.open_sftp()
print(f'Connected!')

# 上传修改的文件
print('Uploading files...')
sftp.put('/workspace/src/pages/bigscreen/EnvironmentBigScreen.tsx', '/opt/milk-can-mes/src/pages/bigscreen/EnvironmentBigScreen.tsx')
print('Upload done.')

# 构建前端
run_cmd(client, 'cd /opt/milk-can-mes && npm run build 2>&1 | tail -5')

# 重启服务
run_cmd(client, 'pm2 restart milk-can-mes-server 2>&1')
run_cmd(client, 'sleep 3 && pm2 logs --lines 10 --nostream 2>&1')
