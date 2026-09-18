/**
 * production.js —— 生产实时监控大屏（ES5 + Canvas 2D）
 *
 * 唯一入口：TVProduction.init(containerId)
 * 后续通过 TVProduction.refresh() 手动刷新，TVProduction.destroy() 清理。
 *
 * 数据来源：/auto/dashboard/production（由 TVConfig.API.PRODUCTION 指定）
 */
(function (global) {
    'use strict';

    var CONFIG = global.TV_CONFIG;
    var Utils = global.TVUtils;
    var Request = global.TVRequest;
    var Charts = global.TVCharts;

    /* ============ 状态常量 ============ */

    var LINE_RUNNING_KEYWORDS = ['运行中', '运行', '开工', '生产中'];
    var LINE_STATUS_MAP = {
        '0': '停用', '1': '运行', '2': '维护中', '3': '待机',
        '停用': '停用', '运行': '运行', '运行中': '运行中',
        '维护中': '维护中', '维修': '维修', '待机': '待机',
        '开工': '开工', '生产中': '生产中'
    };

    var ORDER_STATUS_MAP = {
        '0': '开立', '1': '下发', '2': '开工', '3': '完工',
        0: '开立', 1: '下发', 2: '开工', 3: '完工',
        '开立': '开立', '下发': '下发', '开工': '开工',
        '已开工': '开工', '完工': '完工', '已关闭': '完工',
        '已下达': '开工', '进行中': '开工'
    };

    /** 判断工单是否处于"开工/进行中"状态 */
    function isOrderRunning(status) {
        var s = status == null ? '' : String(status);
        return s === '0' || s === '2' || s === '开工' || s === '已开工'
            || s === '已下达' || s === '进行中' || s === '运行中';
    }

    /* ============ 日期辅助 ============ */

    /** 取今天或数据中的有效日期 yyyy-MM-dd */
    function getActiveDate(data) {
        if (data && data.activeDate) return data.activeDate;
        var today = new Date();
        return today.getFullYear() + '-' + Utils.pad(today.getMonth() + 1) + '-' + Utils.pad(today.getDate());
    }

    /** 从 workOrders 中按日期匹配 */
    function matchByDate(records, date) {
        if (!records || !records.length || !date) return [];
        var out = [];
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            var timeStr = r.report_time || r.start_time || r.createdAt || r.created_at || '';
            if (timeStr && String(timeStr).indexOf(date) === 0) out.push(r);
        }
        return out;
    }

    /* ============ 核心模块 ============ */

    var ProductionScreen = {
        containerId: null,
        container: null,

        // 图表实例引用
        chartTrend: null,      // 产线产出趋势折线
        chartDefectPie: null,   // 不良分布饼图
        chartProcessDefect: null,// 工序不良堆叠柱
        chartOrderProgress: null,// 工单进度水平柱

        // 定时器
        refreshTimer: null,
        clockTimer: null,
        idleTimer: null,

        // 状态
        lastActivity: 0,
        lastData: null,
        isLoading: false,
        isDestroyed: false,

        /* ============ 初始化 ============ */

        init: function (containerId) {
            this.containerId = containerId;
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('[TVProduction] container 不存在:', containerId);
                return;
            }

            // 先渲染骨架（带 loading 遮罩）
            this.container.innerHTML = this.buildSkeletonHTML();
            this.bindIdleEvents();
            this.startClock();
            this.initCharts();
            this.loadData();
            this.startAutoRefresh();
        },

        /* ============ HTML 骨架 ============ */

        buildSkeletonHTML: function () {
            return ''
                + '<div class="bs-root" id="bs-root">'
                + '  <div class="bs-header">'
                + '    <div class="bs-header-left">'
                + '      <div class="bs-header-time" id="bs-clock">--:--:--</div>'
                + '      <div class="bs-header-week" id="bs-weekday">--</div>'
                + '    </div>'
                + '    <div class="bs-env-bar" id="bs-env-bar">'
                + '      <span class="bs-env-item"><span class="bs-env-label" style="color:#00d4ff">温度</span><span class="bs-env-value" id="bs-env-temp">21.5°C</span></span>'
                + '      <span class="bs-env-item"><span class="bs-env-label" style="color:#3FB950">湿度</span><span class="bs-env-value" id="bs-env-hum">60.5%</span></span>'
                + '      <span class="bs-env-item"><span class="bs-env-label" style="color:#F0883E">压差</span><span class="bs-env-value" id="bs-env-pres">18.0Pa</span></span>'
                + '    </div>'
                + '    <div class="bs-header-title">生产实时监控中心</div>'
                + '    <div class="bs-header-right">'
                + '      <div class="bs-header-update-label">更新时间</div>'
                + '      <div class="bs-header-update-time" id="bs-update-time">--:--:--</div>'
                + '    </div>'
                + '  </div>'

                // KPI 行
                + '  <div class="bs-kpi-row" id="bs-kpi-row">'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" id="kpi-1">0<span class="bs-kpi-unit">个</span></div><div class="bs-kpi-label">开工工单</div></div></div>'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" style="color:#3FB950" id="kpi-2">0<span class="bs-kpi-unit">罐</span></div><div class="bs-kpi-label">今日开工</div></div></div>'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" style="color:#F0883E" id="kpi-3">0<span class="bs-kpi-unit">罐</span></div><div class="bs-kpi-label">今日投入</div></div></div>'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" style="color:#a78bfa" id="kpi-4">0<span class="bs-kpi-unit">罐</span></div><div class="bs-kpi-label">当前产出</div></div></div>'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" style="color:#3FB950" id="kpi-5">0.0<span class="bs-kpi-unit">%</span></div><div class="bs-kpi-label">良率</div></div></div>'
                + '    <div class="bs-kpi-card"><div class="bs-kpi-card-inner"><div class="bs-kpi-value bs-number-glow" style="color:#00d4ff" id="kpi-6">0<span class="bs-kpi-unit">条</span></div><div class="bs-kpi-label">运行产线</div></div></div>'
                + '  </div>'

                // 图表区
                + '  <div class="bs-chart-area">'

                // 第一行（左: 产线列表 / 中: 趋势折线 / 右: 不良饼图）
                + '    <div class="bs-chart-row" style="height:38%;">'
                + '      <div class="bs-chart-col" style="width:20.333%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">产线运行状态</div><div class="bs-panel-body" id="bs-line-list"></div></div>'
                + '      </div>'
                + '      <div class="bs-chart-col" style="width:47%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">产线产出趋势</div><div class="bs-panel-body"><div class="bs-canvas-wrap"><canvas id="bs-canvas-trend"></canvas></div></div></div>'
                + '      </div>'
                + '      <div class="bs-chart-col" style="width:26.333%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">不良分布分析</div><div class="bs-panel-body"><div class="bs-canvas-wrap"><canvas id="bs-canvas-defect-pie"></canvas></div></div></div>'
                + '      </div>'
                + '      <div class="bs-clear"></div>'
                + '    </div>'

                // 第二行（左: 工序不良柱 / 中: 工单进度水平柱 / 右: 订单概览）
                + '    <div class="bs-chart-row" style="height:58%;">'
                + '      <div class="bs-chart-col" style="width:31%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">各工序不良统计</div><div class="bs-panel-body"><div class="bs-canvas-wrap"><canvas id="bs-canvas-process-defect"></canvas></div></div></div>'
                + '      </div>'
                + '      <div class="bs-chart-col" style="width:31%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">生产工单实时进度</div><div class="bs-panel-body"><div class="bs-canvas-wrap"><canvas id="bs-canvas-order-progress"></canvas></div></div></div>'
                + '      </div>'
                + '      <div class="bs-chart-col" style="width:31%;">'
                + '        <div class="bs-panel"><div class="bs-panel-title">生产订单概览</div><div class="bs-panel-body" id="bs-order-list"></div></div>'
                + '      </div>'
                + '      <div class="bs-clear"></div>'
                + '    </div>'

                + '  </div>'

                // Loading 遮罩
                + '  <div class="bs-loading" id="bs-loading">'
                + '    <div class="text">数据加载中</div>'
                + '    <div style="margin-top:20px;"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>'
                + '    <div class="sub">正在连接 MES 服务器...</div>'
                + '  </div>'
                + '</div>';
        },

        /* ============ 图表初始化 ============ */

        initCharts: function () {
            this.chartTrend = new Charts.LineChart(document.getElementById('bs-canvas-trend'));
            this.chartDefectPie = new Charts.PieChart(document.getElementById('bs-canvas-defect-pie'));
            this.chartProcessDefect = new Charts.BarChart(document.getElementById('bs-canvas-process-defect'));
            this.chartOrderProgress = new Charts.BarChart(document.getElementById('bs-canvas-order-progress'));
        },

        /* ============ 时钟 ============ */

        startClock: function () {
            var self = this;
            if (this.clockTimer) clearInterval(this.clockTimer);
            this.clockTimer = setInterval(function () {
                var now = new Date();
                var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
                var el = document.getElementById('bs-clock');
                if (el) el.innerHTML = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
                var we = document.getElementById('bs-weekday');
                if (we) we.innerHTML = Utils.fmtWeekday(now);
            }, 1000);
        },

        /* ============ 空闲检测 ============ */

        bindIdleEvents: function () {
            var self = this;
            this.lastActivity = Date.now();
            var mark = function () {
                self.lastActivity = Date.now();
                var root = document.getElementById('bs-root');
                if (root && root.className.indexOf('idle') !== -1) root.className = 'bs-root';
            };
            var events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
            for (var i = 0; i < events.length; i++) {
                window.addEventListener(events[i], mark);
            }
            // 1s 检查一次
            this.idleTimer = setInterval(function () {
                var elapsed = Date.now() - self.lastActivity;
                var root = document.getElementById('bs-root');
                if (elapsed > CONFIG.IDLE_THRESHOLD && root && root.className.indexOf('idle') === -1) {
                    root.className = 'bs-root idle';
                } else if (elapsed <= CONFIG.IDLE_THRESHOLD && root && root.className.indexOf('idle') !== -1) {
                    root.className = 'bs-root';
                }
            }, 1000);
        },

        /* ============ 自动刷新 ============ */

        startAutoRefresh: function () {
            var self = this;
            if (this.refreshTimer) clearInterval(this.refreshTimer);
            this.refreshTimer = setInterval(function () {
                self.loadData();
            }, CONFIG.REFRESH_INTERVAL);
        },

        /* ============ 数据加载 ============ */

        loadData: function () {
            if (this.isLoading || this.isDestroyed) return;
            this.isLoading = true;
            var self = this;

            Request.get(CONFIG.API.PRODUCTION, { timeout: 10000 }, function (err, data) {
                self.isLoading = false;
                if (self.isDestroyed) return;

                if (err) {
                    console.warn('[TVProduction] 数据加载失败:', err.message);
                    // 有上次数据就用上次，没有就显示错误
                    if (self.lastData) {
                        self.renderAll(self.lastData);
                        self.showToastMessage('网络异常，显示上次数据');
                    } else {
                        self.showError(err.message);
                    }
                    return;
                }

                self.lastData = data;
                self.hideLoading();
                self.renderAll(data);
            });
        },

        /* ============ 渲染全部 ============ */

        renderAll: function (data) {
            if (!data) return;
            var activeDate = getActiveDate(data);
            var now = new Date();

            // 更新时间
            var qt = data.queryTime;
            var elUpdate = document.getElementById('bs-update-time');
            if (elUpdate) {
                if (qt) {
                    var str = String(qt);
                    if (str.indexOf('T') > 0) str = str.split('T')[1];
                    elUpdate.innerHTML = str.length > 8 ? str.slice(0, 8) : str;
                } else {
                    elUpdate.innerHTML = Utils.fmtClock(now);
                }
            }

            // KPI
            this.renderKPIs(data, activeDate);
            // 列表：产线 + 订单
            this.renderLineList(data);
            this.renderOrderList(data, activeDate);
            // 图表
            this.renderTrendChart(data);
            this.renderDefectPie(data, activeDate);
            this.renderProcessDefect(data);
            this.renderOrderProgress(data, activeDate);
        },

        /* ============ KPI 渲染 ============ */

        renderKPIs: function (data, activeDate) {
            var workOrders = data.workOrders || [];
            var processReports = data.processReports || [];

            // 开工工单数
            var runningWO = [];
            for (var i = 0; i < workOrders.length; i++) {
                if (isOrderRunning(workOrders[i].status)) runningWO.push(workOrders[i]);
            }

            // 今日开工工单
            var todayStartWO = [];
            for (var i = 0; i < workOrders.length; i++) {
                var t = workOrders[i].report_time || workOrders[i].reportTime || workOrders[i].createdAt || '';
                if (t && String(t).indexOf(activeDate) === 0) todayStartWO.push(workOrders[i]);
            }

            // 今日投入 = 今日开工工单 report_qty 和
            var todayStartQty = 0;
            for (var i = 0; i < todayStartWO.length; i++) {
                todayStartQty += Number(todayStartWO[i].report_qty || todayStartWO[i].target_qty || 0);
            }

            // 当前产出 = 开工工单匹配的 processReports output_qty 和
            var currentOutput = 0;
            var runningWOIds = [];
            for (var i = 0; i < runningWO.length; i++) {
                runningWOIds.push(runningWO[i].report_order_id || runningWO[i].work_order_id || runningWO[i].report_no);
            }
            for (var i = 0; i < processReports.length; i++) {
                var r = processReports[i];
                var match = false;
                for (var j = 0; j < runningWOIds.length; j++) {
                    if (runningWOIds[j] && (r.report_order_id === runningWOIds[j] || r.work_order_id === runningWOIds[j])) {
                        match = true; break;
                    }
                }
                if (match) currentOutput += Number(r.output_qty || 0);
            }

            // 今日总产出 + 不良
            var todayProcessReports = matchByDate(processReports, activeDate);
            var totalOutput = 0;
            var totalDefect = 0;
            for (var i = 0; i < todayProcessReports.length; i++) {
                var r2 = todayProcessReports[i];
                totalOutput += Number(r2.output_qty || 0);
                totalDefect += Number(r2.defect_material || 0) + Number(r2.defect_process || 0) + Number(r2.defect_scrap || 0);
            }

            // 良率
            var yieldRate = todayStartQty > 0 ? ((todayStartQty - totalDefect) / todayStartQty * 100).toFixed(1) : '0.0';

            // 运行产线数
            var productionLines = data.productionLines || [];
            var runningLines = 0;
            for (var i = 0; i < productionLines.length; i++) {
                var ls = LINE_STATUS_MAP[String(productionLines[i].status || '')] || String(productionLines[i].status || '');
                if (LINE_RUNNING_KEYWORDS.indexOf(ls) !== -1) runningLines++;
            }

            // 写 DOM
            this.setKpi('kpi-1', Utils.fmtNumber(runningWO.length), '个', '#00d4ff');
            this.setKpi('kpi-2', Utils.fmtNumber(todayStartQty), '罐', '#3FB950');
            this.setKpi('kpi-3', Utils.fmtNumber(todayStartQty), '罐', '#F0883E');
            this.setKpi('kpi-4', Utils.fmtNumber(currentOutput), '罐', '#a78bfa');
            this.setKpi('kpi-5', yieldRate, '%', '#3FB950');
            this.setKpi('kpi-6', String(runningLines), '条', '#00d4ff');
        },

        setKpi: function (id, value, unit, color) {
            var el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = value + '<span class="bs-kpi-unit">' + unit + '</span>';
            if (color) el.style.color = color;
        },

        /* ============ 产线列表 ============ */

        renderLineList: function (data) {
            var lines = data.productionLines || [];
            var container = document.getElementById('bs-line-list');
            if (!container) return;

            if (!lines.length) {
                container.innerHTML = '<div class="bs-error"><div class="title">暂无产线数据</div></div>';
                return;
            }

            var html = '';
            for (var i = 0; i < lines.length; i++) {
                var l = lines[i];
                var statusText = LINE_STATUS_MAP[String(l.status || '')] || String(l.status || '-');
                var isRun = LINE_RUNNING_KEYWORDS.indexOf(statusText) !== -1;
                var isMaintain = statusText === '维护中' || statusText === '维修' || statusText === '待机';
                var dotClass = isRun ? 'run' : (isMaintain ? 'maintain' : (statusText === '停用' ? 'stop' : 'fault'));

                html += '<div class="bs-list-item" style="border-left-color:'
                    + (isRun ? '#3FB950' : isMaintain ? '#D29922' : (statusText === '停用' ? '#8B949E' : '#F85149'))
                    + ';">'
                    + '<span class="bs-dot ' + dotClass + '"></span>'
                    + '<span class="title">' + (l.line_name || '') + ' ' + (l.workshop || '') + '</span>'
                    + '<span class="sub">状态：'
                    + '<span class="bs-tag '
                    + (isRun ? 'bs-tag-success' : isMaintain ? 'bs-tag-warn' : statusText === '停用' ? 'bs-tag-default' : 'bs-tag-danger')
                    + '">' + statusText + '</span>'
                    + '</span>'
                    + '</div>';
            }
            container.innerHTML = html;
        },

        /* ============ 订单列表 ============ */

        renderOrderList: function (data, activeDate) {
            var orders = data.orders || [];
            var workOrders = data.workOrders || [];
            var container = document.getElementById('bs-order-list');
            if (!container) return;

            if (!orders.length) {
                container.innerHTML = '<div class="bs-error"><div class="title">暂无订单数据</div></div>';
                return;
            }

            // 过滤：今日下发/开工/完工的
            var filtered = [];
            for (var i = 0; i < orders.length; i++) {
                var o = orders[i];
                var releasedToday = o.release_time && String(o.release_time).indexOf(activeDate) === 0
                    && (o.status === '下发' || o.status === 1);
                var startedToday = false;
                for (var j = 0; j < workOrders.length; j++) {
                    if (workOrders[j].order_id === o.order_id) {
                        var t = workOrders[j].report_time || workOrders[j].createdAt || '';
                        if (t && String(t).indexOf(activeDate) === 0) { startedToday = true; break; }
                    }
                }
                var finishedToday = false;
                for (var j = 0; j < workOrders.length; j++) {
                    if (workOrders[j].order_id === o.order_id && workOrders[j].finish_time
                        && String(workOrders[j].finish_time).indexOf(activeDate) === 0) {
                        finishedToday = true; break;
                    }
                }
                if (releasedToday || startedToday || finishedToday) filtered.push(o);
            }

            // 按状态排序
            filtered.sort(function (a, b) {
                var sa = a.status == null ? 99 : String(a.status);
                var sb = b.status == null ? 99 : String(b.status);
                var order = { '下发': 1, '开工': 1, '已开工': 1, '已下达': 1, '进行中': 1,
                    '开立': 2, 0: 2, 1: 1, 2: 1, '完工': 3, 3: 3 };
                var oa = order[sa] || 99, ob = order[sb] || 99;
                if (oa !== ob) return oa - ob;
                return (a.order_no || '').localeCompare(b.order_no || '');
            });

            if (!filtered.length) filtered = orders.slice(0, 8);

            var html = '';
            for (var i = 0; i < filtered.length; i++) {
                var o = filtered[i];
                var st = ORDER_STATUS_MAP[o.status] || String(o.status || '-');
                var qty = Number(o.planned_qty || o.order_qty || o.target_qty || 0);
                var tagCls = (st === '下发' || st === '开工' || st === '已开工' || st === '已下达' || st === '进行中') ? 'bs-tag-info'
                    : (st === '完工' || st === '已关闭') ? 'bs-tag-success'
                    : 'bs-tag-default';

                html += '<div class="bs-order-row">'
                    + '<div class="row-top">'
                    + '<span class="order-no">' + (o.order_no || '') + '</span>'
                    + '<span class="order-status"><span class="bs-tag ' + tagCls + '">' + st + '</span></span>'
                    + '</div>'
                    + '<div class="row-sub">'
                    + (o.material_name || '-') + ' · ' + (qty > 0 ? Utils.fmtNumber(qty) + '件' : '-')
                    + '</div>'
                    + '</div>';
            }
            container.innerHTML = html;
        },

        /* ============ 趋势折线图 ============ */

        renderTrendChart: function (data) {
            var dailyTrend = data.dailyTrend || [];
            var dailyEnergy = data.dailyEnergy || [];

            if (!dailyTrend.length) {
                this.chartTrend.setOption({ xData: ['暂无数据'], series: [] });
                return;
            }

            // 产线名（取 dailyTrend[0] 的所有非 date key）
            var lineNames = [];
            var firstItem = dailyTrend[0];
            if (firstItem) {
                for (var k in firstItem) {
                    if (firstItem.hasOwnProperty(k) && k !== 'date') lineNames.push(k);
                }
            }
            if (!lineNames.length && (data.productionLines || []).length) {
                for (var i = 0; i < data.productionLines.length; i++) {
                    lineNames.push(data.productionLines[i].line_name || ('产线' + (i + 1)));
                }
            }

            var xData = [];
            for (var i = 0; i < dailyTrend.length; i++) {
                var d = dailyTrend[i].date || '';
                xData.push(d.length >= 10 ? d.slice(5) : d); // MM-DD
            }

            var palette = CONFIG.PALETTE;
            var series = [];
            for (var li = 0; li < lineNames.length; li++) {
                var name = lineNames[li];
                var sData = [];
                for (var di = 0; di < dailyTrend.length; di++) {
                    sData.push(Number(dailyTrend[di][name]) || 0);
                }
                series.push({
                    name: name,
                    data: sData,
                    color: palette[li % palette.length],
                    showArea: true
                });
            }

            // 能源双 Y 轴
            var energyData = [];
            var hasEnergy = false;
            for (var di2 = 0; di2 < dailyEnergy.length; di2++) {
                energyData.push(Number(dailyEnergy[di2].energy_kwh) || 0);
                if (dailyEnergy[di2].energy_kwh > 0) hasEnergy = true;
            }
            if (hasEnergy) {
                series.push({
                    name: '能源(kWh)',
                    data: energyData,
                    color: '#faad14',
                    useY2: true,
                    showArea: false
                });
            }

            this.chartTrend.setOption({
                xData: xData,
                yLabel: '产出(件)',
                yLabel2: hasEnergy ? '能源(kWh)' : null,
                series: series
            });
        },

        /* ============ 不良分布饼图 ============ */

        renderDefectPie: function (data, activeDate) {
            var processReports = data.processReports || [];
            var todayReports = matchByDate(processReports, activeDate);

            var material = 0, process = 0, scrap = 0;
            for (var i = 0; i < todayReports.length; i++) {
                var r = todayReports[i];
                material += Number(r.defect_material || 0);
                process += Number(r.defect_process || 0);
                scrap += Number(r.defect_scrap || 0);
            }

            if (material === 0 && process === 0 && scrap === 0) {
                // 没数据时显示占位饼
                this.chartDefectPie.setOption({
                    data: [{ name: '暂无数据', value: 1, color: '#30363d' }],
                    centerSubText: '不良总数(件)'
                });
                return;
            }

            var pieData = [
                { name: '来料不良', value: material, color: '#ffd93d' },
                { name: '制程不良', value: process, color: '#ff6b6b' },
                { name: '检验报废', value: scrap, color: '#a78bfa' }
            ];
            this.chartDefectPie.setOption({
                data: pieData,
                centerSubText: '不良总数(件)'
            });
        },

        /* ============ 工序不良堆叠柱 ============ */

        renderProcessDefect: function (data) {
            var list = data.processDefectList || [];

            if (!list.length) {
                this.chartProcessDefect.setOption({
                    xData: ['暂无不良记录'],
                    series: [
                        { name: '来料不良', data: [0], color: '#ffd93d', stack: 'defect' },
                        { name: '制程不良', data: [0], color: '#ff6b6b', stack: 'defect' },
                        { name: '检验报废', data: [0], color: '#a78bfa', stack: 'defect' }
                    ]
                });
                return;
            }

            var names = [];
            var materialData = [], processData = [], scrapData = [];
            for (var i = 0; i < list.length; i++) {
                names.push(list[i].name || ('工序' + (i + 1)));
                materialData.push(Number(list[i].material) || 0);
                processData.push(Number(list[i].process) || 0);
                scrapData.push(Number(list[i].scrap) || 0);
            }

            this.chartProcessDefect.setOption({
                xData: names,
                yLabel: '不良(件)',
                series: [
                    { name: '来料不良', data: materialData, color: '#ffd93d', stack: 'defect' },
                    { name: '制程不良', data: processData, color: '#ff6b6b', stack: 'defect' },
                    { name: '检验报废', data: scrapData, color: '#a78bfa', stack: 'defect' }
                ]
            });
        },

        /* ============ 工单进度水平柱 ============ */

        renderOrderProgress: function (data, activeDate) {
            var workOrders = data.workOrders || [];
            var processReports = data.processReports || [];

            // 过滤：非完工状态的工单
            var activeWO = [];
            for (var i = 0; i < workOrders.length; i++) {
                var wo = workOrders[i];
                var s = wo.status;
                if (s === '完工' || s === 3) continue;
                activeWO.push(wo);
            }

            if (!activeWO.length) {
                this.chartOrderProgress.setOption({
                    horizontal: true,
                    xData: ['暂无进行中工单'],
                    showPercent: true,
                    series: [
                        { name: '目标数量', data: [1], color: 'rgba(167,139,250,0.5)' },
                        { name: '完工数量', data: [1], color: '#00ff88' }
                    ]
                });
                return;
            }

            // 每个工单：目标数量 / 已完工 / 百分比
            var labels = [];
            var targets = [];
            var completeds = [];
            for (var i = 0; i < activeWO.length; i++) {
                var wo2 = activeWO[i];
                var label = (wo2.report_no || wo2.work_order_no || '') + ' · ' + (wo2.line_name || '');
                labels.push(label.length > 14 ? label.slice(0, 14) + '..' : label);

                var target = Number(wo2.report_qty || wo2.target_qty || wo2.planned_qty || 0);
                targets.push(target);

                var done = 0;
                var rid = wo2.report_order_id || wo2.report_no || wo2.work_order_id;
                for (var j = 0; j < processReports.length; j++) {
                    var r = processReports[j];
                    if (r.report_order_id === rid || r.work_order_id === rid || r.report_order_id === wo2.order_id) {
                        done += Number(r.output_qty || 0);
                    }
                }
                completeds.push(done);
            }

            this.chartOrderProgress.setOption({
                horizontal: true,
                xData: labels,
                showPercent: true,
                series: [
                    { name: '目标数量', data: targets, color: 'rgba(167,139,250,0.5)' },
                    { name: '完工数量', data: completeds, color: '#00ff88' }
                ]
            });
        },

        /* ============ 显示/隐藏 ============ */

        hideLoading: function () {
            var mask = document.getElementById('bs-loading');
            if (mask) mask.style.display = 'none';
        },

        showError: function (msg) {
            var container = this.container;
            if (!container) return;
            container.innerHTML = ''
                + '<div class="bs-root">'
                + '  <div class="bs-error">'
                + '    <div class="title">数据加载失败</div>'
                + '    <div class="sub">' + (msg || '未知错误') + '</div>'
                + '    <div class="sub">请检查网络或 MES 服务器状态</div>'
                + '  </div>'
                + '</div>';
        },

        showToastMessage: function (msg) {
            // 简易提示：控制台 + 底部
            console.warn('[TVProduction]', msg);
        },

        /* ============ 销毁 ============ */

        destroy: function () {
            this.isDestroyed = true;
            if (this.clockTimer) clearInterval(this.clockTimer);
            if (this.refreshTimer) clearInterval(this.refreshTimer);
            if (this.idleTimer) clearInterval(this.idleTimer);
            if (this.chartTrend) this.chartTrend.destroy();
            if (this.chartDefectPie) this.chartDefectPie.destroy();
            if (this.chartProcessDefect) this.chartProcessDefect.destroy();
            if (this.chartOrderProgress) this.chartOrderProgress.destroy();
            this.container = null;
        }
    };

    global.TVProduction = {
        init: function (id) { ProductionScreen.init(id); },
        destroy: function () { ProductionScreen.destroy(); }
    };
})(window);
