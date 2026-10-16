import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

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

// Global alert controller listeners
type AlertListener = (config: AlertConfig) => void;
const alertListeners = new Set<AlertListener>();

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

/**
 * Programmatic controller to trigger alerts/confirms anywhere in the application
 */
export const mayaAlert = {
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

  if (!config.visible) return null;

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
  );
}

const styles = StyleSheet.create({
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
