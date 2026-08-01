#!/usr/bin/env bash
# 远程SSH辅助脚本：避免密码中的!被zsh/bash历史展开破坏
# 使用方式：ssh-help.sh <命令>

set -euo pipefail

export SSHPASS='ASD!@#asd'
HOST='ubuntu@43.138.218.55'
SSH_OPTS='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=error'

case "${1:-cmd}" in
  cmd)
    shift
    sshpass -e ssh $SSH_OPTS "$HOST" "$@"
    ;;
  upload)
    # upload <src> <dest(remote, relative to /opt/milk-can-mes or absolute)>
    SRC="$2"
    DST="$3"
    sshpass -e scp $SSH_OPTS -r "$SRC" "$HOST:$DST"
    ;;
  rsync)
    # rsync <local_path> <remote_path>
    LOCAL="$2"
    REMOTE="$3"
    sshpass -e rsync -avz --progress -e "ssh $SSH_OPTS" "$LOCAL" "$HOST:$REMOTE"
    ;;
  *)
    echo "用法: $0 cmd '<shell command>' | upload <src> <dst> | rsync <local> <remote>"
    exit 1
    ;;
esac
