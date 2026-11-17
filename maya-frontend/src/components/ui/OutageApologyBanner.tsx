import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AppStorage } from '@/services/storage/storage-adapter';
import { promotionsApi } from '@/services/promotions/promotions-api';
import { authService } from '@/services/auth/auth-service';
import { mayaAlert } from '@/components/ui/alert-modal';
import { router } from 'expo-router';

export interface OutageApologyBannerProps {
  userTier?: 'starter' | 'basic' | 'pro' | 'premium' | string;
  isPaidUser?: boolean;
  onPressAction?: () => void;
}

const STORAGE_DISMISSED_KEY = 'maya_outage_apology_modal_claimed_v2';

export const OutageApologyBanner: React.FC<OutageApologyBannerProps> = ({
  userTier = 'starter',
  isPaidUser = false,
  onPressAction,
}) => {
  const { isPhone } = useBreakpoint();
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const isProOrPaid = isPaidUser || (userTier !== 'starter' && userTier !== 'trial');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const claimed = await AppStorage.getItem(STORAGE_DISMISSED_KEY);
        if (isMounted) {
          setIsVisible(claimed !== 'true');
        }
      } catch {
        if (isMounted) setIsVisible(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAction = async () => {
    if (onPressAction) {
      onPressAction();
      return;
    }

    try {
      setIsClaiming(true);
      const res = await promotionsApi.claimPromotion('outage-comeback-nov26');
      await AppStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
      setIsVisible(false);

      // Refresh balance so header shows updated minutes immediately
      await authService.fetchUserProfile();

      if (res?.message) {
        await mayaAlert.success(
          res.message,
          isProOrPaid ? '🎉 100 Bonus Minutes Added!' : '👑 3-Day Pro Pass Unlocked!'
        );
      }
      router.push('/(tabs)/roadmap');
    } catch (err: any) {
      await AppStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
      setIsVisible(false);
      router.push('/(tabs)/roadmap');
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  // Theme palettes based on user type (Purple for Free Pro Pass, Blue for Paid Subscribers)
  const theme = isProOrPaid
    ? {
        cardBorder: '#BAE6FD',
        badgeBg: '#E0F2FE',
        badgeText: '#0284C7',
        badgeLabel: 'Paid Subscribers',
        badgeIcon: 'star',
        title: "We're Back! 100 Free Bonus Minutes Added",
        body: "Thank you so much for your patience during the global outage that happened to our infrastructure over the past 3 days. As an apology, we've credited 100 Non-Expiring Bonus Minutes directly to your balance. Your practice will never be interrupted again!",
        perkLabel: '⭐ 100 Non-Expiring Bonus Minutes Credited',
        btnBg: '#0284C7',
        btnText: 'Start Speaking Now →',
        avatarSource: require('@/assets/images/banner-maya-paid.png'),
      }
    : {
        cardBorder: '#DDD6FE',
        badgeBg: '#EDE9FE',
        badgeText: '#7C3AED',
        badgeLabel: 'Pro Pass',
        badgeIcon: 'ribbon',
        title: "We're Back Online! Enjoy a 3-Day Pro Pass on Us",
        body: "Over the past 3 days, a global outage happened to our infrastructure. We are deeply sorry for interrupting your English practice! As an apology, we've unlocked 3 Days of Free Pro Access (120 Minutes) on your account.",
        perkLabel: '👑 3 Days of Free Pro Access (120 Minutes)',
        btnBg: '#7C3AED',
        btnText: 'Start Speaking Now →',
        avatarSource: require('@/assets/images/banner-maya-pro.png'),
      };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      // User CANNOT close with back button or backdrop tap
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, isPhone && styles.modalCardMobile, { borderColor: theme.cardBorder }]}>
          {/* Avatar Graphic */}
          <View style={styles.avatarContainer}>
            <Image
              source={theme.avatarSource}
              style={styles.avatarImg}
              resizeMode="contain"
            />
          </View>

          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
            <Ionicons name={theme.badgeIcon as any} size={14} color={theme.badgeText} style={{ marginRight: 5 }} />
            <Text style={[styles.badgeText, { color: theme.badgeText }]}>{theme.badgeLabel}</Text>
          </View>

          {/* Headline */}
          <Text style={styles.titleText}>{theme.title}</Text>

          {/* Apology Body */}
          <Text style={styles.bodyText}>{theme.body}</Text>

          {/* Perk Highlight Box */}
          <View style={[styles.perkBox, { backgroundColor: theme.badgeBg }]}>
            <Text style={[styles.perkText, { color: theme.badgeText }]}>{theme.perkLabel}</Text>
          </View>

          {/* Mandatory Action Button - Must press Start Speaking Now */}
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: theme.btnBg },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              isClaiming && { opacity: 0.7 },
            ]}
            onPress={handleAction}
            disabled={isClaiming}
            accessibilityRole="button"
          >
            {isClaiming ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.ctaBtnText}>{theme.btnText}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 2,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  modalCardMobile: {
    padding: 20,
    borderRadius: 24,
  },
  avatarContainer: {
    width: 140,
    height: 140,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    letterSpacing: 0.3,
  },
  titleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  bodyText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  perkBox: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  perkText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    textAlign: 'center',
  },
  ctaBtn: {
    width: '100%',
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  ctaBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#FFFFFF',
  },
});
