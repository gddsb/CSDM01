import React, { useState, useEffect } from 'react';
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
import api from '../api';
import theme from '../theme';

const statusColorMap = {
  运行: theme.colors.status.running,
  维修: theme.colors.status.maintenance,
  停用: theme.colors.status.stopped,
};

export default function MaintenanceScreen({ navigation }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get('/basic/devices', { params: { page: 1, pageSize: 50 } });
      setData(res.data || []);
    } catch (e) {
      console.error('Load devices error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMaintenance = (item) => {
    Alert.alert('提示', `设备 ${item.device_name} 维保记录功能开发中`);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.8} style={styles.itemWrapper}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.deviceName}>{item.device_name}</Text>
            <Text style={styles.deviceNo}>{item.device_code}</Text>
          </View>
          <Tag
            text={item.status || '运行'}
            color={statusColorMap[item.status] || theme.colors.text.tertiary}
          />
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>设备类型</Text>
            <Text style={styles.infoValue}>{item.device_type || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>所属产线</Text>
            <Text style={styles.infoValue}>{item.production_line || '-'}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleMaintenance(item)}
          >
            <Ionicons name="build-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.actionText}>维保记录</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设备维保</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.device_id || item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState text="暂无设备数据" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border.secondary,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  itemWrapper: { marginBottom: theme.spacing.md },
  card: { padding: theme.spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  deviceName: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary },
  deviceNo: { fontSize: theme.fontSize.sm, color: theme.colors.text.tertiary, marginTop: 2 },
  infoRow: { flexDirection: 'row', marginBottom: theme.spacing.md },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginBottom: 2 },
  infoValue: { fontSize: theme.fontSize.md, color: theme.colors.text.primary },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.sm,
  },
  actionText: { fontSize: theme.fontSize.sm, color: theme.colors.primary, marginLeft: 4 },
});
