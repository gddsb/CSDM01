/**
 * canvas-charts.js —— 手写 Canvas 图表库（ES5 + Canvas 2D，兼容 Chrome 28）
 *
 * 提供四个图表类：
 *   TVCharts.LineChart(canvas)   折线图（多曲线 + 面积渐变 + 双 Y 轴）
 *   TVCharts.BarChart(canvas)    柱状图（堆叠/对比/水平）
 *   TVCharts.PieChart(canvas)    饼图（环形 + 中心数字）
 *   TVCharts.GaugeChart(canvas)  仪表盘（弧形 KPI）
 *
 * 使用模式（与 ECharts 风格一致）：
 *   var chart = new TVCharts.LineChart(document.getElementById('canvasId'));
 *   chart.setOption({ title: '...', xData: [...], series: [...] });
 *   // 窗口 resize 后调用 chart.resize();
 */
(function (global) {
    'use strict';

    var PALETTE = (global.TV_CONFIG && global.TV_CONFIG.PALETTE)
        ? global.TV_CONFIG.PALETTE
        : ['#00d4ff', '#00ff88', '#a78bfa', '#ffd93d', '#ff6b6b', '#F0883E'];

    var DPR = (global.TV_CONFIG && global.TV_CONFIG.DPR) ? global.TV_CONFIG.DPR : 1;

    var BG = (global.TV_CONFIG && global.TV_CONFIG.BG_COLOR) ? global.TV_CONFIG.BG_COLOR : '#0a0e1a';

    var TEXT_PRIMARY = '#E6EDF3';
    var TEXT_MUTED = '#8B949E';
    var ACCENT = '#00d4ff';

    /** 公共：canvas 尺寸初始化 */
    function setupCanvas(canvas) {
        var w = canvas.clientWidth || 300;
        var h = canvas.clientHeight || 150;
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        var ctx = canvas.getContext('2d');
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        return { w: w, h: h, ctx: ctx };
    }

    /** 公共：空数据占位 */
    function drawEmpty(ctx, w, h, text) {
        var msg = text || '暂无数据';
        ctx.fillStyle = TEXT_MUTED;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, w / 2, h / 2);
    }

    /** 公共：渐变色生成 —— Chrome 28 支持 createLinearGradient */
    function areaGradient(ctx, x0, y0, x1, y1, color) {
        var grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, color + '66');
        grad.addColorStop(1, color + '00');
        return grad;
    }

    /** 公共：判断数组是否全为零 */
    function allZero(arr) {
        if (!arr || !arr.length) return true;
        for (var i = 0; i < arr.length; i++) {
            if (Number(arr[i]) !== 0) return false;
        }
        return true;
    }

    /* =========================================================
     * LineChart —— 折线图（多曲线 + 面积渐变）
     * option: { title, xData: [], yLabel, yLabel2, series: [{name, data, color, useY2}] }
     * ========================================================= */
    function LineChart(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opt = {};
        this._raf = null;
        this._resizeHandler = null;
    }
    LineChart.prototype.setOption = function (opt) {
        this.opt = opt || {};
        this.resize();
    };
    LineChart.prototype.resize = function () {
        var canvas = this.canvas;
        var self = this;
        this._raf = null;
        this._resizeHandler = function () { self.render(); };
        window.removeEventListener('resize', this._resizeHandler);
        this.render();
        window.addEventListener('resize', this._resizeHandler);
    };
    LineChart.prototype.destroy = function () {
        window.removeEventListener('resize', this._resizeHandler);
    };
    LineChart.prototype.render = function () {
        var canvas = this.canvas;
        var opt = this.opt;
        var info = setupCanvas(canvas);
        var ctx = info.ctx;
        var W = info.w, H = info.h;

        // 背景
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        var series = opt.series || [];
        var xData = opt.xData || [];

        if (!xData.length || !series.length) {
            drawEmpty(ctx, W, H);
            return;
        }

        // 边距
        var ml = 48, mr = opt.yLabel2 ? 56 : 20, mt = 32, mb = 36;
        var cw = W - ml - mr, ch = H - mt - mb;

        // Y 轴范围（区分 y1 和 y2）
        var y1Max = 0, y1Min = Infinity;
        var y2Max = 0;
        for (var i = 0; i < series.length; i++) {
            var s = series[i];
            var arr = s.data || [];
            for (var j = 0; j < arr.length; j++) {
                var v = Number(arr[j]) || 0;
                if (s.useY2) {
                    if (v > y2Max) y2Max = v;
                } else {
                    if (v > y1Max) y1Max = v;
                    if (v < y1Min) y1Min = v;
                }
            }
        }
        if (y1Min === Infinity) y1Min = 0;
        if (y1Max <= 0) y1Max = 10;
        if (y2Max <= 0) y2Max = 10;

        // Y 轴网格线
        ctx.strokeStyle = 'rgba(0,212,255,0.08)';
        ctx.lineWidth = 1;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = TEXT_MUTED;

        var gridCount = 5;
        for (var g = 0; g <= gridCount; g++) {
            var gy = mt + ch * (1 - g / gridCount);
            ctx.beginPath();
            ctx.moveTo(ml, gy);
            ctx.lineTo(ml + cw, gy);
            ctx.stroke();
            // Y1 标签
            var yv1 = (y1Max - y1Min) * (g / gridCount) + y1Min;
            ctx.fillText(String(Math.round(yv1)), ml - 6, gy);
            // Y2 标签（右侧）
            if (opt.yLabel2) {
                ctx.textAlign = 'left';
                var yv2 = y2Max * (g / gridCount);
                ctx.fillStyle = '#faad14';
                ctx.fillText(String(Math.round(yv2)), ml + cw + 6, gy);
                ctx.textAlign = 'right';
                ctx.fillStyle = TEXT_MUTED;
            }
        }

        // X 轴标签
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        var xCount = xData.length;
        for (var x = 0; x < xCount; x++) {
            var gx = ml + cw * (x / Math.max(xCount - 1, 1));
            if (x % 3 === 0 || x === xCount - 1) {
                ctx.fillText(String(xData[x] || ''), gx, mt + ch + 6);
            }
        }

        // Y 轴边框线
        ctx.strokeStyle = 'rgba(0,212,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(ml, mt);
        ctx.lineTo(ml, mt + ch);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ml, mt + ch);
        ctx.lineTo(ml + cw, mt + ch);
        ctx.stroke();

        // 绘制每条折线 + 面积渐变
        for (var si = 0; si < series.length; si++) {
            var s = series[si];
            var color = s.color || PALETTE[si % PALETTE.length];
            var data = s.data || [];
            var useY2 = !!s.useY2;

            var pts = [];
            for (var pi = 0; pi < data.length; pi++) {
                var px = ml + cw * (pi / Math.max(data.length - 1, 1));
                var val = Number(data[pi]) || 0;
                var py;
                if (useY2) {
                    py = mt + ch - (val / Math.max(y2Max, 1)) * ch;
                } else {
                    py = mt + ch - ((val - y1Min) / Math.max(y1Max - y1Min, 1)) * ch;
                }
                pts.push({ x: px, y: py, v: val });
            }

            // 面积渐变
            if (s.showArea !== false && pts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, mt + ch);
                for (var ti = 0; ti < pts.length; ti++) {
                    ctx.lineTo(pts[ti].x, pts[ti].y);
                }
                ctx.lineTo(pts[pts.length - 1].x, mt + ch);
                ctx.closePath();
                ctx.fillStyle = areaGradient(ctx, 0, mt, 0, mt + ch, color);
                ctx.fill();
            }

            // 折线
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var li = 0; li < pts.length; li++) {
                if (li === 0) ctx.moveTo(pts[li].x, pts[li].y);
                else ctx.lineTo(pts[li].x, pts[li].y);
            }
            ctx.stroke();

            // 数据点
            ctx.fillStyle = color;
            for (var di = 0; di < pts.length; di++) {
                ctx.beginPath();
                ctx.arc(pts[di].x, pts[di].y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 图例
        if (series.length > 0) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '11px sans-serif';
            var lx = ml;
            var ly = 12;
            var lh = 10;
            for (var li = 0; li < series.length; li++) {
                var ls = series[li];
                var lc = ls.color || PALETTE[li % PALETTE.length];
                ctx.fillStyle = lc;
                ctx.fillRect(lx, ly - lh / 2, 14, 4);
                ctx.fillStyle = TEXT_MUTED;
                ctx.fillText(ls.name || '', lx + 18, ly);
                lx += 18 + (ls.name || '').length * 6;
                if (lx > W - 100) { lx = ml; ly += 18; }
            }
        }
    };

    /* =========================================================
     * BarChart —— 柱状图（堆叠或对比）
     * option: { title, xData: [], yLabel, series: [{name, data, color, stack}] }
     *   stack 相同的 series 会堆叠
     *   stack 不同则并列对比
     *   水平模式：horizontal:true，此时 xData 变成 Y 轴标签，series.data 是数字
     * ========================================================= */
    function BarChart(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opt = {};
        this._resizeHandler = null;
    }
    BarChart.prototype.setOption = function (opt) {
        this.opt = opt || {};
        this.resize();
    };
    BarChart.prototype.resize = function () {
        var self = this;
        window.removeEventListener('resize', this._resizeHandler);
        this.render();
        this._resizeHandler = function () { self.render(); };
        window.addEventListener('resize', this._resizeHandler);
    };
    BarChart.prototype.destroy = function () {
        window.removeEventListener('resize', this._resizeHandler);
    };
    BarChart.prototype.render = function () {
        var canvas = this.canvas;
        var opt = this.opt;
        var info = setupCanvas(canvas);
        var ctx = info.ctx;
        var W = info.w, H = info.h;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        var series = opt.series || [];
        var xData = opt.xData || [];
        var horizontal = !!opt.horizontal;

        if (!xData.length || !series.length) {
            drawEmpty(ctx, W, H);
            return;
        }

        if (horizontal) {
            this._renderHorizontal(ctx, W, H, opt);
        } else {
            this._renderVertical(ctx, W, H, opt);
        }
    };

    BarChart.prototype._renderVertical = function (ctx, W, H, opt) {
        var ml = 44, mr = 16, mt = 32, mb = 36;
        var cw = W - ml - mr, ch = H - mt - mb;

        var series = opt.series;
        var xData = opt.xData;

        // 计算 Y 轴最大值（堆叠场景：同 stack 的要累加）
        var stackMap = {}; // stackKey -> maxSum
        var perColMax = [];
        var stackNames = [];
        for (var si = 0; si < series.length; si++) {
            var s = series[si];
            var key = s.stack || ('_alone_' + si);
            if (stackNames.indexOf(key) === -1) stackNames.push(key);
            for (var xi = 0; xi < xData.length; xi++) {
                if (!perColMax[xi]) perColMax[xi] = 0;
                perColMax[xi] += Number(s.data[xi]) || 0;
            }
        }
        var yMax = 0;
        for (var mi = 0; mi < perColMax.length; mi++) {
            if (perColMax[mi] > yMax) yMax = perColMax[mi];
        }
        if (yMax <= 0) yMax = 10;

        // 网格 + Y 轴
        ctx.strokeStyle = 'rgba(0,212,255,0.08)';
        ctx.fillStyle = TEXT_MUTED;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '10px sans-serif';
        var gridCount = 5;
        for (var g = 0; g <= gridCount; g++) {
            var gy = mt + ch * (1 - g / gridCount);
            ctx.beginPath();
            ctx.moveTo(ml, gy);
            ctx.lineTo(ml + cw, gy);
            ctx.stroke();
            ctx.fillText(String(Math.round(yMax * g / gridCount)), ml - 6, gy);
        }

        // X 轴标签
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (var xi = 0; xi < xData.length; xi++) {
            var gx = ml + cw * ((xi + 0.5) / xData.length);
            ctx.fillText(String(xData[xi]), gx, mt + ch + 6);
        }

        // 画柱
        var groupCount = stackNames.length; // 每个 x 下有几个组（非堆叠并列时每组一个 series）
        var barGap = 6;
        var groupWidth = cw / xData.length;
        var singleBarW = Math.min((groupWidth - barGap * (groupCount + 1)) / Math.max(groupCount, 1), 40);

        for (var stackIdx = 0; stackIdx < stackNames.length; stackIdx++) {
            var stackKey = stackNames[stackIdx];
            var stackBars = [];
            for (var si2 = 0; si2 < series.length; si2++) {
                if ((series[si2].stack || ('_alone_' + si2)) === stackKey) stackBars.push(series[si2]);
            }
            // 如果是非堆叠，stackBars 只有一个；如果是堆叠，stackBars 多个
            var isStacked = !!stackBars[0].stack;

            var groupX = groupWidth * stackIdx;
            for (var xi2 = 0; xi2 < xData.length; xi2++) {
                var baseY = mt + ch;
                var barCenter = ml + groupX + groupWidth * ((xi2 + 0.5) / xData.length) - (groupCount - 1) * singleBarW / 2 + stackIdx * singleBarW;

                for (var bi = 0; bi < stackBars.length; bi++) {
                    var bs = stackBars[bi];
                    var bColor = bs.color || PALETTE[bi % PALETTE.length];
                    var bVal = Number(bs.data[xi2]) || 0;
                    var bH = (bVal / yMax) * ch;
                    var bTop = baseY - bH;

                    ctx.fillStyle = bColor;
                    ctx.fillRect(barCenter - singleBarW / 2, bTop, singleBarW, bH);

                    // 堆叠时累加 baseY
                    if (isStacked) {
                        baseY = bTop;
                    }
                }

                // 非堆叠时，这个 group 画完了就换下一个
                if (!isStacked) {
                    // 每个 non-stacked group 占一个 slot
                }
            }
        }

        // 图例
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '11px sans-serif';
        var lx = ml, ly = 12;
        for (var li = 0; li < series.length; li++) {
            var ls2 = series[li];
            var lc = ls2.color || PALETTE[li % PALETTE.length];
            ctx.fillStyle = lc;
            ctx.fillRect(lx, ly - 4, 14, 8);
            ctx.fillStyle = TEXT_MUTED;
            ctx.fillText(ls2.name || '', lx + 18, ly);
            lx += 18 + (ls2.name || '').length * 6 + 10;
            if (lx > W - 100) { lx = ml; ly += 16; }
        }
    };

    BarChart.prototype._renderHorizontal = function (ctx, W, H, opt) {
        // 水平柱状图，用于工单进度对比
        var ml = 120, mr = 80, mt = 8, mb = 8;
        var cw = W - ml - mr, ch = H - mt - mb;
        var series = opt.series || [];
        var labels = opt.xData || [];
        var rowCount = labels.length;
        if (!rowCount) { drawEmpty(ctx, W, H); return; }

        var rowH = Math.min(ch / rowCount, 28);
        var gapY = Math.max(2, rowH * 0.25);

        // 找最大值
        var maxV = 0;
        for (var si = 0; si < series.length; si++) {
            for (var xi = 0; xi < labels.length; xi++) {
                var v = Number(series[si].data[xi]) || 0;
                if (v > maxV) maxV = v;
            }
        }
        if (maxV <= 0) maxV = 10;

        for (var ri = 0; ri < rowCount; ri++) {
            var cy = mt + rowH / 2 + ri * rowH;

            // 标签
            ctx.fillStyle = TEXT_PRIMARY;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            var label = String(labels[ri] || '').length > 16
                ? String(labels[ri]).slice(0, 16) + '..'
                : String(labels[ri] || '');
            ctx.fillText(label, ml - 6, cy);

            // 背景条
            ctx.fillStyle = 'rgba(0,212,255,0.08)';
            ctx.fillRect(ml, cy - rowH / 2 + gapY / 2, cw, rowH - gapY);

            // 画每组（series 对应两种条）
            var leftX = ml;
            for (var si2 = 0; si2 < series.length; si2++) {
                var s = series[si2];
                var color = s.color || PALETTE[si2 % PALETTE.length];
                var val = Number(s.data[ri]) || 0;
                var bw = (val / maxV) * cw;
                ctx.fillStyle = color;
                ctx.fillRect(leftX, cy - rowH / 2 + gapY / 2, bw, rowH - gapY);
                leftX += bw;
            }

            // 右侧百分比/数值标签
            if (opt.showPercent && series.length >= 2) {
                var target = Number(series[0].data[ri]) || 0;
                var done = Number(series[1].data[ri]) || 0;
                var pct = target > 0 ? Math.round(done / target * 100) : 0;
                ctx.fillStyle = '#00ff88';
                ctx.textAlign = 'left';
                ctx.fillText(pct + '%', ml + cw + 8, cy);
            }
        }

        // 图例
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '11px sans-serif';
        var lx = ml, ly = Math.max(mt + rowCount * rowH + 6, 4);
        for (var li = 0; li < series.length; li++) {
            var ls2 = series[li];
            var lc = ls2.color || PALETTE[li % PALETTE.length];
            ctx.fillStyle = lc;
            ctx.fillRect(lx, ly - 4, 14, 8);
            ctx.fillStyle = TEXT_MUTED;
            ctx.fillText(ls2.name || '', lx + 18, ly);
            lx += 18 + (ls2.name || '').length * 6 + 10;
        }
    };

    /* =========================================================
     * PieChart —— 环形饼图
     * option: { data: [{name, value, color}], centerText, centerSubText }
     * ========================================================= */
    function PieChart(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opt = {};
        this._resizeHandler = null;
    }
    PieChart.prototype.setOption = function (opt) {
        this.opt = opt || {};
        this.resize();
    };
    PieChart.prototype.resize = function () {
        var self = this;
        window.removeEventListener('resize', this._resizeHandler);
        this.render();
        this._resizeHandler = function () { self.render(); };
        window.addEventListener('resize', this._resizeHandler);
    };
    PieChart.prototype.destroy = function () {
        window.removeEventListener('resize', this._resizeHandler);
    };
    PieChart.prototype.render = function () {
        var canvas = this.canvas;
        var opt = this.opt;
        var info = setupCanvas(canvas);
        var ctx = info.ctx;
        var W = info.w, H = info.h;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        var data = opt.data || [];
        if (!data.length) {
            drawEmpty(ctx, W, H);
            return;
        }

        var cx = W * 0.5;
        var cy = H * 0.44;
        var maxR = Math.min(W, H) * 0.32;
        var innerR = maxR * 0.6;

        // 先画外圈
        var total = 0;
        for (var i = 0; i < data.length; i++) total += Number(data[i].value) || 0;
        if (total <= 0) { drawEmpty(ctx, W, H); return; }

        var startAngle = -Math.PI / 2;
        for (var di = 0; di < data.length; di++) {
            var d = data[di];
            var val = Number(d.value) || 0;
            var angle = (val / total) * Math.PI * 2;
            var color = d.color || PALETTE[di % PALETTE.length];

            ctx.beginPath();
            ctx.arc(cx, cy, maxR, startAngle, startAngle + angle, false);
            ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // 分割线
            ctx.strokeStyle = BG;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 百分比标签
            var midAngle = startAngle + angle / 2;
            var labelR = maxR + 18;
            var lx = cx + Math.cos(midAngle) * labelR;
            var ly = cy + Math.sin(midAngle) * labelR;
            var pct = ((val / total) * 100).toFixed(0);

            ctx.font = '11px sans-serif';
            ctx.fillStyle = TEXT_PRIMARY;
            ctx.textAlign = Math.cos(midAngle) > 0 ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct + '%', lx, ly);

            startAngle += angle;
        }

        // 中心数字
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText(String(total), cx, cy - 4);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = TEXT_MUTED;
        ctx.fillText(opt.centerSubText || '不良总数(件)', cx, cy + 20);

        // 底部图例
        var ly = H - 28;
        var lx = W * 0.15;
        var step = W * 0.35;
        ctx.font = '11px sans-serif';
        for (var li = 0; li < data.length; li++) {
            var d2 = data[li];
            var lc = d2.color || PALETTE[li % PALETTE.length];
            // 每行三个左右
            var row = Math.floor(li / 3);
            var col = li % 3;
            var tx = lx + col * step;
            var ty = ly + row * 16;
            ctx.fillStyle = lc;
            ctx.beginPath();
            ctx.arc(tx, ty, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = TEXT_MUTED;
            ctx.textAlign = 'left';
            ctx.fillText((d2.name || '') + ' ' + d2.value, tx + 10, ty);
        }
    };

    /* =========================================================
     * GaugeChart —— 仪表盘 / 弧形 KPI
     * option: { value, max, min, label, unit, color, from, to }
     *   from/to: 弧形起止角度（默认从 220° 到 -40°，约 260°）
     * ========================================================= */
    function GaugeChart(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opt = {};
        this._resizeHandler = null;
    }
    GaugeChart.prototype.setOption = function (opt) {
        this.opt = opt || {};
        this.resize();
    };
    GaugeChart.prototype.resize = function () {
        var self = this;
        window.removeEventListener('resize', this._resizeHandler);
        this.render();
        this._resizeHandler = function () { self.render(); };
        window.addEventListener('resize', this._resizeHandler);
    };
    GaugeChart.prototype.destroy = function () {
        window.removeEventListener('resize', this._resizeHandler);
    };
    GaugeChart.prototype.render = function () {
        var canvas = this.canvas;
        var opt = this.opt;
        var info = setupCanvas(canvas);
        var ctx = info.ctx;
        var W = info.w, H = info.h;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        var cx = W / 2;
        var cy = H * 0.55;
        var r = Math.min(W, H) * 0.38;

        var value = Number(opt.value) || 0;
        var max = Number(opt.max) || 100;
        var min = Number(opt.min) || 0;
        var label = opt.label || '';
        var unit = opt.unit || '';
        var color = opt.color || '#00d4ff';

        var fromDeg = typeof opt.from === 'number' ? opt.from : 220;
        var toDeg = typeof opt.to === 'number' ? opt.to : -40;
        var fromRad = fromDeg * Math.PI / 180;
        var toRad = toDeg * Math.PI / 180;
        var totalAngle = fromRad - toRad;

        var ratio = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1)));
        var valueAngle = fromRad - ratio * totalAngle;

        // 背景弧
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,212,255,0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, toRad, fromRad, false);
        ctx.stroke();

        // 值弧
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, toRad, valueAngle, false);
        ctx.stroke();

        // 中心数值
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(String(value), cx, cy);

        if (unit) {
            ctx.font = '11px sans-serif';
            ctx.fillStyle = TEXT_MUTED;
            ctx.fillText(unit, cx, cy + 18);
        }

        if (label) {
            ctx.font = '12px sans-serif';
            ctx.fillStyle = TEXT_MUTED;
            ctx.fillText(label, cx, cy + r + 24);
        }
    };

    /* =========================================================
     * 导出
     * ========================================================= */
    global.TVCharts = {
        LineChart: LineChart,
        BarChart: BarChart,
        PieChart: PieChart,
        GaugeChart: GaugeChart
    };
})(window);
