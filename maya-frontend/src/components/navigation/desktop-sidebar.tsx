import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import {
  HomeNavIcon,
  RoadmapNavIcon,
  HistoryNavIcon,
  AccountNavIcon,
  CrownNavIcon,
  CrownSolidIcon,
} from '@/components/icons/nav-icons';

export type DashboardTab = 'home' | 'roadmap' | 'history' | 'account' | 'upgrade';

export interface DesktopSidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  isPro?: boolean;
  usedMinutes?: number;
  totalMinutes?: number;
  resetsInText?: string;
  onUpgrade?: () => void;
  onGetExtraTime?: () => void;
}

interface SidebarNavItemProps {
  label: string;
  icon: (active: boolean, isHovered: boolean) => React.ReactNode;
  isActive: boolean;
  isCompact?: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
  isUpgrade?: boolean;
}

function SidebarNavItem({
  label,
  icon,
  isActive,
  isCompact,
  onPress,
  badge,
  isUpgrade,
}: SidebarNavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.navItem,
        isCompact && styles.navItemCompact,
        isActive && styles.navItemActive,
        isHovered && !isActive && (isUpgrade ? styles.upgradeItemHovered : styles.navItemHovered),
        pressed && styles.navItemPressed,
      ]}
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      {/* Active Left Indicator Notch */}
      <View
        style={[
          styles.activeIndicatorNotch,
          isActive && styles.activeIndicatorNotchVisible,
        ]}
      />

      {/* Icon with micro-scale on active/hover */}
      <View
        style={[
          styles.navIconWrapper,
          (isActive || isHovered) && styles.navIconWrapperActive,
        ]}
      >
        {icon(isActive, isHovered)}
      </View>

      <Text
        style={[
          styles.navLabel,
          isCompact && styles.navLabelCompact,
          isActive && styles.navLabelActive,
          isHovered && !isActive && styles.navLabelHovered,
          isUpgrade && styles.upgradeLabel,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {badge}
    </Pressable>
  );
}

export function DesktopSidebar({
  activeTab,
  onSelectTab,
  isPro = false,
  usedMinutes,
  totalMinutes,
  resetsInText,
  onUpgrade,
  onGetExtraTime,
}: DesktopSidebarProps) {
  const { height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 900;
  const isVeryCompact = windowHeight < 740;

  const currentUsed = usedMinutes ?? (isPro ? 320 : 1);
  const currentTotal = totalMinutes ?? (isPro ? 600 : 5);
  const currentResetsIn = resetsInText ?? (isPro ? 'Resets in 12 days' : 'Resets in 24 hours');
  const percentFilled = Math.min(100, Math.round((currentUsed / currentTotal) * 100));
  const displayMinutes = isPro ? String(currentUsed) : String(currentUsed).padStart(2, '0');

  return (
    <View style={[
      styles.desktopSidebar,
      isCompact && styles.desktopSidebarCompact,
      isVeryCompact && styles.desktopSidebarVeryCompact,
    ]}>
      <View>
        {/* Logo Header */}
        <View style={[styles.sidebarLogoSection, isCompact && styles.sidebarLogoSectionCompact]}>
          <Text style={[styles.brandTitle, isCompact && styles.brandTitleCompact]}>
            Speakwith<Text style={styles.brandAccent}>Maya</Text>
          </Text>
          <Text style={styles.brandTagline}>
            Practice · improve · Be Confident
          </Text>
        </View>

        {/* Navigation Menu with Interactive Tab Animations */}
        <View style={[styles.sidebarNav, isCompact && styles.sidebarNavCompact]}>
          {/* Home */}
          <SidebarNavItem
            label="Home"
            icon={(active) => <HomeNavIcon active={active} size={isCompact ? 18 : 20} />}
            isActive={activeTab === 'home'}
            isCompact={isCompact}
            onPress={() => onSelectTab('home')}
          />

          {/* Roadmap */}
          <SidebarNavItem
            label="Roadmap"
            icon={(active) => <RoadmapNavIcon active={active} size={isCompact ? 18 : 20} />}
            isActive={activeTab === 'roadmap'}
            isCompact={isCompact}
            onPress={() => onSelectTab('roadmap')}
          />

          {/* History */}
          <SidebarNavItem
            label="History"
            icon={(active) => <HistoryNavIcon active={active} size={isCompact ? 18 : 20} />}
            isActive={activeTab === 'history'}
            isCompact={isCompact}
            onPress={() => onSelectTab('history')}
          />

          {/* Account */}
          <SidebarNavItem
            label="Account"
            icon={(active) => <AccountNavIcon active={active} size={isCompact ? 18 : 20} />}
            isActive={activeTab === 'account'}
            isCompact={isCompact}
            onPress={() => onSelectTab('account')}
          />

          {/* Upgrade to Pro (hidden when user is Pro) */}
          {!isPro && (
            <>
              <View style={[styles.sidebarDivider, isCompact && styles.sidebarDividerCompact]} />

              <SidebarNavItem
                label="Upgrade to Pro"
                icon={(active, hovered) => (
                  <CrownNavIcon
                    color={active ? '#2B5BFF' : hovered ? '#F59E0B' : '#D97706'}
                    width={isCompact ? 18 : 20}
                    height={isCompact ? 18 : 20}
                  />
                )}
                isActive={activeTab === 'upgrade'}
                isCompact={isCompact}
                isUpgrade
                onPress={() => {
                  if (onUpgrade) onUpgrade();
                  else onSelectTab('upgrade');
                }}
                badge={
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>20% off</Text>
                  </View>
                }
              />
            </>
          )}
        </View>
      </View>

      {/* Talk Time Card at bottom */}
      <View style={[styles.talkTimeCard, isCompact && styles.talkTimeCardCompact]}>
        <View style={styles.talkTimeHeader}>
          <Text style={[styles.talkTimeTitle, isCompact && styles.talkTimeTitleCompact]}>Your Talk Time</Text>
          <Text style={[styles.talkTimeReset, isCompact && styles.talkTimeResetCompact]}>{currentResetsIn}</Text>
        </View>

        <Text style={[styles.talkTimeMinutes, isCompact && styles.talkTimeMinutesCompact]}>
          {displayMinutes}{' '}
          <Text style={[styles.talkTimeTotal, isCompact && styles.talkTimeTotalCompact]}>/ {currentTotal} minutes</Text>
        </Text>

        <View style={[styles.progressBarTrack, isCompact && styles.progressBarTrackCompact]}>
          <View style={[styles.progressBarFill, { width: `${percentFilled}%` }]} />
        </View>

        <Pressable
          style={[styles.extraTimeButton, isCompact && styles.extraTimeButtonCompact]}
          onPress={isPro ? onGetExtraTime : onUpgrade}
          accessibilityRole="button"
        >
          {isPro ? (
            <>
              <HistoryNavIcon color="#2B5BFF" size={isCompact ? 15 : 17} />
              <Text style={[styles.extraTimeButtonText, isCompact && styles.extraTimeButtonTextCompact]}>
                Get Extra Talk Time →
              </Text>
            </>
          ) : (
            <>
              <CrownSolidIcon color="#2B5BFF" size={isCompact ? 16 : 18} />
              <Text style={[styles.extraTimeButtonText, isCompact && styles.extraTimeButtonTextCompact]}>
                Upgrade to premium →
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopSidebar: {
    width: 268,
    backgroundColor: '#F6F7FC',
    borderRightWidth: 1,
    borderRightColor: '#ECEEF5',
    paddingLeft: 14,
    paddingRight: 0,
    paddingVertical: 24,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  sidebarLogoSection: {
    marginBottom: 34,
    paddingLeft: 4,
    paddingRight: 14,
  },
  brandTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandAccent: {
    fontFamily: Fonts.outfit.extraBold,
    color: '#0085db',
  },
  brandTagline: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  sidebarNav: {
    gap: 10,
  },
  activeIndicatorNotch: {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: 0,
    height: 22,
    marginTop: -11,
    backgroundColor: '#2B5BFF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    opacity: 0,
    ...(Platform.OS === 'web'
      ? ({ transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)' } as any)
      : {}),
  },
  activeIndicatorNotchVisible: {
    width: 4,
    opacity: 1,
  },
  navIconWrapper: {
    ...(Platform.OS === 'web'
      ? ({ transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)' } as any)
      : {}),
  },
  navIconWrapperActive: {
    transform: [{ scale: 1.1 }],
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 14,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        } as any)
      : {}),
  },
  navItemActive: {
    backgroundColor: '#EDF3FF',
    transform: [{ translateX: 2 }],
  },
  navItemHovered: {
    backgroundColor: '#EEF2F6',
    transform: [{ translateX: 3 }],
  },
  upgradeItemHovered: {
    backgroundColor: '#FEF3C7',
    transform: [{ translateX: 3 }],
  },
  navItemPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  navLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15.5,
    color: '#64748b',
    ...(Platform.OS === 'web'
      ? ({ transition: 'color 0.15s ease' } as any)
      : {}),
  },
  navLabelHovered: {
    color: '#0F172A',
  },
  navLabelActive: {
    ...fontStyle('outfit', 'bold'),
    color: '#2B5BFF',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#ECEEF5',
    marginVertical: 12,
    marginRight: 14,
    marginLeft: 4,
  },
  upgradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 14,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  upgradeItemActive: {
    backgroundColor: '#EDF3FF',
  },
  upgradeLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    color: '#000036',
    flexShrink: 0,
  },
  upgradeLabelActive: {
    ...fontStyle('outfit', 'bold'),
    color: '#2B5BFF',
  },
  discountBadge: {
    minWidth: 60,
    height: 19,
    paddingTop: 2,
    paddingRight: 6,
    paddingBottom: 2,
    paddingLeft: 6,
    borderRadius: Radii.pill,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadgeText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
  },
  /* Talk Time Card */
  talkTimeCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    marginRight: 14,
  },
  talkTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  talkTimeTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13.5,
    color: '#1e293b',
  },
  talkTimeReset: {
    fontFamily: Fonts.inter.regular,
    fontSize: 12,
    color: '#94a3b8',
  },
  talkTimeMinutes: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 28,
    color: '#0f172a',
    marginTop: 8,
  },
  talkTimeTotal: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#94a3b8',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2B5BFF',
    borderRadius: 4,
  },
  extraTimeButton: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#2B5BFF',
    borderRadius: 14,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  extraTimeButtonCompact: {
    marginTop: 10,
    height: 36,
    borderRadius: 12,
  },
  extraTimeButtonText: {
    ...fontStyle('inter', 'bold'),
    color: '#2B5BFF',
    fontSize: 13.5,
  },
  extraTimeButtonTextCompact: {
    fontSize: 12.5,
  },
  /* Compact & Very Compact Height Overrides */
  desktopSidebarCompact: {
    paddingVertical: 14,
  },
  desktopSidebarVeryCompact: {
    paddingVertical: 10,
  },
  sidebarLogoSectionCompact: {
    marginBottom: 22,
  },
  brandTitleCompact: {
    fontSize: 20,
  },
  sidebarNavCompact: {
    gap: 10,
  },
  navItemCompact: {
    paddingVertical: 7,
    gap: 10,
  },
  navLabelCompact: {
    fontSize: 14,
  },
  sidebarDividerCompact: {
    marginVertical: 6,
  },
  upgradeItemCompact: {
    paddingVertical: 6,
  },
  upgradeLabelCompact: {
    fontSize: 14.5,
  },
  talkTimeCardCompact: {
    padding: 12,
    marginTop: 8,
    borderRadius: 16,
  },
  talkTimeTitleCompact: {
    fontSize: 12.5,
  },
  talkTimeResetCompact: {
    fontSize: 11,
  },
  talkTimeMinutesCompact: {
    fontSize: 22,
    marginTop: 4,
  },
  talkTimeTotalCompact: {
    fontSize: 12.5,
  },
  progressBarTrackCompact: {
    marginTop: 8,
    height: 6,
  },
});
