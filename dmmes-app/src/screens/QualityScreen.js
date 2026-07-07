import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui';
import Button from '../components/Button';
import theme from '../theme';

const defectCategories = [
  { key: 'appearance', name: '外观检验', items: ['表面划伤', '凹坑', '变形', '色差', '印刷不良'] },
  { key: 'size', name: '尺寸检验', items: ['直径偏差', '高度偏差', '厚度偏差', '重量偏差'] },
  { key: 'sealing', name: '密封检验', items: ['漏气', '漏液', '封口不良'] },
  { key: 'function', name: '功能检验', items: ['开启力', '耐压', '跌落测试'] },
];

export default function QualityScreen({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('appearance');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [inspector, setInspector] = useState('');
  const [sampleQty, setSampleQty] = useState('');
  const [defectQty, setDefectQty] = useState('');
  const [defectItems, setDefectItems] = useState({});
  const [remark, setRemark] = useState('');

  const category = defectCategories.find((c) => c.key === selectedCategory);

  const handleItemToggle = (item) => {
    setDefectItems((prev) => {
      const next = { ...prev };
      if (next[item]) {
        delete next[item];
      } else {
        next[item] = '1';
      }
      return next;
    });
  };

  const handleItemQtyChange = (item, value) => {
    setDefectItems((prev) => ({ ...prev, [item]: value }));
  };

  const handleSubmit = () => {
    if (!workOrderNo.trim()) {
      Alert.alert('提示', '请输入工单号');
      return;
    }
    const selectedCount = Object.keys(defectItems).length;
    if (selectedCount === 0) {
      Alert.alert(
        '确认提交',
        '未选择任何不良项目，确认提交合格记录？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确认提交', onPress: () => submitRecord() },
        ]
      );
    } else {
      submitRecord();
    }
  };

  const submitRecord = () => {
    Alert.alert('成功', '检验记录已提交');
    setWorkOrderNo('');
    setSampleQty('');
    setDefectQty('');
    setDefectItems({});
    setRemark('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>质量检验</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>基本信息</Text>

          <Text style={styles.formLabel}>工单号</Text>
          <TextInput
            style={styles.textInput}
            placeholder="请扫描或输入工单号"
            value={workOrderNo}
            onChangeText={setWorkOrderNo}
          />

          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>检验员</Text>
              <TextInput
                style={styles.textInput}
                placeholder="检验员"
                value={inspector}
                onChangeText={setInspector}
              />
            </View>
            <View style={{ width: theme.spacing.md }} />
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>抽样数</Text>
              <TextInput
                style={styles.textInput}
                placeholder="抽样数量"
                keyboardType="numeric"
                value={sampleQty}
                onChangeText={setSampleQty}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>不良数</Text>
              <TextInput
                style={styles.textInput}
                placeholder="不良数量"
                keyboardType="numeric"
                value={defectQty}
                onChangeText={setDefectQty}
              />
            </View>
            <View style={{ width: theme.spacing.md }} />
            <View style={styles.formHalf}>
              <Text style={styles.formLabel}>不良率</Text>
              <View style={[styles.textInput, styles.disabledInput]}>
                <Text style={styles.disabledText}>
                  {sampleQty && defectQty
                    ? `${((Number(defectQty) / Number(sampleQty)) * 100).toFixed(2)}%`
                    : '-'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>检验分类</Text>
          <View style={styles.categoryTabs}>
            {defectCategories.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryTab, selectedCategory === cat.key && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    selectedCategory === cat.key && styles.categoryTabTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.itemList}>
            {category?.items.map((item) => (
              <View key={item} style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.checkboxWrap}
                  onPress={() => handleItemToggle(item)}
                >
                  <View style={[styles.checkbox, defectItems[item] && styles.checkboxChecked]}>
                    {defectItems[item] && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.itemName}>{item}</Text>
                </TouchableOpacity>
                {defectItems[item] && (
                  <TextInput
                    style={styles.itemQtyInput}
                    keyboardType="numeric"
                    value={defectItems[item]}
                    onChangeText={(v) => handleItemQtyChange(item, v)}
                    placeholder="数量"
                  />
                )}
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>备注</Text>
          <TextInput
            style={styles.textArea}
            placeholder="请输入检验备注..."
            multiline
            numberOfLines={3}
            value={remark}
            onChangeText={setRemark}
            textAlignVertical="top"
          />
        </Card>

        <Button
          title="提交检验记录"
          size="lg"
          onPress={handleSubmit}
          style={styles.submitBtn}
        />
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2 },
  formCard: { marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary, marginBottom: theme.spacing.lg },
  formLabel: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  textInput: {
    backgroundColor: theme.colors.bg.secondary, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, height: 44, fontSize: theme.fontSize.md,
    color: theme.colors.text.primary, borderWidth: 1, borderColor: 'transparent',
  },
  textArea: {
    backgroundColor: theme.colors.bg.secondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: theme.fontSize.md,
    color: theme.colors.text.primary, minHeight: 80,
  },
  formRow: { flexDirection: 'row' },
  formHalf: { flex: 1 },
  disabledInput: { justifyContent: 'center', backgroundColor: theme.colors.bg.tertiary },
  disabledText: { color: theme.colors.text.secondary, fontSize: theme.fontSize.md },
  categoryTabs: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: theme.spacing.md },
  categoryTab: {
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg.secondary, borderRadius: theme.radius.round,
    margin: 4, borderWidth: 1, borderColor: 'transparent',
  },
  categoryTabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  categoryTabText: { fontSize: theme.fontSize.sm, color: theme.colors.text.primary },
  categoryTabTextActive: { color: theme.colors.primary, fontWeight: '500' },
  itemList: { marginTop: theme.spacing.sm },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border.secondary,
  },
  checkboxWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: theme.radius.sm,
    borderWidth: 2, borderColor: theme.colors.border.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.sm,
  },
  checkboxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  itemName: { fontSize: theme.fontSize.md, color: theme.colors.text.primary },
  itemQtyInput: {
    width: 80, height: 36, backgroundColor: theme.colors.bg.secondary,
    borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm,
    fontSize: theme.fontSize.sm, textAlign: 'center',
  },
  submitBtn: { marginTop: theme.spacing.md },
});
