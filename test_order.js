const { parseOrderStatusParam, buildOrderWhere } = require('./dist/services/OrderService.js');

console.log('=== parseOrderStatusParam 测试 ===');
console.log('输入 "下发"      =>', parseOrderStatusParam('下发'));
console.log('输入 ["下发"]    =>', parseOrderStatusParam(['下发']));
console.log('输入 "0"         =>', parseOrderStatusParam('0'));
console.log('输入 0 (falsy)   =>', parseOrderStatusParam(0));
console.log('输入 "下发,开工" =>', parseOrderStatusParam('下发,开工'));
console.log('输入 "" (空)     =>', parseOrderStatusParam(''));
console.log('输入 undefined   =>', parseOrderStatusParam(undefined));

console.log('');
console.log('=== buildOrderWhere 测试 ===');
console.log('status="下发" =>', JSON.stringify(buildOrderWhere({ status: '下发', page: 1, pageSize: 10 })));
console.log('status="开立" =>', JSON.stringify(buildOrderWhere({ status: '开立', page: 1, pageSize: 10 })));
console.log('status="0"    =>', JSON.stringify(buildOrderWhere({ status: '0', page: 1, pageSize: 10 })));
