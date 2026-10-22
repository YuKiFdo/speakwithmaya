import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { AdminAuthStore } from '@/services/store/admin-auth-store';

export default function AdminLoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (AdminAuthStore.isAuthenticated()) {
      router.replace('/admin/users');
    }
  }, []);

  const handleLogin = () => {
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const ok = AdminAuthStore.login(username, password);
      setIsSubmitting(false);
      if (ok) {
        router.replace('/admin/users');
      } else {
        setErrorMsg('Invalid admin username or password.');
      }
    }, 150);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Brand Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="mic" size={22} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.brandTitle}>SpeakMaya Admin</Text>
              <Text style={styles.brandSubtitle}>Control Center & Analytics</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.heading}>Admin Sign In</Text>
          <Text style={styles.subheading}>
            Enter your administrator credentials to access the management portal.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Username Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={16} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter admin username"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={handleLogin}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={16} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Enter admin password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color="#64748b"
                />
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.submitBtnPressed,
              isSubmitting && styles.submitBtnDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Sign In to Admin</Text>
                <Feather name="arrow-right" size={16} color="#ffffff" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 17,
    color: '#0f172a',
  },
  brandSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 20,
  },
  heading: {
    ...fontStyle('inter', 'bold'),
    fontSize: 20,
    color: '#0f172a',
    marginBottom: 6,
  },
  subheading: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#dc2626',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  submitBtn: {
    marginTop: 8,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#0d9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnPressed: {
    backgroundColor: '#0f766e',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#ffffff',
  },
});
