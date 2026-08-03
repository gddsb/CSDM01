#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证码识别辅助脚本 - 多模型投票方案
接收 base64 编码的图片数据，输出识别结果
用法: python3 captcha_ocr.py <base64_image_data>
"""
import sys
import base64
import re
import io

try:
    import ddddocr
except ImportError:
    print("[ERROR] ddddocr not installed", file=sys.stderr)
    sys.exit(1)

ocr_def = ddddocr.DdddOcr(show_ad=False)
try:
    ocr_beta = ddddocr.DdddOcr(beta=True, show_ad=False)
except Exception:
    ocr_beta = None

try:
    from PIL import Image
    has_pil = True
except ImportError:
    has_pil = False


def clean(text):
    return re.sub(r'[^0-9A-Za-z]', '', text).upper()


if len(sys.argv) < 2:
    print("[ERROR] missing base64 image data", file=sys.stderr)
    sys.exit(1)

try:
    base64_data = sys.argv[1].strip()
    image_bytes = base64.b64decode(base64_data)

    results = []

    # 方案1: 默认模型（原始图片）
    results.append(clean(ocr_def.classification(image_bytes)))

    # 方案2: beta模型（原始图片）
    if ocr_beta:
        results.append(clean(ocr_beta.classification(image_bytes)))

    # 方案3: 默认模型（灰度化图片）
    if has_pil:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            im = im.convert('L')
            buf = io.BytesIO()
            im.save(buf, format='PNG')
            results.append(clean(ocr_def.classification(buf.getvalue())))
        except Exception:
            pass

    # 方案4: beta模型（灰度化图片）
    if ocr_beta and has_pil:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            im = im.convert('L')
            buf = io.BytesIO()
            im.save(buf, format='PNG')
            results.append(clean(ocr_beta.classification(buf.getvalue())))
        except Exception:
            pass

    # 投票：优先选长度=4的，其次选出现次数最多的
    valid4 = [r for r in results if len(r) == 4]
    if valid4:
        from collections import Counter
        cnt = Counter(valid4)
        print(cnt.most_common(1)[0][0])
    else:
        print(results[0] if results else "")

except Exception as e:
    print(f"[ERROR] {e}", file=sys.stderr)
    sys.exit(1)
