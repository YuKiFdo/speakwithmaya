import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import {
  HomeNavIcon,
  RoadmapNavIcon,
  HistoryNavIcon,
  AccountNavIcon,
  CrownSolidIcon,
} from '@/components/icons/nav-icons';
import {
  EditPencilIcon,
  PersonalInfoIcon,
  LearningGoalsIcon,
  MayaVoiceIcon,
  ExplanationLangIcon,
  SpeakingPrefIcon,
  NotificationsIcon,
  PrivacyDataIcon,
  ClockPracticeIcon,
  CalendarRenewIcon,
  UnlimitedChatIcon,
  AdvancedMemoryIcon,
  DetailedFeedbackIcon,
  PriorityVoiceIcon,
  CustomGoalsIcon,
  CustomerSupportIcon,
  AboutAppIcon,
  ChevronRightIcon,
} from '@/components/icons/account-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';

export default function AccountScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name || 'Tharindu Fernando';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<DashboardTab>('account');
  const [isPro, setIsPro] = useState(true);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.push({ pathname: '/dashboard', params });
    } else if (tab === 'roadmap') {
      router.push({ pathname: '/roadmap', params });
    } else if (tab === 'history') {
      router.push({ pathname: '/history', params });
    } else {
      setActiveTab(tab);
    }
  };

  const handleSupportEmail = () => {
    Linking.openURL('mailto:support@talkwithmaya.com').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* ==================================================================== */}
        {/* DESKTOP SIDEBAR NAVIGATION */}
        {/* ==================================================================== */}
        {isDesktop && (
          <DesktopSidebar
            activeTab="account"
            onSelectTab={handleSelectTab}
            isPro={isPro}
            onUpgrade={() => router.push('/upgrade')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* ==================================================================== */}
        {/* MAIN CONTAINER */}
        {/* ==================================================================== */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR (PINNED) */}
          {!isDesktop && (
            <View style={styles.mobileFixedTopBar}>
              <View>
                <Text style={styles.brandTitleMobile}>
                  Speakwith<Text style={styles.brandAccent}>Maya</Text>
                </Text>
                <Text style={styles.brandTaglineMobile}>
                  Practice · Improve · Be Confident
                </Text>
              </View>

              <UserLevelBadge
                isPro={isPro}
                avatarSource={require('@/assets/images/maya-avatar.png')}
                onPress={() => setActivePopup('level-up')}
              />
            </View>
          )}

          {/* MAIN SCROLLABLE CONTENT */}
          <ScrollView
            style={[styles.mainScroll, isDesktop && styles.mainScrollDesktop]}
            contentContainerStyle={[
              styles.mainScrollContent,
              isDesktop && styles.mainScrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* DESKTOP TOP HEADER */}
            {isDesktop && (
              <View style={styles.desktopTopHeader}>
                <View>
                  <Text style={styles.headingTitle}>Account</Text>
                  <Text style={styles.headingSubtitle}>
                    Manage your profile, preferences and account settings.
                  </Text>
                </View>

                <UserLevelBadge
                  isPro={isPro}
                  avatarSource={require('@/assets/images/maya-avatar.png')}
                  onPress={() => setActivePopup('level-up')}
                />
              </View>
            )}

            {/* MOBILE HEADING */}
            {!isDesktop && (
              <View style={styles.mobileHeadingSection}>
                <Text style={styles.headingTitleMobile}>Account</Text>
                <Text style={styles.headingSubtitleMobile}>
                  Manage your profile, preferences and account settings.
                </Text>
              </View>
            )}

            {/* ================================================================ */}
            {/* DESKTOP 2-COLUMN LAYOUT vs MOBILE 1-COLUMN STACK                */}
            {/* ================================================================ */}
            {isDesktop ? (
              <View style={styles.desktopColumnsContainer}>
                {/* ---------------- LEFT COLUMN ---------------- */}
                <View style={styles.desktopLeftCol}>
                  <ProfileCard
                    isPro={isPro}
                    name={displayName}
                    isDesktop={true}
                    onEdit={() => setActivePopup('practice-complete')}
                  />

                  <PreferencesCard onRowPress={(id) => {}} />

                  <AboutCard />
                </View>

                {/* ---------------- RIGHT COLUMN ---------------- */}
                <View style={styles.desktopRightCol}>
                  <PracticeMonthlyCard onManagePlan={() => router.push('/upgrade')} />

                  <ProPlanPerksCard onManagePlan={() => router.push('/upgrade')} />

                  <CustomerSupportCard onEmailPress={handleSupportEmail} />
                </View>
              </View>
            ) : (
              /* MOBILE 1-COLUMN STACK (MATCHES SCREENSHOT) */
              <View style={styles.mobileStackContainer}>
                <ProfileCard
                  isPro={isPro}
                  name={displayName}
                  isDesktop={false}
                  onEdit={() => setActivePopup('practice-complete')}
                />

                <PracticeMonthlyCard onManagePlan={() => router.push('/upgrade')} />

                <PreferencesCard onRowPress={(id) => {}} />

                <ProPlanPerksCard onManagePlan={() => router.push('/upgrade')} />

                <AboutCard />

                <CustomerSupportCard onEmailPress={handleSupportEmail} />

                {/* MOBILE UPGRADE TO PRO BANNER */}
                <View style={styles.mobileUpgradeCard}>
                  <View style={styles.mobileUpgradeHeaderRow}>
                    <CrownSolidIcon size={18} color="#D97706" />
                    <Text style={styles.mobileUpgradeTitle}>Upgrade to Pro</Text>
                    <View style={styles.hotBadge}>
                      <Text style={styles.hotBadgeText}>Hot</Text>
                    </View>
                  </View>

                  <Text style={styles.mobileUpgradeSubtitle}>
                    Unlock unlimited conversations, advanced AI feedback and premium features.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.mobileUpgradeBtn,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => router.push('/upgrade')}
                  >
                    <Text style={styles.mobileUpgradeBtnText}>Upgrade Now →</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Bottom scroll clearance */}
            <View style={{ height: isDesktop ? 40 : 80 }} />
          </ScrollView>
        </View>

        {/* ==================================================================== */}
        {/* MOBILE BOTTOM NAVIGATION TABS (MATCHES SCREENSHOT) */}
        {/* ==================================================================== */}
        {!isDesktop && (
          <View style={styles.mobileBottomTabs}>
            <Pressable
              style={styles.mobileTabItem}
              onPress={() => router.push({ pathname: '/dashboard', params })}
            >
              <HomeNavIcon active={false} size={24} />
              <Text style={styles.mobileTabLabel}>Home</Text>
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => router.push({ pathname: '/roadmap', params })}
            >
              <RoadmapNavIcon active={false} size={24} />
              <Text style={styles.mobileTabLabel}>Roadmap</Text>
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => router.push({ pathname: '/history', params })}
            >
              <HistoryNavIcon active={false} size={24} />
              <Text style={styles.mobileTabLabel}>History</Text>
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => setActiveTab('account')}
            >
              <AccountNavIcon active={true} size={24} color="#0057FF" />
              <Text style={[styles.mobileTabLabel, styles.mobileTabLabelActive]}>
                Account
              </Text>
              <View style={styles.activeIndicatorDot} />
            </Pressable>
          </View>
        )}

        {/* ==================================================================== */}
        {/* POPUP MODAL */}
        {/* ==================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'unlock-premium'}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={() => {
            if (activePopup === 'unlock-premium') {
              router.push('/upgrade');
            }
            setActivePopup(null);
          }}
          onFooterButtonPress={() => {
            router.push('/upgrade');
            setActivePopup(null);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * 1. Profile Information Card
 */
function ProfileCard({
  name,
  isPro,
  isDesktop,
  onEdit,
}: {
  name: string;
  isPro: boolean;
  isDesktop: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.profileRow}>
        {/* Avatar Initials Circle */}
        <View style={styles.avatarInitialsCircle}>
          <Text style={styles.avatarInitialsText}>TF</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfoCol}>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileNameText}>{name}</Text>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && styles.cardPressed]}
              onPress={onEdit}
              hitSlop={8}
            >
              <EditPencilIcon size={13} color="#0057FF" />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          <Text style={styles.memberSinceText}>Member since May 20, 2026</Text>

          {isPro && (
            <View style={styles.proPlanPill}>
              <Text style={styles.proPlanPillText}>Pro Plan</Text>
            </View>
          )}
        </View>

        {/* Mobile Right Chevron */}
        {!isDesktop && (
          <View style={styles.profileChevron}>
            <ChevronRightIcon size={18} color="#94A3B8" />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * 2. Settings & Preferences Card (7 Items)
 */
interface PreferenceItem {
  id: string;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value?: string;
}

function PreferencesCard({ onRowPress }: { onRowPress: (id: string) => void }) {
  const PREFERENCES: PreferenceItem[] = [
    {
      id: 'personal-info',
      iconBg: '#F3E8FF',
      icon: <PersonalInfoIcon size={18} color="#9333EA" />,
      title: 'Personal Information',
      subtitle: 'Update your name, email and basic details.',
    },
    {
      id: 'learning-goals',
      iconBg: '#FFEDD5',
      icon: <LearningGoalsIcon size={18} color="#EA580C" />,
      title: 'Learning Goals',
      subtitle: 'Update your English goals and learning focus.',
    },
    {
      id: 'maya-voice',
      iconBg: '#FCE7F3',
      icon: <MayaVoiceIcon size={18} color="#DB2777" />,
      title: "Maya's Voice & Personality",
      subtitle: 'Choose voice, speaking style and personality.',
    },
    {
      id: 'explanation-lang',
      iconBg: '#DCFCE7',
      icon: <ExplanationLangIcon size={18} color="#16A34A" />,
      title: 'Explanation Language',
      subtitle: 'Choose the language Maya uses for explanations.',
      value: 'Sinhala',
    },
    {
      id: 'speaking-pref',
      iconBg: '#FEF3C7',
      icon: <SpeakingPrefIcon size={18} color="#D97706" />,
      title: 'Speaking Preferences',
      subtitle: 'Set speaking speed, feedback style and more.',
      value: 'Normal Speed • ...',
    },
    {
      id: 'notifications',
      iconBg: '#E0F2FE',
      icon: <NotificationsIcon size={18} color="#0284C7" />,
      title: 'Notifications & Reminders',
      subtitle: 'Manage daily reminders and important alerts.',
      value: '7:00 PM Daily',
    },
    {
      id: 'privacy-data',
      iconBg: '#EEF2FF',
      icon: <PrivacyDataIcon size={18} color="#4F46E5" />,
      title: 'Privacy & Data',
      subtitle: 'Manage your data and privacy settings.',
    },
  ];

  return (
    <View style={styles.cardContainer}>
      {PREFERENCES.map((item, index) => {
        const isLast = index === PREFERENCES.length - 1;
        return (
          <React.Fragment key={item.id}>
            <Pressable
              style={({ pressed }) => [
                styles.preferenceRow,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onRowPress(item.id)}
            >
              {/* Colored Circular Icon */}
              <View style={[styles.prefIconCircle, { backgroundColor: item.iconBg }]}>
                {item.icon}
              </View>

              {/* Text Info */}
              <View style={styles.prefTextCol}>
                <Text style={styles.prefTitleText}>{item.title}</Text>
                <Text style={styles.prefSubtitleText} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>

              {/* Right Value & Chevron */}
              <View style={styles.prefRightCol}>
                {item.value && (
                  <Text style={styles.prefValueText}>{item.value}</Text>
                )}
                <ChevronRightIcon size={16} color="#94A3B8" />
              </View>
            </Pressable>

            {!isLast && <View style={styles.prefDivider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/**
 * 3. This Month's Practice Card
 */
function PracticeMonthlyCard({ onManagePlan }: { onManagePlan: () => void }) {
  const percentUsed = 26; // 1h 18m of 5h 00m = ~26%

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.sectionSmallHeading}>This month's practice</Text>

      <View style={styles.practiceHeroRow}>
        <View style={styles.practiceTimeDisplayRow}>
          <Text style={styles.practiceTimeBig}>3h 42m</Text>
          <Text style={styles.practiceTimeLeftText}> left</Text>
        </View>

        <View style={styles.greenPlanPill}>
          <Text style={styles.greenPlanPillText}>Pro Plan</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentUsed}%` }]} />
      </View>

      <View style={styles.progressLabelsRow}>
        <Text style={styles.progressSubLabel}>
          Used: <Text style={styles.progressBoldText}>1h 18m</Text>
        </Text>
        <Text style={styles.progressSubLabel}>
          Total: <Text style={styles.progressBoldText}>5h 00m</Text>
        </Text>
      </View>

      {/* Two Sub-Boxes */}
      <View style={styles.subBoxesRow}>
        {/* Total practice time */}
        <View style={styles.subBoxCard}>
          <View style={styles.subBoxIconCircle}>
            <ClockPracticeIcon size={18} color="#0057FF" />
          </View>
          <Text style={styles.subBoxLabel}>Total practice time</Text>
          <Text style={styles.subBoxValue}>5 Hours</Text>
          <Text style={styles.subBoxSubtext}>300 minutes this month</Text>
        </View>

        {/* Plan renews on */}
        <View style={styles.subBoxCard}>
          <View style={styles.subBoxIconCircle}>
            <CalendarRenewIcon size={18} color="#0057FF" />
          </View>
          <Text style={styles.subBoxLabel}>Plan renews on</Text>
          <Text style={styles.subBoxValue}>25 Jun 2026</Text>
          <Text style={styles.subBoxSubtext}>12 days remaining</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * 4. Your Pro Plan Card (Perks & Features)
 */
function ProPlanPerksCard({ onManagePlan }: { onManagePlan: () => void }) {
  const PERKS = [
    {
      id: 'perk-1',
      icon: <UnlimitedChatIcon size={18} color="#0057FF" />,
      label: 'Unlimited\nconversations',
    },
    {
      id: 'perk-2',
      icon: <AdvancedMemoryIcon size={18} color="#0057FF" />,
      label: 'Advanced\nAI memory',
    },
    {
      id: 'perk-3',
      icon: <DetailedFeedbackIcon size={18} color="#0057FF" />,
      label: 'Detailed feedback\n& corrections',
    },
    {
      id: 'perk-4',
      icon: <PriorityVoiceIcon size={18} color="#0057FF" />,
      label: 'Priority voice\naccess',
    },
    {
      id: 'perk-5',
      icon: <CustomGoalsIcon size={18} color="#0057FF" />,
      label: 'Custom learning\ngoals',
    },
  ];

  return (
    <View style={styles.cardContainer}>
      <View style={styles.perksHeaderRow}>
        <Text style={styles.cardHeaderTitle}>Your Pro Plan</Text>
        <Pressable
          style={({ pressed }) => [pressed && styles.cardPressed]}
          onPress={onManagePlan}
          hitSlop={8}
        >
          <Text style={styles.managePlanText}>☆ Manage Plan</Text>
        </Pressable>
      </View>

      {/* 5 Icons Row */}
      <View style={styles.perksIconsRow}>
        {PERKS.map((perk) => (
          <View key={perk.id} style={styles.perkItemCol}>
            <View style={styles.perkIconCircle}>
              {perk.icon}
            </View>
            <Text style={styles.perkItemLabel} numberOfLines={2}>
              {perk.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Blue Banner Pill */}
      <View style={styles.perkBannerPill}>
        <Text style={styles.perkBannerPillText}>
          ★ You are enjoying all Pro Plan benefits.
        </Text>
      </View>
    </View>
  );
}

/**
 * 5. About TalkWithMaya Card
 */
function AboutCard() {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.aboutHeaderRow}>
        <View style={styles.aboutTitleRow}>
          <AboutAppIcon size={24} />
          <Text style={styles.aboutAppTitle}>About TalkWithMaya</Text>
        </View>

        <View style={styles.mayaLogoRow}>
          <Text style={styles.mayaLogoText}>Maya</Text>
          <Text style={styles.mayaTaglineText}>● Your English Partner</Text>
        </View>
      </View>

      <Text style={styles.aboutDescriptionText}>
        TalkWithMaya is your AI English partner that helps you speak with confidence in real-life situations.
      </Text>

      <Text style={styles.versionText}>Version 1.0.0</Text>
    </View>
  );
}

/**
 * 6. Customer Support Card
 */
function CustomerSupportCard({ onEmailPress }: { onEmailPress: () => void }) {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.supportRow}>
        <View style={styles.supportIconCircle}>
          <CustomerSupportIcon size={20} color="#0057FF" />
        </View>

        <View style={styles.supportTextCol}>
          <Text style={styles.supportTitle}>Customer Support</Text>
          <Text style={styles.supportSubtitle}>
            We're here to help you with any questions or issues you may have.
          </Text>
          <Pressable
            style={({ pressed }) => [pressed && styles.cardPressed]}
            onPress={onEmailPress}
            hitSlop={6}
          >
            <Text style={styles.supportEmailLink}>support@talkwithmaya.com</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScrollDesktop: {
    marginLeft: 0,
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
  },
  mainScrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 24,
    paddingBottom: 40,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },

  /* Desktop Top Header */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headingTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 32,
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headingSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 14.5,
    color: '#64748B',
    marginTop: 4,
  },

  /* Mobile Fixed Top Bar */
  mobileFixedTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0F172A',
  },
  brandAccent: {
    color: '#0057FF',
  },
  brandTaglineMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#94a3b8',
  },
  mobileHeadingSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  headingTitleMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 26,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headingSubtitleMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },

  /* Desktop 2 Columns */
  desktopColumnsContainer: {
    flexDirection: 'row',
    gap: 22,
    alignItems: 'flex-start',
  },
  desktopLeftCol: {
    flex: 1.05,
    gap: 18,
  },
  desktopRightCol: {
    flex: 0.95,
    gap: 18,
  },

  /* Mobile 1 Column Stack */
  mobileStackContainer: {
    gap: 16,
  },

  /* Common Card Container */
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.02)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
          elevation: 1,
        }),
  },
  cardPressed: {
    opacity: 0.8,
  },

  /* Profile Card */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarInitialsCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0057FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 19,
    color: '#FFFFFF',
  },
  profileInfoCol: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileNameText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0F172A',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12.5,
    color: '#0057FF',
  },
  memberSinceText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },
  proPlanPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  proPlanPillText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 11,
    color: '#0057FF',
  },
  profileChevron: {
    paddingLeft: 4,
  },

  /* Preferences List Card */
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  prefIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  prefTextCol: {
    flex: 1,
    marginRight: 10,
  },
  prefTitleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0F172A',
  },
  prefSubtitleText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  prefRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prefValueText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748B',
  },
  prefDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginLeft: 52,
  },

  /* Practice Monthly Card */
  sectionSmallHeading: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748B',
  },
  practiceHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  practiceTimeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  practiceTimeBig: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 32,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  practiceTimeLeftText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 16,
    color: '#64748B',
  },
  greenPlanPill: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greenPlanPillText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    color: '#FFFFFF',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0057FF',
    borderRadius: 4,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  progressSubLabel: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12,
    color: '#64748B',
  },
  progressBoldText: {
    ...fontStyle('outfit', 'bold'),
    color: '#0F172A',
  },
  subBoxesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  subBoxCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  subBoxIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  subBoxLabel: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 11.5,
    color: '#64748B',
  },
  subBoxValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#0057FF',
    marginTop: 2,
    marginBottom: 2,
  },
  subBoxSubtext: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#94A3B8',
  },

  /* Pro Plan Perks Card */
  perksHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardHeaderTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  managePlanText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0057FF',
  },
  perksIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  perkItemCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  perkIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  perkItemLabel: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  perkBannerPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkBannerPillText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#0057FF',
    textAlign: 'center',
  },

  /* About Card */
  aboutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutAppTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#0F172A',
  },
  mayaLogoRow: {
    alignItems: 'flex-end',
  },
  mayaLogoText: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    fontStyle: 'italic',
    color: '#0F172A',
  },
  mayaTaglineText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10,
    color: '#64748B',
  },
  aboutDescriptionText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 10,
  },
  versionText: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 11,
    color: '#94A3B8',
  },

  /* Customer Support Card */
  supportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  supportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTextCol: {
    flex: 1,
  },
  supportTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 3,
  },
  supportSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 6,
  },
  supportEmailLink: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#0057FF',
  },

  /* Mobile Upgrade Card */
  mobileUpgradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 18,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.02)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
          elevation: 1,
        }),
  },
  mobileUpgradeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  mobileUpgradeTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  hotBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hotBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  mobileUpgradeSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  mobileUpgradeBtn: {
    backgroundColor: '#0057FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileUpgradeBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#FFFFFF',
  },

  /* Mobile Bottom Navigation */
  mobileBottomTabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 10,
  },
  mobileTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 60,
  },
  mobileTabLabel: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  mobileTabLabelActive: {
    ...fontStyle('outfit', 'bold'),
    color: '#0057FF',
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0057FF',
    marginTop: 3,
  },
});
