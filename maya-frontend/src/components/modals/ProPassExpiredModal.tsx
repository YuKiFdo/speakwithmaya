import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { paymentApi } from '@/services/payment/payment-api';
import { payHereGateway } from '@/services/payment/payhere-gateway';
import { mayaAlert } from '@/components/ui/alert-modal';
import { router } from 'expo-router';

export interface ProPassExpiredModalProps {
  visible: boolean;
  onClose: () => void;
  onContinueStarter?: () => void;
}

export const ProPassExpiredModal: React.FC<ProPassExpiredModalProps> = ({
  visible,
  onClose,
  onContinueStarter,
}) => {
  const { isPhone } = useBreakpoint();
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const handleCheckout = async () => {
    try {
      setLoading(true);
      const params = await paymentApi.getCheckoutParams('3-months-pro', '3-months');
      const result = await payHereGateway.startPayment(params);

      if (result.status === 'success') {
        onClose();
        await mayaAlert.success(
          'Your 3-Month Pro Plan is now active! You have 360 monthly minutes.',
          '👑 Welcome to Maya Pro!'
        );
      } else if (result.status === 'error') {
        await mayaAlert.error(result.message || 'Payment was unsuccessful', 'Checkout Error');
      }
    } catch (err: any) {
      await mayaAlert.error(err?.message || 'Could not initiate card payment', 'Payment Error');
    } finally {
      setLoading(false);
    }
  };

  const handleStarter = () => {
    onClose();
    if (onContinueStarter) {
      onContinueStarter();
    }
  };

  const handleViewAllPlans = () => {
    onClose();
    router.push('/plan' as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, isPhone && styles.cardMobile]}>
          {/* Close button */}
          <Pressable
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color="#94A3B8" />
          </Pressable>

          {/* Avatar / Icon Header */}
          <View style={styles.avatarBox}>
            <Image
              source={require('@/assets/images/banner-maya-pro.png')}
              style={styles.avatarImg}
              resizeMode="contain"
            />
          </View>

          {/* Title & Headline */}
          <Text style={styles.title}>Your 3-Day Pro Pass Has Ended</Text>
          <Text style={styles.subtitle}>
            We hope you enjoyed uninterrupted practice! Keep your momentum and stay fluent with our best-value plan.
          </Text>

          {/* 3-Month Special Deal Card */}
          <View style={styles.dealCard}>
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>BEST VALUE · SAVE 20%</Text>
            </View>

            <View style={styles.dealHeaderRow}>
              <View>
                <Text style={styles.dealPlanName}>3-Month Pro Pass</Text>
                <Text style={styles.dealPlanSub}>360 Total Practice Minutes</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dealPrice}>LKR 8,640</Text>
                <Text style={styles.dealPerMonth}>~LKR 96 / day</Text>
              </View>
            </View>

            {/* Feature Perks */}
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Feather name="check" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.featureText}>Instant grammar & pronunciation correction</Text>
              </View>
              <View style={styles.featureItem}>
                <Feather name="check" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.featureText}>All scenarios, roleplay & interviews unlocked</Text>
              </View>
              <View style={styles.featureItem}>
                <Feather name="check" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.featureText}>Natural bilingual Sinhala & English coaching</Text>
              </View>
            </View>
          </View>

          {/* Primary Action Button: Pay with Card */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Keep Pro Access (Pay with Card) →</Text>
            )}
          </Pressable>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <Pressable
              style={({ pressed }) => [styles.starterBtn, pressed && { opacity: 0.6 }]}
              onPress={handleStarter}
            >
              <Text style={styles.starterBtnText}>Continue with Free Starter (5 Mins / Day)</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.viewPlansBtn, pressed && { opacity: 0.6 }]}
              onPress={handleViewAllPlans}
            >
              <Text style={styles.viewPlansBtnText}>View All Plans (/plan)</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  cardMobile: {
    maxWidth: '100%',
    borderRadius: 20,
    padding: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  avatarBox: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  dealCard: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    position: 'relative',
  },
  dealBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dealBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  dealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  dealPlanName: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  dealPlanSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#7C3AED',
  },
  dealPrice: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
  },
  dealPerMonth: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
  },
  featuresList: {
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    paddingTop: 10,
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#334155',
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  primaryBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryActions: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  starterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  starterBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  viewPlansBtn: {
    paddingVertical: 4,
  },
  viewPlansBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0284C7',
    textAlign: 'center',
  },
});

