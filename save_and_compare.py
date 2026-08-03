import requests, base64, json, string, random, subprocess, sys

API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

chars = string.ascii_uppercase + string.digits
SCRIPT_PATH = "/opt/milk-can-mes/server/src/services/ocr/captcha_ocr.py"

for i in range(10):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": FRONTEND_HOST,
        "Referer": FRONTEND_HOST + "/login.html",
    })
    keyStr = "".join(random.choice(chars) for _ in range(12))
    url = API_HOST + "/api/Account/GetCaptcha?keyStr=" + keyStr
    resp = session.post(url, data={"keyStr": keyStr}, timeout=30)
    result = resp.json()
    if isinstance(result, str): result = json.loads(result)
    if not result.get("IsSuccess"): continue
    
    b64 = str(result["Data"]).replace('"', "").replace("\\", "")
    img = base64.b64decode(b64)
    
    fname = "/tmp/captcha_debug_" + str(i+1) + ".png"
    with open(fname, "wb") as f:
        f.write(img)
    
    proc = subprocess.run(["python3", SCRIPT_PATH, b64], capture_output=True, text=True, timeout=15)
    ocr_result = proc.stdout.strip()
    print("图片 " + str(i+1) + ": OCR=[" + ocr_result + "]")

print("\n图片已保存到 /tmp/captcha_debug_*.png")
