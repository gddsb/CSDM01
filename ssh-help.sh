#!/usr/bin/env bash
# 远程SSH辅助脚本（通过HTTP代理CONNECT隧道连接）
# 使用方式：
#   ssh-help.sh cmd '<shell command>'
#   ssh-help.sh upload <local_src> <remote_dst>
#   ssh-help.sh rsync <local_path> <remote_path>

set -euo pipefail

# 密码通过 SSHPASS 环境变量传递，避免!等特殊字符被shell解释
export SSHPASS='ASD!@#asd'
HOST='ubuntu@43.138.218.55'
PROXY='127.0.0.1:18080'
# SSH 选项：通过 nc 的 HTTP CONNECT 代理建立隧道
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=error -o ProxyCommand='nc -X connect -x $PROXY %h %p' -o ConnectTimeout=15"

case "${1:-cmd}" in
  cmd)
    shift
    eval sshpass -e ssh $SSH_OPTS "$HOST" '"$@"'
    ;;
  upload)
    SRC="$2"
    DST="$3"
    eval sshpass -e scp $SSH_OPTS -r "'$SRC'" "'$HOST:$DST'"
    ;;
  rsync)
    LOCAL="$2"
    REMOTE="$3"
    eval sshpass -e rsync -avz $SSH_OPTS "'$LOCAL'" "'$HOST:$REMOTE'"
    ;;
  *)
    echo "用法: $0 cmd '<shell command>' | upload <src> <dst> | rsync <local> <remote>"
    exit 1
    ;;
esac
