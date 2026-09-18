/**
 * utils.js —— 通用工具函数（ES5 兼容）
 */
(function (global) {
    'use strict';

    /** 数字补零 */
    function pad(n) {
        return (n < 10) ? ('0' + n) : ('' + n);
    }

    /** 格式化日期：2026-09-18 */
    function fmtDate(d) {
        if (!d) return '--';
        var dt = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dt.getTime())) return '--';
        return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    }

    /** 格式化时间：14:32:05 */
    function fmtClock(d) {
        if (!d) return '--:--:--';
        var dt = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dt.getTime())) return '--:--:--';
        return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    }

    /** 格式化完整：2026-09-18 14:32:05 */
    function fmtDateTime(d) {
        return fmtDate(d) + ' ' + fmtClock(d);
    }

    /** 星期几 */
    var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    function fmtWeekday(d) {
        var dt = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dt.getTime())) return '--';
        return WEEKDAYS[dt.getDay()] || '--';
    }

    /** 数字加千分位 */
    function fmtNumber(n) {
        if (n == null || isNaN(Number(n))) return '--';
        var v = Number(n);
        if (Math.abs(v) < 1000) {
            return (v % 1 === 0) ? String(v) : v.toFixed(1);
        }
        var s = Math.round(v).toString();
        var neg = (s.charAt(0) === '-');
        if (neg) s = s.slice(1);
        var out = '';
        var len = s.length;
        for (var i = 0; i < len; i++) {
            var pos = len - i;
            out = s.charAt(len - 1 - i) + out;
            if (pos > 1 && pos % 3 === 1) out = ',' + out;
        }
        return (neg ? '-' : '') + out;
    }

    /** 取数组内数字的最大/最小/和 */
    function arrMax(arr) {
        if (!arr || !arr.length) return 0;
        var m = -Infinity;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] > m) m = arr[i];
        }
        return isFinite(m) ? m : 0;
    }
    function arrMin(arr) {
        if (!arr || !arr.length) return 0;
        var m = Infinity;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] < m) m = arr[i];
        }
        return isFinite(m) ? m : 0;
    }
    function arrSum(arr) {
        if (!arr || !arr.length) return 0;
        var s = 0;
        for (var i = 0; i < arr.length; i++) s += Number(arr[i]) || 0;
        return s;
    }

    /** 节流：让 fn 最多每隔 wait 毫秒执行一次 */
    function throttle(fn, wait) {
        var last = 0;
        var timer = null;
        return function () {
            var now = Date.now();
            var ctx = this;
            var args = arguments;
            var remain = wait - (now - last);
            if (remain <= 0) {
                if (timer) { clearTimeout(timer); timer = null; }
                last = now;
                fn.apply(ctx, args);
            } else if (!timer) {
                timer = setTimeout(function () {
                    last = Date.now();
                    timer = null;
                    fn.apply(ctx, args);
                }, remain);
            }
        };
    }

    /** 简单深拷贝（仅处理普通对象/数组/基本类型） */
    function clone(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        var out = Array.isArray(obj) ? [] : {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                out[k] = clone(obj[k]);
            }
        }
        return out;
    }

    /** 从对象数组中按 key 取值 */
    function pluck(arr, key) {
        if (!arr || !arr.length) return [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            out.push(arr[i] != null ? arr[i][key] : undefined);
        }
        return out;
    }

    /** 是否有有效数据 */
    function hasData(v) {
        return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }

    global.TVUtils = {
        pad: pad,
        fmtDate: fmtDate,
        fmtClock: fmtClock,
        fmtDateTime: fmtDateTime,
        fmtWeekday: fmtWeekday,
        fmtNumber: fmtNumber,
        arrMax: arrMax,
        arrMin: arrMin,
        arrSum: arrSum,
        throttle: throttle,
        clone: clone,
        pluck: pluck,
        hasData: hasData
    };
})(window);
