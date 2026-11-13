#!/usr/bin/env python3
import sys, paramiko
host, user, pwd, port = "43.138.218.55", "ubuntu", "ASD123asd", 22
cmd = sys.argv[1] if len(sys.argv) > 1 else "echo ok"
timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 300
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=pwd, timeout=15,
               sock=paramiko.ProxyCommand(f"nc -X connect -x 127.0.0.1:18080 {host} {port}"))
stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
print(stdout.read().decode(), end='')
err = stderr.read().decode()
if err: print(err, file=sys.stderr, end='')
print(f"\n[exit={stdout.channel.recv_exit_status()}]", file=sys.stderr)
client.close()
