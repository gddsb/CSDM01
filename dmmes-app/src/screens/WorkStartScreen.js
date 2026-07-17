import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Tag, EmptyState, Loading } from '../components/ui';
import Button from '../components/Button';
import api from '../api';
import theme from '../theme';
import dayjs from 'dayjs';

export default function WorkStartScreen({ navigation }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/production/work-orders', {
        params: { page: 1, pageSize: 50, status: '开立' },
      });
      setData(res.data || []);
    } catch (e) {
      Alert.alert('错误', e.message || '获取工单列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleStart = (item) => {
    Alert.alert(
      '确认开工',
      `确认开工工单 ${item.work_order_no}？\n开工后将进入生产状态，不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认开工',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/production/work-orders/${item.work_order_id}/start`);
              Alert.alert('成功', `工单 ${item.work_order_no} 已开工`);
              loadData();
            } catch (e) {
              Alert.alert('开工失败', e.message || '操作失败');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.8} style={styles.itemWrapper}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderNoWrap}>
            <Text style={styles.orderNo}>{item.work_order_no}</Text>
            <Tag
              text={item.status}
              color={item.status === '开立' ? theme.colors.status.open : theme.colors.status.started}
            />
          </View>
          <Text style={styles.orderName}>{item.order_no}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>产线</Text>
            <Text style={styles.infoValue}>{item.line_name || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>工序</Text>
            <Text style={styles.infoValue}>{item.process_name || '-'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>计划数量</Text>
            <Text style={styles.infoValue}>
              {(item.planned_qty || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>完工数量</Text>
            <Text style={[styles.infoValue, styles.finishedQty]}>
              {(item.finished_qty || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="time-outline" size={14} color={theme.colors.text.tertiary} />
          <Text style={styles.dateText}>
            {item.plan_start_time ? dayjs(item.plan_start_time).format('MM-DD') : '-'}
            {' ~ '}
            {item.plan_end_time ? dayjs(item.plan_end_time).format('MM-DD') : '-'}
          </Text>
        </View>

        {item.status === '开立' && (
          <View style={styles.actionRow}>
            <Button
              title="立即开工"
              size="sm"
              icon={<Ionicons name="play" size={14} color="#fff" />}
              onPress={() => handleStart(item)}
              loading={submitting}
            />
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>生产开工</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.work_order_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={<EmptyState text="暂无待开工工单" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.secondary,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl * 2,
  },
  itemWrapper: {
    marginBottom: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.lg,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  orderNoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderNo: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  orderName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.secondary,
    marginVertical: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  finishedQty: {
    color: theme.colors.success,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginLeft: 4,
  },
  actionRow: {
    marginTop: theme.spacing.md,
    alignItems: 'flex-end',
  },
});
