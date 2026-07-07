import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Card } from '../components/ui';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import theme from '../theme';

const menuItems = [
  { key: 'profile', label: '个人信息', icon: 'person-outline', color: theme.colors.primary },
  { key: 'password', label: '修改密码', icon: 'lock-closed-outline', color: theme.colors.success },
  { key: 'about', label: '关于我们', icon: 'information-circle-outline', color: theme.colors.info },
  { key: 'feedback', label: '意见反馈', icon: 'chatbox-outline', color: theme.colors.warning },
];

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [currentVersion] = useState(Constants?.expoConfig?.version || '1.0.0');

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await api.get('/app/version/latest').catch(() => null);
      if (res && res.data) {
        setLatestVersion(res.data);
        if (res.data.version && res.data.version !== currentVersion) {
          setUpdateModalVisible(true);
        } else {
          Alert.alert('版本检查', '当前已是最新版本');
        }
      } else {
        Alert.alert('版本检查', '无法获取最新版本信息');
      }
    } catch (e) {
      Alert.alert('版本检查失败', e.message || '请稍后重试');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.key}
      style={styles.menuItem}
      activeOpacity={0.7}
      onPress={() => {
        if (item.key === 'about') {
          Alert.alert('关于 DMMES', `版本：${currentVersion}\n\n数字化制造执行系统移动端\n版权所有 © 2026`);
        } else {
          Alert.alert('提示', `${item.label}功能开发中`);
        }
      }}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.real_name || user?.username || '用户'}</Text>
            <Text style={styles.userRole}>
              {user?.role_name || user?.role || '系统管理员'}
            </Text>
          </View>
        </View>

        <Card style={styles.menuCard}>
          {menuItems.map(renderMenuItem)}
        </Card>

        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={checkUpdate}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: `${theme.colors.primary}15` }]}>
              <Ionicons name="cloud-download-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>检查更新</Text>
              <Text style={styles.menuSub}>当前版本 v{currentVersion}</Text>
            </View>
            {checkingUpdate ? (
              <Text style={styles.updatingText}>检查中...</Text>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
            )}
          </TouchableOpacity>
        </Card>

        <View style={styles.logoutWrap}>
          <Button
            title="退出登录"
            variant="outline"
            onPress={handleLogout}
            style={styles.logoutBtn}
          />
        </View>

        <Text style={styles.footerText}>DMMES v{currentVersion}</Text>
      </ScrollView>

      <Modal
        visible={updateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="cloud-download" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.modalTitle}>发现新版本</Text>
            <Text style={styles.modalVersion}>
              v{currentVersion} → v{latestVersion?.version}
            </Text>
            {latestVersion?.description && (
              <View style={styles.modalDesc}>
                <Text style={styles.modalDescTitle}>更新内容：</Text>
                <Text style={styles.modalDescText}>{latestVersion.description}</Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Button
                title="稍后再说"
                variant="ghost"
                size="md"
                onPress={() => setUpdateModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="立即更新"
                size="md"
                onPress={() => {
                  Alert.alert('提示', '正在下载更新包...');
                  setUpdateModalVisible(false);
                }}
                style={{ flex: 1, marginLeft: theme.spacing.md }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.secondary },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { marginLeft: theme.spacing.lg, flex: 1 },
  userName: { fontSize: theme.fontSize.xl, fontWeight: '600', color: '#fff' },
  userRole: { fontSize: theme.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  menuCard: {
    margin: theme.spacing.lg, marginTop: theme.spacing.md,
    marginBottom: 0, padding: 0, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.secondary,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    marginRight: theme.spacing.md,
  },
  menuLabel: { fontSize: theme.fontSize.md, color: theme.colors.text.primary, flex: 1 },
  menuSub: { fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary, marginTop: 2 },
  updatingText: { fontSize: theme.fontSize.sm, color: theme.colors.text.tertiary },
  logoutWrap: { padding: theme.spacing.lg },
  logoutBtn: { width: '100%' },
  footerText: {
    textAlign: 'center', fontSize: theme.fontSize.xs,
    color: theme.colors.text.disabled, paddingBottom: theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl,
  },
  modalContent: {
    width: '100%', backgroundColor: '#fff', borderRadius: theme.radius.xl,
    padding: theme.spacing.xl, alignItems: 'center',
  },
  modalIcon: { marginBottom: theme.spacing.md },
  modalTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text.primary },
  modalVersion: { fontSize: theme.fontSize.md, color: theme.colors.primary, marginTop: theme.spacing.sm },
  modalDesc: {
    marginTop: theme.spacing.lg, width: '100%',
    backgroundColor: theme.colors.bg.secondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  modalDescTitle: { fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginBottom: 4 },
  modalDescText: { fontSize: theme.fontSize.sm, color: theme.colors.text.primary, lineHeight: 18 },
  modalActions: {
    flexDirection: 'row', marginTop: theme.spacing.xl,
    width: '100%',
  },
});
