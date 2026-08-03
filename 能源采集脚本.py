#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
能源管理系统 - 纯HTTP模式数据采集脚本
=====================================
目标网站: https://nh2.yunjichaobiao.com
功能: 通过纯HTTP API调用实现登录、验证码识别、数据采集，无需浏览器自动化

依赖安装:
    pip install requests ddddocr Pillow --break-system-packages

工作流程:
    1. 获取验证码图片 (POST /api/Account/GetCaptcha)
    2. OCR识别验证码 (ddddocr)
    3. API登录获取JWT令牌 (POST /api/Account/Login)
    4. 调用数据API获取总有功/无功电能历史数据 (POST /api/Monitor/PageForTotalEnergy)
    5. 自动翻页采集所有数据并保存为CSV

API分析:
    - 验证码API:  POST https://nh2api.yunjichaobiao.com/api/Account/GetCaptcha?keyStr=<key>
    - 登录API:    POST https://nh2api.yunjichaobiao.com/api/Account/Login
    - 数据API:    POST https://nh2api.yunjichaobiao.com/api/Monitor/PageForTotalEnergy
    - 认证方式:   Authorization: Bearer <JWT Token>
    - 数据格式:   application/json (数据API), form-urlencoded (登录/验证码API)
"""

import requests
import json
import csv
import time
import re
import random
import string
import base64
import sys
from datetime import datetime, timedelta


# ==================== 配置区 ====================
# API基础地址
API_HOST = "https://nh2api.yunjichaobiao.com"
FRONTEND_HOST = "https://nh2.yunjichaobiao.com"

# 登录凭据
USERNAME = "N12641"
PASSWORD = "asd123asd"

# API端点 (从源码 yjAPI 映射提取)
API_ENDPOINTS = {
    "login": "api/Account/Login",
    "getCaptcha": "api/Account/GetCaptcha",
    "pageForTotalEnergy": "api/Monitor/PageForTotalEnergy",          # 总有功/无功电能
    "summaryTotalEnergy": "api/Monitor/SummaryTotalEnergy",           # 汇总数据
    "chartTotalEnergy": "api/Monitor/ChartTotalEnergy",               # 图表数据
    "exportTotalEnergy": "api/Monitor/ExportTotalEnergy",             # 导出数据
    "getAreaAll": "api/System/GetAreaAll",                            # 获取区域设备列表
}

# 数据采集参数 (从iframe变量提取)
COLLECT_CONFIG = {
    "listType": "device",          # 按设备采集 (可选: "area" 按区域)
    "dateType": "mi15",            # 15分钟间隔 (可选: mi1, mi5, mi15, H, D, M, Y)
    "areaID": 56552,               # 区域ID (总表所在区域)
    "ammeterID": 107799,           # 电表ID (总表)
    "valueType": "SJZ",            # 实际值 (SJZ=实际值, SSZ=示数值)
    "pageSize": 50,                # 每页记录数
}

# 日期范围: 当前日期往前一天和往后一天
DATE_CONFIG = {
    "startTime": "2026-08-01 00:00",
    "endTime": "2026-08-04 00:00",
}

# 输出文件
OUTPUT_CSV = "/workspace/总表设备级历史数据_HTTP模式.csv"

# 请求超时(秒)
REQUEST_TIMEOUT = 30

# 最大重试次数
MAX_RETRIES = 3


# ==================== 工具函数 ====================
def generate_key_str(length=12):
    """
    生成随机密钥字符串 (模拟前端 randomWord 函数)
    用于验证码请求的 keyStr 参数
    """
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def init_ocr():
    """
    初始化 ddddocr 验证码识别引擎
    工具: ddddocr.DdddOcr(det=False, ocr=True, show_ad=False)
    """
    try:
        import ddddocr
        ocr = ddddocr.DdddOcr(det=False, ocr=True, show_ad=False)
        print("[OK] ddddocr 验证码识别引擎初始化成功")
        return ocr
    except ImportError:
        print("[WARN] ddddocr 未安装, 尝试使用 pytesseract 替代方案")
        return init_tesseract()


def init_tesseract():
    """
    替代方案: 使用 pytesseract 识别验证码
    """
    try:
        import pytesseract
        from PIL import Image
        print("[OK] pytesseract 验证码识别引擎初始化成功")
        return ("tesseract", pytesseract, Image)
    except ImportError:
        print("[ERROR] pytesseract 也未安装, 请执行: pip install ddddocr pytesseract Pillow")
        sys.exit(1)


def recognize_captcha(ocr_engine, image_bytes):
    """
    识别验证码图片
    参数:
        ocr_engine: OCR引擎实例
        image_bytes: 验证码图片二进制数据
    返回:
        str: 识别出的验证码文本
    """
    if isinstance(ocr_engine, tuple) and ocr_engine[0] == "tesseract":
        _, pytesseract, Image = ocr_engine
        import io
        image = Image.open(io.BytesIO(image_bytes))
        config = '--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        result = pytesseract.image_to_string(image, config=config)
        result = result.strip().upper()
    else:
        result = ocr_engine.classification(image_bytes)
        result = result.strip().upper()

    # 清理结果: 只保留数字和字母
    result = re.sub(r'[^0-9A-Za-z]', '', result)
    print(f"  [OCR] 验证码识别结果: {result}")
    return result


# ==================== HTTP API 模块 ====================
class EnergyAPI:
    """
    能源管理系统 HTTP API 客户端
    封装登录、验证码、数据采集等API调用
    """

    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_info = None
        self.ocr_engine = init_ocr()

        # 设置通用请求头 (模拟浏览器行为)
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": FRONTEND_HOST,
            "Referer": f"{FRONTEND_HOST}/login.html",
        })

    def get_captcha(self, key_str):
        """
        获取验证码图片
        API: POST /api/Account/GetCaptcha?keyStr=<keyStr>
        参数:
            key_str: 12位随机密钥 (前端 randomWord 生成)
        返回:
            bytes: 验证码图片二进制数据 (PNG格式)
        """
        url = f"{API_HOST}/{API_ENDPOINTS['getCaptcha']}?keyStr={key_str}"
        print(f"  [请求] GET Captcha: keyStr={key_str}")

        resp = self.session.post(
            url,
            data={"keyStr": key_str},
            timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()

        # 解析响应: { IsSuccess: true, Data: "<base64>" }
        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if result.get("IsSuccess"):
            # Data 字段是 base64 编码的图片数据
            base64_data = result["Data"].replace('"', '').replace('\\', '')
            image_bytes = base64.b64decode(base64_data)
            print(f"  [OK] 验证码图片获取成功, 大小: {len(image_bytes)} bytes")
            return image_bytes
        else:
            raise Exception(f"获取验证码失败: {result.get('ErrorMsg', 'Unknown error')}")

    def login(self, username, password, key_str, code):
        """
        登录系统获取JWT令牌
        API: POST /api/Account/Login
        参数:
            username: 用户名
            password: 密码
            key_str: 验证码密钥
            code: 验证码
        返回:
            dict: 用户信息 (包含Token)
        """
        url = f"{API_HOST}/{API_ENDPOINTS['login']}"
        login_data = {
            "UserID": username,
            "Password": password,
            "client": 0,           # 0=PC端
            "KeyStr": key_str,
            "Code": code,
            "Language": "en",       # 语言: en/cn
        }
        print(f"  [请求] POST Login: UserID={username}")

        resp = self.session.post(
            url,
            data=login_data,
            timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()

        # 解析响应
        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        if result.get("IsSuccess"):
            self.user_info = result.get("Data", {})
            self.token = result.get("Token")
            print(f"  [OK] 登录成功!")
            print(f"    用户: {self.user_info.get('Name', 'N/A')}")
            print(f"    项目: {self.user_info.get('ProjectName', 'N/A')}")
            print(f"    Token: {self.token[:50]}...")
            return True
        else:
            error_msg = result.get("ErrorMsg", "Unknown error")
            error_code = result.get("ErrorCode", "")
            print(f"  [FAIL] 登录失败: [{error_code}] {error_msg}")
            return False

    def login_with_captcha(self, username, password, max_retries=MAX_RETRIES):
        """
        完整登录流程: 获取验证码 -> 识别 -> 登录 (带重试)
        """
        print("\n[步骤] 开始登录流程...")

        for attempt in range(1, max_retries + 1):
            print(f"\n--- 登录尝试 {attempt}/{max_retries} ---")

            # 1. 生成密钥并获取验证码
            key_str = generate_key_str(12)
            try:
                image_bytes = self.get_captcha(key_str)
            except Exception as e:
                print(f"  [ERROR] 获取验证码失败: {e}")
                continue

            # 2. OCR识别验证码
            captcha_code = recognize_captcha(self.ocr_engine, image_bytes)
            if not captcha_code or len(captcha_code) < 3:
                print(f"  [WARN] 验证码识别结果不完整, 重试...")
                continue

            # 3. 调用登录API
            if self.login(username, password, key_str, captcha_code):
                return True
            else:
                print(f"  [WARN] 登录失败, 可能验证码识别错误, 重试...")

        print(f"\n[FAIL] 登录失败, 已重试 {max_retries} 次")
        return False

    def get_total_energy_data(self, page_index=1, page_size=50, **kwargs):
        """
        获取总有功/无功电能历史数据 (分页)
        API: POST /api/Monitor/PageForTotalEnergy
        认证: Authorization: Bearer <token>
        参数:
            page_index: 页码 (从1开始)
            page_size: 每页记录数
            **kwargs: 覆盖默认采集参数
        返回:
            dict: { list: [...], index: <page>, count: <total>, pageCount: <pages> }
        """
        url = f"{API_HOST}/{API_ENDPOINTS['pageForTotalEnergy']}"

        # 合并参数
        params = {
            "listType": COLLECT_CONFIG["listType"],
            "pageIndex": page_index,
            "pageSize": page_size,
            "dateType": COLLECT_CONFIG["dateType"],
            "areaID": COLLECT_CONFIG["areaID"],
            "ammeterID": COLLECT_CONFIG["ammeterID"],
            "startTime": DATE_CONFIG["startTime"],
            "endTime": DATE_CONFIG["endTime"],
            "valueType": COLLECT_CONFIG["valueType"],
            "PrivAddr": "",   # 必填字段 (前端 yjAjax 自动添加)
        }
        params.update(kwargs)

        # 设置认证头
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Referer": f"{FRONTEND_HOST}/Energy/ygwgzdn.html",
        }

        print(f"  [请求] POST PageForTotalEnergy: page={page_index}, size={page_size}")

        resp = self.session.post(
            url,
            data=json.dumps(params),
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()

        # 解析API响应 (格式: { IsSuccess: true, Data: <json_string_or_object> })
        result = resp.json()
        if isinstance(result, str):
            result = json.loads(result)

        # yjAjax.success 逻辑: 检查 IsSuccess, 解析 Data 字段
        if result and result.get("IsSuccess"):
            data = result.get("Data")
            # Data 可能是 JSON 字符串或对象
            if isinstance(data, str):
                data = json.loads(data)
            return data
        else:
            error_msg = result.get("ErrorMsg", "Unknown error") if result else "Empty response"
            error_code = result.get("ErrorCode", "") if result else ""
            print(f"  [API ERROR] [{error_code}] {error_msg}")
            return None

    def collect_all_data(self):
        """
        采集所有分页数据
        自动翻页直到获取所有记录
        返回:
            list: 所有数据记录列表
        """
        print("\n[步骤] 开始采集数据...")

        all_records = []
        page_index = 1
        page_size = COLLECT_CONFIG["pageSize"]
        total_count = 0
        total_pages = 0

        while True:
            try:
                data = self.get_total_energy_data(
                    page_index=page_index,
                    page_size=page_size
                )
            except Exception as e:
                print(f"  [ERROR] 获取第{page_index}页数据失败: {e}")
                break

            if not data or not data.get("list"):
                print(f"  [INFO] 第{page_index}页无数据")
                break

            records = data["list"]
            all_records.extend(records)

            total_count = data.get("count", 0)
            total_pages = data.get("pageCount", 0)

            print(f"  [OK] 第{page_index}/{total_pages}页: 获取{len(records)}条, 累计{len(all_records)}/{total_count}条")

            # 判断是否还有下一页
            if page_index >= total_pages:
                break

            page_index += 1
            time.sleep(0.5)  # 请求间隔, 避免过于频繁

        print(f"\n[完成] 数据采集完成: 共{len(all_records)}条记录, {total_pages}页")
        return all_records


# ==================== CSV导出模块 ====================
def export_to_csv(records, output_path, ammeter_name="总表", address="542408002831"):
    """
    将采集的数据导出为CSV文件
    数据字段映射:
        ReadingDate -> 时间
        AmmeterName -> 电表名称
        Address     -> 通讯地址
        ZYGDN       -> 正向有功总电能(kWh)
        ZWGDN       -> 正向无功总电能(kvarh)
        FYGDN       -> 反向有功总电能(kWh)
        FWGDN       -> 反向无功总电能(kvarh)
    """
    if not records:
        print("[WARN] 无数据可导出")
        return

    headers = [
        "序号", "时间", "电表名称", "通讯地址",
        "正向有功总电能(kWh)", "正向无功总电能(kvarh)",
        "反向有功总电能(kWh)", "反向无功总电能(kvarh)"
    ]

    def format_value(val):
        """格式化数值: null/特殊值显示为'-'"""
        if val is None or val == "" or val == "null":
            return "-"
        try:
            return str(int(float(val)))
        except (ValueError, TypeError):
            return str(val) if val else "-"

    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for i, record in enumerate(records, 1):
            row = [
                i,
                record.get("ReadingDate", ""),
                record.get("AmmeterName", ammeter_name),
                record.get("Address", address),
                format_value(record.get("ZYGDN")),
                format_value(record.get("ZWGDN")),
                format_value(record.get("FYGDN")),
                format_value(record.get("FWGDN")),
            ]
            writer.writerow(row)

    print(f"\n[OK] CSV文件已保存: {output_path}")
    print(f"  共 {len(records)} 条记录")


# ==================== 主入口 ====================
def main():
    print("=" * 70)
    print("  能源管理系统 - 纯HTTP模式数据采集脚本")
    print(f"  目标: {API_HOST}")
    print(f"  用户: {USERNAME}")
    print(f"  采集: 总有功/无功电能 (总表)")
    print(f"  时间范围: {DATE_CONFIG['startTime']} ~ {DATE_CONFIG['endTime']}")
    print("=" * 70)
    print()

    # 创建API客户端
    api = EnergyAPI()

    # ===== 步骤1: 登录 =====
    if not api.login_with_captcha(USERNAME, PASSWORD):
        print("\n[FATAL] 登录失败, 程序退出")
        sys.exit(1)

    # ===== 步骤2: 采集数据 =====
    records = api.collect_all_data()

    # ===== 步骤3: 导出CSV =====
    if records:
        export_to_csv(records, OUTPUT_CSV)

        # 打印前5条记录预览
        print("\n[预览] 前5条记录:")
        print(f"  {'时间':<20} {'电表名称':<8} {'正向有功':>8} {'正向无功':>8} {'反向有功':>8} {'反向无功':>8}")
        print("  " + "-" * 70)
        for r in records[:5]:
            zy = r.get("ZYGDN", "-")
            zw = r.get("ZWGDN", "-")
            fy = r.get("FYGDN", "-")
            fw = r.get("FWGDN", "-")
            print(f"  {r.get('ReadingDate', ''):<20} {r.get('AmmeterName', '总表'):<8} {str(zy):>8} {str(zw):>8} {str(fy):>8} {str(fw):>8}")
    else:
        print("\n[WARN] 未采集到任何数据")

    print("\n" + "=" * 70)
    print("  数据采集完成!")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[中断] 用户手动中断")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] 程序异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
