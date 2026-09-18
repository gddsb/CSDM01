/**
 * TV 大屏终端配置 —— ES5 兼容写法
 * 如需修改 API 地址、刷新间隔、轮播速度，改这里即可
 */
window.TV_CONFIG = {
    /** API 基础地址（公网 MES 后端） */
    API_BASE: 'http://43.138.218.55/api',

    /** 数据刷新间隔（毫秒）—— 大屏每隔多久重新拉一次数据 */
    REFRESH_INTERVAL: 30 * 1000,

    /** 轮播总控：每个大屏页面停留时间（毫秒） */
    SLIDE_DURATION: 15 * 1000,

    /** 空闲检测：多少毫秒无操作进入省电模式 */
    IDLE_THRESHOLD: 15 * 1000,

    /** Canvas 渲染比例：电视是 4K(3840x2160) 但 CPU 弱，锁 1x 避免像素过剩 */
    DPR: 1,

    /** 设计稿基准分辨率，用于 scale 计算。4K 电视按 1920x1080 设计稿等比放大 2x */
    DESIGN_WIDTH: 1920,
    DESIGN_HEIGHT: 1080,

    /** 图表调色板（与原有 React 版视觉一致） */
    PALETTE: ['#00d4ff', '#00ff88', '#a78bfa', '#ffd93d', '#ff6b6b', '#F0883E'],

    /** 暗色背景主色 */
    BG_COLOR: '#0a0e1a',

    /** 面板边框/标题色 */
    ACCENT_COLOR: '#00d4ff',

    /** 数据接口路径 */
    API: {
        PRODUCTION: '/auto/dashboard/production',
        QUALITY:    '/auto/dashboard/quality',
        MANAGEMENT: '/auto/dashboard/management',
        OVERVIEW:   '/auto/dashboard/overview',
        TREND:      '/auto/dashboard/trend',
        ENERGY:     '/energy/overview',
        ENERGY_MONTH: '/energy/month-trend?months=12',
        ENERGY_TREND: '/energy/trend?mode=month'
    }
};
