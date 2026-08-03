#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
能源采集完整脚本 - 被TypeScript调用
用法: python3 energy_collect.py <username> <password> [task_setting_id]
输出: JSON格式的采集结果到stdout
"""
import sys
import json
import time
import re
import random
import string
import base64
import io
import requests
import ddddocr

try:
    from PIL import Image
    has_pil = True
except ImportError:
    has_pil = False

API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

MAX_RETRIES = 15

# OCR引擎初始化
ocr_def = ddddocr.DdddOcr(show_ad=False)
try:
    ocr_beta = ddddocr.DdddOcr(beta=True, show_ad=False)
except Exception:
    ocr_beta = None


def clean(text):
    return re.sub(r'[^0-9A-Za-z]', '', text).upper()


def recognize_captcha(image_bytes):
    """多模型投票识别验证码"""
    results = []
    results.append(clean(ocr_def.classification(image_bytes)))
    if ocr_beta:
        results.append(clean(ocr_beta.classification(image_bytes)))
    if has_pil:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            im = im.convert('L')
            buf = io.BytesIO()
            im.save(buf, format='PNG')
            results.append(clean(ocr_def.classification(buf.getvalue())))
        except Exception:
            pass
    if ocr_beta and has_pil:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            im = im.convert('L')
            buf = io.BytesIO()
            im.save(buf, format='PNG')
            results.append(clean(ocr_beta.classification(buf.getvalue())))
        except Exception:
            pass

    valid4 = [r for r in results if len(r) == 4]
    if valid4:
        from collections import Counter
        cnt = Counter(valid4)
        return cnt.most_common(1)[0][0]
    return results[0] if results else ""


def generate_key_str(length=12):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def login(username, password):
    """登录能源平台，返回 (token, error_msg)"""
    for attempt in range(1, MAX_RETRIES + 1):
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Origin": FRONTEND_HOST,
            "Referer": FRONTEND_HOST + "/login.html",
        })

        key_str = generate_key_str(12)

        # 1. 获取验证码
        url = API_HOST + "/api/Account/GetCaptcha?keyStr=" + key_str
        try:
            resp = session.post(url, data={"keyStr": key_str}, timeout=30)
        except Exception as e:
            print(f"[WARN] 尝试 {attempt}: 获取验证码失败: {e}", file=sys.stderr)
            continue

        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)
        if not result.get("IsSuccess"):
            continue

        b64 = str(result["Data"]).replace('"', '').replace('\\', '')
        img = base64.b64decode(b64)

        # 2. 识别验证码
        captcha = recognize_captcha(img)
        if len(captcha) != 4:
            print(f"[WARN] 尝试 {attempt}: 验证码长度不对: [{captcha}]", file=sys.stderr)
            continue

        # 3. 登录
        login_url = API_HOST + "/api/Account/Login"
        login_data = {
            "UserID": username,
            "Password": password,
            "client": 0,
            "KeyStr": key_str,
            "Code": captcha,
            "Language": "en",
        }
        try:
            resp2 = session.post(login_url, data=login_data, timeout=30)
        except Exception as e:
            print(f"[WARN] 尝试 {attempt}: 登录请求失败: {e}", file=sys.stderr)
            continue

        r2 = resp2.json()
        if isinstance(r2, str):
            r2 = json.loads(r2)

        if r2.get("IsSuccess"):
            print(f"[OK] 登录成功，尝试次数: {attempt}", file=sys.stderr)
            return session, r2.get("Token"), None
        else:
            err = r2.get("ErrorMsg", "Unknown")
            print(f"[WARN] 尝试 {attempt}: 登录失败 [{captcha}]: {err}", file=sys.stderr)

    return None, None, f"登录失败，已重试 {MAX_RETRIES} 次"


def collect_data(session, token):
    """采集电能数据"""
    all_records = []
    page_index = 1
    page_size = 50

    now = time.time()
    start_ts = now - 24 * 3600
    end_ts = now + 24 * 3600

    def fmt(ts):
        t = time.localtime(ts)
        return f"{t.tm_year}-{t.tm_mon:02d}-{t.tm_mday:02d} {t.tm_hour:02d}:{t.tm_min:02d}"

    while True:
        url = API_HOST + "/api/Monitor/PageForTotalEnergy"
        params = {
            "listType": "device",
            "pageIndex": page_index,
            "pageSize": page_size,
            "dateType": "mi15",
            "areaID": 56552,
            "ammeterID": 107799,
            "startTime": fmt(start_ts),
            "endTime": fmt(end_ts),
            "valueType": "SJZ",
            "PrivAddr": "",
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Referer": FRONTEND_HOST + "/Energy/ygwgzdn.html",
        }
        try:
            resp = session.post(url, data=json.dumps(params), headers=headers, timeout=30)
        except Exception as e:
            print(f"[WARN] 获取第{page_index}页数据失败: {e}", file=sys.stderr)
            break

        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if not result or not result.get("IsSuccess"):
            break

        data = result.get("Data")
        if isinstance(data, str):
            data = json.loads(data)

        if not data or not data.get("list"):
            break

        records = data["list"]
        all_records.extend(records)
        total_pages = data.get("pageCount", 1)
        print(f"[INFO] 第{page_index}/{total_pages}页: {len(records)}条, 累计{len(all_records)}/{data.get('count', 0)}条", file=sys.stderr)

        if page_index >= total_pages:
            break
        page_index += 1
        time.sleep(0.5)

    return all_records


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "参数不足: 需要 username password [task_setting_id]"}))
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    task_setting_id = int(sys.argv[3]) if len(sys.argv) > 3 else None

    # Step 1: 登录
    print("[步骤] 连接能源平台...", file=sys.stderr)
    session, token, err = login(username, password)
    if err:
        print(json.dumps({"success": False, "totalRecords": 0, "error": err}))
        sys.exit(1)

    # Step 2: 采集数据
    print("[步骤] 获取电能数据...", file=sys.stderr)
    records = collect_data(session, token)
    print(f"[步骤] 数据获取成功，共 {len(records)} 条", file=sys.stderr)

    # 输出结果
    result = {
        "success": True,
        "totalRecords": len(records),
        "records": records,
        "taskSettingId": task_setting_id,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "totalRecords": 0, "error": str(e)}))
