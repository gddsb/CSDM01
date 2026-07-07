import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import theme from '../theme';

export function Card({ style, children, ...props }) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export function EmptyState({ text = '暂无数据', icon }) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading({ text = '加载中...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

export function Tag({ text, color = theme.colors.primary, bgColor, style, textStyle }) {
  const bg = bgColor || `${color}20`;
  return (
    <View style={[styles.tag, { backgroundColor: bg, borderColor: color }, style]}>
      <Text style={[styles.tagText, { color }, textStyle]}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ title, right, style }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {right}
    </View>
  );
}

export function StatCard({ label, value, icon, color = theme.colors.primary }) {
  return (
    <Card style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {icon && <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>{icon}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bg.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.md,
  },
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitleText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    padding: theme.spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: theme.fontSize.title,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
