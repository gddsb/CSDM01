/**
 * request.js —— 兼容 Android 4.2.1 (Chrome 28) 的 HTTP 请求封装
 *
 * 只走 XMLHttpRequest，不使用 fetch/Promise，纯回调风格。
 * 调用示例：
 *   TVRequest.get('/auto/dashboard/production', { timeout: 8000 }, function(err, data) { ... });
 *   TVRequest.post('/auth/login', { username: 'xx' }, function(err, data) { ... });
 */
(function (global) {
    'use strict';

    var DEFAULT_TIMEOUT = 10000;
    var BASE = (global.TV_CONFIG && global.TV_CONFIG.API_BASE) ? global.TV_CONFIG.API_BASE : '';

    /**
     * 内部核心：发起一次请求
     * @param {string} method  'GET' | 'POST'
     * @param {string} path    接口路径（自动拼接 BASE，也支持完整 URL）
     * @param {object} body    POST 请求体（自动序列化为 JSON）
     * @param {object} opts    { timeout: number }
     * @param {function} cb    callback(err, data) —— 成功时 err=null，data 为解析后的 JSON
     */
    function doRequest(method, path, body, opts, cb) {
        // 参数归一化
        if (typeof opts === 'function') { cb = opts; opts = {}; }
        opts = opts || {};
        cb = cb || function () {};

        var url = (path.indexOf('http') === 0) ? path : (BASE + path);
        var timeout = opts.timeout || DEFAULT_TIMEOUT;

        var xhr = new XMLHttpRequest();
        var timer = null;
        var called = false; // 防止超时/错误/成功多次触发 callback

        function done(err, data) {
            if (called) return;
            called = true;
            if (timer) { clearTimeout(timer); timer = null; }
            cb(err, data);
        }

        xhr.open(method, url, true);

        // 超时定时器
        timer = setTimeout(function () {
            try { xhr.abort(); } catch (e) {}
            done(new Error('请求超时: ' + url));
        }, timeout);

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            if (timer) { clearTimeout(timer); timer = null; }

            if (xhr.status < 200 || xhr.status >= 300) {
                done(new Error('HTTP ' + xhr.status + ' ' + xhr.statusText));
                return;
            }

            // 解析 JSON
            var raw = xhr.responseText;
            var data;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                // 不是合法 JSON 也不算完全失败，把原始文本返回
                data = raw;
            }

            // MES 后端统一返回 { success, code, data }
            if (data && typeof data === 'object' && 'success' in data) {
                if (data.success === false) {
                    done(new Error(data.message || '业务失败'), data);
                    return;
                }
                done(null, data.data != null ? data.data : data);
                return;
            }

            done(null, data);
        };

        // 错误事件（网络断开）
        xhr.onerror = function () {
            done(new Error('网络错误: ' + url));
        };

        // 发送
        if (method === 'POST' && body) {
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
            xhr.send(JSON.stringify(body));
        } else {
            xhr.send(null);
        }
    }

    global.TVRequest = {
        get: function (path, opts, cb) { doRequest('GET', path, null, opts, cb); },
        post: function (path, body, cb) { doRequest('POST', path, body || {}, null, cb); },
        _reconfigure: function (base) { BASE = base; }
    };
})(window);
