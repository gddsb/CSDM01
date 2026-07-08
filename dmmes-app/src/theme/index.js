export const theme = {
  colors: {
    primary: '#1890FF',
    primaryDark: '#096DD9',
    primaryLight: '#E6F7FF',
    success: '#52C41A',
    warning: '#FAAD14',
    error: '#FF4D4F',
    info: '#13C2C2',
    text: {
      primary: '#262626',
      secondary: '#595959',
      tertiary: '#8C8C8C',
      disabled: '#BFBFBF',
      inverse: '#FFFFFF',
    },
    bg: {
      primary: '#FFFFFF',
      secondary: '#F5F7FA',
      tertiary: '#F0F2F5',
      overlay: 'rgba(0, 0, 0, 0.45)',
    },
    border: {
      primary: '#D9D9D9',
      secondary: '#F0F0F0',
    },
    status: {
      open: '#FAAD14',
      started: '#1890FF',
      finished: '#52C41A',
      running: '#52C41A',
      maintenance: '#FAAD14',
      stopped: '#8C8C8C',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    title: 24,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
};

export default theme;
