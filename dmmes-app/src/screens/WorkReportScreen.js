import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Tag, EmptyState, Loading } from '../components/ui';
import Button from '../components/Button';
import api from '../api';
import theme from '../theme';

const tabs = [
  { key: 'list', label: '工单列表' },
  { key: 'defect', label: '不良登记' },
  { key: 'material', label: '物料录入' },
];

export default function WorkReportScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWO, setSelectedWO] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [defectData, setDefectData] = useState([]);
  const [materialData, setMaterialData] = useState([]);

  const [defectForm, setDefectForm] = useState({
    defect_type: '制程不良',
    defect_name: '',
    qty: '',
    unit: '罐',
  });

  const [materialForm, setMaterialForm] = useState({
    material_type: '',
    material_batch: '',
    qty: '',
  });

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/production/work-orders', {
        params: { page: 1, pageSize: 50, status: '开工' },
      });
      setData(res.data || []);
    } catch (e) {
      console.error('Load work orders error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadDetailData = async (woId) => {
    try {
      const [defectRes, materialRes] = await Promise.all([
        api.get(`/production/work-orders/${woId}/process-defects`, { params: { page: 1, pageSize: 100 } }).catch(() => ({ data: [] })),
        api.get(`/production/work-orders/${woId}/process-materials`, { params: { page: 1, pageSize: 100 } }).catch(() => ({ data: [] })),
      ]);
      setDefectData(defectRes.data || []);
      setMaterialData(materialRes.data || []);
    } catch (e) {
      console.error('Load detail error:', e);
    }
  };

  const handleSelectWO = (item) => {
    setSelectedWO(item);
    loadDetailData(item.work_order_id);
  };

  const handleSubmitDefect = async () => {
    if (!defectForm.defect_name.trim()) {
      Alert.alert('提示', '请输入不良名称');
      return;
    }
    if (!defectForm.qty || Number(defectForm.qty) <= 0) {
      Alert.alert('提示', '请输入正确的不良数量');
      return;
    }
    try {
      await api.post(`/production/process-defects`, {
        work_order_id: selectedWO.work_order_id,
        defect_type: defectForm.defect_type,
        defect_name: defectForm.defect_name,
        qty: Number(defectForm.qty),
        unit: defectForm.unit,
      });
      Alert.alert('成功', '不良登记已提交');
      setDefectForm({ defect_type: '制程不良', defect_name: '', qty: '', unit: '罐' });
      loadDetailData(selectedWO.work_order_id);
    } catch (e) {
      Alert.alert('失败', e.message || '提交失败');
    }
  };

  const handleSubmitMaterial = async () => {
    if (!materialForm.material_type.trim()) {
      Alert.alert('提示', '请选择物料类型');
      return;
    }
    if (!materialForm.qty || Number(materialForm.qty) <= 0) {
      Alert.alert('提示', '请输入正确的数量');
      return;
    }
    try {
      await api.post(`/production/process-materials`, {
        work_order_id: selectedWO.work_order_id,
        material_type: materialForm.material_type,
        material_batch: materialForm.material_batch,
        qty: Number(materialForm.qty),
      });
      Alert.alert('成功', '物料录入已提交');
      setMaterialForm({ material_type: '', material_batch: '', qty: '' });
      loadDetailData(selectedWO.work_order_id);
    } catch (e) {
      Alert.alert('失败', e.message || '提交失败');
    }
  };

  const handleFinish = (item) => {
    Alert.alert(
      '确认完工',
      `确认完工工单 ${item.work_order_no}？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认完工',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/production/work-orders/${item.work_order_id}/finish`);
              Alert.alert('成功', '工单已完工');
              loadData();
            } catch (e) {
              Alert.alert('失败', e.message || '操作失败');
            }
          },
        },
      ]
    );
  };

  const renderWOItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.itemWrapper}
      onPress={() => handleSelectWO(item)}
    >
      <Card style={[styles.card, selectedWO?.work_order_id === item.work_order_id && styles.selectedCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNo}>{item.work_order_no}</Text>
          <Tag text={item.status} color={theme.colors.status.started} />
        </View>
        <Text style={styles.orderName}>{item.order_no}</Text>

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

        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, ((item.finished_qty || 0) / (item.planned_qty || 1)) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {(item.finished_qty || 0).toLocaleString()} / {(item.planned_qty || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Button title="报工" size="sm" variant="primary" onPress={() => { setModalVisible(true); handleSelectWO(item); }} />
          <Button title="完工" size="sm" variant="outline" onPress={() => handleFinish(item)} />
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
        <Text style={styles.headerTitle}>生产报工</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'list' && (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.work_order_id)}
          renderItem={renderWOItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState text="暂无进行中的工单" />}
        />
      )}

      {activeTab === 'defect' && (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>不良登记</Text>

            <Text style={styles.formLabel}>不良分类</Text>
            <View style={styles.radioRow}>
              {['制程不良', '来料不良', '检验报废'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.radioItem}
                  onPress={() => setDefectForm({ ...defectForm, defect_type: type })}
                >
                  <View style={[styles.radioCircle, defectForm.defect_type === type && styles.radioSelected]}>
                    {defectForm.defect_type === type && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>不良名称</Text>
            <TextInput
              style={styles.textInput}
              placeholder="请输入不良名称"
              value={defectForm.defect_name}
              onChangeText={(v) => setDefectForm({ ...defectForm, defect_name: v })}
            />

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>数量</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="数量"
                  keyboardType="numeric"
                  value={defectForm.qty}
                  onChangeText={(v) => setDefectForm({ ...defectForm, qty: v })}
                />
              </View>
              <View style={{ width: theme.spacing.md }} />
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>单位</Text>
                <View style={styles.radioRow}>
                  {['罐', '小片'].map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={styles.radioItem}
                      onPress={() => setDefectForm({ ...defectForm, unit: u })}
                    >
                      <View style={[styles.radioCircle, defectForm.unit === u && styles.radioSelected]}>
                        {defectForm.unit === u && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioText}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Button title="提交不良记录" onPress={handleSubmitDefect} style={styles.submitBtn} />
          </Card>

          <Card style={styles.recordCard}>
            <Text style={styles.recordTitle}>不良记录 ({defectData.length})</Text>
            {defectData.length === 0 ? (
              <Text style={styles.emptyText}>暂无记录</Text>
            ) : (
              defectData.map((d, i) => (
                <View key={i} style={styles.recordItem}>
                  <View>
                    <Text style={styles.recordName}>{d.defect_name}</Text>
                    <Text style={styles.recordMeta}>
                      {d.defect_type} · {d.unit}
                    </Text>
                  </View>
                  <Text style={styles.recordQty}>-{d.qty}</Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}

      {activeTab === 'material' && (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>物料录入</Text>

            <Text style={styles.formLabel}>物料类型</Text>
            <View style={styles.typeGrid}>
              {['马口铁素铁', '印花马口铁', '涂料', '稀释剂', '底盖', '上盖', '纸板', '其它'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, materialForm.material_type === type && styles.typeChipActive]}
                  onPress={() => setMaterialForm({ ...materialForm, material_type: type })}
                >
                  <Text style={[styles.typeChipText, materialForm.material_type === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>物料批号（选填）</Text>
            <TextInput
              style={styles.textInput}
              placeholder="请输入物料批号"
              value={materialForm.material_batch}
              onChangeText={(v) => setMaterialForm({ ...materialForm, material_batch: v })}
            />

            <Text style={styles.formLabel}>数量</Text>
            <TextInput
              style={styles.textInput}
              placeholder="请输入数量"
              keyboardType="numeric"
              value={materialForm.qty}
              onChangeText={(v) => setMaterialForm({ ...materialForm, qty: v })}
            />

            <Button title="提交物料记录" onPress={handleSubmitMaterial} style={styles.submitBtn} />
          </Card>

          <Card style={styles.recordCard}>
            <Text style={styles.recordTitle}>物料记录 ({materialData.length})</Text>
            {materialData.length === 0 ? (
              <Text style={styles.emptyText}>暂无记录</Text>
            ) : (
              materialData.map((m, i) => (
                <View key={i} style={styles.recordItem}>
                  <View>
                    <Text style={styles.recordName}>{m.material_type}</Text>
                    <Text style={styles.recordMeta}>
                      批号: {m.material_batch || '-'}
                    </Text>
                  </View>
                  <Text style={[styles.recordQty, { color: theme.colors.primary }]}>+{m.qty}</Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bg.primary,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.secondary,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    marginHorizontal: 2,
  },
  activeTab: { backgroundColor: theme.colors.primaryLight },
  tabText: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary },
  activeTabText: { color: theme.colors.primary, fontWeight: '600' },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  itemWrapper: { marginBottom: theme.spacing.md },
  card: { padding: theme.spacing.lg },
  selectedCard: { borderWidth: 2, borderColor: theme.colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNo: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary },
  orderName: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing.sm },
  infoRow: { flexDirection: 'row', marginBottom: theme.spacing.sm },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginBottom: 2 },
  infoValue: { fontSize: theme.fontSize.md, color: theme.colors.text.primary, fontWeight: '500' },
  progressWrap: { marginVertical: theme.spacing.sm },
  progressBar: { height: 6, backgroundColor: theme.colors.bg.tertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  progressText: { fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginTop: 4, textAlign: 'right' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  formScroll: { flex: 1 },
  formContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  formCard: { marginBottom: theme.spacing.lg },
  formTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary, marginBottom: theme.spacing.lg },
  formLabel: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  textInput: {
    backgroundColor: theme.colors.bg.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap' },
  radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg, marginBottom: theme.spacing.sm },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: theme.colors.border.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: theme.colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  radioText: { fontSize: theme.fontSize.md, color: theme.colors.text.primary, marginLeft: theme.spacing.sm },
  formRow: { flexDirection: 'row' },
  formHalf: { flex: 1 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  typeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg.secondary,
    borderRadius: theme.radius.round,
    margin: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  typeChipText: { fontSize: theme.fontSize.sm, color: theme.colors.text.primary },
  typeChipTextActive: { color: theme.colors.primary, fontWeight: '500' },
  submitBtn: { marginTop: theme.spacing.xl, width: '100%' },
  recordCard: {},
  recordTitle: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text.primary, marginBottom: theme.spacing.md },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.secondary,
  },
  recordName: { fontSize: theme.fontSize.md, color: theme.colors.text.primary },
  recordMeta: { fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginTop: 2 },
  recordQty: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.error },
  emptyText: { fontSize: theme.fontSize.sm, color: theme.colors.text.tertiary, textAlign: 'center', paddingVertical: theme.spacing.lg },
});
