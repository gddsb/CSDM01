import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import theme from '../theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (!password.trim()) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
    } catch (e) {
      Alert.alert('登录失败', e.message || '请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <Ionicons name="factory" size={48} color="#fff" />
            </View>
            <Text style={styles.appName}>DMMES</Text>
            <Text style={styles.appDesc">数字化制造执行系统</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formTitle}>账号登录</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>用户名</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={theme.colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="请输入用户名"
                  placeholderTextColor={theme.colors.text.disabled}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>密码</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="请输入密码"
                  placeholderTextColor={theme.colors.text.disabled}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title="登 录"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={styles.loginBtn}
            />

            <Text style={styles.tip}>
              快捷登录账号：admin / 123456
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: 2,
  },
  appDesc: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
  },
  formSection: {
    flex: 1,
  },
  formTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xl,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.secondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    padding: 0,
  },
  loginBtn: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  tip: {
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.tertiary,
  },
});
