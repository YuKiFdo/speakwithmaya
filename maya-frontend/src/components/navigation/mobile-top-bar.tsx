import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { Radii } from '@/theme/tokens';
import { useUserStats } from '@/hooks/useUserStats';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { CommonPopup } from '@/components/ui/common-popup';

export interface MobileTopBarProps {
  /**
   * If true, renders a back navigation button before the brand title.
   * Useful for screens like /upgrade or sub-flows.
   * Default: false
   */
  showBackButton?: boolean;

  /**
   * Custom action when the back button is pressed.
   * Defaults to router.back().
   */
  onBack?: () => void;

  /**
   * Custom action when clicking the brand title.
   * Defaults to navigating to /(tabs)/dashboard.
   */
  onBrandPress?: () => void;

  /**
   * Action when the UserLevelBadge is pressed.
   * If not provided, MobileTopBar automatically manages and displays
   * the level progress modal (CommonPopup preset="level-up").
   */
  onLevelPress?: () => void;

  /** Override level label (e.g. "Level 2"). Defaults to live stats.levelLabel. */
  levelLabel?: string;

  /** Override xp label (e.g. "300 / 500 XP"). Defaults to live stats.xpLabel. */
  xpLabel?: string;

  /** Override progress (0 - 1). Defaults to live stats.progress. */
  progress?: number;

  /** Override isPro badge. Defaults to live stats.isPro. */
  isPro?: boolean;

  /** Override planTier ('starter' | 'basic' | 'pro' | 'premium'). Defaults to live stats.planTier. */
  planTier?: 'starter' | 'basic' | 'pro' | 'premium' | string;

  /** Custom avatar image source. Defaults to require('@/assets/images/maya-avatar.png'). */
  avatarSource?: any;

  /**
   * Container layout mode:
   * - true (default): Fixed / pinned styling at top of screen (white bg, horizontal padding 20, borderBottom, zIndex 10).
   * - false: Clean inline styling for embedding inside an existing scrollview container (e.g. dashboard).
   */
  pinned?: boolean;

  /**
   * If true (default), hides completely on desktop & tablet screens (>= 768px).
   * Set to false to force rendering across all breakpoints.
   */
  phoneOnly?: boolean;

  /** Optional custom container style overrides. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Universal Mobile Top Bar component for SpeakwithMaya.
 *
 * Displays the authoritative mobile brand header (SpeakwithMaya)
 * alongside the interactive UserLevelBadge with instant Level/XP loading.
 */
export function MobileTopBar({
  showBackButton = false,
  onBack,
  onBrandPress,
  onLevelPress,
  levelLabel,
  xpLabel,
  progress,
  isPro,
  planTier,
  avatarSource,
  pinned = true,
  phoneOnly = true,
  style,
}: MobileTopBarProps) {
  const { isPhone } = useBreakpoint();
  const stats = useUserStats();
  const [internalPopupOpen, setInternalPopupOpen] = useState(false);

  // Responsive guard: only render on mobile phone unless explicitly opted out
  if (phoneOnly && !isPhone) {
    return null;
  }

  const resolvedLevelLabel = levelLabel ?? stats.levelLabel;
  const resolvedXpLabel = xpLabel ?? stats.xpLabel;
  const resolvedProgress = progress ?? stats.progress;
  const resolvedIsPro = isPro ?? stats.isPro;
  const resolvedPlanTier = planTier ?? stats.planTier;
  const resolvedLevelNumber = stats.currentLevelNumber;

  const handleLevelBadgePress = () => {
    if (onLevelPress) {
      onLevelPress();
    } else {
      setInternalPopupOpen(true);
    }
  };

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleBrandPress = () => {
    if (onBrandPress) {
      onBrandPress();
    } else {
      router.push('/(tabs)/dashboard');
    }
  };

  return (
    <View style={[pinned ? styles.pinnedContainer : styles.inlineContainer, style]}>
      {/* Brand area */}
      <View style={styles.brandRow}>
        {showBackButton && (
          <Pressable
            style={styles.backButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </Pressable>
        )}

        <Pressable
          onPress={handleBrandPress}
          style={styles.brandTextCol}
          accessibilityRole="button"
          accessibilityLabel="SpeakwithMaya home"
        >
          <Text style={styles.brandTitleMobile}>
            Speakwith<Text style={styles.brandAccent}>Maya</Text>
          </Text>
          <Text style={styles.brandTaglineMobile}>
            Practice · Improve · Be Confident
          </Text>
        </Pressable>
      </View>

      {/* User Level Badge */}
      <UserLevelBadge
        levelLabel={resolvedLevelLabel}
        xpLabel={resolvedXpLabel}
        progress={resolvedProgress}
        isPro={resolvedIsPro}
        planTier={resolvedPlanTier}
        avatarSource={avatarSource ?? require('@/assets/images/maya-avatar.png')}
        onPress={handleLevelBadgePress}
      />

      {/* Fallback Internal Level Progress Popup (used when onLevelPress is omitted) */}
      {!onLevelPress && (
        <CommonPopup
          visible={internalPopupOpen}
          preset="level-up"
          levelNumber={resolvedLevelNumber}
          title="Your Level Progress"
          subtitle={`You are currently on ${resolvedLevelLabel} with ${resolvedXpLabel}.\nKeep completing speaking lessons to reach Level ${resolvedLevelNumber + 1}!`}
          primaryButtonText="View Learning Roadmap"
          primaryButtonIcon="arrow"
          showPrimaryArrow
          onClose={() => setInternalPopupOpen(false)}
          onPrimaryPress={() => {
            setInternalPopupOpen(false);
            router.push('/(tabs)/roadmap');
          }}
          onFooterButtonPress={() => {
            setInternalPopupOpen(false);
            router.push('/upgrade');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pinnedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  inlineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    justifyContent: 'center',
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  brandAccent: {
    color: '#0085db',
  },
  brandTaglineMobile: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
  },
});
