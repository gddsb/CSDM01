#!/usr/bin/env python3
"""MES 自动计算字段清单 PDF 生成"""
import os, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# === 字体 ===
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
# STSong-Light 不支持 Bold 变体，用同一字体模拟
FONT = 'STSong-Light'
FONTB = 'STSong-Light'

# 特殊字符归一化（CID 字体不支持 → ASCII 等价）
NORM = {
    '\u2212': '-',   # MINUS SIGN
    '\u2014': '-',   # EM DASH
    '\u2013': '-',   # EN DASH
    '\u2010': '-',
    '\u00D7': 'x',   # MULTIPLICATION
    '\u2265': '>=',  # GREATER-OR-EQUAL
    '\u2192': '->',  # ARROW
    '\u00B7': '.',   # MIDDLE DOT
    '\u26A0': '[!]', # WARNING SIGN
    '\u2705': '[OK]',# CHECK MARK
    '\u3014': '(',   # （
    '\u3015': ')',   # ）
    '\uFF08': '(',   # FULLWIDTH (
    '\uFF09': ')',   # FULLWIDTH )
    '\uFF0C': ',',   # FULLWIDTH ,
    '\uFF1B': ';',   # FULLWIDTH ;
    '\u201C': '"',
    '\u201D': '"',
    '\u2018': "'",
    '\u2019': "'",
}
def norm(s):
    for k, v in NORM.items():
        s = s.replace(k, v)
    return s

# === 页面 ===
PAGE_W, PAGE_H = landscape(A4)
OUT = '/workspace/auto-calc-fields/auto-calc-fields.pdf'

# === 样式 ===
def S(**kw):
    return ParagraphStyle('s', fontName=FONT, fontSize=10, leading=14, **kw)

title_style = ParagraphStyle('t', fontName=FONTB, fontSize=22, leading=28,
                             textColor=HexColor('#1e293b'), alignment=TA_LEFT, spaceAfter=4)
sub_style = ParagraphStyle('sub', fontName=FONT, fontSize=11, leading=15,
                           textColor=HexColor('#64748b'), spaceAfter=16)
meta_style = ParagraphStyle('meta', fontName=FONT, fontSize=9, leading=13,
                            textColor=HexColor('#475569'))

def cell_p(txt, style=S(), bold=False, color=None, mono=False):
    st = ParagraphStyle('c', parent=style, fontName='NotoSCB' if bold else 'NotoSC',
                        textColor=color or HexColor('#1f2937'),
                        fontSize=9.5, leading=13.5)
    if mono:
        st.fontName = 'Courier'
        st.fontSize = 9
    return Paragraph(str(txt).replace('\n', '<br/>').replace(' ', '&nbsp;'), st)

# === 表格数据 ===
rows = [
    # 表头
    ['表名', '表说明', '字段名', '字段说明', '计算公式'],

    # ---- 报工主表 7 行 ----
    ['production_report_order', '报工单主表（v1.2.0 新增 7 列）',
     'total_input_qty', '投入数量',
     '首工序 SUM(material WHERE type=投入) − SUM(type=退回)'],
    ['production_report_order', '报工单主表',
     'total_defect_material', '来料不良数量',
     'SUM(process_defect.quantity WHERE defect_type = 来料不良)'],
    ['production_report_order', '报工单主表',
     'total_defect_process', '制程不良数量',
     'SUM(process_defect.quantity WHERE defect_type = 制程不良)'],
    ['production_report_order', '报工单主表',
     'total_defect_scrap', '检验报废数量',
     'SUM(process_defect.quantity WHERE defect_type = 检验报废)'],
    ['production_report_order', '报工单主表',
     'total_exception_hours', '异常停机工时(h，已扣休息)',
     'SUM(COALESCE(process_exception.net_duration, duration))'],
    ['production_report_order', '报工单主表',
     'total_manpower_hours', '总人工工时(h，已扣休息)',
     'SUM(COALESCE(manpower_record.net_hours, 0))'],
    ['production_report_order', '报工单主表',
     'expected_output', '理论产出(物料平衡)',
     'total_input_qty − 来料不良 − 制程不良 − 检验报废'],

    # ---- 人力记录 ----
    ['production_manpower_record', '报工人力记录子表',
     'total_people', '总人数',
     'skilled + regular + labor + other — DB STORED'],
    ['production_manpower_record', '报工人力记录子表',
     'hours', '时长(h)',
     '(end_time − start_time) · 小时 — DB STORED'],
    ['production_manpower_record', '报工人力记录子表',
     'man_hours', '工时×人数',
     'hours × total_people — DB STORED'],
    ['production_manpower_record', '报工人力记录子表',
     'net_hours', '净工时(h，扣休息)',
     'man_hours − calcOverlap(start, end, breakTimes) — 后端 create/update 自动写入'],
    ['production_manpower_record', '报工人力记录子表',
     'net_hours', '休息表变更批量重算',
     '同上行公式，批量 UPDATE — BreakTimeService recalcNetForReport'],

    # ---- 异常记录 ----
    ['production_process_exception', '工序异常停机记录子表',
     'net_duration', '净停机时长(h，扣休息)',
     'duration − calcOverlap(start, end, breakTimes) — 后端 create/update 自动写入'],
    ['production_process_exception', '工序异常停机记录子表',
     'net_duration', '休息表变更批量重算',
     '同上行公式，批量 UPDATE — BreakTimeService recalcNetForReport'],

    # ---- 订单主表 ----
    ['master_order', '生产订单主表',
     'finished_qty', '累计完工数量',
     'SUM(report_order.report_qty WHERE status IN (2,3)) — ProductionWorkflowService 回填'],
    ['master_order', '生产订单主表',
     'status', '订单状态机',
     'finished_qty ≥ planned_qty → 2 已完工；=0 → 0 已创建；否则 → 1 进行中'],

    # ---- list 接口即时 ----
    ['report-orders list 接口', '报工单列表即时字段',
     'input_qty', '投入数量(同 total_input_qty)',
     'sequelize.literal 即时计算 — ReportOrderService.list'],
    ['production_report_order', '报工单预留字段',
     'break_minutes', '休息总分钟数',
     'SUM(breakMinutesOfDay(report_time, finish_time, breakTimes)) — 当前未自动回填'],

    # ---- OEE ----
    ['OEE 指标（即时聚合）', '生产设备综合效率',
     'availability', '可用率(%)',
     'runtime_hours / planned_hours × 100；无 runtime 数据默认 85%'],
    ['OEE 指标（即时聚合）', '生产设备综合效率',
     'performance', '性能率(%)',
     'min(100, output / (runtime × 100)) × 100；无数据默认 85%；⚠ 100 为硬编码假设'],
    ['OEE 指标（即时聚合）', '生产设备综合效率',
     'quality', '质量率(%)',
     '100 − (defect / (output + defect)) × 100；无数据默认 95%'],
    ['OEE 指标（即时聚合）', '生产设备综合效率',
     'oee_total', 'OEE 综合值(%)',
     'availability × performance × quality / 10000 — 保留 1 位小数'],

    # ---- 设备列表 ----
    ['device_oee（master_device 运行时）', '设备列表 OEE 字段',
     'oee_availability / oee_performance / oee_quality / oee_total',
     '设备列表直接返回 OEE 四项',
     '同 OEE 指标公式 — DeviceService.list 即时聚合，非持久化'],

    # ---- 维保 ----
    ['production_maintenance_record（聚合）', '维修保养记录',
     'completion_rate', '维保完成率(按日/周/月)',
     'COUNT(status=2) / COUNT(*) × 100 GROUP BY period_key — MaintenanceRecordCrud'],

    # ---- 大屏/日报派生 ----
    ['大屏 / 日报', '外部报表派生指标',
     '良率(大屏)', '良品率',
     '(产出 − 不良) / 投入 × 100 — ProductionBigScreen / ManagementBigScreen'],
    ['大屏 / 日报', '外部报表派生指标',
     '投入产出比', '产出率',
     '产出 / 投入 × 100 — ProductionReport'],
    ['大屏 / 日报', '外部报表派生指标',
     '总不良率', '不良占比',
     '(来料不良 + 制程不良 + 检验报废) / 投入 × 100 — OrderManagement'],

    # ---- recalc 钩子 ----
    ['recalc 钩子触发源', '报工单统计字段自动重算',
     '—', '触发下列 7 列重新计算',
     'ProcessDefectService 4处 · ProcessExceptionService 3处 · ProcessMaterialService 3处 · ManpowerRecordService 1处 — reportOrderStats.recalcReportStats 失败静默'],
]

# === 构建表格 ===
def wrap(row, header=False):
    if header:
        H = ParagraphStyle('H', fontName=FONTB, fontSize=10, leading=13,
                           textColor=white, alignment=TA_LEFT)
        return [Paragraph(str(c), H) for c in row]
    base = ParagraphStyle('B', fontName=FONT, fontSize=9.2, leading=12.5,
                          textColor=HexColor('#1f2937'))
    mono = ParagraphStyle('M', parent=base, fontName=FONT, fontSize=9.0)
    tbl_name = ParagraphStyle('T', parent=base, fontName=FONTB,
                              textColor=HexColor('#1d4ed8'))
    field_name = ParagraphStyle('F', parent=mono, textColor=HexColor('#0f172a'))
    cells = []
    for i, c in enumerate(row):
        txt = norm(str(c))
        if i == 0:
            cells.append(Paragraph(txt.replace('\n','<br/>'), tbl_name))
        elif i == 2:
            cells.append(Paragraph(txt.replace('\n','<br/>'), field_name))
        elif i == 4:
            cells.append(Paragraph(txt.replace('\n','<br/>').replace(' ','&nbsp;'), mono))
        else:
            cells.append(Paragraph(txt.replace('\n','<br/>'), base))
    return cells

wrapped = [wrap(rows[0], header=True)] + [wrap(r) for r in rows[1:]]

col_w = [46*mm, 52*mm, 38*mm, 44*mm, 96*mm]

t = Table(wrapped, colWidths=col_w, repeatRows=1)

# 样式
header_bg = HexColor('#1e293b')
alt_bg = HexColor('#f8fafc')
rule = HexColor('#e2e8f0')
accent = HexColor('#dbeafe')

style = [
    ('BACKGROUND', (0, 0), (-1, 0), header_bg),
    ('TEXTCOLOR',  (0, 0), (-1, 0), white),
    ('FONTNAME',   (0, 0), (-1, 0), FONTB),
    ('FONTSIZE',   (0, 0), (-1, 0), 10),
    ('ALIGN',      (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN',     (0, 0), (-1, -1), 'TOP'),
    ('GRID',       (0, 0), (-1, -1), 0.4, rule),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ('TOPPADDING',    (0, 0), (-1, 0), 8),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ('TOPPADDING',    (0, 1), (-1, -1), 6),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, alt_bg]),
]
t.setStyle(style)

# === 文档 ===
doc = SimpleDocTemplate(OUT, pagesize=landscape(A4),
                        leftMargin=14*mm, rightMargin=14*mm,
                        topMargin=14*mm, bottomMargin=14*mm,
                        title='MES 自动计算字段清单',
                        author='东莞大满包装长沙分公司')

story = [
    Paragraph('MES 自动计算字段清单', title_style),
    Paragraph('东莞大满包装长沙分公司奶粉罐 MES · 报工 + 设备 + OEE 模块全量持久化计算字段', sub_style),
    Paragraph('版本 v1.2.0 build408 · 日期 2026-11-14 · 字段总数 35 · 涉及表 8', meta_style),
    Spacer(1, 8),
    t,
]

# 页码
def _on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(HexColor('#94a3b8'))
    canvas.drawRightString(PAGE_W - 14*mm, 8*mm,
                           f'第 {doc.page} 页')
    canvas.restoreState()

doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
print(f'✅ 生成: {OUT}')
print(f'   大小: {os.path.getsize(OUT)/1024:.1f} KB')
