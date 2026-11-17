import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { usePathname } from 'expo-router';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/utils/backend-url';

export const MaintenanceOverlay: React.FC = () => {
  const pathname = usePathname();
  const { isPhone } = useBreakpoint();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState<{
    title?: string;
    message?: string;
    estimatedEndTime?: string;
  }>({});
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/app-config`);
      if (res.ok) {
        const config = await res.json();
        if (config?.maintenanceMode?.enabled) {
          setIsMaintenance(true);
          setMaintenanceInfo(config.maintenanceMode);
        } else {
          setIsMaintenance(false);
        }
      }
    } catch {
      // If server unreachable, don't necessarily show maintenance unless configured
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 30s to automatically clear when maintenance finishes
    const timer = setInterval(checkStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  // Do NOT block admin routes — admins must be able to log in and toggle maintenance off!
  if (!isMaintenance || pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <View style={styles.fullscreenOverlay}>
      <View style={[styles.card, isPhone && styles.cardMobile]}>
        {/* Maya Maintenance Avatar */}
        <View style={styles.avatarBox}>
          <Image
            source={require('@/assets/images/maya-maintenance.png')}
            style={styles.avatarImg}
            resizeMode="contain"
          />
        </View>

        {/* Maintenance Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🛠️ SCHEDULED MAINTENANCE</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {maintenanceInfo.title || 'Maya is Tuning Up!'}
        </Text>

        {/* Message */}
        <Text style={styles.subtitle}>
          {maintenanceInfo.message ||
            "We are currently conducting scheduled improvements to ensure your English speaking coach is smoother, faster, and always reliable. We'll be back online in just a few minutes!"}
        </Text>

        {maintenanceInfo.estimatedEndTime ? (
          <View style={styles.estimateBox}>
            <Text style={styles.estimateLabel}>Estimated Completion:</Text>
            <Text style={styles.estimateValue}>{maintenanceInfo.estimatedEndTime}</Text>
          </View>
        ) : null}

        {/* Refresh / Check Status Button */}
        <Pressable
          style={({ pressed }) => [
            styles.checkBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            checking && { opacity: 0.7 },
          ]}
          onPress={checkStatus}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.checkBtnText}>Check Server Status ↻</Text>
          )}
        </Pressable>

        <Text style={styles.footerHint}>
          Need urgent help? Reach us at support@speakwithmaya.com
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        backdropFilter: 'blur(6px)',
      },
    }),
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  cardMobile: {
    padding: 22,
    borderRadius: 24,
  },
  avatarBox: {
    width: 170,
    height: 170,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  badge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    color: '#D97706',
    letterSpacing: 0.5,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  estimateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
    gap: 8,
  },
  estimateLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748B',
  },
  estimateValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0F172A',
  },
  checkBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#0052FF',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  checkBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#FFFFFF',
  },
  footerHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

