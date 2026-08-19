#!/bin/bash
# HTTP CONNECT 代理 wrapper，供 ssh ProxyCommand 使用
# 用法: ssh -o ProxyCommand="/workspace/http_proxy_wrapper.sh %h %p" user@host
TARGET_HOST="$1"
TARGET_PORT="$2"
PROXY_HOST="127.0.0.1"
PROXY_PORT="18080"
# 用 printf 输出 CONNECT 请求，然后 cat 把 ssh 的数据双向转发
{
  printf "CONNECT %s:%s HTTP/1.1\r\nHost: %s:%s\r\n\r\n" "$TARGET_HOST" "$TARGET_PORT" "$TARGET_HOST" "$TARGET_PORT"
  cat
} | nc "$PROXY_HOST" "$PROXY_PORT"
