import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
  PressableProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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

  /** Custom action when the back button is pressed. Defaults to router.back(). */
  onBack?: () => void;

  /** Custom action when clicking the brand title. Defaults to navigating to /(tabs)/dashboard. */
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

  /** Override isInactive status. Defaults to live stats.isSubscriptionLocked || stats.isTelcoUnsubscribed. */
  isInactive?: boolean;

  /** Custom avatar image source. Defaults to require('@/assets/images/maya-avatar.png'). */
  avatarSource?: any;

  /**
   * Container layout mode:
   * - true (default): Fixed / pinned styling at top of screen.
   * - false: Clean inline styling for embedding inside an existing scrollview container.
   */
  pinned?: boolean;

  /**
   * If true (default), hides completely on desktop & tablet screens (>= 768px).
   * Set to false to force rendering across all breakpoints.
   */
  phoneOnly?: boolean;

  /** Optional custom container style overrides. */
  style?: StyleProp<ViewStyle>;

  /** Disable all micro-animations. Also auto-disabled when the OS "Reduce Motion" setting is on. */
  disableAnimations?: boolean;

  /** Disable haptic feedback. Default: false */
  disableHaptics?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Haptics helpers (no-op on web)                                             */
/* -------------------------------------------------------------------------- */

const canHaptic = Platform.OS !== 'web';

const hapticSelection = () => {
  if (canHaptic) Haptics.selectionAsync();
};
const hapticLight = () => {
  if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
const hapticSuccess = () => {
  if (canHaptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/* -------------------------------------------------------------------------- */
/* Animated primitives                                                        */
/* -------------------------------------------------------------------------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_IN_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const PRESS_OUT_SPRING = { damping: 9, stiffness: 320, mass: 0.6 };

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  enabled?: boolean;
  /** Lets children react to press state (e.g. arrow nudge). */
  onPressedChange?: (pressed: boolean) => void;
}

/** Pressable that springs down on press-in and bounces back on release. */
function PressableScale({
  style,
  scaleTo = 0.96,
  enabled = true,
  onPressedChange,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (enabled) scale.value = withSpring(scaleTo, PRESS_IN_SPRING);
        onPressedChange?.(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (enabled) scale.value = withSpring(1, PRESS_OUT_SPRING);
        onPressedChange?.(false);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Back button; the arrow slides left slightly while pressed. */
function AnimatedBackButton({
  onPress,
  enabled,
}: {
  onPress: () => void;
  enabled: boolean;
}) {
  const nudge = useSharedValue(0);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
  }));

  const handlePressedChange = (pressed: boolean) => {
    if (!enabled) return;
    nudge.value = pressed
      ? withSpring(-3, PRESS_IN_SPRING)
      : withSpring(0, { damping: 7, stiffness: 300, mass: 0.6 });
  };

  return (
    <PressableScale
      style={styles.backButton}
      onPress={onPress}
      onPressedChange={handlePressedChange}
      scaleTo={0.9}
      enabled={enabled}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={arrowStyle}>
        <Ionicons name="arrow-back" size={20} color="#0f172a" />
      </Animated.View>
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

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
  isInactive,
  avatarSource,
  pinned = true,
  phoneOnly = true,
  style,
  disableAnimations = false,
  disableHaptics = false,
}: MobileTopBarProps) {
  const { isPhone } = useBreakpoint();
  const stats = useUserStats();
  const [internalPopupOpen, setInternalPopupOpen] = useState(false);

  const reduceMotion = useReducedMotion();
  const animationsEnabled = !disableAnimations && !reduceMotion;
  const hapticsEnabled = !disableHaptics;

  // Interactive badge scale animation (for XP pop and press feedback)
  const badgeScale = useSharedValue(1);
  const hasMounted = useRef(false);

  const resolvedLevelLabel = levelLabel ?? stats.levelLabel;
  const resolvedXpLabel = xpLabel ?? stats.xpLabel;
  const resolvedProgress = progress ?? stats.progress;
  const resolvedIsPro = isPro ?? stats.isPro;
  const resolvedPlanTier = planTier ?? stats.planTier;
  const resolvedIsInactive =
    isInactive ?? (stats.isSubscriptionLocked || stats.isTelcoUnsubscribed);
  const resolvedLevelNumber = stats.currentLevelNumber;

  // Pulse the badge whenever XP / level changes (skips the first render)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (!animationsEnabled) return;

    badgeScale.value = withSequence(
      withTiming(1.12, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 7, stiffness: 240, mass: 0.7 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProgress, resolvedLevelNumber, resolvedXpLabel]);

  const badgeScaleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  // Responsive guard (after all hooks)
  if (phoneOnly && !isPhone) {
    return null;
  }

  const bumpBadge = () => {
    if (!animationsEnabled) return;
    badgeScale.value = withSequence(
      withTiming(0.92, { duration: 90 }),
      withSpring(1, { damping: 7, stiffness: 300, mass: 0.6 })
    );
  };

  const handleLevelBadgePress = () => {
    bumpBadge();
    if (hapticsEnabled) hapticLight();
    if (onLevelPress) {
      onLevelPress();
    } else {
      setInternalPopupOpen(true);
    }
  };

  const handleBackPress = () => {
    if (hapticsEnabled) hapticSelection();
    if (onBack) onBack();
    else router.back();
  };

  const handleBrandPress = () => {
    if (hapticsEnabled) hapticSelection();
    if (onBrandPress) onBrandPress();
    else router.push('/(tabs)/dashboard');
  };

  return (
    <View
      style={[
        pinned ? styles.pinnedContainer : styles.inlineContainer,
        style,
      ]}
    >
      {/* Brand area */}
      <View style={styles.brandRow}>
        {showBackButton && (
          <AnimatedBackButton onPress={handleBackPress} enabled={animationsEnabled} />
        )}

        <PressableScale
          onPress={handleBrandPress}
          style={styles.brandTextCol}
          scaleTo={0.97}
          enabled={animationsEnabled}
          accessibilityRole="button"
          accessibilityLabel="SpeakwithMaya home"
        >
          <Text style={styles.brandTitleMobile}>
            Speakwith<Text style={styles.brandAccent}>Maya</Text>
          </Text>
          <Text style={styles.brandTaglineMobile}>
            Practice · Improve · Be Confident
          </Text>
        </PressableScale>
      </View>

      {/* User Level Badge */}
      <Animated.View style={badgeScaleAnimatedStyle}>
        <UserLevelBadge
          levelLabel={resolvedLevelLabel}
          xpLabel={resolvedXpLabel}
          progress={resolvedProgress}
          isPro={resolvedIsPro}
          planTier={resolvedPlanTier}
          isInactive={resolvedIsInactive}
          avatarSource={avatarSource}
          onPress={handleLevelBadgePress}
        />
      </Animated.View>

      {/* Fallback Internal Level Progress Popup (used when onLevelPress is omitted) */}
      {!onLevelPress && (
        <CommonPopup
          visible={internalPopupOpen}
          preset="level-up"
          levelNumber={resolvedLevelNumber}
          title="Your Level Progress"
          subtitle={`You are currently on ${resolvedLevelLabel} with ${resolvedXpLabel}.\nKeep completing speaking lessons to reach Level ${resolvedLevelNumber + 1}!`}
          primaryButtonText="Practice Roleplays"
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
    color: '#0052FF',
  },
  brandTaglineMobile: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
  },
});