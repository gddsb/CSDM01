import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui';
import api from '../api';
import theme from '../theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({
    todayOutput: 0,
    todayOrder: 0,
    defectiveRate: 0,
    deviceUtilization: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lineData, setLineData] = useState([
    { name: '产线一', output: 1200, target: 1500, status: 'running' },
    { name: '产线二', output: 800, target: 1000, status: 'running' },
    { name: '产线三', output: 0, target: 1200, status: 'stopped' },
    { name: '产线四', output: 600, target: 800, status: 'maintenance' },
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersRes, workOrdersRes] = await Promise.all([
          api.get('/production/orders', { params: { page: 1, pageSize: 1 } }).catch(() => ({ total: 0 })),
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1 } }).catch(() => ({ total: 0 })),
        ]);
        setStats((s) => ({
          ...s,
          todayOrder: ordersRes.total || 0,
          todayOutput: (workOrdersRes.total || 0) * 100,
        }));
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const statItems = [
    { label: '今日产量', value: stats.todayOutput.toLocaleString(), unit: '件', color: theme.colors.primary, icon: 'bar-chart-outline' },
    { label: '在制订单', value: stats.todayOrder, unit: '单', color: theme.colors.success, icon: 'document-text-outline' },
    { label: '不良率', value: `${stats.defectiveRate}%`, unit: '', color: theme.colors.error, icon: 'alert-circle-outline' },
    { label: '设备稼动率', value: `${stats.deviceUtilization}%`, unit: '', color: theme.colors.warning, icon: 'construct-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>生产看板</Text>
        <Text style={styles.headerTime}>
          {new Date().toLocaleDateString('zh-CN')}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsGrid}>
          {statItems.map((item, index) => (
            <Card key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={[styles.statValue, { color: item.color }]}>
                {item.value}
                <Text style={styles.statUnit}> {item.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>产线生产进度</Text>
          {lineData.map((line, index) => (
            <View key={index} style={styles.lineItem}>
              <View style={styles.lineHeader}>
                <View style={styles.lineNameWrap}>
                  <View
                    style={[
                      styles.lineStatusDot,
                      {
                        backgroundColor:
                          line.status === 'running' ? theme.colors.success :
                          line.status === 'maintenance' ? theme.colors.warning :
                          theme.colors.text.disabled,
                      },
                    ]}
                  />
                  <Text style={styles.lineName}>{line.name}</Text>
                </View>
                <Text style={styles.lineOutput}>
                  {line.output.toLocaleString()} / {line.target.toLocaleString()}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, (line.output / line.target) * 100)}%`,
                      backgroundColor:
                        line.status === 'running' ? theme.colors.primary :
                        line.status === 'maintenance' ? theme.colors.warning :
                        theme.colors.text.disabled,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {((line.output / line.target) * 100).toFixed(1)}%
              </Text>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>当日产量趋势</Text>
          <View style={styles.chartContainer}>
            {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
              <View key={i} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: `${h}%` }]} />
                <Text style={styles.chartLabel}>{i + 8}时</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>设备状态</Text>
          <View style={styles.deviceRow}>
            <View style={styles.deviceItem}>
              <Text style={[styles.deviceNum, { color: theme.colors.success }]}>12</Text>
              <Text style={styles.deviceLabel}>运行中</Text>
            </View>
            <View style={styles.deviceDivider} />
            <View style={styles.deviceItem}>
              <Text style={[styles.deviceNum, { color: theme.colors.warning }]}>2</Text>
              <Text style={styles.deviceLabel}>维修中</Text>
            </View>
            <View style={styles.deviceDivider} />
            <View style={styles.deviceItem}>
              <Text style={[styles.deviceNum, { color: theme.colors.text.disabled }]}>1</Text>
              <Text style={styles.deviceLabel}>已停用</Text>
            </View>
            <View style={styles.deviceDivider} />
            <View style={styles.deviceItem}>
              <Text style={[styles.deviceNum, { color: theme.colors.primary }]}>15</Text>
              <Text style={styles.deviceLabel}>总数</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.secondary },
  header: {
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
  },
  headerTitle: { fontSize: theme.fontSize.xl, fontWeight: '700', color: '#fff' },
  headerTime: { fontSize: theme.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: -theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.sm * 2) / 2,
    margin: theme.spacing.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 44, height: 44, borderRadius: theme.radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm,
  },
  statValue: { fontSize: theme.fontSize.xl, fontWeight: '700' },
  statUnit: { fontSize: theme.fontSize.sm, fontWeight: '400' },
  statLabel: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginTop: 2 },
  sectionCard: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: theme.fontSize.lg, fontWeight: '600',
    color: theme.colors.text.primary, marginBottom: theme.spacing.lg,
  },
  lineItem: { marginBottom: theme.spacing.md },
  lineHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: theme.spacing.sm,
  },
  lineNameWrap: { flexDirection: 'row', alignItems: 'center' },
  lineStatusDot: {
    width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing.sm,
  },
  lineName: { fontSize: theme.fontSize.md, color: theme.colors.text.primary, fontWeight: '500' },
  lineOutput: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary },
  progressBar: {
    height: 8, backgroundColor: theme.colors.bg.tertiary,
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPercent: {
    fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary,
    textAlign: 'right', marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 150, justifyContent: 'space-around',
    paddingTop: theme.spacing.lg,
  },
  chartBarWrap: { alignItems: 'center', flex: 1 },
  chartBar: {
    width: 20, backgroundColor: theme.colors.primary,
    borderRadius: 4, minHeight: 4,
  },
  chartLabel: {
    fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginTop: 8,
  },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingVertical: theme.spacing.md,
  },
  deviceItem: { alignItems: 'center', flex: 1 },
  deviceNum: { fontSize: theme.fontSize.title, fontWeight: '700' },
  deviceLabel: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginTop: 4 },
  deviceDivider: {
    width: 1, height: 30, backgroundColor: theme.colors.border.secondary,
  },
});
