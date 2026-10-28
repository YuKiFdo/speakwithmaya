import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { MayaPrimaryButton } from '@/components/ui';
import {
  playOtherButtonSound,
  playAnalysisCompleteSound,
} from '@/services/sound/sound-service';
import { authService } from '@/services/auth/auth-service';
import { OnboardingStore, useOnboardingStore } from '@/services/store/onboarding-store';
import { paymentApi } from '@/services/payment/payment-api';
import { payHereGateway } from '@/services/payment/payhere-gateway';
import { mayaAlert } from '@/components/ui/alert-modal';
import {
  resolvePlanAnalyticsDetails,
  getPendingCheckoutContext,
  trackOnboardingComplete,
  trackViewPlanSelection,
  trackViewAllPlans,
  trackSelectPlan,
  trackBeginCheckout,
  trackContinueStarter,
  trackVerifiedPurchase,
  trackPaymentFailed,
  trackPaymentCancelled,
} from '@/utils/analytics';

const CLOCK_IMAGE = require('@/assets/images/offer-expired-clock.png');

const PAYHERE_LOGOS = [
  { id: 'visa', source: require('@/assets/images/payhere/visa.png'), type: 'circle' as const },
  { id: 'mastercard', source: require('@/assets/images/payhere/mastercard.png'), type: 'circle' as const },
  { id: 'amex', source: require('@/assets/images/payhere/amex.png'), type: 'circle' as const },
  { id: 'gpay', source: require('@/assets/images/payhere/gpay.png'), type: 'pill' as const },
  { id: 'helakuru-pay', source: require('@/assets/images/payhere/helakuru-pay.png'), type: 'pill' as const },
  { id: 'genie', source: require('@/assets/images/payhere/genie.png'), type: 'circle' as const },
  { id: 'frimi', source: require('@/assets/images/payhere/frimi.png'), type: 'circle' as const },
  { id: 'ipay', source: require('@/assets/images/payhere/ipay.png'), type: 'circle' as const },
  { id: 'qplus', source: require('@/assets/images/payhere/qplus.png'), type: 'circle' as const },
];

// Offer reservation duration: 10 minutes
const TEST_DURATION_SECONDS = 10 * 60;
const EXTRA_MINUTES_SECONDS = 10 * 60; // 10 minutes

interface PlanItem {
  id: string;
  name: string;
  minutes: string;
  minutesSubtext: string;
  pricePerMonth: string;
  billedInfo: string;
  saveBadge?: string;
  isFeatured?: boolean;
}

const ALL_PLANS: PlanItem[] = [
  {
    id: '3-months-pro',
    name: '3 Months Pro',
    minutes: '1,800 AI conversation minutes',
    minutesSubtext: 'every 3 months',
    pricePerMonth: 'LKR 2,880',
    billedInfo: 'Billed as LKR 8,640 every 3 months',
    saveBadge: 'Save 20%',
    isFeatured: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    minutes: '450 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 3,600',
    billedInfo: 'Billed as LKR 3,600 monthly',
  },
  {
    id: 'pro',
    name: 'Pro',
    minutes: '600 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 5,400',
    billedInfo: 'Billed as LKR 5,400 monthly',
  },
  {
    id: 'premium',
    name: 'Premium',
    minutes: '1,200 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 7,200',
    billedInfo: 'Billed as LKR 7,200 monthly',
  },
];

const PRO_FEATURES = [
  // '600 AI conversation minutes',
  'Detailed speaking analytics',
  'Advanced pronunciation feedback',
  'Personalized learning insights',
  'Rephrasing suggestions',
  'Priority AI responses',
  'Conversation history',
  'Early access to new features',
];

interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 'sanduni',
    quote: '"SpeakwithMaya has really helped me improve my confidence. The extra practice time in Pro is worth it!"',
    author: '- Sanduni, Sri Lanka',
  },
  {
    id: 'kasun',
    quote: '"I know English grammar, but speaking was difficult for me. Practicing with Maya helps me speak more naturally."',
    author: '- Kasun, Sri Lanka',
  },
  {
    id: 'amaya',
    quote: '"I love that I can practice speaking anytime. The corrections help me understand my mistakes and improve."',
    author: '- Amaya, Sri Lanka',
  },
  {
    id: 'dilshan',
    quote: '"The roleplay sessions are really useful. I can practice real-life situations like job interviews and everyday conversations."',
    author: '- Dilshan, Sri Lanka',
  },
  {
    id: 'nethmi',
    quote: '"Maya gives me a comfortable place to practice English. I am slowly overcoming my fear of making mistakes."',
    author: '- Nethmi, Sri Lanka',
  },
];

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'what-is-maya',
    question: 'What is SpeakwithMaya?',
    answer:
      'SpeakwithMaya is an AI-powered English-speaking coach that helps you improve your speaking skills through real-time conversations, roleplays, and personalized feedback.',
  },
  {
    id: 'who-is-it-for',
    question: 'Who is SpeakwithMaya for?',
    answer:
      'SpeakwithMaya is for anyone who wants to improve their spoken English, build confidence, and speak more naturally, even if they already know English grammar but struggle to speak.',
  },
  {
    id: 'plan-differences',
    question: 'What is the difference between Basic, Pro, and Premium?',
    answer:
      'Basic is ideal for getting started. Pro offers more practice time and additional speaking feedback. Premium provides the most practice time and advanced learning features.',
  },
  {
    id: 'practice-minutes',
    question: 'How many minutes can I practice?',
    answer:
      'Your available AI conversation minutes depend on your selected plan. Check the pricing table to see the included minutes and session durations for each plan.',
  },
  {
    id: 'daily-limit-handling',
    question: 'What happens when I use all my daily practice time?',
    answer:
      "Once you use your included daily practice time, you may be able to continue practicing using your remaining monthly AI minutes, depending on your plan's limits.",
  },
  {
    id: 'correct-mistakes',
    question: 'Can Maya correct my English mistakes?',
    answer:
      'Yes! Maya can help you identify grammar mistakes, improve pronunciation, and find more natural ways to express yourself. Available feedback features depend on your plan.',
  },
  {
    id: 'cancel-subscription',
    question: 'Can I cancel my subscription?',
    answer:
      'You can manage or cancel your subscription through the subscription or billing options available for your account.',
  },
  {
    id: 'subscription-expires',
    question: 'What happens when my subscription expires?',
    answer:
      'When your subscription expires, you may lose access to paid-plan features. You can renew your subscription or choose another available plan to continue enjoying premium features.',
  },
];

export default function PersonalizedPlanScreen() {
  const params = useLocalSearchParams<{ name?: string; payment?: string; order_id?: string }>();
  const { isPhone } = useBreakpoint();
  const onboardingState = useOnboardingStore();

  const userName = useMemo(() => {
    const raw = (onboardingState.name || onboardingState.user?.displayName || params.name || '').trim();
    return raw || 'Learner';
  }, [onboardingState.name, onboardingState.user?.displayName, params.name]);

  // Handle PayHere Preapproval redirect return
  useEffect(() => {
    let paymentStatus = params.payment;
    let orderId = params.order_id;

    // Web fallback
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
      const q = new URLSearchParams(window.location.search);
      if (!paymentStatus) paymentStatus = q.get('payment') || undefined;
      if (!orderId) orderId = q.get('order_id') || undefined;
    }

    if (!paymentStatus) {
      trackOnboardingComplete(onboardingState.user?.id);
      trackViewPlanSelection();
      return;
    }

    // Immediately clean URL query on web to prevent duplicate processing on browser refresh
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleReturn = async () => {
      const pendingCtx = getPendingCheckoutContext();
      const effectiveOrderId = orderId || pendingCtx?.transaction_id;

      if (paymentStatus === 'success') {
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
          await authService.fetchUserProfile();
          router.replace({
            pathname: '/onboarding/complete' as any,
            params: { plan: '3-months-pro' },
          });
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
            verifyRes.message || 'Your payment could not be completed. Please try again.',
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
        mayaAlert.alert('Subscription checkout was cancelled.', 'Cancelled', 'info');
      }
    };

    handleReturn();
  }, [params.payment, params.order_id]);

  // Ensure browser URL bar displays clean route with zero query leakage on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search && !window.location.search.includes('payment=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(TEST_DURATION_SECONDS);
  const [isTimerExpired, setIsTimerExpired] = useState<boolean>(false);
  const [showExpiredModal, setShowExpiredModal] = useState<boolean>(false);

  // Plans expansion state
  const [showAllPlans, setShowAllPlans] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('3-months-pro');
  const chevronBounceAnim = useRef(new Animated.Value(0)).current;

  // Subtle vertical nudge animation on "See more Plans" chevron when collapsed
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'maya-smooth-chevron-keyframes';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        @keyframes mayaChevronFloat {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, 1.8px, 0); }
        }
      `;
      return;
    }

    if (showAllPlans) {
      chevronBounceAnim.stopAnimation();
      chevronBounceAnim.setValue(0);
      return;
    }

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronBounceAnim, {
          toValue: 1.8,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chevronBounceAnim, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    bounceLoop.start();
    return () => bounceLoop.stop();
  }, [showAllPlans, chevronBounceAnim]);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // Testimonial horizontal auto-rotation state
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState<number>(0);
  const testimonialFadeAnim = useRef(new Animated.Value(1)).current;
  const testimonialSlideAnim = useRef(new Animated.Value(0)).current;

  // Auto-rotate testimonials horizontally every 4.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(testimonialFadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(testimonialSlideAnim, {
          toValue: -15,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setActiveTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);
        testimonialSlideAnim.setValue(15);
        Animated.parallel([
          Animated.timing(testimonialFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(testimonialSlideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [testimonialFadeAnim, testimonialSlideAnim]);

  // Modal scale animation
  const modalScaleAnim = useRef(new Animated.Value(0.85)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) {
      if (!isTimerExpired) {
        setIsTimerExpired(true);
        setShowExpiredModal(true);
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerExpired(true);
          setShowExpiredModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isTimerExpired]);

  // Modal animation trigger
  useEffect(() => {
    if (showExpiredModal) {
      Animated.parallel([
        Animated.spring(modalScaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      modalScaleAnim.setValue(0.85);
      modalOpacityAnim.setValue(0);
    }
  }, [showExpiredModal, modalScaleAnim, modalOpacityAnim]);

  // Format timer into MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const handleGiveExtraTime = () => {
    try {
      playOtherButtonSound();
    } catch {}
    setShowExpiredModal(false);
    setIsTimerExpired(false);
    // Add extra 10 minutes (or reset)
    setTimeLeft(EXTRA_MINUTES_SECONDS);
  };

  // Upgrade loading state
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false);

  // Automatically sync this step with the database so opening on another phone loads here
  useEffect(() => {
    authService.syncStep('/onboarding/personalized-plan');
  }, []);

  const handleUpgrade = async () => {
    try {
      playAnalysisCompleteSound();
    } catch {}

    const planAnalytics = resolvePlanAnalyticsDetails({
      planId: selectedPlanId,
      planName: selectedPlan?.name,
      billedInfo: selectedPlan?.billedInfo,
      priceText: selectedPlan?.pricePerMonth,
    });

    setIsUpgrading(true);
    try {
      // 1. Save onboarding preferences first
      const state = OnboardingStore.getState();
      await authService.savePreferences({
        displayName: state.name,
        nativeLanguage: state.nativeLanguage,
        level: state.level,
        goal: state.goal,
        challenge: state.challenge,
        employmentStatus: state.employment,
        dailyGoalMinutes: state.dailyGoalMinutes,
        baselineScores: state.baselineScores || undefined,
      });

      // 2. Check if user already has a pre-approved token on file for 1-click activation
      const sub = await paymentApi.getMySubscription();
      if (sub?.can_auto_charge && sub?.customer_token) {
        const cardDisplay = sub.card_masked ? `card ending in ${sub.card_masked.slice(-4)}` : 'your saved card';
        const chargeText =
          selectedPlanId === '3-months-pro'
            ? 'LKR 8,640 (every 3 months)'
            : `${selectedPlan?.pricePerMonth || 'LKR 5,400'}/month`;
        const confirmed = await mayaAlert.confirm({
          title: '1-Click Activation',
          message: `Deduct ${chargeText} from ${cardDisplay} and activate ${selectedPlan?.name} immediately?`,
          confirmText: 'Confirm & Activate',
          cancelText: 'Cancel',
          type: 'info',
        });

        if (confirmed) {
          trackBeginCheckout(planAnalytics);
          try {
            const chargeRes = await paymentApi.chargeSavedCard({ planTier: selectedPlanId as any });
            if (
              chargeRes.verified &&
              chargeRes.transaction &&
              chargeRes.firstVerifiedForAnalytics !== false
            ) {
              trackVerifiedPurchase({
                transaction_id: chargeRes.transaction.transactionId,
                event_id: chargeRes.transaction.eventId,
                plan_name: chargeRes.transaction.planName,
                billing_period: chargeRes.transaction.billingPeriod,
                value: chargeRes.transaction.value,
                currency: 'LKR',
              });
            }
            await authService.fetchUserProfile();
            router.replace({
              pathname: '/onboarding/complete' as any,
              params: { plan: selectedPlanId },
            });
            return;
          } catch (chargeErr: any) {
            trackPaymentFailed(planAnalytics);
            throw chargeErr;
          }
        } else {
          return;
        }
      }

      // 3. Fallback to standard PayHere Payment Gateway checkout if no card saved yet
      const checkoutParams = await paymentApi.getCheckoutParams(selectedPlanId as any);
      const checkoutAnalytics = resolvePlanAnalyticsDetails({
        planId: selectedPlanId,
        planName: selectedPlan?.name,
        amount: checkoutParams.amount,
        billedInfo: selectedPlan?.billedInfo,
        priceText: selectedPlan?.pricePerMonth,
      });

      trackBeginCheckout({
        ...checkoutAnalytics,
        transaction_id: checkoutParams.order_id,
      });

      // 4. Launch PayHere Gateway (JS SDK popup modal on Web, Native SDK on mobile)
      const result = await payHereGateway.startPayment(checkoutParams);

      if (result.status === 'completed') {
        const txOrderId = result.orderId || checkoutParams.order_id;
        const verifyRes = await paymentApi.verifyOrderWithRetry(txOrderId);
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
          await authService.fetchUserProfile();
          router.replace({
            pathname: '/onboarding/complete' as any,
            params: { plan: selectedPlanId },
          });
        } else {
          trackPaymentFailed({
            ...checkoutAnalytics,
            transaction_id: txOrderId,
          });
          await mayaAlert.error(
            verifyRes.message || 'Payment could not be verified. Please try again.',
            'Payment Error'
          );
        }
      } else if (result.status === 'dismissed') {
        trackPaymentCancelled({
          ...checkoutAnalytics,
          transaction_id: checkoutParams.order_id,
        });
      } else if (result.status === 'error') {
        trackPaymentFailed({
          ...checkoutAnalytics,
          transaction_id: checkoutParams.order_id,
        });
        const errorMsg = result.error || 'Payment could not be completed. Please try again.';
        await mayaAlert.error(errorMsg, 'Payment Error');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to initialize payment gateway.';
      await mayaAlert.error(errMsg, 'Checkout Error');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleContinueSecondary = async () => {
    try {
      playOtherButtonSound();
    } catch {}

    trackOnboardingComplete(OnboardingStore.getState().user?.id);
    trackContinueStarter();

    const state = OnboardingStore.getState();
    await authService.savePreferences({
      displayName: state.name,
      nativeLanguage: state.nativeLanguage,
      level: state.level,
      goal: state.goal,
      challenge: state.challenge,
      employmentStatus: state.employment,
      dailyGoalMinutes: state.dailyGoalMinutes,
      baselineScores: state.baselineScores || undefined,
    });

    OnboardingStore.setOnboardingCompleted();
    authService.syncStep('/(tabs)/dashboard');
    router.replace('/(tabs)/dashboard');
  };

  const toggleFaq = (faqId: string) => {
    try {
      playOtherButtonSound();
    } catch {}
    setOpenFaq((prev) => (prev === faqId ? null : faqId));
  };

  const selectedPlan = useMemo(() => {
    return ALL_PLANS.find((p) => p.id === selectedPlanId) || ALL_PLANS[0];
  }, [selectedPlanId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isPhone && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Top Reservation Banner with Countdown */}
          <View style={styles.topReservationBar}>
            <View style={styles.topBarLeft}>
              <Ionicons name="lock-closed" size={15} color="#0D4EFD" style={styles.lockIcon} />
              <Text style={styles.topBarText}>Offer reserved for you</Text>
            </View>
            <View style={[styles.timerBadge, isTimerExpired && styles.timerBadgeExpired]}>
              <Text style={styles.timerText}>{formattedTime}</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>
            Hi {userName}! Your{' '}
            <Text style={styles.titleHighlight}>Personalized Plan</Text> is Ready
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Unlock everything Maya has to offer and start speaking English with confidence.
          </Text>

          {/* Plan Cards Section */}
          <View style={styles.plansContainer}>
            {showAllPlans ? (
              // Expanded: Show all plans
              ALL_PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => {
                      setSelectedPlanId(plan.id);
                      trackSelectPlan(
                        resolvePlanAnalyticsDetails({
                          planId: plan.id,
                          planName: plan.name,
                          billedInfo: plan.billedInfo,
                          priceText: plan.pricePerMonth,
                        })
                      );
                    }}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                    ]}
                  >
                    {plan.saveBadge && (
                      <View style={styles.saveBadgePill}>
                        <FontAwesome5 name="crown" size={10} color="#FFFFFF" style={styles.crownIcon} />
                        <Text style={styles.saveBadgeText}>{plan.saveBadge}</Text>
                      </View>
                    )}

                    <View style={styles.planCardLeft}>
                      <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                        {plan.name}
                      </Text>
                      <View style={styles.minutesRow}>
                        <View style={styles.clockIconCircle}>
                          <Ionicons name="time-outline" size={12} color="#0D4EFD" />
                        </View>
                        <View>
                          <Text style={styles.minutesTitle}>{plan.minutes}</Text>
                          <Text style={styles.minutesSub}>{plan.minutesSubtext}</Text>
                        </View>
                      </View>
                      <Text style={styles.billedInfo}>{plan.billedInfo}</Text>
                    </View>

                    <View style={styles.planCardRight}>
                      <Text style={[styles.priceNumber, isSelected && styles.priceNumberSelected]}>
                        {plan.pricePerMonth}
                      </Text>
                      <Text style={styles.pricePeriod}>/ month</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              // Collapsed: Show only featured 3 Months Pro card
              <Pressable
                onPress={() => {
                  setSelectedPlanId(selectedPlan.id);
                  trackSelectPlan(
                    resolvePlanAnalyticsDetails({
                      planId: selectedPlan.id,
                      planName: selectedPlan.name,
                      billedInfo: selectedPlan.billedInfo,
                      priceText: selectedPlan.pricePerMonth,
                    })
                  );
                }}
                style={[styles.planCard, styles.planCardSelected]}
              >
                {selectedPlan.saveBadge && (
                  <View style={styles.saveBadgePill}>
                    <FontAwesome5 name="crown" size={10} color="#FFFFFF" style={styles.crownIcon} />
                    <Text style={styles.saveBadgeText}>{selectedPlan.saveBadge}</Text>
                  </View>
                )}

                <View style={styles.planCardLeft}>
                  <Text style={[styles.planName, styles.planNameSelected]}>
                    {selectedPlan.name}
                  </Text>
                  <View style={styles.minutesRow}>
                    <View style={styles.clockIconCircle}>
                      <Ionicons name="time-outline" size={12} color="#0D4EFD" />
                    </View>
                    <View>
                      <Text style={styles.minutesTitle}>{selectedPlan.minutes}</Text>
                      <Text style={styles.minutesSub}>{selectedPlan.minutesSubtext}</Text>
                    </View>
                  </View>
                  <Text style={styles.billedInfo}>{selectedPlan.billedInfo}</Text>
                </View>

                <View style={styles.planCardRight}>
                  <Text style={[styles.priceNumber, styles.priceNumberSelected]}>
                    {selectedPlan.pricePerMonth}
                  </Text>
                  <Text style={styles.pricePeriod}>/ month</Text>
                </View>
              </Pressable>
            )}

            {/* Toggle See More Plans / Collapse */}
            <Pressable
              onPress={() => {
                try {
                  playOtherButtonSound();
                } catch {}
                setShowAllPlans((prev) => {
                  const next = !prev;
                  if (next) {
                    trackViewAllPlans();
                  }
                  return next;
                });
              }}
              style={({ pressed }) => [
                styles.togglePlansButton,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.togglePlansText}>
                {showAllPlans ? 'Collapse' : 'See more Plans'}
              </Text>
              <Animated.View
                style={
                  Platform.OS === 'web'
                    ? ({
                        display: 'inline-flex',
                        willChange: 'transform',
                        animation: showAllPlans
                          ? 'none'
                          : 'mayaChevronFloat 1.6s ease-in-out infinite',
                      } as any)
                    : {
                        transform: [{ translateY: chevronBounceAnim }],
                      }
                }
              >
                <Ionicons
                  name={showAllPlans ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color="#0D4EFD"
                />
              </Animated.View>
            </Pressable>
          </View>

          {/* Primary Action Button */}
          <View style={styles.primaryButtonWrapper}>
            <MayaPrimaryButton
              label={
                selectedPlanId === '3-months-pro' || selectedPlanId === 'pro'
                  ? 'Upgrade to Pro'
                  : `Upgrade to ${selectedPlan.name}`
              }
              onPress={handleUpgrade}
              loading={isUpgrading}
              showArrow={!isUpgrading}
              height={54}
              borderRadius={27}
            />
          </View>

          {/* Secondary Action Button */}
          <Pressable
            onPress={handleContinueSecondary}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isTimerExpired ? 'Continue Free' : 'Continue Starter'}
            </Text>
          </Pressable>

          {/* Payment Trust & Gateways */}
          <View style={styles.securityRow}>
            <Feather name="lock" size={12} color="#64748B" style={styles.lockSmallIcon} />
            <Text style={styles.securityText}>Secure payment powered by PayHere · Cancel anytime</Text>
          </View>

          {/* Payment Methods Badges Row (Actual PayHere Supported Logos) */}
          <View style={styles.paymentMethodsRow}>
            {PAYHERE_LOGOS.map((logo) => (
              <View
                key={logo.id}
                style={
                  logo.type === 'pill'
                    ? styles.paymentLogoPillWrap
                    : styles.paymentLogoCircleWrap
                }
              >
                <Image
                  source={logo.source}
                  style={
                    logo.type === 'pill'
                      ? styles.paymentLogoPillImg
                      : styles.paymentLogoCircleImg
                  }
                  resizeMode="contain"
                  accessibilityLabel={logo.id}
                />
              </View>
            ))}
          </View>

          {/* Everything in Pro Section */}
          <View style={styles.proFeaturesCard}>
            <Text style={styles.proFeaturesTitle}>Everything in Pro</Text>
            <View style={styles.featureList}>
              {PRO_FEATURES.map((feature, idx) => (
                <View key={idx} style={styles.featureItemRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#0D4EFD"
                    style={styles.checkIcon}
                  />
                  <Text style={styles.featureItemText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Automatic Horizontal Testimonial Carousel */}
          <View style={styles.testimonialsSection}>
            <Animated.View
              style={[
                styles.testimonialCard,
                {
                  opacity: testimonialFadeAnim,
                  transform: [{ translateX: testimonialSlideAnim }],
                },
              ]}
            >
              <View style={styles.testimonialQuoteRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#93C5FD" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={styles.testimonialQuote}>
                    {TESTIMONIALS[activeTestimonialIdx].quote}
                  </Text>
                  <View style={styles.testimonialMetaCol}>
                    <Text style={styles.testimonialAuthor}>
                      {TESTIMONIALS[activeTestimonialIdx].author}
                    </Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name="star" size={14} color="#FBBF24" style={{ marginRight: 2 }} />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Horizontal indicators / dots */}
            <View style={styles.testimonialDotsRow}>
              {TESTIMONIALS.map((_, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setActiveTestimonialIdx(idx)}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.testimonialDot,
                      idx === activeTestimonialIdx && styles.testimonialDotActive,
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Frequently Asked Questions Section */}
          <View style={styles.faqSection}>
            <View style={styles.faqHeaderRow}>
              <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
              <Pressable onPress={() => setOpenFaq(openFaq ? null : FAQS[0].id)}>
                <Text style={styles.faqViewAllLink}>View all</Text>
              </Pressable>
            </View>

            <View style={styles.faqListContainer}>
              {FAQS.map((faq) => {
                const isOpen = openFaq === faq.id;
                return (
                  <Pressable
                    key={faq.id}
                    onPress={() => toggleFaq(faq.id)}
                    style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                  >
                    <View style={styles.faqQuestionRow}>
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#64748B"
                      />
                    </View>
                    {isOpen && (
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Offer Time is Over Modal */}
      <Modal
        visible={showExpiredModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowExpiredModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalOpacityAnim,
                transform: [{ scale: modalScaleAnim }],
              },
            ]}
          >
            {/* Alarm Clock Illustration with Exclamation Badge */}
            <View style={styles.clockGraphicWrapper}>
              <Image
                source={CLOCK_IMAGE}
                style={styles.clockImage}
                resizeMode="contain"
              />
            </View>

            {/* Modal Title */}
            <Text style={styles.modalTitle}>Offer time is over!</Text>

            {/* Modal Body */}
            <Text style={styles.modalBody}>
              Your personalized offer has expired. Would you like to get an{' '}
              <Text style={styles.modalBodyBold}>extra 10 minutes</Text>
              {' '}to upgrade and unlock everything Maya has to offer?
            </Text>

            {/* Give me extra 10 minutes button */}
            <View style={styles.modalButtonWrapper}>
              <MayaPrimaryButton
                label="Give me extra 10 minutes"
                onPress={handleGiveExtraTime}
                showArrow={false}
                icon={<Ionicons name="time" size={20} color="#FFFFFF" />}
                iconPosition="left"
                height={50}
                borderRadius={25}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    alignItems: 'center',
  },
  scrollContentDesktop: {
    paddingVertical: 48,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  topReservationBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockIcon: {
    marginRight: 2,
  },
  topBarText: {
    fontSize: 13,
    color: '#0D4EFD',
    ...fontStyle('inter', 'bold'),
  },
  timerBadge: {
    backgroundColor: '#0D4EFD',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  timerBadgeExpired: {
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    ...fontStyle('inter', 'extraBold'),
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    color: '#0F172A',
    letterSpacing: -0.6,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 10,
    ...fontStyle('outfit', 'extraBold'),
  },
  titleHighlight: {
    color: '#0D4EFD',
    ...fontStyle('outfit', 'extraBold'),
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 24,
    ...fontStyle('inter', 'regular'),
  },
  plansContainer: {
    width: '100%',
    marginBottom: 20,
  },
  planCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#EFF6FF',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(13, 78, 253, 0.14)',
      } as any,
      default: {
        elevation: 3,
        shadowColor: '#0D4EFD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
    }),
  },
  saveBadgePill: {
    position: 'absolute',
    top: -11,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D4EFD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 2,
  },
  crownIcon: {
    marginRight: 2,
  },
  saveBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    ...fontStyle('inter', 'bold'),
  },
  planCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  planName: {
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 8,
    ...fontStyle('outfit', 'bold'),
  },
  planNameSelected: {
    color: '#0D4EFD',
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  clockIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutesTitle: {
    fontSize: 12,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },
  minutesSub: {
    fontSize: 10.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  billedInfo: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  planCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceNumber: {
    fontSize: 17,
    color: '#0F172A',
    letterSpacing: -0.4,
    ...fontStyle('outfit', 'bold'),
  },
  priceNumberSelected: {
    color: '#0D4EFD',
    ...fontStyle('outfit', 'extraBold'),
  },
  pricePeriod: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    ...fontStyle('inter', 'medium'),
  },
  togglePlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 8,
    gap: 5,
  },
  togglePlansText: {
    fontSize: 13.5,
    color: '#0D4EFD',
    ...fontStyle('inter', 'semiBold'),
  },
  primaryButtonWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  secondaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#475569',
    ...fontStyle('inter', 'bold'),
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  lockSmallIcon: {
    marginTop: -1,
  },
  securityText: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  paymentLogoCircleWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
    }),
  },
  paymentLogoCircleImg: {
    width: 34,
    height: 34,
  },
  paymentLogoPillWrap: {
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
      } as any,
      default: {
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
    }),
  },
  paymentLogoPillImg: {
    width: 48,
    height: 24,
  },
  proFeaturesCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    padding: 22,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
    }),
  },
  proFeaturesTitle: {
    fontSize: 17.5,
    color: '#0F172A',
    marginBottom: 16,
    ...fontStyle('outfit', 'bold'),
  },
  featureList: {
    gap: 13,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    marginTop: 1,
  },
  featureItemText: {
    fontSize: 13.5,
    color: '#334155',
    flex: 1,
    ...fontStyle('inter', 'medium'),
  },
  testimonialsSection: {
    width: '100%',
    marginBottom: 28,
  },
  testimonialCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
      } as any,
    }),
  },
  testimonialQuoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  testimonialQuote: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    marginBottom: 6,
    fontStyle: 'italic',
    ...fontStyle('inter', 'medium'),
  },
  testimonialMetaCol: {
    marginTop: 2,
  },
  testimonialAuthor: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  testimonialDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  testimonialDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  testimonialDotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0D4EFD',
  },
  faqSection: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  faqTitle: {
    fontSize: 17,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  faqViewAllLink: {
    fontSize: 13,
    color: '#0D4EFD',
    ...fontStyle('inter', 'semiBold'),
  },
  faqListContainer: {
    gap: 10,
  },
  faqCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  faqCardOpen: {
    borderColor: '#0D4EFD',
    backgroundColor: '#EFF6FF',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontSize: 14,
    color: '#0F172A',
    flex: 1,
    paddingRight: 10,
    ...fontStyle('inter', 'semiBold'),
  },
  faqAnswerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...fontStyle('inter', 'regular'),
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
      } as any,
      default: {
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
    }),
  },
  clockGraphicWrapper: {
    width: 140,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clockImage: {
    width: 136,
    height: 114,
  },
  modalTitle: {
    fontSize: 22,
    color: '#10213D',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
    ...fontStyle('inter', 'extraBold'),
  },
  modalBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    ...fontStyle('inter', 'regular'),
  },
  modalBodyBold: {
    color: '#10213D',
    ...fontStyle('inter', 'bold'),
  },
  modalButtonWrapper: {
    width: '100%',
  },
});
