import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  id: number;
  visible: boolean;
  type: AlertType;
  message: string;
  durationMs: number;
}

export interface AlertConfig {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  isConfirm: boolean;
  confirmText: string;
  cancelText: string;
  isDestructive?: boolean;
  resolve?: (value: boolean) => void;
}

// Global alert & toast controller listeners
type AlertListener = (config: AlertConfig) => void;
type ToastListener = (toast: ToastConfig) => void;
const alertListeners = new Set<AlertListener>();
const toastListeners = new Set<ToastListener>();

const DEFAULT_CONFIG: AlertConfig = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  isConfirm: false,
  confirmText: 'Got It',
  cancelText: 'Cancel',
};

let currentConfig: AlertConfig = { ...DEFAULT_CONFIG };
let currentToast: ToastConfig = {
  id: 0,
  visible: false,
  type: 'info',
  message: '',
  durationMs: 4000,
};

/**
 * Programmatic controller to trigger alerts/confirms/toasts anywhere in the application
 */
export const mayaAlert = {
  toast: (message: string, type: AlertType = 'info', durationMs: number = 4000): void => {
    currentToast = {
      id: Date.now() + Math.random(),
      visible: true,
      type,
      message,
      durationMs,
    };
    toastListeners.forEach((l) => l(currentToast));
  },

  alert: (message: string, title?: string, type: AlertType = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      currentConfig = {
        visible: true,
        type,
        title: title || (type === 'error' ? 'Notice' : type === 'success' ? 'Success' : 'Information'),
        message,
        isConfirm: false,
        confirmText: 'Got It',
        cancelText: '',
        resolve: () => resolve(),
      };
      alertListeners.forEach((l) => l(currentConfig));
    });
  },

  success: (message: string, title = 'Success'): Promise<void> => {
    return mayaAlert.alert(message, title, 'success');
  },

  error: (message: string, title = 'Notice'): Promise<void> => {
    return mayaAlert.alert(message, title, 'error');
  },

  warning: (message: string, title = 'Warning'): Promise<void> => {
    return mayaAlert.alert(message, title, 'warning');
  },

  confirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: AlertType;
    isDestructive?: boolean;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      currentConfig = {
        visible: true,
        type: options.type || 'info',
        title: options.title || 'Confirm Action',
        message: options.message,
        isConfirm: true,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        isDestructive: options.isDestructive,
        resolve: (val: boolean) => resolve(val),
      };
      alertListeners.forEach((l) => l(currentConfig));
    });
  },
};

/**
 * Global Host Component that renders the custom alert matching CommonPopup aesthetic.
 * Mount this once in RootLayout (_layout.tsx).
 */
export function AlertHost() {
  const [config, setConfig] = useState<AlertConfig>(currentConfig);
  const [toast, setToast] = useState<ToastConfig>(currentToast);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-24)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    const listener: AlertListener = (newConfig) => {
      setConfig({ ...newConfig });
    };
    alertListeners.add(listener);

    // If an alert was requested before this component finished mounting, render it immediately
    if (currentConfig.visible) {
      setConfig({ ...currentConfig });
    }

    return () => {
      alertListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const dismissToast = () => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -20,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          currentToast = { ...currentToast, visible: false };
          setToast((prev) => ({ ...prev, visible: false }));
        }
      });
    };

    const listener: ToastListener = (newToast) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast({ ...newToast });
      toastOpacity.setValue(0);
      toastTranslateY.setValue(-24);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
        Animated.spring(toastTranslateY, {
          toValue: 0,
          tension: 90,
          friction: 9,
          useNativeDriver: useNative,
        }),
      ]).start();

      toastTimerRef.current = setTimeout(dismissToast, newToast.durationMs || 4000);
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastOpacity, toastTranslateY, useNative]);

  const toastPalette =
    toast.type === 'error'
      ? {
          bg: '#FFF1F2',
          border: '#FECDD3',
          iconBg: '#FFE4E6',
          iconColor: '#DC2626',
          textColor: '#991B1B',
          closeColor: '#E11D48',
          iconName: 'alert-circle' as const,
        }
      : toast.type === 'success'
      ? {
          bg: '#F0FDF4',
          border: '#BBF7D0',
          iconBg: '#DCFCE7',
          iconColor: '#16A34A',
          textColor: '#166534',
          closeColor: '#15803D',
          iconName: 'checkmark-circle' as const,
        }
      : toast.type === 'warning'
      ? {
          bg: '#FFF7ED',
          border: '#FED7AA',
          iconBg: '#FFEDD5',
          iconColor: '#EA580C',
          textColor: '#9A3412',
          closeColor: '#C2410C',
          iconName: 'warning' as const,
        }
      : {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          iconBg: '#DBEAFE',
          iconColor: '#2563EB',
          textColor: '#1E3A8A',
          closeColor: '#3B82F6',
          iconName: 'information-circle' as const,
        };

  const toastElement = toast.visible ? (
    <View pointerEvents="box-none" style={styles.toastViewport}>
      <Animated.View
        style={[
          styles.toastBanner,
          {
            backgroundColor: toastPalette.bg,
            borderColor: toastPalette.border,
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          },
        ]}
      >
        <View style={[styles.toastIconBadge, { backgroundColor: toastPalette.iconBg }]}>
          <Ionicons
            name={toastPalette.iconName}
            size={18}
            color={toastPalette.iconColor}
          />
        </View>
        <Text style={[styles.toastText, { color: toastPalette.textColor }]}>
          {toast.message}
        </Text>
        <Pressable
          onPress={() => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            currentToast = { ...currentToast, visible: false };
            setToast((prev) => ({ ...prev, visible: false }));
          }}
          hitSlop={10}
          style={styles.toastCloseBtn}
        >
          <Ionicons name="close" size={16} color={toastPalette.closeColor} />
        </Pressable>
      </Animated.View>
    </View>
  ) : null;

  if (!config.visible) return toastElement;

  const handleConfirm = () => {
    const res = config.resolve;
    setConfig((prev) => ({ ...prev, visible: false }));
    if (res) res(true);
  };

  const handleCancel = () => {
    const res = config.resolve;
    setConfig((prev) => ({ ...prev, visible: false }));
    if (res) res(false);
  };

  const renderIcon = () => {
    switch (config.type) {
      case 'success':
        return (
          <View style={[styles.iconAura, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <View style={[styles.iconInner, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={34} color="#16A34A" />
            </View>
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconAura, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
            <View style={[styles.iconInner, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="alert-circle" size={34} color="#D97706" />
            </View>
          </View>
        );
      case 'error':
        return (
          <View style={[styles.iconAura, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
            <View style={[styles.iconInner, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle" size={34} color="#DC2626" />
            </View>
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[styles.iconAura, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
            <View style={[styles.iconInner, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="information-circle" size={34} color="#2563EB" />
            </View>
          </View>
        );
    }
  };

  return (
    <>
      {toastElement}
      <Modal
        transparent
        visible={config.visible}
        animationType="fade"
        onRequestClose={handleCancel}
      >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTouch}
          onPress={config.isConfirm ? handleCancel : handleConfirm}
          accessibilityLabel="Dismiss modal"
        />

        <View style={styles.card}>
          {/* Header Graphic */}
          <View style={styles.headerGraphicBox}>{renderIcon()}</View>

          {/* Title */}
          <Text style={styles.titleText}>{config.title}</Text>

          {/* Message */}
          <Text style={styles.messageText}>{config.message}</Text>

          {/* Action Buttons */}
          {config.isConfirm ? (
            <View style={styles.confirmButtonsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={config.cancelText}
              >
                <Text style={styles.cancelButtonText}>{config.cancelText}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  config.isDestructive && { backgroundColor: '#DC2626' },
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel={config.confirmText}
              >
                <Text style={styles.confirmButtonText}>{config.confirmText}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.singlePrimaryButton,
                config.type === 'error' && { backgroundColor: '#DC2626' },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={config.confirmText}
            >
              <Text style={styles.singlePrimaryButtonText}>{config.confirmText}</Text>
            </Pressable>
          )}
        </View>
      </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastViewport: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 50,
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    maxWidth: 420,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12), 0 2px 8px rgba(15, 23, 42, 0.05)',
      } as any,
      default: {
        elevation: 5,
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
    }),
  },
  toastIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.75,
  },
  toastText: {
    flex: 1,
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
      } as any,
      default: {
        elevation: 6,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
    }),
  },
  headerGraphicBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconAura: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  messageText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  singlePrimaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#0057FF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  singlePrimaryButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 15,
    color: '#FFFFFF',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  cancelButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#475569',
  },
  confirmButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#0057FF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  confirmButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
