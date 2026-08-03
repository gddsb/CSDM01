import requests, base64, json, string, random, sys, re, io, subprocess

API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

USERNAME = "N12641"
PASSWORD = "asd123asd"

chars = string.ascii_uppercase + string.digits

def generate_key_str(length=12):
    return "".join(random.choice(chars) for _ in range(length))

SCRIPT_PATH = "/opt/milk-can-mes/server/src/services/ocr/captcha_ocr.py"

for attempt in range(1, 6):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": FRONTEND_HOST,
        "Referer": FRONTEND_HOST + "/login.html",
    })
    
    keyStr = generate_key_str(12)
    print("\n=== 尝试 " + str(attempt) + " ===")
    print("keyStr: " + keyStr)
    
    # Step 1: 获取验证码（表单格式）
    url = API_HOST + "/api/Account/GetCaptcha?keyStr=" + keyStr
    resp = session.post(url, data={"keyStr": keyStr}, timeout=30)
    print("验证码请求 cookies: " + str(dict(session.cookies)))
    
    result = resp.json()
    if isinstance(result, str): result = json.loads(result)
    print("验证码 IsSuccess: " + str(result.get("IsSuccess")))
    
    if not result.get("IsSuccess"):
        continue
    
    b64 = str(result["Data"]).replace('"', "").replace("\\", "")
    img = base64.b64decode(b64)
    
    # Step 2: 调用实际的 Python OCR 脚本
    proc = subprocess.run(
        ["python3", SCRIPT_PATH, b64],
        capture_output=True, text=True, timeout=15
    )
    captcha = proc.stdout.strip()
    print("OCR识别验证码: [" + captcha + "]")
    if proc.stderr.strip():
        print("  stderr: " + proc.stderr.strip()[:100])
    
    if len(captcha) != 4:
        print("  -> 跳过: 长度不是4位")
        continue
    
    # Step 3: 登录
    login_url = API_HOST + "/api/Account/Login"
    login_data = {
        "UserID": USERNAME, "Password": PASSWORD, "client": 0,
        "KeyStr": keyStr, "Code": captcha, "Language": "en",
    }
    resp2 = session.post(login_url, data=login_data, timeout=30)
    r2 = resp2.json()
    if isinstance(r2, str): r2 = json.loads(r2)
    
    print("登录结果: IsSuccess=" + str(r2.get("IsSuccess")) + " ErrorCode=" + str(r2.get("ErrorCode")) + " Msg=" + str(r2.get("ErrorMsg")))
    
    if r2.get("IsSuccess"):
        print("登录成功！Token: " + str(r2.get("Token", ""))[:50])
        break
