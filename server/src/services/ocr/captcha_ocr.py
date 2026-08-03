#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证码识别辅助脚本 - 通过 ddddocr 识别验证码
接收 base64 编码的图片数据，输出识别结果
用法: python3 captcha_ocr.py <base64_image_data>
"""
import sys
import base64

try:
    import ddddocr
    ocr = ddddocr.DdddOcr(det=False, ocr=True, show_ad=False)
except ImportError:
    print("[ERROR] ddddocr not installed", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 2:
    print("[ERROR] missing base64 image data", file=sys.stderr)
    sys.exit(1)

try:
    base64_data = sys.argv[1].strip()
    image_bytes = base64.b64decode(base64_data)
    result = ocr.classification(image_bytes)
    # 清理结果：只保留数字和大写字母
    import re
    result = re.sub(r'[^0-9A-Za-z]', '', result).upper()
    print(result)
except Exception as e:
    print(f"[ERROR] {e}", file=sys.stderr)
    sys.exit(1)
