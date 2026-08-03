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

    url = API_HOST + "/api/Account/GetCaptcha?keyStr=" + keyStr
    resp = session.post(url, data={"keyStr": keyStr}, timeout=30)
    result = resp.json()
    if isinstance(result, str): result = json.loads(result)
    if not result.get("IsSuccess"): continue

    b64 = str(result["Data"]).replace('"', "").replace("\\", "")
    img = base64.b64decode(b64)

    fname = "/tmp/manual_login_" + str(attempt) + ".png"
    with open(fname, "wb") as f:
        f.write(img)
    print("尝试 " + str(attempt+1) + ": 图片保存到 " + fname)

    import ddddocr
    ocr = ddddocr.DdddOcr(show_ad=False)
    ocr_res = ocr.classification(img)
    print("  OCR识别结果: [" + ocr_res + "]")

print("请下载图片查看，然后输入正确验证码测试:")
