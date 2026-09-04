#!/usr/bin/env python3
"""SSH helper that connects to the production server through an HTTP proxy."""
import sys
import socket
import paramiko

PROXY_HOST = '127.0.0.1'
PROXY_PORT = 18080
SERVER_HOST = '43.138.218.55'
SERVER_PORT = 22
USERNAME = 'ubuntu'
PASSWORD = 'ASD!@#asd'


def make_proxy_socket():
    """Create a socket tunneled through the HTTP proxy via CONNECT."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(30)
    sock.connect((PROXY_HOST, PROXY_PORT))
    connect_req = (
        f"CONNECT {SERVER_HOST}:{SERVER_PORT} HTTP/1.1\r\n"
        f"Host: {SERVER_HOST}:{SERVER_PORT}\r\n"
        f"Proxy-Connection: keep-alive\r\n\r\n"
    ).encode()
    sock.sendall(connect_req)
    # Read proxy response
    resp = b''
    while b'\r\n\r\n' not in resp:
        chunk = sock.recv(4096)
        if not chunk:
            break
        resp += chunk
    if b' 200 ' not in resp.split(b'\r\n')[0]:
        raise RuntimeError(f"Proxy CONNECT failed: {resp.split(b'\r\n')[0]!r}")
    return sock


def run_command(transport, cmd, timeout=300):
    """Run a single command and stream output."""
    chan = transport.open_session()
    chan.settimeout(timeout)
    chan.exec_command(cmd)
    stdout = b''
    stderr = b''
    while True:
        if chan.recv_ready():
            stdout += chan.recv(65536)
        if chan.recv_stderr_ready():
            stderr += chan.recv_stderr(65536)
        if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
            break
    # Drain remaining
    while chan.recv_ready():
        stdout += chan.recv(65536)
    while chan.recv_stderr_ready():
        stderr += chan.recv_stderr(65536)
    code = chan.recv_exit_status()
    chan.close()
    return code, stdout.decode('utf-8', errors='replace'), stderr.decode('utf-8', errors='replace')


def main():
    commands = sys.argv[1:]
    if not commands:
        print("Usage: deploy_ssh.py 'cmd1' 'cmd2' ...", file=sys.stderr)
        sys.exit(1)

    sock = make_proxy_socket()
    client = paramiko.Transport(sock)
    client.set_keepalive(30)
    try:
        client.connect(username=USERNAME, password=PASSWORD)
    except Exception as e:
        print(f"SSH connect failed: {e}", file=sys.stderr)
        sock.close()
        sys.exit(2)

    for cmd in commands:
        print(f"\n$ {cmd}")
        print("-" * 60)
        code, out, err = run_command(client, cmd)
        if out:
            print(out, end='')
        if err:
            print(f"[stderr] {err}", end='')
        print(f"[exit={code}]")

    client.close()
    sock.close()


if __name__ == '__main__':
    main()
