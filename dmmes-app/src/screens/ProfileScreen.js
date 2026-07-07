import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
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
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
      const res = await api.get('/app/version/latest', {
        params: { platform: Platform.OS === 'android' ? 'android' : 'ios' },
      }).catch(() => null);
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

  // 下载并安装 APK
  const downloadAndInstallApk = async (downloadUrl) => {
    if (!downloadUrl) {
      Alert.alert('错误', '下载地址不存在');
      return;
    }
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const apkPath = FileSystem.documentDirectory + 'dmmes-update.apk';
      // 若已存在旧包，先删除
      const fileInfo = await FileSystem.getInfoAsync(apkPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(apkPath, { idempotent: true });
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        apkPath,
        {},
        (dlProgress) => {
          const percent = Math.round(
            (dlProgress.totalBytesWritten / dlProgress.totalBytesExpectedToWrite) * 100
          );
          setDownloadProgress(percent);
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('下载失败');
      }

      // 触发 Android 系统安装界面
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
        setUpdateModalVisible(false);
      } else {
        // iOS 无法直接安装 IPA，引导用户用浏览器打开下载链接
        const supported = await Linking.canOpenURL(downloadUrl);
        if (supported) {
          await Linking.openURL(downloadUrl);
        }
        setUpdateModalVisible(false);
      }
    } catch (e) {
      Alert.alert('下载失败', e.message || '请检查网络后重试');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
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

  const isForceUpdate = latestVersion?.is_force === 1 || latestVersion?.is_force === true;

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
            disabled={checkingUpdate || downloading}
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
        onRequestClose={() => {
          if (!isForceUpdate && !downloading) setUpdateModalVisible(false);
        }}
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
            {latestVersion?.file_size && (
              <Text style={styles.modalFileSize}>安装包大小：{latestVersion.file_size}</Text>
            )}
            {isForceUpdate && (
              <Text style={styles.modalForceTip}>此为强制更新版本，需更新后才能继续使用</Text>
            )}

            {downloading ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>下载中 {downloadProgress}%</Text>
              </View>
            ) : (
              <View style={styles.modalActions}>
                {!isForceUpdate && (
                  <Button
                    title="稍后再说"
                    variant="ghost"
                    size="md"
                    onPress={() => setUpdateModalVisible(false)}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title="立即更新"
                  size="md"
                  onPress={() => downloadAndInstallApk(latestVersion?.download_url)}
                  style={{ flex: 1, marginLeft: isForceUpdate ? 0 : theme.spacing.md }}
                />
              </View>
            )}
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
  modalFileSize: {
    fontSize: theme.fontSize.xs, color: theme.colors.text.tertiary,
    marginTop: theme.spacing.sm,
  },
  modalForceTip: {
    fontSize: theme.fontSize.xs, color: theme.colors.warning || '#FF9800',
    marginTop: theme.spacing.xs, textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row', marginTop: theme.spacing.xl,
    width: '100%',
  },
  progressWrap: {
    width: '100%', marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%', height: 6,
    backgroundColor: theme.colors.bg.secondary,
    borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: theme.fontSize.sm, color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
  },
});
