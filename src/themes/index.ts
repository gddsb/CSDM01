// 六套主题配色方案 - 基于设计文档
interface ThemeColors {
  [key: string]: string
}

interface Theme {
  key?: string
  name: string
  icon: string
  dark: boolean
  colors: ThemeColors
}

function generateThemeVariants(theme: Theme): ThemeColors {
  const primary = theme.colors['--color-primary']
  const bgCard = theme.colors['--bg-card']
  const textSecondary = theme.colors['--text-secondary']
  const borderColor = theme.colors['--border-color']
  const dark = theme.dark

  const mix = (color1: string, color2: string, ratio: number): string => {
    const hex = (c: string) => parseInt(c, 16)
    const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7))
    const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7))
    const r = Math.round(r1 * ratio + r2 * (1 - ratio))
    const g = Math.round(g1 * ratio + g2 * (1 - ratio))
    const b = Math.round(b1 * ratio + b2 * (1 - ratio))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  return {
    '--color-primary-bg': mix(primary, bgCard, dark ? 0.15 : 0.08),
    '--color-primary-light': mix(primary, bgCard, dark ? 0.35 : 0.2),
    '--color-primary-border': mix(primary, borderColor, dark ? 0.5 : 0.4),
    '--color-primary-soft': mix(primary, bgCard, dark ? 0.25 : 0.12),
  }
}

export const themes: Record<string, Theme> = {
  pureMilk: {
    name: '纯净奶源',
    icon: '🥛',
    dark: false,
    colors: {
      '--bg-main': '#FFFFFF',
      '--bg-card': '#FAFBFC',
      '--color-primary': '#2196F3',
      '--color-secondary': '#00BCD4',
      '--color-accent': '#FF6F00',
      '--color-success': '#4CAF50',
      '--color-warning': '#FF9800',
      '--color-error': '#F44336',
      '--text-primary': '#212121',
      '--text-secondary': '#757575',
      '--border-color': '#E0E0E0',
      '--nav-bg': '#FFFFFF',
      '--nav-text': '#212121',
    },
  },
  darkFactory: {
    key: 'darkFactory',
    name: '暗夜工厂',
    icon: '🌙',
    dark: true,
    colors: {
      '--bg-main': '#0D1117',
      '--bg-card': '#161B22',
      '--color-primary': '#58A6FF',
      '--color-secondary': '#3FB950',
      '--color-accent': '#F0883E',
      '--color-success': '#3FB950',
      '--color-warning': '#D29922',
      '--color-error': '#F85149',
      '--text-primary': '#E6EDF3',
      '--text-secondary': '#8B949E',
      '--border-color': '#30363D',
      '--nav-bg': '#0D1117',
      '--nav-text': '#E6EDF3',
    }
  },
  blueSky: {
    key: 'blueSky',
    name: '蓝天牧场',
    icon: '🌤️',
    dark: false,
    colors: {
      '--bg-main': '#F0F7FF',
      '--bg-card': '#FFFFFF',
      '--color-primary': '#4A90D9',
      '--color-secondary': '#7EC8E3',
      '--color-accent': '#F5A623',
      '--color-success': '#7ED321',
      '--color-warning': '#F8C445',
      '--color-error': '#E86B6B',
      '--text-primary': '#2C3E50',
      '--text-secondary': '#7F8C8D',
      '--border-color': '#D6E4F0',
      '--nav-bg': '#F0F7FF',
      '--nav-text': '#2C3E50',
    }
  },
  metal: {
    key: 'metal',
    name: '金属质感',
    icon: '🔩',
    dark: false,
    colors: {
      '--bg-main': '#F5F5F5',
      '--bg-card': '#FFFFFF',
      '--color-primary': '#607D8B',
      '--color-secondary': '#90A4AE',
      '--color-accent': '#FF5722',
      '--color-success': '#689F38',
      '--color-warning': '#F9A825',
      '--color-error': '#C62828',
      '--text-primary': '#37474F',
      '--text-secondary': '#78909C',
      '--border-color': '#CFD8DC',
      '--nav-bg': '#F5F5F5',
      '--nav-text': '#37474F',
    }
  },
  greenOasis: {
    key: 'greenOasis',
    name: '自然绿洲',
    icon: '🌿',
    dark: false,
    colors: {
      '--bg-main': '#F1F8E9',
      '--bg-card': '#FFFFFF',
      '--color-primary': '#43A047',
      '--color-secondary': '#66BB6A',
      '--color-accent': '#EF6C00',
      '--color-success': '#2E7D32',
      '--color-warning': '#FFA000',
      '--color-error': '#D32F2F',
      '--text-primary': '#33691E',
      '--text-secondary': '#689F38',
      '--border-color': '#C8E6C9',
      '--nav-bg': '#F1F8E9',
      '--nav-text': '#33691E',
    }
  },
  warmAmber: {
    key: 'warmAmber',
    name: '暖阳琥珀',
    icon: '🔥',
    dark: false,
    colors: {
      '--bg-main': '#FFFBF5',
      '--bg-card': '#FFFFFF',
      '--color-primary': '#E65100',
      '--color-secondary': '#FF8F00',
      '--color-accent': '#00897B',
      '--color-success': '#2E7D32',
      '--color-warning': '#F9A825',
      '--color-error': '#C62828',
      '--text-primary': '#3E2723',
      '--text-secondary': '#795548',
      '--border-color': '#FFE0B2',
      '--nav-bg': '#FFFBF5',
      '--nav-text': '#3E2723',
    }
  }
}

Object.values(themes).forEach(theme => {
  Object.assign(theme.colors, generateThemeVariants(theme))
})

export const themeList = Object.values(themes)

export function applyTheme(themeKey: string): Theme {
  const theme = themes[themeKey] || themes.pureMilk
  const root = document.documentElement
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', themeKey)
  root.setAttribute('data-dark', theme.dark ? 'true' : 'false')
  return theme
}
