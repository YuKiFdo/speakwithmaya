import React, { useState, useEffect, useRef } from 'react';
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
import { MobileTopBar } from '@/components/navigation/mobile-top-bar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { CrownNavIcon } from '@/components/icons/nav-icons';
import { LKFlag } from '@/components/icons/lk-flag';
import { MayaPrimaryButton } from '@/components/ui/maya-primary-button';
import { useOnboardingStore, OnboardingStore } from '@/services/store/onboarding-store';
import { authService } from '@/services/auth/auth-service';
import { useUserStats } from '@/hooks/useUserStats';
import { paymentApi } from '@/services/payment/payment-api';
import { payHereGateway } from '@/services/payment/payhere-gateway';
import { SubscriptionRecord } from '@/services/payment/payhere-types';
import { mayaAlert } from '@/components/ui/alert-modal';
import {
  getPendingCheckoutContext,
  trackVerifiedPurchase,
  trackPaymentFailed,
  trackPaymentCancelled,
} from '@/utils/analytics';

const PLAN_CROWN_IMAGE = require('@/assets/images/plan-crown.png');

const ENGLISH_LEVEL_OPTIONS = [
  {
    id: 'beginner',
    title: 'Beginner',
    subtitle: 'Basic words and simple\nsentences',
    bars: 1,
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    subtitle: 'Can handle daily\nconversations',
    bars: 2,
  },
  {
    id: 'upper-intermediate',
    title: 'Upper Intermediate',
    subtitle: 'Confident in most\nsituations',
    bars: 3,
  },
  {
    id: 'advanced',
    title: 'Advanced',
    subtitle: 'Fluent and natural\nconversations',
    bars: 4,
  },
] as const;

function normalizeLevelId(raw?: string | null): string {
  const clean = (raw || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (clean === 'beginner') return 'beginner';
  if (clean === 'upper-intermediate' || clean === 'upper_intermediate') return 'upper-intermediate';
  if (clean === 'advanced') return 'advanced';
  return 'intermediate';
}

function formatLocalPhoneDigits(rawPhone?: string | null): string {
  const raw = (rawPhone || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(/^\+?94\s*/, '').replace(/\D/g, '');
  if (!stripped) return '';
  const withLeadingZero = stripped.startsWith('0') ? stripped : `0${stripped}`;
  if (withLeadingZero.length > 3) {
    return `${withLeadingZero.slice(0, 3)} ${withLeadingZero.slice(3, 10)}`;
  }
  return withLeadingZero;
}

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
  const currentAvatarUrl = store.avatarUrl || user?.avatarUrl || null;
  const currentEmail = store.email || user?.email || '';
  const currentLevelId = normalizeLevelId(user?.level || store.level);

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editPhone, setEditPhone] = useState(() => formatLocalPhoneDigits(phoneNumber));
  const [editEmail, setEditEmail] = useState(currentEmail);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [editLevel, setEditLevel] = useState<string>(currentLevelId);
  const [editLang, setEditLang] = useState<'sinhala' | 'tamil' | 'english'>(
    (user?.nativeLanguage as any) || 'sinhala'
  );
  const [editGoal, setEditGoal] = useState<number>(user?.dailyGoalMinutes || 10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditName(displayName);
    setEditPhone(formatLocalPhoneDigits(phoneNumber));
    setEditEmail(currentEmail);
    setEditAvatarUrl(currentAvatarUrl);
    setEditLevel(currentLevelId);
    if (user?.nativeLanguage) {
      setEditLang(user.nativeLanguage as any);
    }
    if (user?.dailyGoalMinutes) {
      setEditGoal(user.dailyGoalMinutes);
    }
  }, [
    displayName,
    phoneNumber,
    currentEmail,
    currentAvatarUrl,
    currentLevelId,
    user?.nativeLanguage,
    user?.dailyGoalMinutes,
  ]);

  const handleOpenEditModal = () => {
    setEditName(displayName);
    setEditPhone(formatLocalPhoneDigits(phoneNumber));
    setEditEmail(currentEmail);
    setEditAvatarUrl(currentAvatarUrl);
    setEditLevel(currentLevelId);
    setEditLang((user?.nativeLanguage as any) || 'sinhala');
    setEditGoal(user?.dailyGoalMinutes || 10);
    setIsEditProfileModalOpen(true);
  };

  const handlePickProfilePhoto = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = (e: any) => {
        const file: File | undefined = e?.target?.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          mayaAlert.toast('Please choose a JPG or PNG image under 5MB.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (!dataUrl) return;
          // Resize & center-crop to a clean 256x256 square JPEG so storage stays fast and lightweight
          const img = new window.Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const targetSize = 256;
              canvas.width = targetSize;
              canvas.height = targetSize;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const minSide = Math.min(img.width, img.height);
                const sx = Math.floor((img.width - minSide) / 2);
                const sy = Math.floor((img.height - minSide) / 2);
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
                const compressed = canvas.toDataURL('image/jpeg', 0.86);
                setEditAvatarUrl(compressed);
                return;
              }
            } catch {}
            setEditAvatarUrl(dataUrl);
          };
          img.onerror = () => setEditAvatarUrl(dataUrl);
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      mayaAlert.toast('Please enter your full name.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const isStarterPlan = !isPro || currentPlanTier === 'starter';
      const cleanDigits = editPhone.replace(/\D/g, '');
      const normalizedPhone = !isStarterPlan && cleanDigits
        ? cleanDigits.startsWith('0')
          ? `+94${cleanDigits.slice(1)}`
          : cleanDigits.startsWith('94')
          ? `+${cleanDigits}`
          : `+94${cleanDigits}`
        : undefined;

      await authService.savePreferences({
        displayName: editName.trim(),
        phoneNumber: normalizedPhone,
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl,
        level: editLevel,
        nativeLanguage: editLang,
        dailyGoalMinutes: editGoal,
      });
      await stats.refreshStats();
      setIsEditProfileModalOpen(false);
      mayaAlert.toast('Profile updated successfully!', 'success');
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

  const handleSelectExplanationLanguage = async (lang: 'sinhala' | 'tamil' | 'english') => {
    setEditLang(lang);
    setIsLanguageModalOpen(false);
    await authService.savePreferences({ nativeLanguage: lang });
    await stats.refreshStats();
    mayaAlert.toast(
      `Explanation language updated to ${lang.charAt(0).toUpperCase() + lang.slice(1)}.`,
      'success',
    );
  };

  const handleSubmitComplaint = async () => {
    if (!complaintText.trim()) {
      mayaAlert.toast('Please describe your issue or feedback before submitting.', 'warning');
      return;
    }
    setIsSubmittingComplaint(true);
    try {
      await authService.submitComplaint(complaintText.trim());
      setComplaintText('');
      setIsComplaintModalOpen(false);
      await mayaAlert.success(
        'Thank you for your feedback! Our team has received your message and will review it promptly.',
        'Submitted',
      );
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await mayaAlert.confirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out of TalkWithMaya? You can sign back in anytime with your mobile number.',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      type: 'warning',
      isDestructive: true,
    });
    if (!confirmed) return;

    await authService.logout();
    router.replace('/onboarding/phone?mode=login');
  };

  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [isReactivatingSub, setIsReactivatingSub] = useState(false);
  const [isReactivateSelectionModalOpen, setIsReactivateSelectionModalOpen] = useState(false);
  const [isReactivateOtpModalOpen, setIsReactivateOtpModalOpen] = useState(false);
  const [reactivateOtpDigits, setReactivateOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [isVerifyingReactivateOtp, setIsVerifyingReactivateOtp] = useState(false);
  const [reactivateOtpError, setReactivateOtpError] = useState<string | null>(null);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const reactivateInputRefs = useRef<(TextInput | null)[]>([]);

  const handleReactivateSubscription = async () => {
    if (stats.hasTelcoSubscription) {
      setIsReactivatingSub(true);
      try {
        const res = await paymentApi.reactivateTelcoSubscription();
        if (res.requiresPin) {
          setReactivateOtpDigits(Array(6).fill(''));
          setReactivateOtpError(null);
          setIsReactivateOtpModalOpen(true);
        } else {
          await stats.refreshStats();
          await mayaAlert.success(
            res.message || 'Your daily subscription has been reactivated successfully!',
            'Subscription Active'
          );
        }
      } catch (err: any) {
        await mayaAlert.error(err.message || 'Failed to reactivate daily subscription.', 'Reactivation Error');
      } finally {
        setIsReactivatingSub(false);
      }
    } else {
      router.push('/upgrade');
    }
  };

  const handleReactivateDigitChange = (text: string, index: number) => {
    setReactivateOtpError(null);
    const cleaned = text.replace(/[^0-9]/g, '');
    if (!cleaned) {
      const updated = [...reactivateOtpDigits];
      updated[index] = '';
      setReactivateOtpDigits(updated);
      return;
    }

    if (cleaned.length > 1) {
      // Pasted full OTP code
      const pasted = cleaned.slice(0, 6).split('');
      const updated = [...reactivateOtpDigits];
      pasted.forEach((char, i) => {
        updated[i] = char;
      });
      setReactivateOtpDigits(updated);
      const targetIdx = Math.min(pasted.length, 5);
      reactivateInputRefs.current[targetIdx]?.focus();
      return;
    }

    const updated = [...reactivateOtpDigits];
    updated[index] = cleaned;
    setReactivateOtpDigits(updated);

    if (index < 5 && cleaned) {
      reactivateInputRefs.current[index + 1]?.focus();
    }
  };

  const handleReactivateKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !reactivateOtpDigits[index] && index > 0) {
      reactivateInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyReactivateOtp = async () => {
    const code = reactivateOtpDigits.join('').trim();
    if (code.length < 6 || isVerifyingReactivateOtp) return;

    setIsVerifyingReactivateOtp(true);
    setReactivateOtpError(null);
    try {
      const res = await paymentApi.verifyReactivateTelcoPin(code);
      setIsReactivateOtpModalOpen(false);
      setReactivateOtpDigits(Array(6).fill(''));
      await stats.refreshStats();
      await fetchSubscription();
      await mayaAlert.success(
        res.message || 'Your daily subscription has been reactivated successfully!',
        'Subscription Active'
      );
    } catch (err: any) {
      setReactivateOtpError(err.message || 'Invalid verification PIN. Please check and try again.');
    } finally {
      setIsVerifyingReactivateOtp(false);
    }
  };

  const handleResendReactivateOtp = async () => {
    if (isResendingOtp) return;
    setIsResendingOtp(true);
    setReactivateOtpError(null);
    try {
      await paymentApi.reactivateTelcoSubscription();
      setReactivateOtpDigits(Array(6).fill(''));
      reactivateInputRefs.current[0]?.focus();
      await mayaAlert.alert('A new verification PIN has been sent via SMS to your mobile phone.', 'PIN Sent', 'info');
    } catch (err: any) {
      setReactivateOtpError(err.message || 'Failed to resend PIN.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleCancelSubscription = async () => {
    // If subscription is already cancelled or locked, direct to reactivate
    if (stats.isSubscriptionLocked || stats.isTelcoUnsubscribed) {
      setActivePopup('reactivate-plan');
      return;
    }

    // 1. Daily Subscription cancellation
    if (stats.hasTelcoSubscription) {
      const confirmed = await mayaAlert.confirm({
        title: 'Cancel Daily Subscription',
        message:
          'Are you sure you want to cancel your daily subscription?\n\n• Daily renewal from your mobile balance will be stopped.\n• Access to Maya practice sessions will be locked until you reactivate or choose a plan.',
        confirmText: 'Cancel Subscription',
        cancelText: 'Keep Plan',
        type: 'warning',
        isDestructive: true,
      });
      if (!confirmed) return;

      setIsCancellingSub(true);
      try {
        const res = await paymentApi.cancelTelcoSubscription();
        await stats.refreshStats();
        await mayaAlert.success(
          res.message || 'Your daily subscription has been cancelled.',
          'Subscription Cancelled'
        );
      } catch (err: any) {
        const errMsg = err.message || 'Failed to cancel daily subscription.';
        await mayaAlert.error(errMsg, 'Cancellation Error');
      } finally {
        setIsCancellingSub(false);
      }
      return;
    }

    // 2. Pro/Premium recurring PayHere card cancellation
    if (isPro) {
      const nextDate = subscription?.next_billing_date
        ? formatBillingDate(subscription.next_billing_date)
        : stats.gracePeriodEndDate
        ? formatBillingDate(stats.gracePeriodEndDate)
        : 'the end of your billing cycle';

      const confirmed = await mayaAlert.confirm({
        title: 'Cancel Subscription',
        message: `Are you sure you want to cancel your recurring subscription?\n\n• Future automatic renewals on PayHere will be stopped.\n• You can continue practicing with your remaining minutes until ${nextDate}.\n• After ${nextDate}, your plan will expire.`,
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
        await mayaAlert.success(
          res.msg || `Your subscription has been cancelled. You can continue practicing until ${nextDate}.`,
          'Subscription Cancelled'
        );
      } catch (err: any) {
        const errMsg = err.message || 'Failed to cancel subscription.';
        await mayaAlert.error(errMsg, 'Cancellation Error');
      } finally {
        setIsCancellingSub(false);
      }
      return;
    }

    // 3. Free Starter user with no active billing
    await mayaAlert.alert(
      'You are currently on the free Starter plan with no active recurring charges.',
      'Starter Plan',
      'info'
    );
  };

  const searchParams = useLocalSearchParams<{
    card_update?: string;
    payment?: string;
    order_id?: string;
    reactivatePin?: string;
    reactivate?: string;
  }>();
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

  useEffect(() => {
    if (searchParams.reactivatePin === '1') {
      setReactivateOtpDigits(Array(6).fill(''));
      setReactivateOtpError(null);
      setIsReactivateOtpModalOpen(true);
    } else if (searchParams.reactivate === '1') {
      setActivePopup('reactivate-plan');
    }
  }, [searchParams.reactivatePin, searchParams.reactivate]);

  // Handle PayHere Preapproval redirect returns for card updates & plan payments
  useEffect(() => {
    let cardUpdateStatus = searchParams.card_update;
    let paymentStatus = searchParams.payment;
    let orderId = searchParams.order_id;

    // Web fallback: Read from window.location.search if external redirect didn't hydrate expo params yet
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
      const q = new URLSearchParams(window.location.search);
      if (!cardUpdateStatus) cardUpdateStatus = q.get('card_update') || undefined;
      if (!paymentStatus) paymentStatus = q.get('payment') || undefined;
      if (!orderId) orderId = q.get('order_id') || undefined;
    }

    if (!cardUpdateStatus && !paymentStatus) return;

    // Clean URL query on web immediately to avoid repeat triggers on page reload
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Small delay ensures screen animation, DOM layout, and AlertHost listener are fully settled
    const timer = setTimeout(async () => {
      const pendingCtx = getPendingCheckoutContext();
      const effectiveOrderId = orderId || pendingCtx?.transaction_id;

      if (cardUpdateStatus === 'success') {
        if (effectiveOrderId) {
          try {
            await paymentApi.verifyOrderWithRetry(effectiveOrderId);
          } catch (e) {
            // fallback gracefully
          }
        }
        stats.refreshStats();
        fetchSubscription();
        mayaAlert.success(
          'Your payment card has been updated successfully! Future monthly renewals will now bill your new card.',
          'Card Updated'
        );
      } else if (cardUpdateStatus === 'cancelled') {
        mayaAlert.alert('Card update was cancelled.', 'Cancelled', 'info');
      } else if (paymentStatus === 'success') {
        if (!effectiveOrderId) {
          mayaAlert.error(
            'Unable to verify payment reference. Please check your account status or try again.',
            'Verification Required'
          );
          return;
        }

        const verifyRes = await paymentApi.verifyOrderWithRetry(effectiveOrderId);
        if (verifyRes.verified && verifyRes.transaction) {
          if (verifyRes.firstVerifiedForAnalytics !== false) {
            trackVerifiedPurchase({
              transaction_id: verifyRes.transaction.transactionId,
              event_id: verifyRes.transaction.eventId,
              plan_name: verifyRes.transaction.planName,
              billing_period: verifyRes.transaction.billingPeriod,
              value: verifyRes.transaction.value,
              currency: 'LKR',
            });
          }
          stats.refreshStats();
          fetchSubscription();
          mayaAlert.success('Your subscription has been activated successfully!', 'Payment Successful');
        } else if (verifyRes.status === 'PAYMENT_FAILED') {
          trackPaymentFailed(
            verifyRes.transaction
              ? {
                  plan_name: verifyRes.transaction.planName,
                  billing_period: verifyRes.transaction.billingPeriod,
                  value: verifyRes.transaction.value,
                  currency: 'LKR',
                  transaction_id: verifyRes.transaction.transactionId,
                }
              : { transaction_id: effectiveOrderId }
          );
          mayaAlert.error(
            verifyRes.message || 'Your subscription payment could not be completed.',
            'Payment Failed'
          );
        } else {
          mayaAlert.alert(
            'Your payment is still being verified by the payment gateway. Please check your account shortly.',
            'Verification Pending',
            'info'
          );
        }
      } else if (paymentStatus === 'cancelled') {
        trackPaymentCancelled({
          ...(pendingCtx || {}),
          ...(effectiveOrderId ? { transaction_id: effectiveOrderId } : {}),
        });
        mayaAlert.alert('Subscription payment was cancelled.', 'Cancelled', 'info');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchParams.card_update, searchParams.payment, searchParams.order_id]);

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
            isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
            usedMinutes={usedMinutes}
            totalMinutes={totalMinutes}
            resetsInText={resetsInText}
            onUpgrade={() => router.push('/upgrade')}
            onReactivate={() => setActivePopup('reactivate-plan')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* MAIN CONTAINER */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR */}
          <MobileTopBar
            pinned
            onLevelPress={() => setActivePopup('level-up')}
          />

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
                  isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
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
                    avatarUrl={currentAvatarUrl}
                    memberSince={stats.memberSinceText}
                    isPro={isPro}
                    isLocked={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
                    onEdit={handleOpenEditModal}
                    onTogglePlan={() => {}}
                    onCancelSubscription={handleCancelSubscription}
                    onLogout={handleLogout}
                  />

                  <StatsCard
                    xp={stats.totalXp}
                    levelNumber={stats.currentLevelNumber}
                    rank={stats.rank}
                  />

                  <AccountActionCards
                    language={stats.nativeLanguageDisplay}
                    onLanguagePress={() => setIsLanguageModalOpen(true)}
                    onLeaderboardPress={() => router.push('/leaderboard' as any)}
                    onComplaintPress={() => setIsComplaintModalOpen(true)}
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
                    registeredDate={user?.createdAt}
                    renewalDate={stats.resetsInText}
                    nextBillingDate={subscription?.next_billing_date || user?.minutesResetAt}
                    billingCycle={subscription?.billing_cycle}
                    cardMasked={subscription?.card_masked}
                    isUpdatingPayment={isUpdatingCard}
                    hasTelcoSubscription={stats.hasTelcoSubscription}
                    isTelcoUnsubscribed={stats.isTelcoUnsubscribed}
                    isSubscriptionLocked={stats.isSubscriptionLocked}
                    isGracePeriodActive={stats.isGracePeriodActive}
                    gracePeriodEndDate={stats.gracePeriodEndDate}
                    onUpgrade={() => router.push('/upgrade')}
                    onGetExtraTime={() => setActivePopup('get-extra-time')}
                    onChangePayment={handleChangePayment}
                    onReactivate={() => setActivePopup('reactivate-plan')}
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
                  avatarUrl={currentAvatarUrl}
                  memberSince={stats.memberSinceText}
                  isPro={isPro}
                  isLocked={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
                  onEdit={handleOpenEditModal}
                  onTogglePlan={() => {}}
                  onCancelSubscription={handleCancelSubscription}
                  onLogout={handleLogout}
                />

                <StatsCard
                  xp={stats.totalXp}
                  levelNumber={stats.currentLevelNumber}
                  rank={stats.rank}
                />

                <AccountActionCards
                  language={stats.nativeLanguageDisplay}
                  onLanguagePress={() => setIsLanguageModalOpen(true)}
                  onLeaderboardPress={() => router.push('/leaderboard' as any)}
                  onComplaintPress={() => setIsComplaintModalOpen(true)}
                />

                <CurrentPlanCard
                  planTier={currentPlanTier}
                  planStatus={stats.planStatus}
                  isPastDue={stats.isPastDue}
                  minutesBalance={minutesBalance}
                  monthlyAllowance={stats.monthlyMinutesAllowance}
                  isTimeExpired={isTimeExpired}
                  phone={phoneNumber}
                  registeredDate={user?.createdAt}
                  renewalDate={stats.resetsInText}
                  nextBillingDate={subscription?.next_billing_date || user?.minutesResetAt}
                  billingCycle={subscription?.billing_cycle}
                  cardMasked={subscription?.card_masked}
                  isUpdatingPayment={isUpdatingCard}
                  hasTelcoSubscription={stats.hasTelcoSubscription}
                  isTelcoUnsubscribed={stats.isTelcoUnsubscribed}
                  isSubscriptionLocked={stats.isSubscriptionLocked}
                  isGracePeriodActive={stats.isGracePeriodActive}
                  gracePeriodEndDate={stats.gracePeriodEndDate}
                  onUpgrade={() => router.push('/upgrade')}
                  onGetExtraTime={() => setActivePopup('get-extra-time')}
                  onChangePayment={handleChangePayment}
                  onReactivate={() => setActivePopup('reactivate-plan')}
                />

                <CustomerSupportCard onEmailPress={handleSupportEmail} />

                <AboutCard />
              </View>
            )}

            <View style={{ height: isDesktop ? 40 : 80 }} />
          </ScrollView>
        </View>

        {/* EDIT PROFILE MODAL (Figma Spec) */}
        <Modal
          visible={isEditProfileModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditProfileModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, !isPhone && styles.modalCardDesktop]}>
              {/* Top Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <Text style={styles.modalSubtitle}>
                    Update your information and personalize your experience with Maya.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsEditProfileModalOpen(false)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Close edit profile"
                >
                  <Feather name="x" size={20} color="#475569" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Avatar Upload Row */}
                <View style={styles.photoUploadRow}>
                  <Pressable
                    onPress={handlePickProfilePhoto}
                    style={styles.editAvatarOuterRing}
                    accessibilityRole="button"
                    accessibilityLabel="Upload profile photo"
                  >
                    {editAvatarUrl ? (
                      <Image
                        source={{ uri: editAvatarUrl }}
                        style={styles.editAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.editAvatarFallback}>
                        <Text style={styles.editAvatarFallbackText}>
                          {(editName || displayName || 'U').trim().charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}

                    {/* Bottom-Right Blue Camera/Photo Badge */}
                    <View style={styles.editAvatarBadgeBtn}>
                      <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  <View style={styles.photoUploadActionCol}>
                    <Pressable
                      onPress={handlePickProfilePhoto}
                      style={({ pressed }) => [
                        styles.changePhotoBtn,
                        pressed && { opacity: 0.75, backgroundColor: '#EFF6FF' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Change Photo"
                    >
                      <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                    </Pressable>
                    <Text style={styles.photoFormatHintText}>JPG, PNG (Max 5MB)</Text>
                  </View>
                </View>

                {/* Full Name */}
                <Text style={styles.modalInputLabel}>Full Name</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                />

                {/* Mobile Number & Email Address Row */}
                <View
                  style={[
                    styles.contactFieldsRow,
                    isPhone && styles.contactFieldsRowMobile,
                  ]}
                >
                  {/* Mobile Number */}
                  <View style={[styles.contactFieldCol, !isPhone && { flex: 1.15 }]}>
                    <Text style={styles.modalInputLabel}>Mobile Number</Text>
                    <View
                      style={[
                        styles.phoneInputComposite,
                        (!isPro || currentPlanTier === 'starter') &&
                          styles.phoneInputCompositeDisabled,
                      ]}
                    >
                      <View style={styles.phoneCountryPrefix}>
                        <LKFlag width={16} height={11} />
                        <Text style={styles.phoneCountryCodeText}>+94</Text>
                        <Feather name="chevron-down" size={12} color="#64748B" />
                      </View>
                      <TextInput
                        style={[
                          styles.phoneDigitsInput,
                          (!isPro || currentPlanTier === 'starter') &&
                            styles.phoneDigitsInputDisabled,
                        ]}
                        value={editPhone}
                        onChangeText={setEditPhone}
                        editable={isPro && currentPlanTier !== 'starter'}
                        placeholder="077 1234567"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                      {(!isPro || currentPlanTier === 'starter') && (
                        <Feather
                          name="lock"
                          size={13}
                          color="#94A3B8"
                          style={{ marginRight: 10 }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Email Address */}
                  <View style={[styles.contactFieldCol, !isPhone && { flex: 1 }]}>
                    <Text style={styles.modalInputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={editEmail}
                      onChangeText={setEditEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.modalSectionDivider} />

                {/* English Level Section */}
                <View style={styles.levelSectionHeaderRow}>
                  <Text style={styles.levelSectionTitle}>English Level</Text>
                  <Ionicons
                    name="information-circle-outline"
                    size={17}
                    color="#0D4EFD"
                    style={{ marginLeft: 5, marginTop: 1 }}
                  />
                </View>
                <Text style={styles.levelSectionSubtitle}>
                  Select your current English speaking level.
                </Text>

                {/* 4 Level Cards Grid */}
                <View
                  style={[
                    styles.levelCardsGrid,
                    isPhone && styles.levelCardsGridMobile,
                  ]}
                >
                  {ENGLISH_LEVEL_OPTIONS.map((lvl) => {
                    const isSelected = editLevel === lvl.id;
                    const barHeights = [12, 18, 24, 30];
                    return (
                      <Pressable
                        key={lvl.id}
                        onPress={() => setEditLevel(lvl.id)}
                        style={({ pressed }) => [
                          styles.levelCardItem,
                          isPhone && styles.levelCardItemMobile,
                          isSelected && styles.levelCardItemSelected,
                          pressed && { opacity: 0.9 },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={lvl.title}
                      >
                        {/* Top-Right Radio Indicator */}
                        <View
                          style={[
                            styles.levelRadioCircle,
                            isSelected && styles.levelRadioCircleSelected,
                          ]}
                        />

                        {/* 4 Signal Bars */}
                        <View style={styles.levelBarsRow}>
                          {barHeights.map((h, barIdx) => {
                            const isBarActive = barIdx < lvl.bars;
                            return (
                              <View
                                key={barIdx}
                                style={[
                                  styles.levelSignalBar,
                                  {
                                    height: h,
                                    backgroundColor: isBarActive ? '#0D4EFD' : '#DCE4F2',
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>

                        <Text style={styles.levelCardTitle}>{lvl.title}</Text>
                        <Text style={styles.levelCardSubtitle}>{lvl.subtitle}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Footer Buttons */}
              <View style={styles.modalFooter}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    pressed && { backgroundColor: '#F8FAFC' },
                  ]}
                  onPress={() => setIsEditProfileModalOpen(false)}
                  disabled={isSaving}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    isSaving && { opacity: 0.7 },
                    pressed && !isSaving && { opacity: 0.92 },
                  ]}
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

        {/* REACTIVATE DAILY SUBSCRIPTION OTP MODAL */}
        <Modal
          visible={isReactivateOtpModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsReactivateOtpModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.otpModalCard}>
              {/* Header Icon */}
              <View style={styles.otpIconCircle}>
                <Feather name="shield" size={28} color="#2563EB" />
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.otpModalTitle}>Verify Daily Subscription</Text>
              <Text style={styles.otpModalSubtitle}>
                Enter the 6-digit verification PIN sent via SMS to your mobile phone ({phoneNumber}) to reactivate your subscription.
              </Text>

              {/* 6 OTP Input Boxes */}
              <View style={styles.otpBoxesRow}>
                {reactivateOtpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => {
                      reactivateInputRefs.current[idx] = el;
                    }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(text) => handleReactivateDigitChange(text, idx)}
                    onKeyPress={(e) => handleReactivateKeyPress(e, idx)}
                    keyboardType="number-pad"
                    maxLength={idx === 0 ? 6 : 1}
                    selectTextOnFocus
                    autoFocus={idx === 0}
                    accessibilityLabel={`OTP digit ${idx + 1}`}
                  />
                ))}
              </View>

              {/* Error Message */}
              {reactivateOtpError ? (
                <Text style={styles.otpErrorText}>{reactivateOtpError}</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.otpModalActions}>
                <Pressable
                  style={[
                    styles.otpVerifyBtn,
                    (reactivateOtpDigits.join('').trim().length < 6 || isVerifyingReactivateOtp) && {
                      opacity: 0.6,
                    },
                  ]}
                  onPress={handleVerifyReactivateOtp}
                  disabled={reactivateOtpDigits.join('').trim().length < 6 || isVerifyingReactivateOtp}
                >
                  {isVerifyingReactivateOtp ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.otpVerifyBtnText}>Verify & Reactivate</Text>
                  )}
                </Pressable>

                {/* Resend Code Action */}
                <Pressable
                  style={styles.otpResendRow}
                  onPress={handleResendReactivateOtp}
                  disabled={isResendingOtp || isVerifyingReactivateOtp}
                >
                  {isResendingOtp ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <Text style={styles.otpResendText}>Didn't receive code?</Text>
                      <Text style={styles.otpResendActionText}>Resend PIN</Text>
                    </>
                  )}
                </Pressable>

                {/* Cancel Button */}
                <Pressable
                  style={styles.otpCancelBtn}
                  onPress={() => setIsReactivateOtpModalOpen(false)}
                  disabled={isVerifyingReactivateOtp}
                >
                  <Text style={styles.otpCancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* EXPLANATION LANGUAGE MODAL */}
        <Modal
          visible={isLanguageModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLanguageModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.selectionModalCard, { maxWidth: 420 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectionModalTitle}>Explanation Language</Text>
                  <Text style={styles.selectionModalSubtitle}>
                    Choose the language Maya uses for explanations.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsLanguageModalOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="x" size={20} color="#64748B" />
                </Pressable>
              </View>

              <View style={{ gap: 10, marginTop: 4 }}>
                {(
                  [
                    { id: 'sinhala', label: 'Sinhala', sub: 'සිංහල පැහැදිලි කිරීම්' },
                    { id: 'tamil', label: 'Tamil', sub: 'தமிழ் விளக்கங்கள்' },
                    { id: 'english', label: 'English Only', sub: 'Full immersion in English' },
                  ] as const
                ).map((item) => {
                  const selected = editLang.toLowerCase() === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleSelectExplanationLanguage(item.id)}
                      style={({ pressed }) => [
                        styles.selectionOptionCard,
                        selected && styles.selectionOptionCardFeatured,
                        pressed && styles.selectionOptionCardPressed,
                      ]}
                    >
                      <View style={[styles.selectionIconBox, { backgroundColor: selected ? '#EFF6FF' : '#F8FAFC' }]}>
                        <Ionicons
                          name="globe-outline"
                          size={22}
                          color={selected ? '#0D4EFD' : '#64748B'}
                        />
                      </View>
                      <View style={styles.selectionContentCol}>
                        <Text style={styles.selectionOptionTitle}>{item.label}</Text>
                        <Text style={styles.selectionOptionDesc}>{item.sub}</Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color="#0D4EFD" />
                      ) : (
                        <Feather name="chevron-right" size={18} color="#94A3B8" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        {/* SUBMIT COMPLAINT MODAL */}
        <Modal
          visible={isComplaintModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsComplaintModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.selectionModalCard, { maxWidth: 460 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectionModalTitle}>Submit Complaint</Text>
                  <Text style={styles.selectionModalSubtitle}>
                    Report an issue or share your feedback with our team.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsComplaintModalOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="x" size={20} color="#64748B" />
                </Pressable>
              </View>

              <TextInput
                style={[
                  styles.modalTextInput,
                  { height: 110, textAlignVertical: 'top', paddingTop: 12, marginTop: 4, marginBottom: 16 },
                ]}
                placeholder="Tell us what went wrong or how we can improve..."
                placeholderTextColor="#94A3B8"
                multiline
                value={complaintText}
                onChangeText={setComplaintText}
              />

              <View style={styles.modalFooter}>
                <Pressable
                  style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.buttonPressed]}
                  onPress={() => setIsComplaintModalOpen(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    pressed && styles.buttonPressed,
                    isSubmittingComplaint && { opacity: 0.7 },
                  ]}
                  onPress={handleSubmitComplaint}
                  disabled={isSubmittingComplaint}
                >
                  {isSubmittingComplaint ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Submit</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* REACTIVATE MAYA SELECTION MODAL */}
        <Modal
          visible={isReactivateSelectionModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsReactivateSelectionModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.selectionModalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectionModalTitle}>Reactivate Maya</Text>
                  <Text style={styles.selectionModalSubtitle}>
                    Choose how you would like to continue practicing
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsReactivateSelectionModalOpen(false)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="x" size={20} color="#64748B" />
                </Pressable>
              </View>

              {/* Selection Options List */}
              <View style={styles.selectionOptionsContainer}>
                {/* Option 1: Daily Subscription */}
                <Pressable
                  style={({ pressed }) => [
                    styles.selectionOptionCard,
                    pressed && styles.selectionOptionCardPressed,
                  ]}
                  onPress={() => {
                    setIsReactivateSelectionModalOpen(false);
                    handleReactivateSubscription();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reactivate Daily Subscription"
                >
                  <View style={[styles.selectionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="phone-portrait-outline" size={24} color="#2563EB" />
                  </View>
                  <View style={styles.selectionContentCol}>
                    <View style={styles.selectionTitleRow}>
                      <Text style={styles.selectionOptionTitle}>Daily Subscription</Text>
                    </View>
                    <Text style={styles.selectionOptionDesc}>
                      Renew your daily subscription directly with your mobile balance.
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#94A3B8" />
                </Pressable>

                {/* Option 2: Upgrade to Pro Plan */}
                <Pressable
                  style={({ pressed }) => [
                    styles.selectionOptionCard,
                    styles.selectionOptionCardFeatured,
                    pressed && styles.selectionOptionCardPressed,
                  ]}
                  onPress={() => {
                    setIsReactivateSelectionModalOpen(false);
                    router.push('/upgrade');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to Pro Plan"
                >
                  <View style={[styles.selectionIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <CrownNavIcon color="#D97706" size={24} />
                  </View>
                  <View style={styles.selectionContentCol}>
                    <View style={styles.selectionTitleRow}>
                      <Text style={styles.selectionOptionTitle}>Upgrade to Pro</Text>
                      <View style={styles.selectionBadge}>
                        <Text style={styles.selectionBadgeText}>Best Value</Text>
                      </View>
                    </View>
                    <Text style={styles.selectionOptionDesc}>
                      Unlock unlimited speaking, all lessons, detailed feedback & monthly minutes.
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#2563EB" />
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                style={styles.selectionCancelBtn}
                onPress={() => setIsReactivateSelectionModalOpen(false)}
              >
                <Text style={styles.selectionCancelBtnText}>Cancel</Text>
              </Pressable>
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
            const currentPop = activePopup;
            setActivePopup(null);
            if (currentPop === 'level-up') {
              router.push('/(tabs)/roadmap');
            } else if (
              currentPop === 'reactivate-plan' ||
              currentPop === 'unlock-premium' ||
              currentPop === 'daily-limit'
            ) {
              router.push('/upgrade');
            }
          }}
          onFooterButtonPress={() => {
            const currentPop = activePopup;
            setActivePopup(null);
            if (currentPop === 'reactivate-plan') {
              handleReactivateSubscription();
              return;
            }
            router.push('/upgrade');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * 1. Profile Information Card (Matches Figma Image 3)
 */
function ProfileCard({
  name,
  initials = 'TF',
  avatarUrl,
  memberSince = 'Member since May 20, 2026',
  isPro,
  isLocked = false,
  onEdit,
  onTogglePlan,
  onCancelSubscription,
  onLogout,
}: {
  name: string;
  initials?: string;
  avatarUrl?: string | null;
  memberSince?: string;
  isPro: boolean;
  isLocked?: boolean;
  onEdit: () => void;
  onTogglePlan?: () => void;
  onCancelSubscription: () => void;
  onLogout: () => void;
}) {
  const displayInitials = (initials || (name || 'U').trim().charAt(0)).toUpperCase();
  return (
    <View style={styles.cardContainer}>
      <View style={styles.profileRow}>
        {/* Left Blue Circular Avatar */}
        <View style={styles.avatarInitialsCircle}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.profileCardAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarInitialsText}>{displayInitials}</Text>
          )}
        </View>

        {/* Right Info Stack: Name + Edit inline + Top-Right Log Out, Member since, Plan Pill + Cancel Subscription */}
        <View style={styles.profileInfoCol}>
          <View style={styles.profileTopHeaderRow}>
            <View style={styles.profileNameInlineRow}>
              <Text style={styles.profileNameText} numberOfLines={1}>
                {name}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.inlineEditBtn, pressed && styles.cardPressed]}
                onPress={onEdit}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
              >
                <Feather name="edit-2" size={14} color="#0D4EFD" />
                <Text style={styles.inlineEditBtnText}>Edit</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onLogout}
              hitSlop={10}
              style={({ pressed }) => [styles.profileTopRightLogoutBtn, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel="Log Out"
            >
              <Text style={styles.profileTopRightLogoutText}>Log Out</Text>
            </Pressable>
          </View>

          <Text style={styles.memberSinceText} numberOfLines={1}>
            {memberSince}
          </Text>

          <View style={styles.profileInlineActionsRow}>
            <Pressable
              onPress={onTogglePlan}
              hitSlop={6}
              style={({ pressed }) => [
                styles.proPlanPill,
                isLocked && styles.inactivePlanPill,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={[styles.proPlanPillText, isLocked && styles.inactivePlanPillText]}>
                {isPro
                  ? isLocked
                    ? 'Pro Plan · Inactive'
                    : 'Pro Plan'
                  : isLocked
                  ? 'Starter Plan · Inactive'
                  : 'Starter Plan'}
              </Text>
            </Pressable>

            <Pressable
              onPress={onCancelSubscription}
              hitSlop={8}
              style={({ pressed }) => [styles.profileActionLinkBtn, pressed && styles.cardPressed]}
            >
              <Text style={[styles.cancelSubText, isLocked && styles.reactivateSubText]}>
                {isLocked ? 'Reactivate Subscription' : 'Cancel Subscription'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * 2. Stats Row Card (3 Columns: XP, Level, Rank based on XP & Minutes Consumed)
 */
function StatsCard({
  xp = 0,
  levelNumber = 1,
  rank = null,
}: {
  xp?: number;
  levelNumber?: number;
  rank?: number | null;
}) {
  return (
    <View style={[styles.cardContainer, styles.statsCardPadding]}>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Feather name="zap" size={24} color="#3B82F6" />
          <Text style={styles.statNumberText}>{xp.toLocaleString()} XP</Text>
          <Text style={styles.statLabelText}>Keep practicing!</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Feather name="bar-chart-2" size={24} color="#3B82F6" />
          <Text style={styles.statNumberText}>Level {levelNumber}</Text>
          <Text style={styles.statLabelText}>You're doing great</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Ionicons name="trophy-outline" size={24} color="#3B82F6" />
          <Text style={styles.statNumberText}>{rank && rank > 0 ? `#${rank}` : 'N/A'}</Text>
          <Text style={styles.statLabelText}>Your Rank</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * 3. Separate Account Action Cards (Explanation Language, Leaderboard, Submit Complaint - Matches Image 3)
 */
function AccountActionCards({
  language = 'Sinhala',
  onLanguagePress,
  onLeaderboardPress,
  onComplaintPress,
}: {
  language?: string;
  onLanguagePress: () => void;
  onLeaderboardPress: () => void;
  onComplaintPress: () => void;
}) {
  return (
    <View style={styles.actionCardsStack}>
      {/* Card 1: Explanation Language */}
      <Pressable
        style={({ pressed }) => [styles.actionItemCard, pressed && styles.cardPressed]}
        onPress={onLanguagePress}
        accessibilityRole="button"
        accessibilityLabel="Explanation Language"
      >
        <View style={[styles.actionIconBox, { backgroundColor: '#E6F9F0' }]}>
          <Ionicons name="globe-outline" size={22} color="#10B981" />
        </View>
        <View style={styles.prefTextCol}>
          <Text style={styles.prefTitleText}>Explanation Language</Text>
          <Text style={styles.prefSubtitleText} numberOfLines={2}>
            Choose the language Maya uses for explanations.
          </Text>
        </View>
        <View style={styles.prefRightCol}>
          <Text style={styles.prefValueText}>{language}</Text>
          <Feather name="chevron-right" size={18} color="#64748B" />
        </View>
      </Pressable>

      {/* Card 2: Leaderboard */}
      <Pressable
        style={({ pressed }) => [styles.actionItemCard, pressed && styles.cardPressed]}
        onPress={onLeaderboardPress}
        accessibilityRole="button"
        accessibilityLabel="Leaderboard"
      >
        <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="trophy-outline" size={21} color="#0D4EFD" />
        </View>
        <View style={styles.prefTextCol}>
          <Text style={styles.prefTitleText}>Leaderboard</Text>
          <Text style={styles.prefSubtitleText} numberOfLines={2}>
            See your rank and compare your progress with others.
          </Text>
        </View>
        <View style={styles.prefRightCol}>
          <Feather name="chevron-right" size={18} color="#64748B" />
        </View>
      </Pressable>

      {/* Card 3: Submit Complaint */}
      <Pressable
        style={({ pressed }) => [styles.actionItemCard, pressed && styles.cardPressed]}
        onPress={onComplaintPress}
        accessibilityRole="button"
        accessibilityLabel="Submit Complaint"
      >
        <View style={[styles.actionIconBox, { backgroundColor: '#FEF2F2' }]}>
          <Feather name="message-square" size={20} color="#EF4444" />
        </View>
        <View style={styles.prefTextCol}>
          <Text style={styles.prefTitleText}>Submit Complaint</Text>
          <Text style={styles.prefSubtitleText} numberOfLines={2}>
            Report an issue or share your feedback.
          </Text>
        </View>
        <View style={styles.prefRightCol}>
          <Feather name="chevron-right" size={18} color="#64748B" />
        </View>
      </Pressable>
    </View>
  );
}

/**
 * 4. Your Current Plan Card
 * Matches Image 1 for Starter Plan (Daily) and Image 2 for Pro Plan (Monthly)
 */
function CurrentPlanCard({
  planTier,
  planStatus,
  isPastDue = false,
  minutesBalance,
  monthlyAllowance,
  isTimeExpired,
  phone,
  registeredDate,
  renewalDate,
  nextBillingDate,
  billingCycle,
  cardMasked,
  isUpdatingPayment = false,
  hasTelcoSubscription = false,
  isTelcoUnsubscribed = false,
  isSubscriptionLocked = false,
  isGracePeriodActive = false,
  gracePeriodEndDate = null,
  onUpgrade,
  onGetExtraTime,
  onChangePayment,
  onReactivate,
}: {
  planTier: string;
  planStatus?: string;
  isPastDue?: boolean;
  minutesBalance: number;
  monthlyAllowance: number;
  isTimeExpired: boolean;
  phone: string;
  registeredDate?: string | null;
  renewalDate: string;
  nextBillingDate?: string | null;
  billingCycle?: string | null;
  cardMasked?: string;
  isUpdatingPayment?: boolean;
  hasTelcoSubscription?: boolean;
  isTelcoUnsubscribed?: boolean;
  isSubscriptionLocked?: boolean;
  isGracePeriodActive?: boolean;
  gracePeriodEndDate?: string | null;
  onUpgrade: () => void;
  onGetExtraTime: () => void;
  onChangePayment: () => void;
  onReactivate?: () => void;
}) {
  const { isPhone } = useBreakpoint();
  const isPro = planTier === 'pro' || planTier === 'premium' || planTier === 'basic';
  const planDisplayName = isPro ? 'Pro Plan' : 'Starter Plan';
  const cycleLabel = isPro
    ? billingCycle === 'quarterly'
      ? '3 Months'
      : billingCycle === 'yearly'
      ? 'Yearly'
      : 'Monthly'
    : 'Daily';

  const registeredDateText = formatBillingDate(registeredDate, '25 Jun 2026');
  const nextBillingDateText = formatBillingDate(nextBillingDate, '25 Jun 2026');
  const localMobileFormatted = formatLocalPhoneDigits(phone) || '077 1234567';

  // Format last 4 digits of card (matches user screenshot: "•••• 4582")
  const digitsOnly = (cardMasked || '').replace(/\D/g, '');
  const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '4582';
  const cardDisplayText = `•••• ${last4}`;

  return (
    <View style={[styles.currentPlanCardContainer, isPhone && styles.currentPlanCardContainerPhone]}>
      {/* Top Header Tag Row */}
      <View style={styles.planHeaderRow}>
        <View style={styles.planHeaderLeft}>
          <Image
            source={PLAN_CROWN_IMAGE}
            style={styles.planCrownImg}
            resizeMode="contain"
          />
          <Text style={styles.planHeaderLeftText} numberOfLines={1}>
            Your Current Plan
          </Text>
        </View>

        {/* Top-Right White Pill Badge */}
        <View
          style={[
            styles.starterBadgePill,
            isSubscriptionLocked
              ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA', flexDirection: 'row', gap: 5 }
              : isGracePeriodActive
              ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
              : isPastDue
              ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
              : null,
          ]}
        >
          {isSubscriptionLocked && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
          )}
          <Text
            style={[
              styles.starterBadgeText,
              isSubscriptionLocked
                ? { color: '#DC2626' }
                : isGracePeriodActive
                ? { color: '#B45309' }
                : isPastDue
                ? { color: '#B45309' }
                : null,
            ]}
          >
            {isSubscriptionLocked
              ? 'Inactive'
              : isGracePeriodActive
              ? `Cancels on ${formatBillingDate(gracePeriodEndDate)}`
              : isPastDue
              ? 'Past Due'
              : planDisplayName}
          </Text>
        </View>
      </View>

      {/* Grace Period Active Banner */}
      {isGracePeriodActive && !isSubscriptionLocked && (
        <View style={[styles.pastDueBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
          <Feather name="clock" size={18} color="#D97706" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.pastDueBannerTitle, { color: '#B45309' }]}>Cancellation Scheduled</Text>
            <Text style={[styles.pastDueBannerSubtitle, { color: '#92400E' }]}>
              Future automatic renewals have been stopped. You can continue speaking with Maya until {formatBillingDate(gracePeriodEndDate)}.
            </Text>
          </View>
        </View>
      )}

      {/* Warning banner if payment deduction failed */}
      {isPastDue && !isSubscriptionLocked && (
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
        {planDisplayName} ({cycleLabel})
      </Text>
      <Text style={styles.planMainSubtitle}>
        {isSubscriptionLocked
          ? 'Your subscription is paused. Upgrade to Pro or reactivate your plan to continue practicing with Maya.'
          : isGracePeriodActive
          ? `Your plan remains active until ${formatBillingDate(gracePeriodEndDate)}.`
          : isPastDue
          ? 'Payment retry in progress. Paid features are frozen until payment settles.'
          : 'Perfect for getting started with Maya.'}
      </Text>

      {/* 3 Information Rows (Matches Image 1 for Starter & Image 2 for Pro) */}
      <View style={styles.planInfoRowsWrap}>
        {/* Row 1: Current Plan */}
        <View style={styles.planInfoCleanRow}>
          <Text style={styles.planInfoCleanLabel}>Current Plan</Text>
          <Text style={styles.planInfoCleanValue}>{planDisplayName}</Text>
        </View>

        {isPro ? (
          <>
            {/* Row 2 (Pro): Next Billing Date */}
            <View style={styles.planInfoCleanRow}>
              <Text style={styles.planInfoCleanLabel}>
                {isGracePeriodActive
                  ? 'Access Expires'
                  : isSubscriptionLocked
                  ? 'Billing Status'
                  : 'Next Billing Date'}
              </Text>
              <Text
                style={[
                  styles.planInfoCleanValue,
                  isSubscriptionLocked && { color: '#DC2626' },
                ]}
              >
                {isGracePeriodActive
                  ? formatBillingDate(gracePeriodEndDate)
                  : isSubscriptionLocked
                  ? 'Cancelled'
                  : nextBillingDateText}
              </Text>
            </View>

            {/* Row 3 (Pro): Payment Method */}
            <View style={styles.planInfoCleanRow}>
              <Text style={styles.planInfoCleanLabel}>Payment Method</Text>
              <View style={styles.planPaymentRightWrap}>
                <View style={styles.paymentCardInfo}>
                  <Ionicons
                    name={hasTelcoSubscription ? 'phone-portrait-outline' : 'card-outline'}
                    size={17}
                    color="#0D4EFD"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.planInfoCleanValue}>
                    {hasTelcoSubscription ? 'Mobile Balance' : cardDisplayText}
                  </Text>
                </View>

                {!hasTelcoSubscription && (
                  <Pressable
                    onPress={onChangePayment}
                    disabled={isUpdatingPayment}
                    hitSlop={8}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Change payment card"
                  >
                    {isUpdatingPayment ? (
                      <ActivityIndicator size="small" color="#0D4EFD" />
                    ) : (
                      <Text style={styles.changePaymentText}>Change</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Row 2 (Starter): Registered Date */}
            <View style={styles.planInfoCleanRow}>
              <Text style={styles.planInfoCleanLabel}>Registered Date</Text>
              <Text style={styles.planInfoCleanValue}>{registeredDateText}</Text>
            </View>

            {/* Row 3 (Starter): Mobile Number */}
            <View style={styles.planInfoCleanRow}>
              <Text style={styles.planInfoCleanLabel}>Mobile Number</Text>
              <Text style={styles.planInfoCleanValue}>{localMobileFormatted}</Text>
            </View>
          </>
        )}
      </View>

      {/* Thin Horizontal Divider Line above button */}
      <View style={styles.planCardDivider} />

      {/* Action Buttons */}
      <View style={styles.planBottomBtnContainer}>
        {isSubscriptionLocked ? (
          <MayaPrimaryButton
            label="Reactivate Maya"
            onPress={onReactivate}
            height={52}
            borderRadius={14}
            showArrow
          />
        ) : (
          <>
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

            {isPro && isTimeExpired && !isPastDue && (
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
                Upgrade to Pro
              </Text>
              <Feather name="chevron-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </Pressable>
          </>
        )}
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

/**
 * 7. Log Out Card
 */
function LogoutCard({ onLogout }: { onLogout: () => void }) {
  return (
    <View style={styles.cardContainer}>
      <Pressable
        style={({ pressed }) => [styles.logoutRow, pressed && styles.cardPressed]}
        onPress={onLogout}
        accessibilityRole="button"
        accessibilityLabel="Log Out"
      >
        <View style={styles.logoutIconCircle}>
          <Feather name="log-out" size={20} color="#DC2626" />
        </View>

        <View style={styles.logoutTextCol}>
          <Text style={styles.logoutTitle}>Log Out</Text>
          <Text style={styles.logoutSubtitle}>
            Sign out of your account on this device.
          </Text>
        </View>

        <Feather name="chevron-right" size={18} color="#DC2626" />
      </Pressable>
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
    marginTop: 12,
    marginBottom: 16,
  },
  headingTitleMobile: {
    fontSize: 24,
    lineHeight: 32,
    color: '#0F172A',
    letterSpacing: -0.4,
    ...fontStyle('outfit', 'bold'),
  },
  headingSubtitleMobile: {
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.03)',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
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

  /* Profile Card (Matches Figma Image 3) */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatarInitialsCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0D4EFD',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  profileCardAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitialsText: {
    fontSize: 22,
    color: '#FFFFFF',
    ...fontStyle('outfit', 'bold'),
  },
  profileInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  profileTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileNameInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  profileTopRightLogoutBtn: {
    paddingVertical: 2,
    paddingLeft: 8,
    flexShrink: 0,
  },
  profileTopRightLogoutText: {
    fontSize: 13,
    color: '#64748B',
    ...fontStyle('inter', 'semiBold'),
  },
  profileNameText: {
    fontSize: 20,
    lineHeight: 26,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  inlineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  inlineEditBtnText: {
    fontSize: 13.5,
    color: '#0D4EFD',
    ...fontStyle('inter', 'bold'),
  },
  memberSinceText: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 3,
    ...fontStyle('inter', 'regular'),
  },
  profileInlineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 18,
  },
  proPlanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6.5,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(13, 78, 253, 0.08)',
      } as any,
    }),
  },
  inactivePlanPill: {
    backgroundColor: '#FEF2F2',
  },
  proPlanPillText: {
    fontSize: 12.5,
    color: '#0D4EFD',
    ...fontStyle('inter', 'bold'),
  },
  inactivePlanPillText: {
    color: '#DC2626',
  },
  profileActionLinkBtn: {
    paddingVertical: 4,
  },
  cancelSubText: {
    fontSize: 12.5,
    color: '#EF4444',
    ...fontStyle('inter', 'medium'),
  },
  reactivateSubText: {
    color: '#0D4EFD',
  },

  /* Stats Card (Matches Figma Image 3) */
  statsCardPadding: {
    paddingVertical: 22,
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
    fontSize: 19,
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 3,
    ...fontStyle('outfit', 'bold'),
  },
  statLabelText: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#E2E8F0',
  },

  /* 3 Separate Action Cards (Explanation Language, Leaderboard, Submit Complaint) */
  actionCardsStack: {
    gap: 14,
  },
  actionItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.03)',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
    }),
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  prefTextCol: {
    flex: 1,
    marginRight: 10,
  },
  prefTitleText: {
    fontSize: 15,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  prefSubtitleText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 3,
    ...fontStyle('inter', 'regular'),
  },
  prefRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefValueText: {
    fontSize: 13,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },

  /* Current Plan Card (Matches Image 1 & Image 2) */
  currentPlanCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 42%)',
        boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.02)',
      } as any,
      default: {
        elevation: 2,
        shadowColor: '#1A3669',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.02,
        shadowRadius: 12,
      },
    }),
  },
  currentPlanCardContainerPhone: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 18,
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
    gap: 8,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexShrink: 1,
    minWidth: 0,
  },
  planHeaderLeftText: {
    fontSize: 14.5,
    color: '#0D4EFD',
    flexShrink: 1,
    ...fontStyle('inter', 'bold'),
  },
  starterBadgePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
      } as any,
    }),
  },
  starterBadgeText: {
    fontSize: 12.5,
    color: '#0D4EFD',
    ...fontStyle('inter', 'bold'),
  },
  planMainTitle: {
    fontSize: 25,
    lineHeight: 32,
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 6,
    ...fontStyle('outfit', 'bold'),
  },
  planMainSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 22,
    ...fontStyle('inter', 'regular'),
  },
  planInfoRowsWrap: {
    paddingLeft: 18,
    paddingRight: 8,
    gap: 15,
  },
  planInfoCleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planInfoCleanLabel: {
    width: 155,
    fontSize: 14,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  planInfoCleanValue: {
    fontSize: 14,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },
  planPaymentRightWrap: {
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
    color: '#0D4EFD',
    ...fontStyle('inter', 'medium'),
  },
  pastDueBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 0,
    marginBottom: 16,
  },
  pastDueBannerTitle: {
    fontSize: 13.5,
    color: '#92400E',
    ...fontStyle('inter', 'bold'),
    marginBottom: 3,
  },
  pastDueBannerSubtitle: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
    ...fontStyle('inter', 'regular'),
  },
  planCardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 22,
    marginBottom: 22,
    width: '100%',
  },
  planBottomBtnContainer: {
    paddingHorizontal: 14,
    gap: 10,
  },
  planUpgradeBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#0D4EFD',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 22px rgba(13, 78, 253, 0.28)',
      } as any,
      default: {
        elevation: 4,
        shadowColor: '#0D4EFD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
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

  /* Edit Profile Modal Styles (Figma Spec — Balanced for Laptops & Mobile) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
      } as any,
      default: {
        elevation: 10,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
      },
    }),
  },
  modalCardDesktop: {
    maxWidth: 580,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: '#0F172A',
    letterSpacing: -0.3,
    ...fontStyle('outfit', 'bold'),
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 3,
    ...fontStyle('inter', 'regular'),
  },
  modalCloseBtn: {
    padding: 4,
    marginTop: -2,
  },
  modalBody: {
    marginBottom: 15,
  },
  photoUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  editAvatarOuterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3.5,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  editAvatarImage: {
    width: 67,
    height: 67,
    borderRadius: 33.5,
  },
  editAvatarFallback: {
    width: 67,
    height: 67,
    borderRadius: 33.5,
    backgroundColor: '#0D4EFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarFallbackText: {
    fontSize: 26,
    color: '#FFFFFF',
    ...fontStyle('outfit', 'bold'),
  },
  editAvatarBadgeBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0D4EFD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadActionCol: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 5,
  },
  changePhotoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0D4EFD',
    backgroundColor: '#FFFFFF',
  },
  changePhotoBtnText: {
    fontSize: 12.5,
    color: '#0D4EFD',
    ...fontStyle('inter', 'semiBold'),
  },
  photoFormatHintText: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  modalInputLabel: {
    fontSize: 12.5,
    color: '#0F172A',
    marginBottom: 6,
    ...fontStyle('inter', 'bold'),
  },
  modalTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 13,
    height: 41,
    fontSize: 13.5,
    color: '#0F172A',
    ...fontStyle('inter', 'regular'),
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
      default: {},
    }),
  },
  contactFieldsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
  },
  contactFieldsRowMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  contactFieldCol: {
    flex: 1,
  },
  phoneInputComposite: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 41,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  phoneInputCompositeDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.78,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
      default: {},
    }),
  },
  phoneCountryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  phoneCountryCodeText: {
    fontSize: 13,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },
  phoneDigitsInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 11,
    fontSize: 13.5,
    color: '#0F172A',
    ...fontStyle('inter', 'regular'),
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
      default: {},
    }),
  },
  phoneDigitsInputDisabled: {
    color: '#64748B',
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
      default: {},
    }),
  },
  modalSectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  levelSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelSectionTitle: {
    fontSize: 14.5,
    color: '#0F172A',
    ...fontStyle('outfit', 'semiBold'),
  },
  levelSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 11,
    ...fontStyle('inter', 'regular'),
  },
  levelCardsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  levelCardsGridMobile: {
    flexWrap: 'wrap',
  },
  levelCardItem: {
    flex: 1,
    minWidth: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingTop: 12,
    paddingBottom: 11,
    alignItems: 'center',
    position: 'relative',
  },
  levelCardItemMobile: {
    minWidth: '47%',
    flexBasis: '47%',
  },
  levelCardItemSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#F5F9FF',
  },
  levelRadioCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  levelRadioCircleSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#0D4EFD',
  },
  levelBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4.5,
    height: 35,
    marginTop: 5,
    marginBottom: 9,
  },
  levelSignalBar: {
    width: 7,
    borderRadius: 3.5,
  },
  levelCardTitle: {
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 3,
    ...fontStyle('inter', 'bold'),
  },
  levelCardSubtitle: {
    fontSize: 10.5,
    lineHeight: 13.5,
    color: '#64748B',
    textAlign: 'center',
    ...fontStyle('inter', 'regular'),
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    color: '#475569',
    ...fontStyle('inter', 'semiBold'),
  },
  modalSaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0D4EFD',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 16px rgba(13, 78, 253, 0.25)',
      } as any,
      default: {
        elevation: 3,
        shadowColor: '#0D4EFD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  modalSaveBtnText: {
    fontSize: 13.5,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },

  /* Profile Header Actions (Edit & Logout) */
  profileHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  logoutHeaderText: {
    fontSize: 12,
    color: '#DC2626',
    ...fontStyle('inter', 'semiBold'),
  },

  /* Log Out Card */
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoutTextCol: {
    flex: 1,
    marginRight: 10,
  },
  logoutTitle: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 2,
    ...fontStyle('inter', 'bold'),
  },
  logoutSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 1,
    ...fontStyle('inter', 'regular'),
  },

  /* Reactivate OTP Modal Styles */
  otpModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      } as any,
      default: {
        elevation: 10,
      },
    }),
  },
  otpIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  otpModalTitle: {
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    ...fontStyle('outfit', 'bold'),
  },
  otpModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    ...fontStyle('inter', 'regular'),
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
    width: '100%',
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 22,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  otpBoxFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  otpErrorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 14,
    ...fontStyle('inter', 'medium'),
  },
  otpModalActions: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  otpVerifyBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  otpVerifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    ...fontStyle('outfit', 'bold'),
  },
  otpResendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  otpResendText: {
    fontSize: 13,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  otpResendActionText: {
    fontSize: 13,
    color: '#2563EB',
    marginLeft: 4,
    ...fontStyle('inter', 'semiBold'),
  },
  otpCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCancelBtnText: {
    fontSize: 14,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },

  /* Selection Modal Styles */
  selectionModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      } as any,
      default: {
        elevation: 10,
      },
    }),
  },
  selectionModalTitle: {
    fontSize: 20,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  selectionModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    ...fontStyle('inter', 'regular'),
  },
  selectionOptionsContainer: {
    gap: 12,
    marginVertical: 18,
  },
  selectionOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  selectionOptionCardFeatured: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  selectionOptionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  selectionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionContentCol: {
    flex: 1,
  },
  selectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  selectionOptionTitle: {
    fontSize: 15.5,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  selectionOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  selectionBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selectionBadgeText: {
    fontSize: 10.5,
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  selectionCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCancelBtnText: {
    fontSize: 14,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
});
