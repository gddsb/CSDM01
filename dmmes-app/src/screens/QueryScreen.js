import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Loading } from '../components/ui';
import api from '../api';
import theme from '../theme';

const tabs = [
  { key: 'order', label: '生产订单' },
  { key: 'workorder', label: '生产工单' },
  { key: 'device', label: '设备档案' },
];

export default function QueryScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('order');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) {
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      let res;
      if (activeTab === 'order') {
        res = await api.get('/production/orders', { params: { page: 1, pageSize: 20, keyword: keyword.trim() } });
      } else if (activeTab === 'workorder') {
        res = await api.get('/production/work-orders', { params: { page: 1, pageSize: 20, keyword: keyword.trim() } });
      } else {
        res = await api.get('/basic/devices', { params: { page: 1, pageSize: 20, keyword: keyword.trim() } });
      }
      setData(res.data || []);
    } catch (e) {
      console.error('Search error:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const renderOrderItem = (item) => (
    <Card key={item.order_id} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{item.order_no}</Text>
        <Text style={[styles.statusTag, styles[`status_${item.status}`]]}>{item.status}</Text>
      </View>
      <Text style={styles.resultSub}>
        {item.material_name || '-'} · {item.planned_qty || 0}件
      </Text>
    </Card>
  );

  const renderWorkOrderItem = (item) => (
    <Card key={item.work_order_id} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{item.work_order_no}</Text>
        <Text style={[styles.statusTag, styles[`status_${item.status}`]]}>{item.status}</Text>
      </View>
      <Text style={styles.resultSub}>
        {item.line_name || '-'} · {item.process_name || '-'}
      </Text>
    </Card>
  );

  const renderDeviceItem = (item) => (
    <Card key={item.device_id || item.id} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{item.device_name}</Text>
        <Text style={[styles.statusTag, styles[`status_${item.status}`]]}>{item.status || '运行'}</Text>
      </View>
      <Text style={styles.resultSub}>
        {item.device_code} · {item.device_type || '-'}
      </Text>
    </Card>
  );

  const renderItem = ({ item }) => {
    if (activeTab === 'order') return renderOrderItem(item);
    if (activeTab === 'workorder') return renderWorkOrderItem(item);
    return renderDeviceItem(item);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据查询</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={theme.colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'order' ? '搜索订单号/产品名称' :
              activeTab === 'workorder' ? '搜索工单号' : '搜索设备名称/编号'
            }
            placeholderTextColor={theme.colors.text.disabled}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {keyword ? (
            <TouchableOpacity onPress={() => { setKeyword(''); setData([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>搜索</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => { setActiveTab(tab.key); setData([]); setSearched(false); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : !searched ? (
        <View style={styles.placeholder}>
          <Ionicons name="search-outline" size={48} color={theme.colors.text.disabled} />
          <Text style={styles.placeholderText}>输入关键词开始查询</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => String(item.order_id || item.work_order_id || item.device_id || item.id || i)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState text="未找到相关数据" />}
        />
      )}
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
  searchBar: {
    flexDirection: 'row', padding: theme.spacing.md,
    backgroundColor: theme.colors.bg.primary, alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.bg.secondary, borderRadius: theme.radius.round,
    paddingHorizontal: theme.spacing.md, height: 36,
  },
  searchInput: {
    flex: 1, marginLeft: theme.spacing.sm, fontSize: theme.fontSize.md,
    color: theme.colors.text.primary, padding: 0,
  },
  searchBtn: {
    marginLeft: theme.spacing.md, paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
  },
  searchBtnText: { color: '#fff', fontSize: theme.fontSize.md, fontWeight: '500' },
  tabs: {
    flexDirection: 'row', backgroundColor: theme.colors.bg.primary,
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border.secondary,
  },
  tab: {
    flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center',
    borderRadius: theme.radius.md, marginHorizontal: 2,
  },
  activeTab: { backgroundColor: theme.colors.primaryLight },
  tabText: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary },
  activeTabText: { color: theme.colors.primary, fontWeight: '600' },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  resultCard: { marginBottom: theme.spacing.md, padding: theme.spacing.md },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  resultTitle: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text.primary },
  resultSub: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary },
  statusTag: {
    fontSize: theme.fontSize.xs, paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2, borderRadius: theme.radius.sm, overflow: 'hidden',
  },
  status_开立: { color: '#FA8C16', backgroundColor: '#FFF7E6' },
  status_下发: { color: '#1890FF', backgroundColor: '#E6F7FF' },
  status_开工: { color: '#1890FF', backgroundColor: '#E6F7FF' },
  status_完工: { color: '#52C41A', backgroundColor: '#F6FFED' },
  status_运行: { color: '#52C41A', backgroundColor: '#F6FFED' },
  status_维修: { color: '#FAAD14', backgroundColor: '#FFFBE6' },
  status_停用: { color: '#8C8C8C', backgroundColor: '#F5F5F5' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: theme.fontSize.md, color: theme.colors.text.disabled, marginTop: theme.spacing.md },
});
