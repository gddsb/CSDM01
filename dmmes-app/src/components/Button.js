import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import theme from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  ...props
}) {
  const buttonStyles = [
    styles.button,
    styles[`${variant}Button`],
    styles[`${size}Button`],
    disabled && styles.disabledButton,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={buttonStyles}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : theme.colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: theme.spacing.xs,
  },
  text: {
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryText: {
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: theme.colors.bg.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  secondaryText: {
    color: theme.colors.text.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  outlineText: {
    color: theme.colors.primary,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
  },
  dangerText: {
    color: '#fff',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: theme.colors.primary,
  },
  smButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minHeight: 28,
  },
  smText: {
    fontSize: theme.fontSize.sm,
  },
  mdButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: 40,
  },
  mdText: {
    fontSize: theme.fontSize.md,
  },
  lgButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
  },
  lgText: {
    fontSize: theme.fontSize.lg,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {},
  fullWidth: {
    width: '100%',
  },
});

export default Button;
