#!/usr/bin/env python3
"""
批量导入扫描建议的权限项到 sys_permission

策略:
  1. 读取 scripts/scan-report.json
  2. 匹配顶级菜单(parent_id=0)的 perm_code 作为 module -> parent 映射
  3. perm_code 已存在 -> 更新 perm_type / perm_name / group_name / parent_id
  4. perm_code 不存在 -> 插入新记录
  5. Dashboard.tsx / Login.tsx 等无对应顶级菜单的跳过

用法:
  python3 scripts/import_scanned_permissions.py            # 实际执行
  python3 scripts/import_scanned_permissions.py --dry-run  # 预览
"""
import json
import sys
from pathlib import Path

import pymysql

REPORT_PATH = Path(__file__).resolve().parent.parent / "scripts" / "scan-report.json"

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "123456",
    "database": "milk_can_mes",
    "charset": "utf8mb4",
}


def main():
    dry_run = "--dry-run" in sys.argv

    if not REPORT_PATH.exists():
        print(f"扫描报告不存在: {REPORT_PATH}")
        print("请先运行: npx tsx scripts/scan-controls.ts --out scripts/scan-report.json")
        sys.exit(1)

    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        report = json.load(f)

    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()

    # 1. 加载顶级菜单映射 module -> (perm_id, group_name)
    cur.execute(
        "SELECT perm_id, perm_code, group_name FROM sys_permission WHERE parent_id = 0 AND type = 'menu'"
    )
    module_map = {}
    for perm_id, perm_code, group_name in cur.fetchall():
        module_map[perm_code] = (perm_id, group_name or perm_code)
    print(f"顶级菜单: {len(module_map)} 个")
    print(f"可匹配模块: {', '.join(sorted(module_map.keys()))}")

    # 2. 收集建议权限项（按 perm_code 去重，保留首次出现）
    all_perms = []
    seen_codes = set()
    skipped = 0
    for item in report["items"]:
        module = item["module"]
        if module not in module_map:
            skipped += len(item["suggestedPermissions"])
            continue
        for p in item["suggestedPermissions"]:
            if p["perm_code"] in seen_codes:
                continue
            seen_codes.add(p["perm_code"])
            all_perms.append({**p, "module": module})
    print(f"待处理权限项: {len(all_perms)}（跳过 {skipped} 个无主模块）")

    # 3. 查询已存在的 perm_code
    if all_perms:
        codes = [p["perm_code"] for p in all_perms]
        placeholders = ",".join(["%s"] * len(codes))
        cur.execute(
            f"SELECT perm_id, perm_code, perm_type FROM sys_permission WHERE perm_code IN ({placeholders})",
            codes,
        )
        existing = {row[1]: row[0] for row in cur.fetchall()}
    else:
        existing = {}

    inserted = 0
    updated = 0

    try:
        for p in all_perms:
            parent_id, group_name = module_map[p["module"]]
            perm_code = p["perm_code"]
            perm_name = p["perm_name"]
            perm_type = p["perm_type"]

            if perm_code in existing:
                if not dry_run:
                    cur.execute(
                        "UPDATE sys_permission SET perm_type=%s, perm_name=%s, group_name=%s, parent_id=%s WHERE perm_id=%s",
                        (perm_type, perm_name, group_name, parent_id, existing[perm_code]),
                    )
                updated += 1
            else:
                if not dry_run:
                    cur.execute(
                        """INSERT INTO sys_permission
                           (perm_code, perm_name, type, perm_type, parent_id, group_name, sort_order, status, visible, is_abandon, created_at)
                           VALUES (%s, %s, 'button', %s, %s, %s, 0, 1, 1, 0, NOW())""",
                        (perm_code, perm_name, perm_type, parent_id, group_name),
                    )
                inserted += 1

        if dry_run:
            conn.rollback()
            print(f"\n[DRY RUN] 将插入 {inserted} 条，更新 {updated} 条")
        else:
            conn.commit()
            print(f"\n完成: 插入 {inserted} 条，更新 {updated} 条")
    except Exception as e:
        conn.rollback()
        print(f"\n事务回滚: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
