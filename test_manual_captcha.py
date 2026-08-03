import requests, base64, json, string, random, sys

API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

USERNAME = "N12641"
PASSWORD = "asd123asd"

chars = string.ascii_uppercase + string.digits

for attempt in range(3):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": FRONTEND_HOST,
        "Referer": FRONTEND_HOST + "/login.html",
    })
    
    keyStr = "".join(random.choice(chars) for _ in range(12))
    
    # 1. 获取验证码
    url = API_HOST + "/api/Account/GetCaptcha?keyStr=" + keyStr
    resp = session.post(url, data={"keyStr": keyStr}, timeout=30)
    result = resp.json()
    if isinstance(result, str): result = json.loads(result)
    if not result.get("IsSuccess"):
        print("获取验证码失败")
        continue
    
    b64 = str(result["Data"]).replace('"', "").replace("\\", "")
    img = base64.b64decode(b64)
    
    # 保存图片
    fname = "/tmp/manual_test_" + str(attempt) + ".png"
    with open(fname, "wb") as f:
        f.write(img)
    print("尝试 " + str(attempt+1) + ": 图片保存到 " + fname)
    
    # 等待用户输入正确的验证码
    print("请查看图片后输入验证码:")
    captcha = input("验证码: ").strip().upper()
    
    # 2. 登录
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
        print("登录成功！")
        break
