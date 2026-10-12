---
name: "mes-mobile-framework"
description: "MES 移动端 safe-area + 滚动架构规范。用户说「移动端布局问题」「状态栏覆盖」「滚不动」「顶栏不固定」或新增移动页面时调用。"
---

# MES 移动端框架规范与 Safe-Area 修复流水线

> **适用项目**：MES 奶粉罐生产系统 `/workspace`，React + Vite + antd-mobile + Capacitor。
> **核心入口**：`src/mobile/styles/mobile.css`（框架 CSS）+ `src/mobile/MobileLayout.tsx`（布局骨架）。
> **本 skill 固化了 4 轮移动端滚动问题修复的经验**，所有后续页面开发/布局修复/框架调优都应以此为参考。

---

## 一、三大核心原则（不可打破）

```
┌──────────────────────────────────────────────────┐
│  ║ 系统状态栏（不可操作区域）║  ← var(--sat)  │
│  ┌──────────────────────────────────────────┐    │
│  │  .mobile-app                             │    │  ← overflow:hidden
│  │  ┌────────────────────────────────────┐  │    │
│  │  │  NavBar / 离线状态条 / 顶部固定头  │  │    │  ← flexShrink:0 不参与滚动
│  │  ├────────────────────────────────────┤  │    │
│  │  │  .mobile-app__content (flex:1)    │  │    │  ← overflow:hidden + min-height:0
│  │  │  ┌──────────────────────────────┐  │  │    │
│  │  │  │ 子页面 Outlet —— 自己决定滚 │  │  │    │  ← 唯一滚动源
│  │  │  └──────────────────────────────┘  │  │    │
│  │  └────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────┘    │
│  ║ Home Indicator（不可操作区域）║  ← var(--sab)│
└──────────────────────────────────────────────────┘
```

1. **外层绝对禁滚**：`html.mobile-root body { overflow:hidden }` + `.mobile-app { overflow:hidden }`
   —— 任何内容都不可能滚到状态栏后面。
2. **外层统一吃 safe-area**：`.mobile-app { box-sizing:border-box; padding-top:var(--sat); padding-bottom:var(--sab); height:100dvh }`
   —— NavBar / Dashboard / Profile 等**禁止**自己加 `paddingTop:var(--sat)`，会造成双倍。
3. **滚动职责单一**：**只有一个容器负责滚动**，由子页面自己决定：
   - 需要"框架固定 + 列表滚动" → `.mobile-page-fixed-header`
   - 简单整页滚 → `.mobile-page-scrollable`

---

## 二、两种页面模式

### 模式 A：固定头 + 内部滚动（`.mobile-page-fixed-header`）

**适用**：检验页、生产报工、过程检验、设备点检、备件等需要顶栏固定的业务页。

```tsx
// 子页面 return 根容器（三行搞定）
<div className="mobile-page-fixed-header">
  <div className="mobile-sticky-header">
    {/* 标题 / Tab / 搜索栏 / 状态筛选 —— 固定不动 */}
  </div>
  <div className="mobile-page-scroll-list mobile-scroll">
    {/* PullToRefresh / List / 记录卡片 —— 只有这里在滚 */}
  </div>
</div>
```

**CSS 定义在 `mobile.css`**，效果：
- 吸顶区：`flex-shrink:0`，高度由内容撑开
- 滚动区：`flex:1; min-height:0; overflow-y:auto`，从吸顶区下方开始独立滚

**实战参考**：`MobileOrderManagement.tsx`（生产订单）—— 完整正确范例。

### 模式 B：整页滚动（`.mobile-page-scrollable`）

**适用**：首页 Dashboard / 我的 Profile / 单页表单等没有吸顶需求的简单页。

```tsx
<div className="mobile-page mobile-page-scrollable" style={{ padding: '12px 14px 80px' }}>
  {/* 全部内容，整页滚 */}
</div>
```

**要点**：外层禁滚后，**没有** `.mobile-page-scrollable` 就会完全滚不动。
扫描命令：`for f in src/mobile/pages/*.tsx; do grep -q "mobile-page-fixed-header\|mobile-page-scrollable" "$f" || echo "⚠️ 无滚动: $(basename $f)"; done`

---

## 三、框架 CSS 关键 token（改之前必须读）

```css
/* mobile.css */
:root {
  --sat: env(safe-area-inset-top, 0px);    /* iPhone 刘海屏状态栏高度 */
  --sab: env(safe-area-inset-bottom, 0px); /* Home Indicator 高度 */
}

.mobile-app {
  height: 100dvh;                          /* 动态视口（地址栏伸缩） */
  box-sizing: border-box;                 /* padding 从 100dvh 内部扣 */
  padding-top: var(--sat);                 /* 统一吃顶部 safe-area */
  padding-bottom: var(--sab);
  overflow: hidden;                        /* 不可逾越的边界 */
  display: flex; flex-direction: column;
}

.mobile-app__content {
  flex: 1; min-height: 0;                  /* min-height:0 让子页面 flex:1 有效 */
  display: flex; flex-direction: column;
  overflow: hidden;                        /* 再次禁滚 */
}

.mobile-page-fixed-header { overflow:hidden; }
.mobile-page-fixed-header .mobile-page-scroll-list {
  flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
}

.mobile-page-scrollable {
  flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
}
```

---

## 四、新增移动端页面 Checklist

每次新增 `.tsx` 页面必须过：

1. **根容器类名**：业务页选 `.mobile-page-fixed-header`，简单页选 `.mobile-page-scrollable`
2. **不要自己加 `paddingTop:var(--sat)`** —— 外层 `.mobile-app` 已统一管
3. **不要用 `minHeight:'100vh'`** —— 撑高外层导致双滚动
4. **TabBar 避让**：业务页外层自动有 `.mobile-tabbar-padding`（`padding-bottom: calc(50px + var(--sab))`）
5. **文件 ≤ 500 行** —— 超了就拆小组件到同级目录
6. **`overflow: hidden` 在根容器**（fixed-header 模式下）— 防止内容溢出造成双滚动
7. **真机验证**：滚到顶看是否盖状态栏、TabBar 是否被 Home Indicator 遮挡

---

## 五、Troubleshooting 流水线（症状 → 根因 → 修复）

### 症状 A：内容盖到状态栏后面

```bash
# 1. 检查 .mobile-app 是否统一吃 safe-area
grep -A5 "\.mobile-app {" src/mobile/styles/mobile.css | head -6
# 期望看到: padding-top: var(--sat); + overflow:hidden; + box-sizing:border-box;

# 2. 有没有页面/组件自己重复加了 paddingTop:var(--sat)？
grep -rn "paddingTop.*sat\|padding-top.*sat" src/mobile/
# 应该只有 .mobile-app 一处；NavBar 包层曾经加过 → 已删

# 3. 有没有 root 容器用 minHeight:'100dvh'/'100vh' 撑高了外层？
grep -rn "100vh\|100dvh" src/mobile/pages/
# 所有子页面 root 容器禁用 100vh，靠 flex:1 填充
```

### 症状 B：页面完全滚不动

```bash
# 外层 overflow:hidden 后，子页面必须自己有滚动类
for f in src/mobile/pages/*.tsx; do
  grep -q "mobile-page-fixed-header\|mobile-page-scrollable" "$f" \
    || echo "⚠️  $(basename $f) —— 外层禁滚但子页面没滚"
done
```

**修复**：`sed -i 's/className="mobile-page"/className="mobile-page mobile-page-scrollable"/g' 目标文件.tsx`

### 症状 C：吸顶头跟着内容一起滚

```bash
# 1. 根容器有没有套对？
grep -A2 "return (" 目标页.tsx | head -5
# 期望根容器 className="mobile-page-fixed-header"

# 2. min-height:0 是否缺失？（这是 flex 中最常见的失效点）
grep -n "min-height:\s*0" src/mobile/styles/mobile.css
# .mobile-app__content 和 .mobile-page-fixed-header .mobile-page-scroll-list 都要有
```

### 症状 D：外层整页在滚 + 内层列表也在滚（双滚动）

```bash
# 根因：外层没有 overflow:hidden + 内层自己有 overflow-y:auto
# 修复：确保
#   html.mobile-root body { overflow:hidden }
#   .mobile-app { overflow:hidden }
#   .mobile-app__content { overflow:hidden }
# 三层禁滚 → 唯一滚动源只能是子页面
```

---

## 六、真机验证清单（部署完成后必须在物理机上测）

- [ ] **首页 / 我的**：拉到顶 → 欢迎文字不盖状态栏，顶部有 20~30px 空隙
- [ ] **生产订单 / 移动报工 / 检验页**：进入子页面 → NavBar 正好在状态栏正下方，无覆盖无过大间距
- [ ] **吸顶页滚动**：向上滚 → 吸顶头（标题/Tabs）固定不动，只有列表卡片滚
- [ ] **外层边界**：任何页面滚到顶，内容**绝不可能**被拖到状态栏后面（硬边界）
- [ ] **底部 TabBar**：在 iPhone 有 Home Indicator 的机型上，TabBar 底部有安全距离，不贴底
- [ ] **表单输入**：聚焦时弹出键盘，不导致页面整体向上位移或错位

---

## 七、常见陷阱（禁止）

| ❌ 禁止 | ✅ 应该 |
|---------|---------|
| 子页面 root 容器加 `minHeight:'100vh'/'100dvh'` | 靠 `flex:1; min-height:0` 填充父容器 |
| 组件自己加 `paddingTop:var(--sat)` | 外层 `.mobile-app` 统一吃 safe-area |
| NavBar 外包一层 `div style={{paddingTop:'var(--sat)'}}` | NavBar 直接渲染，`flexShrink:0` |
| 同时让外层和内层 overflow-y:auto（双滚动） | 三层禁滚 + 子页面唯一滚动源 |
| 吸顶方案只改 inline style 不改 CSS 类 | 统一用 `.mobile-page-fixed-header` + `.mobile-sticky-header` + `.mobile-page-scroll-list` |
| `overflow:hidden` 忘了配合 `min-height:0` | flex 中 overflow:hidden 必须搭配 min-height:0 才生效 |
| 新增页面后不跑滚扫脚本 | 每次 commit 前扫一次：`for f in src/mobile/pages/*.tsx; do ...` |

---

## 八、相关 Skill

- **`mes-deploy`** —— 推送 + 生产机 rebuild_v2.sh + 五维 HTTP 验证（已固化在 `.trae/skills/mes-deploy/SKILL.md`）
- 本 skill 与 mes-deploy 互补：本 skill 管**前端架构规范**，mes-deploy 管**部署流水线**。
