#!/usr/bin/env python3
import sys, socket, paramiko
PROXY_HOST, PROXY_PORT = "127.0.0.1", 18080
TARGET_HOST, TARGET_PORT, USERNAME, PASSWORD = "43.138.218.55", 22, "ubuntu", "ASD!@#asd"
def open_via_http_proxy():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(15); s.connect((PROXY_HOST, PROXY_PORT))
    s.sendall(f"CONNECT {TARGET_HOST}:{TARGET_PORT} HTTP/1.1\r\nHost: {TARGET_HOST}:{TARGET_PORT}\r\n\r\n".encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = s.recv(4096)
        if not chunk: raise RuntimeError("proxy closed")
        buf += chunk
    head = buf.partition(b"\r\n\r\n")[0]
    if "200" not in head.split(b"\r\n",1)[0].decode(errors="replace"): raise RuntimeError("proxy CONNECT failed")
    return s
cmd = sys.stdin.read() if (len(sys.argv)>1 and sys.argv[1]=="-") else (sys.argv[1] if len(sys.argv)>1 else "")
sock = open_via_http_proxy(); t = paramiko.Transport(sock); t.set_keepalive(30); t.start_client(timeout=20)
t.auth_password(USERNAME, PASSWORD)
chan = t.open_session(); chan.settimeout(300); chan.get_pty(); chan.exec_command(cmd)
out, err = [], []
while True:
    if chan.recv_ready(): out.append(chan.recv(65536))
    if chan.recv_stderr_ready(): err.append(chan.recv_stderr(65536))
    if chan.exit_status_ready():
        while chan.recv_ready(): out.append(chan.recv(65536))
        while chan.recv_stderr_ready(): err.append(chan.recv_stderr(65536))
        break
rc = chan.recv_exit_status()
sys.stdout.buffer.write(b"".join(out)); sys.stdout.buffer.flush()
sys.stderr.buffer.write(b"".join(err)); sys.stderr.buffer.flush()
chan.close(); t.close(); sys.exit(rc)
