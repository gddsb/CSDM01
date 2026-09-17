import subprocess, json, sys

# Get pm2 logs
result = subprocess.run(
    ["sshpass", "-p", "ASD!@#asd", "ssh",
     "-o", "StrictHostKeyChecking=no",
     "-o", "ConnectTimeout=10",
     "-o", "ProxyCommand=nc -X connect -x 127.0.0.1:18080 %h %p",
     "ubuntu@43.138.218.55",
     "pm2 logs milk-can-mes-server --lines 2000 --nostream 2>&1"],
    capture_output=True, text=True, timeout=25
)

print("=== ALL ANDROID REQUESTS ===")
count = 0
for line in result.stdout.splitlines():
    try:
        d = json.loads(line.strip())
        ua = d.get("req",{}).get("headers",{}).get("user-agent","")
        if "Android" in ua:
            url = d.get("req",{}).get("url","")
            status = d.get("res",{}).get("statusCode")
            query = d.get("req",{}).get("query",{})
            print(f"  [{d.get('time','')}] {url} -> {status}  query={query}")
            count += 1
    except:
        pass

if count == 0:
    print("  (no Android requests found)")

print("")
print("=== ALL requests with production/orders ===")
for line in result.stdout.splitlines():
    try:
        d = json.loads(line.strip())
        url = d.get("req",{}).get("url","")
        if "production/orders" in url:
            ua = d.get("req",{}).get("headers",{}).get("user-agent","")
            status = d.get("res",{}).get("statusCode")
            query = d.get("req",{}).get("query",{})
            ua_short = ua[:60] if ua else "?"
            print(f"  [{d.get('time','')}] {url} -> {status}")
            print(f"    query={query}")
            print(f"    ua={ua_short}")
    except:
        pass
