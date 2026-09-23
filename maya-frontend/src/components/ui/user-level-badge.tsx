import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, PressableProps, DimensionValue } from 'react-native';
import { Fonts, fontStyle } from '@/theme/fonts';
import { Radii } from '@/theme/tokens';
import { CrownSolidIcon } from '@/components/icons/nav-icons';

export interface UserLevelBadgeProps {
  /** e.g. "Level 4" */
  levelLabel?: string;
  /** e.g. "420 / 800 XP" */
  xpLabel?: string;
  /** 0-1 progress fraction */
  progress?: number;
  /** Show the PRO badge? */
  isPro?: boolean;
  /** Avatar image source */
  avatarSource?: any;
  /** Called when the badge is pressed */
  onPress?: PressableProps['onPress'];
  /** Accessibility label */
  accessibilityLabel?: string;
}

/**
 * Shared user level / XP badge component used in the top bars
 * of dashboard, roadmap, and other screens.
 *
 * Source-of-truth styling matches the dashboard home screen.
 */
export function UserLevelBadge({
  levelLabel = 'Level 4',
  xpLabel = '420 / 800 XP',
  progress = 0.52,
  isPro = false,
  avatarSource,
  onPress,
  accessibilityLabel = 'View level progress',
}: UserLevelBadgeProps) {
  const progressWidth = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` as DimensionValue;

  return (
    <Pressable
      style={styles.userBadgeRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.levelProgressCol}>
        <View style={styles.levelNameRow}>
          <Text style={styles.levelName}>{levelLabel}</Text>
          {isPro && (
            <View style={styles.proBadge}>
              <CrownSolidIcon color="#ffffff" size={10} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.xpText}>{xpLabel}</Text>
        <View style={styles.miniProgressTrack}>
          <View style={[styles.miniProgressFill, { width: progressWidth }]} />
        </View>
      </View>
      {avatarSource && (
        <View style={styles.userAvatarWrapper}>
          <Image
            source={avatarSource}
            style={styles.userAvatarImage}
            resizeMode="cover"
          />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Canonical styles — aligned to the dashboard home screen.
 * Every screen that uses this component will get identical
 * font families, sizes, colours, and spacing.
 */
const styles = StyleSheet.create({
  userBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelProgressCol: {
    alignItems: 'flex-end',
  },
  levelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelName: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12.5,
    color: '#0f172a',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radii.pill,
  },
  proBadgeText: {
    ...fontStyle('inter', 'extraBold'),
    color: '#ffffff',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  xpText: {
    fontFamily: Fonts.inter.medium,
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  miniProgressTrack: {
    width: 68,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#0085db',
    borderRadius: 2,
  },
  userAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
});
