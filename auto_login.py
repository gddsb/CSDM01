#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
能源管理系统自动登录脚本
========================
目标网站: https://nh2.yunjichaobiao.com/login.html
功能: 自动填写用户名、密码，识别验证码，完成登录

依赖安装:
    pip install playwright ddddocr --break-system-packages
    playwright install chromium

验证码识别工具说明:
    - 工具名称: ddddocr (带带弟弟OCR)
    - 用途: 专门用于验证码图片识别的轻量级OCR库
    - 安装: pip install ddddocr
    - 核心参数:
        * det=False   -> 使用OCR识别模式(识别文字), 非检测模式(检测文字位置)
        * ocr=True    -> 启用OCR识别
        * show_ad=False -> 关闭广告输出
    - 替代方案: pytesseract (需安装Tesseract引擎), 或调用AI视觉模型API
"""

import time
import re
import sys
from playwright.sync_api import sync_playwright


# ==================== 配置区 ====================
LOGIN_URL = "https://nh2.yunjichaobiao.com/login.html"
USERNAME = "N12641"
PASSWORD = "asd123asd"

# 页面元素选择器 (基于页面DOM结构分析)
SELECTORS = {
    "tab_password": "text=密码登录",          # 密码登录标签
    "input_account": "input[placeholder='账号']",  # 账号输入框
    "input_password": "input[placeholder='密码']", # 密码输入框
    "input_captcha": "input[placeholder='验证码']",# 验证码输入框
    "captcha_img": "img[id='captchaImg']",         # 验证码图片 (需根据实际DOM调整)
    "btn_login": "button:has-text('登录')",        # 登录按钮
}


# ==================== 验证码识别模块 ====================
def init_ocr():
    """
    初始化 ddddocr 验证码识别引擎

    使用的工具: ddddocr.DdddOcr()
    参数说明:
        - det=False:    纯OCR模式, 输入图片返回文字内容 (非目标检测模式)
        - ocr=True:     启用OCR文字识别
        - show_ad=False: 不显示作者广告信息
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
    需要系统安装 Tesseract-OCR 引擎

    使用的工具: pytesseract.image_to_string()
    参数说明:
        - image:        PIL.Image 对象 (验证码截图)
        - config:       '--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                        psm 7 = 将图片视为单行文本
                        whitelist = 限制只识别数字和大写字母
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
        ocr_engine:  OCR识别引擎实例 (ddddocr 或 tesseract元组)
        image_bytes: 验证码图片的二进制数据

    返回:
        str: 识别出的验证码文本 (如 "KYA9")

    工具与参数详解:

    【方案A - ddddocr (推荐)】
        工具: ddddocr.DdddOcr().classification(image_bytes)
        参数:
            - image_bytes: 图片二进制数据 (bytes类型, 非文件路径)
        特点:
            - 专为验证码设计, 对干扰线/扭曲字体识别率高
            - 无需额外配置字符白名单
            - 返回纯文本结果

    【方案B - pytesseract】
        工具: pytesseract.image_to_string(image, config=...)
        参数:
            - image:  PIL.Image 对象 (需用 io.BytesIO 转换)
            - config: '--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        特点:
            - 通用OCR引擎, 需手动安装Tesseract
            - 需配置白名单提高准确率
            - 返回结果需strip()去除空白字符
    """
    if isinstance(ocr_engine, tuple) and ocr_engine[0] == "tesseract":
        # ----- pytesseract 方案 -----
        _, pytesseract, Image = ocr_engine
        import io
        image = Image.open(io.BytesIO(image_bytes))
        config = '--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        result = pytesseract.image_to_string(image, config=config)
        result = result.strip().upper()
    else:
        # ----- ddddocr 方案 (推荐) -----
        result = ocr_engine.classification(image_bytes)
        result = result.strip().upper()

    # 清理结果: 只保留数字和字母
    result = re.sub(r'[^0-9A-Za-z]', '', result)
    print(f"[OCR] 验证码识别结果: {result}")
    return result


# ==================== 浏览器自动化模块 ====================
def auto_login():
    """
    执行自动登录完整流程

    浏览器自动化工具: Playwright (Python版)
    核心API与参数对照:
        - page.goto(url, wait_until="networkidle")
            url: 目标网址
            wait_until: 等待网络空闲 (等同于之前的 browser_wait_for)

        - page.click(selector, timeout=10000)
            selector: CSS选择器或文本定位器
            timeout: 超时时间(毫秒)

        - page.fill(selector, value)
            selector: 输入框选择器
            value:   要填入的文本

        - page.locator(selector).screenshot()
            对指定元素截图, 返回bytes

        - page.wait_for_timeout(ms)
            固定等待时间(毫秒)
    """
    # 初始化OCR引擎
    ocr_engine = init_ocr()

    with sync_playwright() as p:
        # 启动浏览器 (headless=False 可看到操作过程)
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        print(f"[导航] 正在打开登录页面: {LOGIN_URL}")

        # ===== 步骤1: 打开登录页面 =====
        # 对应工具: browser_navigate({ url: LOGIN_URL })
        page.goto(LOGIN_URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        print("[OK] 登录页面已加载")

        # ===== 步骤2: 切换到"密码登录"标签 =====
        # 对应工具: browser_click({ ref: 'e18' })
        page.click(SELECTORS["tab_password"], timeout=10000)
        page.wait_for_timeout(1000)
        print("[OK] 已切换到密码登录模式")

        # ===== 步骤3: 填写用户名 =====
        # 对应工具: browser_type({ ref: 'e19', text: 'N12641', clear: true })
        page.fill(SELECTORS["input_account"], USERNAME)
        print(f"[OK] 用户名已填入: {USERNAME}")

        # ===== 步骤4: 填写密码 =====
        # 对应工具: browser_type({ ref: 'e20', text: 'asd123asd', clear: true })
        page.fill(SELECTORS["input_password"], PASSWORD)
        print("[OK] 密码已填入: ******")

        # ===== 步骤5: 获取并识别验证码 =====
        # 对应工具: browser_take_screenshot({ filename: 'login_page.png' })
        #           + Read({ file_path: 'login_page.png', target: '识别验证码' })
        #
        # 在脚本中, 直接对验证码图片元素截图:
        captcha_img = page.locator(SELECTORS["captcha_img"])
        # 如果选择器未命中, 尝试备用选择器
        if captcha_img.count() == 0:
            # 备用: 找页面上所有img, 取验证码区域的那张
            captcha_img = page.locator("img").filter(has_text="")
            print("[WARN] 使用备用选择器定位验证码图片")

        image_bytes = captcha_img.screenshot()
        print("[OK] 验证码图片已截图")

        # OCR识别验证码
        captcha_code = recognize_captcha(ocr_engine, image_bytes)

        if not captcha_code or len(captcha_code) < 3:
            print("[WARN] 验证码识别失败, 尝试刷新验证码重试...")
            # 点击验证码图片刷新
            captcha_img.click()
            page.wait_for_timeout(1000)
            image_bytes = captcha_img.screenshot()
            captcha_code = recognize_captcha(ocr_engine, image_bytes)

        # ===== 步骤6: 填写验证码 =====
        # 对应工具: browser_type({ ref: 'e86', text: 'KYA9', clear: true })
        page.fill(SELECTORS["input_captcha"], captcha_code)
        print(f"[OK] 验证码已填入: {captcha_code}")

        # ===== 步骤7: 点击登录按钮 =====
        # 对应工具: browser_click({ ref: 'e87' })
        page.click(SELECTORS["btn_login"], timeout=10000)
        print("[OK] 已点击登录按钮")

        # ===== 步骤8: 等待页面跳转, 验证登录结果 =====
        # 对应工具: browser_wait_for({ time: 3 }) + browser_snapshot()
        page.wait_for_timeout(3000)

        current_url = page.url
        page_title = page.title()

        if "login" in current_url.lower():
            # 可能验证码错误, 检查是否有错误提示
            print("[FAIL] 登录可能失败, 仍在登录页面")
            # 截图保存错误状态
            page.screenshot(path="/workspace/login_failed.png")
            print("[INFO] 错误截图已保存到 /workspace/login_failed.png")

            # 重试逻辑: 刷新验证码重新登录
            print("[RETRY] 尝试重新识别验证码...")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.click(SELECTORS["tab_password"])
            page.fill(SELECTORS["input_account"], USERNAME)
            page.fill(SELECTORS["input_password"], PASSWORD)
            image_bytes = page.locator(SELECTORS["captcha_img"]).screenshot()
            captcha_code = recognize_captcha(ocr_engine, image_bytes)
            page.fill(SELECTORS["input_captcha"], captcha_code)
            page.click(SELECTORS["btn_login"])
            page.wait_for_timeout(3000)
            current_url = page.url
            page_title = page.title()

        if "main" in current_url.lower() or "login" not in current_url.lower():
            print("=" * 60)
            print("[SUCCESS] 登录成功!")
            print(f"  跳转页面: {current_url}")
            print(f"  页面标题: {page_title}")
            print("=" * 60)
            # 截图保存成功状态
            page.screenshot(path="/workspace/login_success.png")
            print("[INFO] 成功截图已保存到 /workspace/login_success.png")
        else:
            print("[FAIL] 登录失败, 请检查账号密码或验证码识别结果")

        # 保持浏览器窗口打开5秒供查看
        page.wait_for_timeout(5000)
        browser.close()


# ==================== 主入口 ====================
if __name__ == "__main__":
    print("=" * 60)
    print("  能源管理系统自动登录脚本")
    print("  目标: https://nh2.yunjichaobiao.com/login.html")
    print("  用户: N12641")
    print("=" * 60)
    print()

    try:
        auto_login()
    except Exception as e:
        print(f"[ERROR] 脚本执行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
