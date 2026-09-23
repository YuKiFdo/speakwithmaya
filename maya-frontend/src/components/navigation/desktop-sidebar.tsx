import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
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

        {/* Navigation Menu */}
        <View style={[styles.sidebarNav, isCompact && styles.sidebarNavCompact]}>
          {/* Home */}
          <Pressable
            style={[
              styles.navItem,
              isCompact && styles.navItemCompact,
              activeTab === 'home' && styles.navItemActive,
            ]}
            onPress={() => onSelectTab('home')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'home' }}
          >
            <HomeNavIcon active={activeTab === 'home'} size={isCompact ? 18 : 20} />
            <Text
              style={[
                styles.navLabel,
                isCompact && styles.navLabelCompact,
                activeTab === 'home' && styles.navLabelActive,
              ]}
            >
              Home
            </Text>
          </Pressable>

          {/* Roadmap */}
          <Pressable
            style={[
              styles.navItem,
              isCompact && styles.navItemCompact,
              activeTab === 'roadmap' && styles.navItemActive,
            ]}
            onPress={() => onSelectTab('roadmap')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'roadmap' }}
          >
            <RoadmapNavIcon active={activeTab === 'roadmap'} size={isCompact ? 18 : 20} />
            <Text
              style={[
                styles.navLabel,
                isCompact && styles.navLabelCompact,
                activeTab === 'roadmap' && styles.navLabelActive,
              ]}
            >
              Roadmap
            </Text>
          </Pressable>

          {/* History */}
          <Pressable
            style={[
              styles.navItem,
              isCompact && styles.navItemCompact,
              activeTab === 'history' && styles.navItemActive,
            ]}
            onPress={() => onSelectTab('history')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'history' }}
          >
            <HistoryNavIcon active={activeTab === 'history'} size={isCompact ? 18 : 20} />
            <Text
              style={[
                styles.navLabel,
                isCompact && styles.navLabelCompact,
                activeTab === 'history' && styles.navLabelActive,
              ]}
            >
              History
            </Text>
          </Pressable>

          {/* Account */}
          <Pressable
            style={[
              styles.navItem,
              isCompact && styles.navItemCompact,
              activeTab === 'account' && styles.navItemActive,
            ]}
            onPress={() => onSelectTab('account')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'account' }}
          >
            <AccountNavIcon active={activeTab === 'account'} size={isCompact ? 18 : 20} />
            <Text
              style={[
                styles.navLabel,
                isCompact && styles.navLabelCompact,
                activeTab === 'account' && styles.navLabelActive,
              ]}
            >
              Account
            </Text>
          </Pressable>

          {/* Upgrade to Pro (hidden when user is Pro) */}
          {!isPro && (
            <>
              <View style={[styles.sidebarDivider, isCompact && styles.sidebarDividerCompact]} />

              <Pressable
                style={[
                  styles.upgradeItem,
                  isCompact && styles.upgradeItemCompact,
                  activeTab === 'upgrade' && styles.upgradeItemActive,
                ]}
                onPress={() => {
                  if (onUpgrade) onUpgrade();
                  else onSelectTab('upgrade');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'upgrade' }}
              >
                <CrownNavIcon
                  color={activeTab === 'upgrade' ? '#2B5BFF' : '#D97706'}
                  width={isCompact ? 18 : 20}
                  height={isCompact ? 18 : 20}
                />
                <Text
                  style={[
                    styles.upgradeLabel,
                    isCompact && styles.upgradeLabelCompact,
                    activeTab === 'upgrade' && styles.upgradeLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  Upgrade to Pro
                </Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>20% off</Text>
                </View>
              </Pressable>
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
  },
  navItemActive: {
    backgroundColor: '#EDF3FF',
  },
  navLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15.5,
    color: '#64748b',
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
