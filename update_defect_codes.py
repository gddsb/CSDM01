import json
import subprocess

with open('/opt/milk-can-mes/server/src/seed-data/DefectType.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

db_host = 'localhost'
db_user = 'root'
db_pass = '123456'
db_name = 'milk_can_mes'

success = 0
fail = 0
for item in data:
    defect_id = item['defect_id']
    new_code = item['defect_code']
    defect_type = item.get('defect_type', '')
    sql = f"UPDATE master_defect_type SET defect_code='{new_code}', defect_type='{defect_type}' WHERE defect_id={defect_id};"
    cmd = ['sudo', 'mysql', '-u', db_user, '-D', db_name, '-e', sql]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f'OK {defect_id}: {new_code}')
        success += 1
    else:
        print(f'FAIL {defect_id}: {result.stderr.strip()[:50]}')
        fail += 1

print(f'\n更新完成: 成功 {success} 条, 失败 {fail} 条')