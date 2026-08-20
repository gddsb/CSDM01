#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
能源管理系统 - 纯HTTP模式数据采集脚本（被Node.js调用版本）
用法: python3 energy_collect.py <username> <password> [task_setting_id]
输出: stdout最后一行是JSON结果
"""

import requests
import json
import time
import re
import random
import string
import base64
import sys
from datetime import datetime, timedelta


# ==================== 配置区 ====================
API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

API_ENDPOINTS = {
    "login": "api/Account/Login",
    "getCaptcha": "api/Account/GetCaptcha",
    "pageForTotalEnergy": "api/Monitor/PageForTotalEnergy",
}

COLLECT_CONFIG = {
    "listType": "device",
    "dateType": "mi15",
    "areaID": 56552,
    "ammeterID": 107799,
    "valueType": "SJZ",
    "pageSize": 50,
}

REQUEST_TIMEOUT = 30
MAX_RETRIES = 15


def log(msg):
    print(msg, file=sys.stderr)


def generate_key_str(length=12):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def init_ocr():
    try:
        import ddddocr
        ocr = ddddocr.DdddOcr(det=False, ocr=True, show_ad=False)
        log("[OK] ddddocr 验证码识别引擎初始化成功")
        return ocr
    except ImportError as e:
        log(f"[ERROR] ddddocr 未安装: {e}")
        sys.exit(1)


def recognize_captcha(ocr_engine, image_bytes):
    result = ocr_engine.classification(image_bytes)
    result = result.strip().upper()
    result = re.sub(r'[^0-9A-Za-z]', '', result)
    log(f"  [OCR] 验证码识别结果: {result}")
    return result


class EnergyAPI:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_info = None
        self.ocr_engine = init_ocr()

        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": FRONTEND_HOST,
            "Referer": f"{FRONTEND_HOST}/login.html",
        })

    def get_captcha(self, key_str):
        url = f"{API_HOST}/{API_ENDPOINTS['getCaptcha']}?keyStr={key_str}"
        log(f"  [请求] GET Captcha: keyStr={key_str}")

        resp = self.session.post(url, data={"keyStr": key_str}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if result.get("IsSuccess"):
            base64_data = result["Data"].replace('"', '').replace('\\', '')
            image_bytes = base64.b64decode(base64_data)
            log(f"  [OK] 验证码图片获取成功, 大小: {len(image_bytes)} bytes")
            return image_bytes
        else:
            raise Exception(f"获取验证码失败: {result.get('ErrorMsg', 'Unknown error')}")

    def login(self, username, password, key_str, code):
        url = f"{API_HOST}/{API_ENDPOINTS['login']}"
        login_data = {
            "UserID": username,
            "Password": password,
            "client": 0,
            "KeyStr": key_str,
            "Code": code,
            "Language": "en",
        }
        log(f"  [请求] POST Login: UserID={username}")

        resp = self.session.post(url, data=login_data, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if result.get("IsSuccess"):
            self.user_info = result.get("Data", {})
            self.token = result.get("Token")
            log(f"  [OK] 登录成功!")
            return True
        else:
            error_msg = result.get("ErrorMsg", "Unknown error")
            error_code = result.get("ErrorCode", "")
            log(f"  [FAIL] 登录失败: [{error_code}] {error_msg}")
            return False

    def login_with_captcha(self, username, password, max_retries=MAX_RETRIES):
        log("\n[步骤] 开始登录流程...")

        for attempt in range(1, max_retries + 1):
            log(f"\n--- 登录尝试 {attempt}/{max_retries} ---")

            key_str = generate_key_str(12)
            try:
                image_bytes = self.get_captcha(key_str)
            except Exception as e:
                log(f"  [ERROR] 获取验证码失败: {e}")
                continue

            captcha_code = recognize_captcha(self.ocr_engine, image_bytes)
            if not captcha_code or len(captcha_code) < 3:
                log(f"  [WARN] 验证码识别结果不完整, 重试...")
                continue

            if self.login(username, password, key_str, captcha_code):
                return True
            else:
                log(f"  [WARN] 登录失败, 可能验证码识别错误, 重试...")

        log(f"\n[FAIL] 登录失败, 已重试 {max_retries} 次")
        return False

    def get_total_energy_data(self, page_index=1, page_size=50, **kwargs):
        url = f"{API_HOST}/{API_ENDPOINTS['pageForTotalEnergy']}"

        now = datetime.now()
        start_time = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M")
        end_time = (now + timedelta(days=1)).strftime("%Y-%m-%d %H:%M")

        params = {
            "listType": COLLECT_CONFIG["listType"],
            "pageIndex": page_index,
            "pageSize": page_size,
            "dateType": COLLECT_CONFIG["dateType"],
            "areaID": COLLECT_CONFIG["areaID"],
            "ammeterID": COLLECT_CONFIG["ammeterID"],
            "startTime": start_time,
            "endTime": end_time,
            "valueType": COLLECT_CONFIG["valueType"],
            "PrivAddr": "",
        }
        params.update(kwargs)

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Referer": f"{FRONTEND_HOST}/Energy/ygwgzdn.html",
        }

        log(f"  [请求] POST PageForTotalEnergy: page={page_index}, size={page_size}")

        resp = self.session.post(url, data=json.dumps(params), headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if result and result.get("IsSuccess"):
            data = result.get("Data")
            if isinstance(data, str):
                data = json.loads(data)
            return data
        else:
            error_msg = result.get("ErrorMsg", "Unknown error") if result else "Empty response"
            error_code = result.get("ErrorCode", "") if result else ""
            log(f"  [API ERROR] [{error_code}] {error_msg}")
            return None

    def collect_all_data(self):
        log("\n[步骤] 开始采集数据...")

        all_records = []
        page_index = 1
        page_size = COLLECT_CONFIG["pageSize"]
        total_pages = 0

        while True:
            try:
                data = self.get_total_energy_data(page_index=page_index, page_size=page_size)
            except Exception as e:
                log(f"  [ERROR] 获取第{page_index}页数据失败: {e}")
                break

            if not data or not data.get("list"):
                log(f"  [INFO] 第{page_index}页无数据")
                break

            records = data["list"]
            all_records.extend(records)
            total_pages = data.get("pageCount", 1)

            log(f"  [OK] 第{page_index}/{total_pages}页: 获取{len(records)}条, 累计{len(all_records)}/{data.get('count', 0)}条")

            if page_index >= total_pages:
                break

            page_index += 1
            time.sleep(0.5)

        log(f"\n[完成] 数据采集完成: 共{len(all_records)}条记录, {total_pages}页")
        return all_records


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "totalRecords": 0, "error": "参数不足: 需要 username password [task_setting_id]"}))
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    log("=" * 70)
    log(f"  能源管理系统 - 纯HTTP模式数据采集")
    log(f"  目标: {API_HOST}")
    log(f"  用户: {username}")
    log("=" * 70)

    api = EnergyAPI()

    if not api.login_with_captcha(username, password):
        result = {"success": False, "totalRecords": 0, "error": f"登录失败，已重试 {MAX_RETRIES} 次"}
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    records = api.collect_all_data()

    result = {
        "success": True,
        "totalRecords": len(records),
        "records": records,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\n[中断] 用户手动中断")
        sys.exit(0)
    except Exception as e:
        log(f"\n[ERROR] 程序异常: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "totalRecords": 0, "error": str(e)}))
