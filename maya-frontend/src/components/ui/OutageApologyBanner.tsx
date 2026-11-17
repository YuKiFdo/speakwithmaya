import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AppStorage } from '@/services/storage/storage-adapter';
import { promotionsApi } from '@/services/promotions/promotions-api';
import { mayaAlert } from '@/components/ui/alert-modal';
import { router } from 'expo-router';

export interface OutageApologyBannerProps {
  userTier?: 'starter' | 'basic' | 'pro' | 'premium' | string;
  isPaidUser?: boolean;
  onPressAction?: () => void;
  style?: any;
}

const STORAGE_DISMISSED_KEY = 'maya_outage_apology_banner_dismissed_v1';

export const OutageApologyBanner: React.FC<OutageApologyBannerProps> = ({
  userTier = 'starter',
  isPaidUser = false,
  onPressAction,
  style,
}) => {
  const { isPhone, isDesktop } = useBreakpoint();
  const [isVisible, setIsVisible] = useState<boolean | null>(null);

  const isProOrPaid = isPaidUser || (userTier !== 'starter' && userTier !== 'trial');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const dismissed = await AppStorage.getItem(STORAGE_DISMISSED_KEY);
        if (isMounted) {
          setIsVisible(dismissed !== 'true');
        }
      } catch {
        if (isMounted) setIsVisible(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const [isClaiming, setIsClaiming] = useState(false);

  const handleDismiss = async () => {
    setIsVisible(false);
    try {
      await AppStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
    } catch {}
  };

  const handleAction = async () => {
    if (onPressAction) {
      onPressAction();
      return;
    }

    try {
      setIsClaiming(true);
      const res = await promotionsApi.claimPromotion('outage-comeback-nov26');
      await handleDismiss();
      if (res?.message) {
        await mayaAlert.success(
          res.message,
          isProOrPaid ? '🎉 100 Bonus Minutes Added!' : '👑 3-Day Pro Pass Unlocked!'
        );
      }
      router.push('/(tabs)/roadmap');
    } catch (err: any) {
      await handleDismiss();
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
        cardBg: '#F0F9FF',
        cardBorder: '#BAE6FD',
        badgeBg: '#E0F2FE',
        badgeText: '#0284C7',
        badgeLabel: 'Paid Subscribers',
        badgeIcon: 'star',
        title: "We're Back! 100 Free Bonus Minutes Added",
        body: "Thank you so much for your patience during our 3-day cloud downtime. As an apology, we've credited 100 Non-Expiring Bonus Minutes directly to your balance. Your practice will never be interrupted again!",
        btnBg: '#0284C7',
        btnText: 'Start Speaking Now →',
        avatarSource: require('@/assets/images/banner-maya-paid.png'),
      }
    : {
        cardBg: '#FAF5FF',
        cardBorder: '#DDD6FE',
        badgeBg: '#EDE9FE',
        badgeText: '#7C3AED',
        badgeLabel: 'Pro Pass',
        badgeIcon: 'ribbon',
        title: "We're Back Online! Enjoy a 3-Day Pro Pass on Us",
        body: "Over the past 3 days, our hosting infrastructure had an unexpected outage. We are deeply sorry for interrupting your English practice! As an apology, we've unlocked 3 Days of Free Pro Access (120 Minutes) on your account.",
        btnBg: '#7C3AED',
        btnText: 'Start Speaking Now →',
        avatarSource: require('@/assets/images/banner-maya-pro.png'),
      };

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, style]}>
      {/* Close button top-right */}
      <Pressable
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss apology notice"
      >
        <Ionicons name="close" size={20} color="#64748B" />
      </Pressable>

      <View style={[styles.innerRow, isPhone && styles.innerRowMobile]}>
        {/* Left: Avatar Column */}
        <View style={styles.avatarCol}>
          <Image
            source={theme.avatarSource}
            style={styles.avatarImg}
            resizeMode="contain"
          />
        </View>

        {/* Center: Content Column */}
        <View style={styles.contentCol}>
          {/* Pill Badge */}
          <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
            <Ionicons name={theme.badgeIcon as any} size={13} color={theme.badgeText} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: theme.badgeText }]}>{theme.badgeLabel}</Text>
          </View>

          {/* Title with Emoji */}
          <Text style={styles.titleText}>{theme.title}</Text>

          {/* Body Text */}
          <Text style={styles.bodyText}>{theme.body}</Text>
        </View>

        {/* Right / Bottom: Action CTA Button */}
        <View style={[styles.actionCol, isPhone && styles.actionColMobile]}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: theme.btnBg },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              isPhone && styles.ctaBtnMobile,
            ]}
            onPress={handleAction}
            accessibilityRole="button"
          >
            <Text style={styles.ctaBtnText}>{theme.btnText}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
    borderRadius: 999,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  innerRowMobile: {
    flexWrap: 'wrap',
  },
  avatarCol: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  contentCol: {
    flex: 1,
    minWidth: 200,
    paddingRight: 24, // Space from close button
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    letterSpacing: 0.2,
  },
  titleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 4,
  },
  bodyText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actionCol: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionColMobile: {
    width: '100%',
    marginLeft: 0,
    marginTop: 12,
  },
  ctaBtn: {
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  ctaBtnMobile: {
    width: '100%',
    height: 44,
  },
  ctaBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#FFFFFF',
  },
});

