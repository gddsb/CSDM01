import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Card, StatCard, Loading } from '../components/ui';
import api from '../api';
import theme from '../theme';
import dayjs from 'dayjs';

const menuItems = [
  { key: 'start', label: '生产开工', icon: 'play-circle', color: '#52C41A', screen: 'WorkStart' },
  { key: 'report', label: '生产报工', icon: 'checkmark-circle', color: '#1890FF', screen: 'WorkReport' },
  { key: 'maintenance', label: '设备维保', icon: 'build', color: '#FAAD14', screen: 'Maintenance', iconLib: 'md' },
  { key: 'quality', label: '质量检验', icon: 'md-checkbox-outline', color: '#13C2C2', screen: 'Quality', iconLib: 'md' },
  { key: 'query', label: '数据查询', icon: 'search', color: '#722ED1', screen: 'Query' },
  { key: 'dashboard', label: '生产看板', icon: 'bar-chart', color: '#EB2F96', screen: 'Dashboard', iconLib: 'md' },
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    orderCount: 0,
    workOrderCount: 0,
    todayOutput: 0,
    deviceCount: 0,
  });

  const loadStats = async () => {
    try {
      const [ordersRes, workOrdersRes] = await Promise.all([
        api.get('/production/orders', { params: { page: 1, pageSize: 1 } }),
        api.get('/production/work-orders', { params: { page: 1, pageSize: 1 } }),
      ]).catch(() => [{ total: 0 }, { total: 0 }]);
      setStats({
        orderCount: ordersRes.total || 0,
        workOrderCount: workOrdersRes.total || 0,
        todayOutput: 0,
        deviceCount: 0,
      });
    } catch (e) {
      console.error('Load stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMenuPress = (item) => {
    if (navigation && item.screen) {
      navigation.navigate(item.screen);
    } else {
      Alert.alert('提示', `${item.label}功能开发中`);
    }
  };

  const renderIcon = (item) => {
    if (item.iconLib === 'md') {
      return <MaterialCommunityIcons name={item.icon} size={28} color={item.color} />;
    }
    return <Ionicons name={item.icon} size={28} color={item.color} />;
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {dayjs().hour() < 12 ? '早上好' : dayjs().hour() < 18 ? '下午好' : '晚上好'}，{user?.real_name || user?.username || '用户'}
            </Text>
            <Text style={styles.date}>
              {dayjs().format('YYYY年MM月DD日 dddd')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation?.navigate('Profile')}
          >
            <Ionicons name="person" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="生产订单"
            value={stats.orderCount}
            color={theme.colors.primary}
            icon={<Ionicons name="document-text" size={20} color={theme.colors.primary} />}
          />
          <View style={{ width: theme.spacing.md }} />
          <StatCard
            label="生产工单"
            value={stats.workOrderCount}
            color={theme.colors.success}
            icon={<Ionicons name="construct" size={20} color={theme.colors.success} />}
          />
        </View>

        <Card style={styles.menuCard}>
          <Text style={styles.menuTitle}>功能入口</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  {renderIcon(item)}
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
            <Text style={styles.tipTitle}>使用提示</Text>
          </View>
          <Text style={styles.tipText}>
            • 点击「生产开工」可查看待开工工单并快速开工{'\n'}
            • 点击「生产报工」可进行工序报工、不良登记、物料录入{'\n'}
            • 所有数据实时同步至服务器，支持离线缓存
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  date: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  menuCard: {
    marginBottom: theme.spacing.lg,
  },
  menuTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -theme.spacing.sm,
  },
  menuItem: {
    width: '33.33%',
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  menuLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: '#91D5FF',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  tipTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
    color: theme.colors.primaryDark,
    marginLeft: theme.spacing.sm,
  },
  tipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    lineHeight: 20,
  },
});
