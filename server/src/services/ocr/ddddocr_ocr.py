#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ddddocr 验证码识别脚本 - 供 Node.js 通过子进程调用
用法: python3 ddddocr_ocr.py <base64_image>
输出: 识别出的验证码文本（4字符，纯字母数字）
"""
import sys
import base64
import ddddocr

def main():
    if len(sys.argv) < 2:
        print("")
        return
    
    try:
        b64_data = sys.argv[1]
        # 去除 data:image/xxx;base64, 前缀
        if ',' in b64_data:
            b64_data = b64_data.split(',', 1)[1]
        
        img_bytes = base64.b64decode(b64_data)
        ocr = ddddocr.DdddOcr(det=False, ocr=True, show_ad=False)
        result = ocr.classification(img_bytes)
        
        # 清理结果：只保留字母数字，转大写，取前4位
        import re
        result = re.sub(r'[^0-9A-Za-z]', '', result).upper()
        if len(result) > 4:
            result = result[:4]
        
        print(result)
    except Exception as e:
        print("")
        sys.stderr.write(str(e) + "\n")

if __name__ == "__main__":
    main()
