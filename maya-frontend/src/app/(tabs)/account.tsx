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
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
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
import { useUserStats } from '@/hooks/useUserStats';
import { paymentApi } from '@/services/payment/payment-api';
import { payHereGateway } from '@/services/payment/payhere-gateway';
import { SubscriptionRecord } from '@/services/payment/payhere-types';
import { mayaAlert } from '@/components/ui/alert-modal';

const PLAN_CROWN_IMAGE = require('@/assets/images/plan-crown.png');

function formatBillingDate(dateStr: string | null | undefined, fallback: string = '25 Jun 2026'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  const day = d.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function AccountScreen() {
  const store = useOnboardingStore();
  const stats = useUserStats();
  const displayName = stats.displayName;
  const phoneNumber = stats.phoneNumber || '+94 77 123 4567';
  const minutesBalance = stats.minutesBalance;
  const isTimeExpired = stats.isTimeExpired;
  const currentPlanTier = stats.planTier;
  const isPro = stats.isPro;
  const usedMinutes = stats.usedMinutes;
  const totalMinutes = stats.totalMinutes;
  const resetsInText = stats.resetsInText;

  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;

  const [activeTab, setActiveTab] = useState<DashboardTab>('account');
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  // Edit Profile & Preferences modal state
  const user = store.user;
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editLang, setEditLang] = useState<'sinhala' | 'tamil' | 'english'>(
    (user?.nativeLanguage as any) || 'sinhala'
  );
  const [editGoal, setEditGoal] = useState<number>(user?.dailyGoalMinutes || 10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditName(displayName);
    if (user?.nativeLanguage) {
      setEditLang(user.nativeLanguage as any);
    }
    if (user?.dailyGoalMinutes) {
      setEditGoal(user.dailyGoalMinutes);
    }
  }, [displayName, user?.nativeLanguage, user?.dailyGoalMinutes]);

  const handleOpenEditModal = () => {
    setEditName(displayName);
    setEditLang((user?.nativeLanguage as any) || 'sinhala');
    setEditGoal(user?.dailyGoalMinutes || 10);
    setIsEditProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await authService.savePreferences({
        displayName: editName.trim(),
        nativeLanguage: editLang,
        dailyGoalMinutes: editGoal,
      });
      await stats.refreshStats();
      setIsEditProfileModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

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

  const [isCancellingSub, setIsCancellingSub] = useState(false);

  const handleCancelSubscription = async () => {
    if (!isPro) {
      await mayaAlert.alert(
        'You are currently on the free Starter plan with no active recurring charges.',
        'Starter Plan',
        'info'
      );
      return;
    }

    const confirmed = await mayaAlert.confirm({
      title: 'Cancel Subscription',
      message:
        'Are you sure you want to cancel your recurring subscription? Future renewals will be stopped on PayHere, and your plan will revert to Starter at the end of your billing cycle.',
      confirmText: 'Cancel Subscription',
      cancelText: 'Keep Plan',
      type: 'warning',
      isDestructive: true,
    });
    if (!confirmed) return;

    setIsCancellingSub(true);
    try {
      const res = await paymentApi.cancelSubscription();
      await stats.refreshStats();
      await mayaAlert.success(res.msg || 'Your subscription has been cancelled.', 'Subscription Cancelled');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to cancel subscription.';
      await mayaAlert.error(errMsg, 'Cancellation Error');
    } finally {
      setIsCancellingSub(false);
    }
  };

  const searchParams = useLocalSearchParams<{ card_update?: string; payment?: string }>();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);

  const fetchSubscription = async () => {
    try {
      const sub = await paymentApi.getMySubscription();
      setSubscription(sub);
    } catch (e) {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  // Handle PayHere Preapproval redirect returns for card updates & plan payments
  useEffect(() => {
    let cardUpdateStatus = searchParams.card_update;
    let paymentStatus = searchParams.payment;

    // Web fallback: Read from window.location.search if external redirect didn't hydrate expo params yet
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
      const q = new URLSearchParams(window.location.search);
      if (!cardUpdateStatus) cardUpdateStatus = q.get('card_update') || undefined;
      if (!paymentStatus) paymentStatus = q.get('payment') || undefined;
    }

    if (cardUpdateStatus === 'success') {
      stats.refreshStats();
      fetchSubscription();
      mayaAlert.success(
        'Your payment card has been updated successfully! Future monthly renewals will now bill your new card.',
        'Card Updated'
      );
    } else if (cardUpdateStatus === 'cancelled') {
      mayaAlert.alert('Card update was cancelled.', 'Cancelled', 'info');
    } else if (paymentStatus === 'success') {
      stats.refreshStats();
      fetchSubscription();
      mayaAlert.success('Your subscription has been activated successfully!', 'Payment Successful');
    } else if (paymentStatus === 'cancelled') {
      mayaAlert.alert('Subscription payment was cancelled.', 'Cancelled', 'info');
    }

    // Clean URL query on web to avoid repeat triggers on page reload
    if ((cardUpdateStatus || paymentStatus) && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.card_update, searchParams.payment]);

  const handleChangePayment = async () => {
    if (!isPro) {
      router.push('/upgrade');
      return;
    }

    const planId = (stats.planTier === 'premium' ? 'premium' : 'pro') as 'pro' | 'premium';
    const planName = planId === 'premium' ? 'Premium' : 'Pro';

    const confirmed = await mayaAlert.confirm({
      title: 'Update Payment Card',
      message:
        'You can update your card today with zero subscription charge.\n\n• PayHere verifies your card with a temporary Rs. 1.00 test authorization that is refunded immediately.\n• Your current subscription, practice minutes, and billing cycle will not be interrupted.\n• Future renewals will automatically bill your new card.',
      confirmText: 'Update Card',
      cancelText: 'Cancel',
      type: 'info',
    });
    if (!confirmed) return;

    setIsUpdatingCard(true);
    try {
      const params = await paymentApi.getCardUpdateParams();
      const result = await payHereGateway.startPayment(params);

      if (result.status === 'completed') {
        // Allow brief interval for webhook to persist new token and card details
        await new Promise((r) => setTimeout(r, 1200));
        await stats.refreshStats();
        await fetchSubscription();
        await mayaAlert.success(
          'Your payment card has been updated successfully! Future monthly renewals will now bill your new card.',
          'Card Updated'
        );
      } else if (result.status === 'error') {
        const errorMsg = result.error || 'Card update could not be completed.';
        await mayaAlert.error(errorMsg, 'Card Update Error');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to initialize payment gateway.';
      await mayaAlert.error(errorMsg, 'Card Update Error');
    } finally {
      setIsUpdatingCard(false);
    }
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
            planTier={stats.planTier}
            usedMinutes={usedMinutes}
            totalMinutes={totalMinutes}
            resetsInText={resetsInText}
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
                levelLabel={stats.levelLabel}
                xpLabel={stats.xpLabel}
                progress={stats.progress}
                isPro={isPro}
                planTier={stats.planTier}
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
                  levelLabel={stats.levelLabel}
                  xpLabel={stats.xpLabel}
                  progress={stats.progress}
                  isPro={isPro}
                  planTier={stats.planTier}
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
                    initials={stats.initials}
                    memberSince={stats.memberSinceText}
                    isPro={isPro}
                    onEdit={handleOpenEditModal}
                    onTogglePlan={() => {}}
                    onCancelSubscription={handleCancelSubscription}
                  />

                  <StatsCard
                    xp={stats.totalXp}
                    levelNumber={stats.currentLevelNumber}
                    lessonsCompleted={stats.completedLessonsCount}
                  />

                  <PreferencesCard
                    language={stats.nativeLanguageDisplay}
                    dailyGoal={stats.dailyGoalDisplay}
                    onRowPress={() => handleOpenEditModal()}
                  />
                </View>

                {/* RIGHT COLUMN */}
                <View style={styles.desktopRightCol}>
                  <CurrentPlanCard
                    planTier={currentPlanTier}
                    planStatus={stats.planStatus}
                    isPastDue={stats.isPastDue}
                    minutesBalance={minutesBalance}
                    monthlyAllowance={stats.monthlyMinutesAllowance}
                    isTimeExpired={isTimeExpired}
                    phone={phoneNumber}
                    renewalDate={stats.resetsInText}
                    nextBillingDate={subscription?.next_billing_date}
                    cardMasked={subscription?.card_masked}
                    isUpdatingPayment={isUpdatingCard}
                    onUpgrade={() => router.push('/upgrade')}
                    onGetExtraTime={() => setActivePopup('get-extra-time')}
                    onChangePayment={handleChangePayment}
                  />

                  <CustomerSupportCard onEmailPress={handleSupportEmail} />

                  <AboutCard />
                </View>
              </View>
            ) : (
              <View style={styles.mobileStackContainer}>
                <ProfileCard
                  name={displayName}
                  initials={stats.initials}
                  memberSince={stats.memberSinceText}
                  isPro={isPro}
                  onEdit={handleOpenEditModal}
                  onTogglePlan={() => {}}
                  onCancelSubscription={handleCancelSubscription}
                />

                <StatsCard
                  xp={stats.totalXp}
                  levelNumber={stats.currentLevelNumber}
                  lessonsCompleted={stats.completedLessonsCount}
                />

                <CurrentPlanCard
                  planTier={currentPlanTier}
                  planStatus={stats.planStatus}
                  isPastDue={stats.isPastDue}
                  minutesBalance={minutesBalance}
                  monthlyAllowance={stats.monthlyMinutesAllowance}
                  isTimeExpired={isTimeExpired}
                  phone={phoneNumber}
                  renewalDate={stats.resetsInText}
                  nextBillingDate={subscription?.next_billing_date}
                  cardMasked={subscription?.card_masked}
                  isUpdatingPayment={isUpdatingCard}
                  onUpgrade={() => router.push('/upgrade')}
                  onGetExtraTime={() => setActivePopup('get-extra-time')}
                  onChangePayment={handleChangePayment}
                />

                <PreferencesCard
                  language={stats.nativeLanguageDisplay}
                  dailyGoal={stats.dailyGoalDisplay}
                  onRowPress={() => handleOpenEditModal()}
                />

                <CustomerSupportCard onEmailPress={handleSupportEmail} />

                <AboutCard />
              </View>
            )}

            <View style={{ height: isDesktop ? 40 : 80 }} />
          </ScrollView>
        </View>

        {/* EDIT PROFILE & PREFERENCES MODAL */}
        <Modal
          visible={isEditProfileModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditProfileModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile & Settings</Text>
                <Pressable
                  onPress={() => setIsEditProfileModalOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="x" size={20} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Name Field */}
                <Text style={styles.modalInputLabel}>Display Name</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                />

                {/* Explanation Language */}
                <Text style={[styles.modalInputLabel, { marginTop: 16 }]}>Explanation Language</Text>
                <View style={styles.chipRow}>
                  {(['sinhala', 'tamil', 'english'] as const).map((lang) => {
                    const isSelected = editLang === lang;
                    const label = lang.charAt(0).toUpperCase() + lang.slice(1);
                    return (
                      <Pressable
                        key={lang}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setEditLang(lang)}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Daily Goal Minutes */}
                <Text style={[styles.modalInputLabel, { marginTop: 16 }]}>Daily Practice Goal</Text>
                <View style={styles.chipRow}>
                  {[5, 10, 15, 20].map((mins) => {
                    const isSelected = editGoal === mins;
                    return (
                      <Pressable
                        key={mins}
                        style={[styles.modalChip, isSelected && styles.modalChipActive]}
                        onPress={() => setEditGoal(mins)}
                      >
                        <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                          {mins} mins
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.modalSyncNotice}>
                  Changes are saved directly to the database and synced across your session and devices.
                </Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditProfileModalOpen(false)}
                  disabled={isSaving}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSaveBtn, isSaving && { opacity: 0.7 }]}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* POPUP MODAL */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'unlock-premium'}
          levelNumber={stats.currentLevelNumber}
          title={activePopup === 'level-up' ? 'Your Level Progress' : undefined}
          subtitle={
            activePopup === 'level-up'
              ? `You are currently on ${stats.levelLabel} with ${stats.xpLabel}.\nKeep practicing speaking lessons to reach Level ${stats.currentLevelNumber + 1}!`
              : undefined
          }
          primaryButtonText={activePopup === 'level-up' ? 'View Learning Roadmap' : undefined}
          primaryButtonIcon={activePopup === 'level-up' ? 'arrow' : undefined}
          showPrimaryArrow={activePopup === 'level-up' ? true : undefined}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={() => {
            if (activePopup === 'level-up') {
              router.push('/(tabs)/roadmap');
            } else if (activePopup === 'unlock-premium') {
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
  initials = 'M',
  memberSince = 'Member since 2026',
  isPro,
  onEdit,
  onTogglePlan,
  onCancelSubscription,
}: {
  name: string;
  initials?: string;
  memberSince?: string;
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
          <Text style={styles.avatarInitialsText}>{initials}</Text>
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

          <Text style={styles.memberSinceText}>{memberSince}</Text>

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
function StatsCard({
  xp = 0,
  levelNumber = 1,
  lessonsCompleted = 0,
}: {
  xp?: number;
  levelNumber?: number;
  lessonsCompleted?: number;
}) {
  return (
    <View style={[styles.cardContainer, styles.statsCardPadding]}>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Feather name="zap" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>{xp.toLocaleString()} XP</Text>
          <Text style={styles.statLabelText}>Keep practicing!</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Feather name="bar-chart-2" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>Level {levelNumber}</Text>
          <Text style={styles.statLabelText}>You're doing great</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Feather name="book-open" size={22} color="#2563EB" />
          <Text style={styles.statNumberText}>{lessonsCompleted}</Text>
          <Text style={styles.statLabelText}>Lessons Completed</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * 3. Settings & Preferences Card (4 Items)
 */
function PreferencesCard({
  language = 'Sinhala',
  dailyGoal = '10 min daily',
  onRowPress,
}: {
  language?: string;
  dailyGoal?: string;
  onRowPress: (id: string) => void;
}) {
  const PREFERENCES = [
    {
      id: 'explanation-lang',
      iconBg: '#DCFCE7',
      icon: <Ionicons name="globe-outline" size={19} color="#16A34A" />,
      title: 'Explanation Language',
      subtitle: 'Choose the language Maya uses for explanations.',
      value: language,
    },
    {
      id: 'speaking-pref',
      iconBg: '#FFEDD5',
      icon: <Feather name="activity" size={18} color="#EA580C" />,
      title: 'Speaking Preferences',
      subtitle: 'Set speaking speed, feedback style and more.',
      value: 'Normal Speed',
    },
    {
      id: 'notifications',
      iconBg: '#F3E8FF',
      icon: <Feather name="bell" size={18} color="#9333EA" />,
      title: 'Notifications & Reminders',
      subtitle: 'Manage daily reminders and important alerts.',
      value: dailyGoal,
    },
    {
      id: 'privacy-data',
      iconBg: '#E0F2FE',
      icon: <Feather name="shield" size={18} color="#0284C7" />,
      title: 'Privacy & Data',
      subtitle: 'Manage your data and privacy settings.',
      value: 'Protected',
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
  planStatus,
  isPastDue = false,
  minutesBalance,
  monthlyAllowance,
  isTimeExpired,
  phone,
  renewalDate,
  nextBillingDate,
  cardMasked,
  isUpdatingPayment = false,
  onUpgrade,
  onGetExtraTime,
  onChangePayment,
}: {
  planTier: string;
  planStatus?: string;
  isPastDue?: boolean;
  minutesBalance: number;
  monthlyAllowance: number;
  isTimeExpired: boolean;
  phone: string;
  renewalDate: string;
  nextBillingDate?: string | null;
  cardMasked?: string;
  isUpdatingPayment?: boolean;
  onUpgrade: () => void;
  onGetExtraTime: () => void;
  onChangePayment: () => void;
}) {
  const isPro = planTier === 'pro' || planTier === 'premium';
  const planDisplayName = planTier.charAt(0).toUpperCase() + planTier.slice(1) + ' Plan';
  const nextBillingDateText = formatBillingDate(nextBillingDate, renewalDate || '25 Jun 2026');

  // Format last 4 digits of card (matches user screenshot: "···· 4582")
  const digitsOnly = (cardMasked || '').replace(/\D/g, '');
  const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : (isPro ? '4582' : '');
  const cardDisplayText = last4 ? `···· ${last4}` : '—';

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
        <View
          style={[
            styles.starterBadgePill,
            isPastDue
              ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
              : isTimeExpired && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
          ]}
        >
          <Text
            style={[
              styles.starterBadgeText,
              isPastDue
                ? { color: '#B45309' }
                : isTimeExpired && { color: '#DC2626' },
            ]}
          >
            {isPastDue ? 'Payment Past Due' : isTimeExpired ? 'Time Expired' : planDisplayName}
          </Text>
        </View>
      </View>

      {/* Warning banner if payment deduction failed */}
      {isPastDue && (
        <View style={styles.pastDueBanner}>
          <Feather name="alert-triangle" size={18} color="#D97706" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.pastDueBannerTitle}>Monthly Deduction Unsuccessful</Text>
            <Text style={styles.pastDueBannerSubtitle}>
              Your subscription renewal could not be deducted. PayHere is retrying your card. You can also re-authorize or change your payment plan now.
            </Text>
          </View>
        </View>
      )}

      {/* Main Title & Subtitle */}
      <Text style={styles.planMainTitle}>
        {planDisplayName} ({isPro ? 'Monthly' : '10 Min/Month'})
      </Text>
      <Text style={styles.planMainSubtitle}>
        {isPastDue
          ? 'Payment retry in progress. Paid features are frozen until payment settles.'
          : isTimeExpired
          ? 'You have used all available minutes for this cycle. Get extra time to continue.'
          : 'Perfect for getting started with Maya.'}
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

        {/* Row 2: Next Billing Date */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Next Billing Date</Text>
          <View style={styles.planInfoValueCol}>
            <Text style={styles.planInfoValue}>{nextBillingDateText}</Text>
          </View>
        </View>

        {/* Row 3: Payment Method */}
        <View style={styles.planInfoRow}>
          <Text style={styles.planInfoLabel}>Payment Method</Text>
          <View style={styles.paymentMethodRow}>
            <View style={styles.paymentCardInfo}>
              <Ionicons name="card-outline" size={17} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={styles.planInfoValue}>{cardDisplayText}</Text>
            </View>
            <Pressable
              onPress={onChangePayment}
              disabled={isUpdatingPayment}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Change payment card"
            >
              {isUpdatingPayment ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text style={styles.changePaymentText}>Change</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Thin Horizontal Divider Line above button */}
      <View style={styles.planCardDivider} />

      {/* Action Buttons: Get Extra Time & Upgrade */}
      <View style={{ gap: 10 }}>
        {isPastDue && (
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [
              styles.planUpgradeBtn,
              { backgroundColor: '#D97706' },
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="credit-card" size={18} color="#FFFFFF" />
            <Text style={[styles.planUpgradeBtnText, { marginLeft: 10 }]}>Update Payment / Retry Now</Text>
          </Pressable>
        )}

        {isTimeExpired && !isPastDue && (
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
            {isPro
              ? planTier === 'premium'
                ? 'Manage Subscription Plan'
                : 'Upgrade to Premium'
              : 'Upgrade to Pro'}
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  starterBadgeText: {
    fontSize: 12,
    color: '#2563EB',
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
    color: '#2563EB',
    ...fontStyle('inter', 'semiBold'),
  },
  pastDueBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    marginBottom: 6,
  },
  pastDueBannerTitle: {
    fontSize: 13,
    color: '#92400E',
    ...fontStyle('inter', 'bold'),
    marginBottom: 2,
  },
  pastDueBannerSubtitle: {
    fontSize: 11.5,
    color: '#B45309',
    lineHeight: 16,
    ...fontStyle('inter', 'regular'),
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

  /* Edit Profile Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      } as any,
      default: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    ...fontStyle('inter', 'semiBold'),
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    ...fontStyle('inter', 'regular'),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  modalChipText: {
    fontSize: 13.5,
    color: '#475569',
    ...fontStyle('inter', 'medium'),
  },
  modalChipTextActive: {
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  modalSyncNotice: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 18,
    lineHeight: 17,
    ...fontStyle('inter', 'regular'),
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 14,
    color: '#475569',
    ...fontStyle('inter', 'semiBold'),
  },
  modalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },
});
