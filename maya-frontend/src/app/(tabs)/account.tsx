import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { CrownNavIcon } from '@/components/icons/nav-icons';
import { useOnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';

const PLAN_CROWN_IMAGE = require('@/assets/images/plan-crown.png');

export default function AccountScreen() {
  const store = useOnboardingStore();
  const user = store.user;
  const displayName = user?.displayName || store.name || 'Tharindu Fernando';
  const phoneNumber = user?.phoneNumber || store.phone || '+94 77 123 4567';
  const minutesBalance = user?.minutesBalance ?? 10;
  const isTimeExpired = minutesBalance <= 0;
  const currentPlanTier = user?.planTier || (store.isCompleted ? 'starter' : 'starter');

  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;

  const [activeTab, setActiveTab] = useState<DashboardTab>('account');
  const [isPro, setIsPro] = useState(currentPlanTier === 'pro' || currentPlanTier === 'premium');
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  useEffect(() => {
    authService.fetchUserProfile();
  }, []);

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.replace('/(tabs)/dashboard');
    } else if (tab === 'roadmap') {
      router.replace('/(tabs)/roadmap');
    } else if (tab === 'history') {
      router.replace('/(tabs)/history');
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
        {/* DESKTOP SIDEBAR NAVIGATION */}
        {isDesktop && (
          <DesktopSidebar
            activeTab="account"
            onSelectTab={handleSelectTab}
            isPro={isPro}
            onUpgrade={() => router.push('/upgrade')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* MAIN CONTAINER */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR */}
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

            {/* 2-COLUMN DESKTOP vs 1-COLUMN MOBILE LAYOUT */}
            {isDesktop ? (
              <View style={styles.desktopColumnsContainer}>
                {/* LEFT COLUMN */}
                <View style={styles.desktopLeftCol}>
                  <ProfileCard
                    name={displayName}
                    isPro={isPro}
                    onEdit={() => setActivePopup('practice-complete')}
                    onTogglePlan={() => setIsPro((prev) => !prev)}
                    onCancelSubscription={() => setActivePopup('level-locked')}
                  />

                  <StatsCard />

                  <PreferencesCard onRowPress={(id) => {}} />
                </View>

                {/* RIGHT COLUMN */}
                <View style={styles.desktopRightCol}>
                  <CurrentPlanCard
                    planTier={currentPlanTier}
                    minutesBalance={minutesBalance}
                    monthlyAllowance={user?.monthlyMinutesAllowance ?? 10}
                    isTimeExpired={isTimeExpired}
                    phone={phoneNumber}
                    renewalDate={user?.minutesResetAt ? new Date(user.minutesResetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Next Month'}
                    onUpgrade={() => router.push('/upgrade')}
                    onGetExtraTime={() => setActivePopup('get-extra-time')}
                    onChangePayment={() => {}}
                  />

                  <CustomerSupportCard onEmailPress={handleSupportEmail} />

                  <AboutCard />
                </View>
              </View>
            ) : (
              <View style={styles.mobileStackContainer}>
                <ProfileCard
                  name={displayName}
                  isPro={isPro}
                  onEdit={() => setActivePopup('practice-complete')}
                  onTogglePlan={() => setIsPro((prev) => !prev)}
                  onCancelSubscription={() => setActivePopup('level-locked')}
                />

                <StatsCard />

                <CurrentPlanCard
                  planTier={currentPlanTier}
                  minutesBalance={minutesBalance}
                  monthlyAllowance={user?.monthlyMinutesAllowance ?? 10}
                  isTimeExpired={isTimeExpired}
                  phone={phoneNumber}
                  renewalDate={user?.minutesResetAt ? new Date(user.minutesResetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Next Month'}
                  onUpgrade={() => router.push('/upgrade')}
                  onGetExtraTime={() => setActivePopup('get-extra-time')}
                  onChangePayment={() => {}}
                />

                <PreferencesCard onRowPress={(id) => {}} />

                <CustomerSupportCard onEmailPress={handleSupportEmail} />

                <AboutCard />
              </View>
            )}

            <View style={{ height: isDesktop ? 40 : 80 }} />
          </ScrollView>
        </View>

        {/* POPUP MODAL */}
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
  onEdit,
  onTogglePlan,
  onCancelSubscription,
}: {
  name: string;
  isPro: boolean;
  onEdit: () => void;
  onTogglePlan?: () => void;
  onCancelSubscription: () => void;
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
              <Feather name="edit-2" size={13} color="#2563EB" />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          <Text style={styles.memberSinceText}>Member since May 20, 2026</Text>

          <View style={styles.profileBadgesRow}>
            <Pressable
              onPress={onTogglePlan}
              hitSlop={8}
              style={({ pressed }) => [styles.proPlanPill, pressed && styles.cardPressed]}
            >
              <Text style={styles.proPlanPillText}>
                {isPro ? 'Pro Plan' : 'Starter Plan'}
              </Text>
            </Pressable>

            <Pressable
              onPress={onCancelSubscription}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.cardPressed]}
            >
              <Text style={styles.cancelSubText}>Cancel Subscription</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * 2. Stats Row Card (3 Columns: XP, Level, Lessons Completed)
 */
function StatsCard() {
  return (
    <View style={[styles.cardContainer, styles.statsCardPadding]}>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Feather name="zap" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>1,250 XP</Text>
          <Text style={styles.statLabelText}>Keep practicing!</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Feather name="bar-chart-2" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>Level 7</Text>
          <Text style={styles.statLabelText}>You're doing great</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Feather name="book-open" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>24</Text>
          <Text style={styles.statLabelText}>Lessons Completed</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * 3. Settings & Preferences Card (4 Items)
 */
function PreferencesCard({ onRowPress }: { onRowPress: (id: string) => void }) {
  const PREFERENCES = [
    {
      id: 'explanation-lang',
      iconBg: '#DCFCE7',
      icon: <Ionicons name="globe-outline" size={19} color="#16A34A" />,
      title: 'Explanation Language',
      subtitle: 'Choose the language Maya uses for explanations.',
      value: 'Sinhala',
    },
    {
      id: 'speaking-pref',
      iconBg: '#FFEDD5',
      icon: <Feather name="activity" size={18} color="#EA580C" />,
      title: 'Speaking Preferences',
      subtitle: 'Set speaking speed, feedback style and mo...',
      value: 'Normal Speed',
    },
    {
      id: 'notifications',
      iconBg: '#F3E8FF',
      icon: <Feather name="bell" size={18} color="#9333EA" />,
      title: 'Notifications & Reminders',
      subtitle: 'Manage daily reminders and important alerts.',
      value: '7:00 PM Daily',
    },
    {
      id: 'privacy-data',
      iconBg: '#E0F2FE',
      icon: <Feather name="shield" size={18} color="#0284C7" />,
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
              <View style={[styles.prefIconCircle, { backgroundColor: item.iconBg }]}>
                {item.icon}
              </View>

              <View style={styles.prefTextCol}>
                <Text style={styles.prefTitleText}>{item.title}</Text>
                <Text style={styles.prefSubtitleText} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>

              <View style={styles.prefRightCol}>
                {item.value && (
                  <Text style={styles.prefValueText}>{item.value}</Text>
                )}
                <Feather name="chevron-right" size={18} color="#94A3B8" />
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
 * 4. Your Current Plan Card
 * Matches Image 1 for Pro Plan (Monthly) and Image 2 for Starter Plan (Daily)
 */
function CurrentPlanCard({
  planTier,
  minutesBalance,
  monthlyAllowance,
  isTimeExpired,
  phone,
  renewalDate,
  onUpgrade,
  onGetExtraTime,
  onChangePayment,
}: {
  planTier: string;
  minutesBalance: number;
  monthlyAllowance: number;
  isTimeExpired: boolean;
  phone: string;
  renewalDate: string;
  onUpgrade: () => void;
  onGetExtraTime: () => void;
  onChangePayment: () => void;
}) {
  const isPro = planTier === 'pro' || planTier === 'premium';
  const planDisplayName = planTier.charAt(0).toUpperCase() + planTier.slice(1) + ' Plan';

  return (
    <View style={styles.currentPlanCardContainer}>
      {/* Top Header Tag Row */}
      <View style={styles.planHeaderRow}>
        <View style={styles.planHeaderLeft}>
          <Image
            source={PLAN_CROWN_IMAGE}
            style={styles.planCrownImg}
            resizeMode="contain"
          />
          <Text style={styles.planHeaderLeftText}>Your Current Plan</Text>
        </View>

        {/* Top-Right Badge */}
        <View style={[styles.starterBadgePill, isTimeExpired && { backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.starterBadgeText, isTimeExpired && { color: '#DC2626' }]}>
            {isTimeExpired ? 'Time Expired' : planDisplayName}
          </Text>
        </View>
      </View>

      {/* Main Title & Subtitle */}
      <Text style={styles.planMainTitle}>
        {planDisplayName} ({isPro ? 'Monthly' : '10 Min/Month'})
      </Text>
      <Text style={styles.planMainSubtitle}>
        {isTimeExpired
          ? 'You have used all available minutes for this cycle. Get extra time to continue.'
          : 'Practice speaking with Maya daily to build fluency.'}
      </Text>

      {/* Table Information Rows */}
      <View style={styles.planInfoTable}>
        {/* Row 1: Current Plan */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Current Plan</Text>
          <View style={styles.planInfoValueCol}>
            <Text style={styles.planInfoValue}>{planDisplayName}</Text>
          </View>
        </View>

        {/* Row 2: Available Practice Time */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Practice Time</Text>
          <View style={styles.planInfoValueCol}>
            <Text style={[styles.planInfoValue, isTimeExpired ? { color: '#DC2626', ...fontStyle('inter', 'bold') } : { color: '#0057FF' }]}>
              {isTimeExpired ? '0m remaining (Expired)' : `${minutesBalance}m of ${monthlyAllowance}m remaining`}
            </Text>
          </View>
        </View>

        {/* Row 3: Next Reset Date */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Cycle Renews</Text>
          <View style={styles.planInfoValueCol}>
            <Text style={styles.planInfoValue}>{renewalDate}</Text>
          </View>
        </View>

        {/* Row 4: Registered Phone */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Mobile Number</Text>
          <View style={styles.planInfoValueCol}>
            <Text style={styles.planInfoValue}>{phone}</Text>
          </View>
        </View>
      </View>

      {/* Thin Horizontal Divider Line above button */}
      <View style={styles.planCardDivider} />

      {/* Action Buttons: Get Extra Time & Upgrade */}
      <View style={{ gap: 10 }}>
        {isTimeExpired && (
          <Pressable
            onPress={onGetExtraTime}
            style={({ pressed }) => [
              styles.planUpgradeBtn,
              { backgroundColor: '#0284C7' },
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="clock" size={18} color="#FFFFFF" />
            <Text style={[styles.planUpgradeBtnText, { marginLeft: 10 }]}>Get Extra Time (+30 / +120 Min)</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onUpgrade}
          style={({ pressed }) => [
            styles.planUpgradeBtn,
            pressed && styles.buttonPressed,
          ]}
        >
          <CrownNavIcon color="#FFFFFF" size={19} />
          <Text style={[styles.planUpgradeBtnText, { marginLeft: 10 }]}>
            {isPro ? 'Change Subscription Plan' : 'Upgrade to Pro'}
          </Text>
          <Feather name="chevron-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 5. Customer Support Card
 */
function CustomerSupportCard({ onEmailPress }: { onEmailPress: () => void }) {
  return (
    <View style={styles.cardContainer}>
      <Pressable
        style={({ pressed }) => [styles.supportRow, pressed && styles.cardPressed]}
        onPress={onEmailPress}
      >
        <View style={styles.supportIconCircle}>
          <Feather name="headphones" size={20} color="#2563EB" />
        </View>

        <View style={styles.supportTextCol}>
          <Text style={styles.supportTitle}>Customer Support</Text>
          <Text style={styles.supportSubtitle}>
            We're here to help you with any questions or issues.
          </Text>
          <Text style={styles.supportEmailLink}>support@talkwithmaya.com</Text>
        </View>

        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </Pressable>
    </View>
  );
}

/**
 * 6. About TalkWithMaya Card
 */
function AboutCard() {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.aboutRow}>
        <View style={styles.aboutLeftCol}>
          <Text style={styles.aboutAppTitle}>About TalkWithMaya</Text>
          <Text style={styles.aboutDescriptionText}>
            SpeakWithMaya is your AI English partner that helps you speak with confidence in real-life situations.
          </Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>

        <View style={styles.aboutRightCol}>
          <Text style={styles.mayaBrandText}>Maya</Text>
          <View style={styles.partnerDotRow}>
            <View style={styles.partnerBlueDot} />
            <Text style={styles.partnerText}>Your English Partner</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingTop: 28,
    paddingBottom: 40,
    maxWidth: 1300,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },

  /* Desktop Top Header */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },
  headingTitle: {
    fontSize: 28,
    color: '#10213D',
    letterSpacing: -0.5,
    ...fontStyle('inter', 'bold'),
  },
  headingSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    ...fontStyle('inter', 'regular'),
  },

  /* Mobile Fixed Top Bar */
  mobileFixedTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  brandTitleMobile: {
    fontSize: 18,
    color: '#10213D',
    ...fontStyle('inter', 'extraBold'),
  },
  brandAccent: {
    color: '#2563EB',
  },
  brandTaglineMobile: {
    fontSize: 10.5,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
  mobileHeadingSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  headingTitleMobile: {
    fontSize: 26,
    color: '#10213D',
    letterSpacing: -0.3,
    ...fontStyle('inter', 'bold'),
  },
  headingSubtitleMobile: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    ...fontStyle('inter', 'regular'),
  },

  /* Desktop 2 Columns */
  desktopColumnsContainer: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  desktopLeftCol: {
    flex: 1.05,
    gap: 16,
  },
  desktopRightCol: {
    flex: 0.95,
    gap: 16,
  },

  /* Mobile 1 Column Stack */
  mobileStackContainer: {
    gap: 14,
  },

  /* Common Card Container */
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.02)',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
    }),
  },
  cardPressed: {
    opacity: 0.8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  /* Profile Card */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarInitialsCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 20,
    color: '#FFFFFF',
    ...fontStyle('inter', 'extraBold'),
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
    fontSize: 17,
    color: '#10213D',
    ...fontStyle('inter', 'bold'),
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editBtnText: {
    fontSize: 13,
    color: '#2563EB',
    ...fontStyle('inter', 'semiBold'),
  },
  memberSinceText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
    ...fontStyle('inter', 'regular'),
  },
  profileBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proPlanPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  proPlanPillText: {
    fontSize: 11.5,
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  cancelSubText: {
    fontSize: 11.5,
    color: '#EF4444',
    marginLeft: 14,
    ...fontStyle('inter', 'semiBold'),
  },

  /* Stats Card */
  statsCardPadding: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumberText: {
    fontSize: 17,
    color: '#10213D',
    marginTop: 6,
    marginBottom: 2,
    ...fontStyle('inter', 'bold'),
  },
  statLabelText: {
    fontSize: 11,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },

  /* Preferences List Card */
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  prefIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  prefTextCol: {
    flex: 1,
    marginRight: 10,
  },
  prefTitleText: {
    fontSize: 14,
    color: '#10213D',
    ...fontStyle('inter', 'bold'),
  },
  prefSubtitleText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    ...fontStyle('inter', 'regular'),
  },
  prefRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prefValueText: {
    fontSize: 12.5,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  prefDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 52,
  },

  /* Current Plan Card */
  currentPlanCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0px 3px 12px 0px #1A366906',
      } as any,
      default: {
        elevation: 2,
        shadowColor: '#1A3669',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
    }),
  },
  planCrownImg: {
    width: 22,
    height: 22,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planHeaderLeftText: {
    fontSize: 14,
    color: '#0055FF',
    ...fontStyle('inter', 'bold'),
  },
  starterBadgePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  starterBadgeText: {
    fontSize: 12,
    color: '#0055FF',
    ...fontStyle('inter', 'semiBold'),
  },
  planMainTitle: {
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 6,
    ...fontStyle('inter', 'bold'),
  },
  planMainSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    ...fontStyle('inter', 'regular'),
  },
  planInfoTable: {
    gap: 16,
  },
  planInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planInfoLabel: {
    width: 140,
    fontSize: 13.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  planInfoValueCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planInfoValue: {
    fontSize: 14,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },
  paymentMethodRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePaymentText: {
    fontSize: 13.5,
    color: '#0055FF',
    ...fontStyle('inter', 'semiBold'),
  },
  planCardDivider: {
    height: 1,
    backgroundColor: '#EEF2F6',
    marginTop: 22,
    marginBottom: 20,
    width: '100%',
  },
  planUpgradeBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#1E50FF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(30, 80, 255, 0.35)',
      } as any,
      default: {
        elevation: 4,
        shadowColor: '#1E50FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  planUpgradeBtnText: {
    fontSize: 15.5,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    ...fontStyle('inter', 'bold'),
  },

  /* Customer Support Card */
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  supportTextCol: {
    flex: 1,
    marginRight: 10,
  },
  supportTitle: {
    fontSize: 14,
    color: '#10213D',
    marginBottom: 2,
    ...fontStyle('inter', 'bold'),
  },
  supportSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 3,
    ...fontStyle('inter', 'regular'),
  },
  supportEmailLink: {
    fontSize: 12,
    color: '#2563EB',
    ...fontStyle('inter', 'semiBold'),
  },

  /* About Card */
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  aboutLeftCol: {
    flex: 1,
    paddingRight: 16,
  },
  aboutAppTitle: {
    fontSize: 14,
    color: '#10213D',
    marginBottom: 4,
    ...fontStyle('inter', 'bold'),
  },
  aboutDescriptionText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#64748B',
    marginBottom: 10,
    ...fontStyle('inter', 'regular'),
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    ...fontStyle('inter', 'medium'),
  },
  aboutRightCol: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 4,
  },
  mayaBrandText: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia, serif',
    }),
    fontWeight: '700',
    fontStyle: 'italic',
    fontSize: 28,
    lineHeight: 42,
    letterSpacing: 0,
    color: '#0A2540',
  },
  partnerDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    gap: 5,
  },
  partnerBlueDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0055FF',
  },
  partnerText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0,
    color: '#737E94',
  },
});
