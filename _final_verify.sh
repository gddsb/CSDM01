#!/bin/bash
TOKEN=$(curl -s http://43.138.218.55/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))")

echo "=== DB 真实数据验证 ==="
echo ""
echo "1. 执行记录总数 × trigger_mode（正确走 listRecords 分页）"
curl -s "http://43.138.218.55/api/basic/device-records?pageSize=1" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  total=', d.get('data',{}).get('total'))"

echo ""
echo "2. 按 trigger_mode 分别查 total"
for tm in daily weekly monthly; do
  TOTAL=$(curl -s "http://43.138.218.55/api/basic/device-records?trigger_mode=$tm&pageSize=1" -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total','?'))")
  echo "  trigger_mode=$tm: $TOTAL 条"
done

echo ""
echo "3. DMCS-SZN-021 (device_id=35) 详情 × trigger_mode"
for tm in daily weekly monthly; do
  TOTAL=$(curl -s "http://43.138.218.55/api/basic/device-records?device_id=35&trigger_mode=$tm&pageSize=1" -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total','?'))")
  echo "  DMCS-SZN-021 $tm: $TOTAL 条"
done
