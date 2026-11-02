import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { useUserStats } from '@/hooks/useUserStats';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { CommonPopup } from '@/components/ui/common-popup';

export interface DesktopTopBarProps {
  /**
   * Primary title displayed on the left (e.g. "Your Learning Roadmap").
   * Can also be a ReactNode (e.g. custom greeting or elements).
   */
  title?: React.ReactNode;

  /**
   * Optional subtitle line under the primary title.
   */
  subtitle?: React.ReactNode;

  /**
   * Optional left accessory (e.g. back button, icon, breadcrumbs).
   */
  leftContent?: React.ReactNode;

  /**
   * Optional custom replacement for the right slot.
   * If omitted, renders the standard UserLevelBadge.
   */
  rightContent?: React.ReactNode;

  /**
   * Action when the UserLevelBadge is pressed.
   * If omitted, automatically manages and displays the level-up CommonPopup.
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

  /**
   * Maximum width of the inner content row. Defaults to 1600.
   * Set to '100%' if full unconstrained width is desired.
   */
  maxWidth?: number | any;

  /**
   * If true (default), renders exclusively on desktop/tablet (>= 768px).
   * Set to false to force rendering across all breakpoints.
   */
  desktopOnly?: boolean;

  /** Optional custom container style overrides. */
  style?: StyleProp<ViewStyle>;

  /** Optional inner row style overrides. */
  innerStyle?: StyleProp<ViewStyle>;

  /** Optional title text style overrides. */
  titleStyle?: StyleProp<TextStyle>;

  /** Optional subtitle text style overrides. */
  subtitleStyle?: StyleProp<TextStyle>;
}

/**
 * Universal Desktop Top Bar component for SpeakwithMaya.
 *
 * Provides a pixel-stable, persistent top bar for all desktop tab views
 * with identical height (68px), standardized horizontal padding (32px),
 * bottom border (#F1F5F9), and right-anchored UserLevelBadge with zero layout shift.
 */
export function DesktopTopBar({
  title,
  subtitle,
  leftContent,
  rightContent,
  onLevelPress,
  levelLabel,
  xpLabel,
  progress,
  isPro,
  planTier,
  isInactive,
  maxWidth = 1600,
  desktopOnly = true,
  style,
  innerStyle,
  titleStyle,
  subtitleStyle,
}: DesktopTopBarProps) {
  const { isPhone } = useBreakpoint();
  const stats = useUserStats();
  const [internalPopupOpen, setInternalPopupOpen] = useState(false);

  // Responsive guard: hide on mobile screens when desktopOnly is true
  if (desktopOnly && isPhone) {
    return null;
  }

  const resolvedLevelLabel = levelLabel ?? stats.levelLabel;
  const resolvedXpLabel = xpLabel ?? stats.xpLabel;
  const resolvedProgress = progress ?? stats.progress;
  const resolvedIsPro = isPro ?? stats.isPro;
  const resolvedPlanTier = planTier ?? stats.planTier;
  const resolvedIsInactive =
    isInactive ?? (stats.isSubscriptionLocked || stats.isTelcoUnsubscribed);
  const resolvedLevelNumber = stats.currentLevelNumber;

  const handleLevelBadgePress = () => {
    if (onLevelPress) {
      onLevelPress();
    } else {
      setInternalPopupOpen(true);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.innerRow,
          maxWidth ? { maxWidth } : undefined,
          innerStyle,
        ]}
      >
        {/* LEFT SECTION: Title & Subtitle or Custom Content */}
        <View style={styles.leftGroup}>
          {leftContent}

          {(title || subtitle) && (
            <View style={styles.titleCol}>
              {typeof title === 'string' ? (
                <Text
                  style={[styles.title, titleStyle]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {title}
                </Text>
              ) : (
                title
              )}

              {typeof subtitle === 'string' ? (
                <Text
                  style={[styles.subtitle, subtitleStyle]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {subtitle}
                </Text>
              ) : (
                subtitle
              )}
            </View>
          )}
        </View>

        {/* RIGHT SECTION: Level Badge or Custom Right Content */}
        <View style={styles.rightGroup}>
          {rightContent !== undefined ? (
            rightContent
          ) : (
            <UserLevelBadge
              levelLabel={resolvedLevelLabel}
              xpLabel={resolvedXpLabel}
              progress={resolvedProgress}
              isPro={resolvedIsPro}
              planTier={resolvedPlanTier}
              isInactive={resolvedIsInactive}
              onPress={handleLevelBadgePress}
            />
          )}
        </View>
      </View>

      {/* Fallback Internal Level Progress Popup */}
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
  container: {
    height: 68,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    width: '100%',
    zIndex: 10,
    justifyContent: 'center',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    width: '100%',
    alignSelf: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 16,
  },
  titleCol: {
    justifyContent: 'center',
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0F172A',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
