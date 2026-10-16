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

const CLOCK_IMAGE = require('@/assets/images/offer-expired-clock.png');

// Testing duration: 30 seconds as requested by the user
const TEST_DURATION_SECONDS = 30;
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
    minutes: '600 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 2,880',
    billedInfo: 'Billed as LKR 8,640 for 3 months',
    saveBadge: 'Save 20%',
    isFeatured: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    minutes: '450 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 2,700',
    billedInfo: 'Billed as LKR 2,700 monthly',
  },
  {
    id: 'pro',
    name: 'Pro',
    minutes: '600 AI conversation minutes',
    minutesSubtext: 'per month',
    pricePerMonth: 'LKR 3,600',
    billedInfo: 'Billed as LKR 3,600 monthly',
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
  '600 AI conversation minutes',
  'Detailed speaking analytics',
  'Advanced pronunciation feedback',
  'Personalized learning insights',
  'Rephrasing suggestions',
  'Priority AI responses',
  'Conversation history',
  'Early access to new features',
];

const TESTIMONIALS = [
  {
    id: 1,
    quote: '"I feel much more confident speaking at work now."',
    author: 'Dinesh S.',
  },
  {
    id: 2,
    quote: '"The pronunciation feedback is amazing. Highly recommend!"',
    author: 'Kavindi P.',
  },
  {
    id: 3,
    quote: '"Best investment for my English journey!"',
    author: 'Dulaj M.',
  },
];

const FAQS = [
  {
    id: 'cancel',
    question: 'Can I cancel anytime?',
    answer:
      'Yes, you can cancel your subscription at any time from your account settings. You will retain access until the end of your billing period.',
  },
  {
    id: 'auto-charge',
    question: 'Will I be charged automatically after 3 months?',
    answer:
      'Your plan will automatically renew at the standard rate unless cancelled prior to the renewal date.',
  },
  {
    id: 'after-3-months',
    question: 'What happens after 3 months?',
    answer:
      'You can continue with your selected plan, change tiers, or pause anytime without losing your practice history and progress.',
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
    if (params.payment === 'success') {
      authService.fetchUserProfile();
      router.replace({
        pathname: '/onboarding/complete' as any,
        params: { plan: '3-months-pro' },
      });
    } else if (params.payment === 'cancelled') {
      mayaAlert.alert('Subscription checkout was cancelled.', 'Cancelled', 'info');
    }
  }, [params.payment]);

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

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<string | null>(null);

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
        const confirmed = await mayaAlert.confirm({
          title: '1-Click Activation',
          message: `Deduct ${selectedPlan?.pricePerMonth || 'LKR 3,600'}/month from ${cardDisplay} and activate ${selectedPlan?.name} immediately?`,
          confirmText: 'Confirm & Activate',
          cancelText: 'Cancel',
          type: 'info',
        });

        if (confirmed) {
          await paymentApi.chargeSavedCard({ planTier: selectedPlanId as any });
          await authService.fetchUserProfile();
          router.replace({
            pathname: '/onboarding/complete' as any,
            params: { plan: selectedPlanId },
          });
          return;
        } else {
          return;
        }
      }

      // 3. Fallback to standard PayHere Payment Gateway checkout if no card saved yet
      const params = await paymentApi.getCheckoutParams(selectedPlanId as any);

      // 4. Launch PayHere Gateway (JS SDK popup modal on Web, Native SDK on mobile)
      const result = await payHereGateway.startPayment(params);

      if (result.status === 'completed') {
        await new Promise((r) => setTimeout(r, 1200));
        await authService.fetchUserProfile();
        router.replace({
          pathname: '/onboarding/complete' as any,
          params: { plan: selectedPlanId },
        });
      } else if (result.status === 'error') {
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
              <Ionicons name="lock-closed" size={15} color="#2563EB" style={styles.lockIcon} />
              <Text style={styles.topBarText}>Offer reserved for you</Text>
            </View>
            <View style={[styles.timerBadge, isTimerExpired && styles.timerBadgeExpired]}>
              <Text style={styles.timerText}>{formattedTime}</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>
            Hi {userName}! Your Personalized Plan is Ready
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
                    onPress={() => setSelectedPlanId(plan.id)}
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
                      <Text style={styles.planName}>{plan.name}</Text>
                      <View style={styles.minutesRow}>
                        <View style={styles.clockIconCircle}>
                          <Ionicons name="time-outline" size={12} color="#2563EB" />
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
                onPress={() => setSelectedPlanId(selectedPlan.id)}
                style={[styles.planCard, styles.planCardSelected]}
              >
                {selectedPlan.saveBadge && (
                  <View style={styles.saveBadgePill}>
                    <FontAwesome5 name="crown" size={10} color="#FFFFFF" style={styles.crownIcon} />
                    <Text style={styles.saveBadgeText}>{selectedPlan.saveBadge}</Text>
                  </View>
                )}

                <View style={styles.planCardLeft}>
                  <Text style={styles.planName}>{selectedPlan.name}</Text>
                  <View style={styles.minutesRow}>
                    <View style={styles.clockIconCircle}>
                      <Ionicons name="time-outline" size={12} color="#2563EB" />
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
                setShowAllPlans((prev) => !prev);
              }}
              style={styles.togglePlansButton}
            >
              <Text style={styles.togglePlansText}>
                {showAllPlans ? 'Collapse' : 'See more Plans'}
              </Text>
              <Ionicons
                name={showAllPlans ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#64748B"
              />
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
            <Text style={styles.securityText}>Secure payment powered by PayHere · Cancel anytime in 1 click</Text>
          </View>

          {/* Payment Methods Badges Row */}
          <View style={styles.paymentMethodsRow}>
            {/* VISA */}
            <View style={styles.paymentBadge}>
              <Text style={styles.visaText}>VISA</Text>
            </View>

            {/* Mastercard */}
            <View style={styles.paymentBadge}>
              <View style={styles.mastercardDots}>
                <View style={[styles.mcCircle, { backgroundColor: '#EB001B', marginRight: -6 }]} />
                <View style={[styles.mcCircle, { backgroundColor: '#F79E1B' }]} />
              </View>
            </View>

            {/* PayHere */}
            <View style={styles.paymentBadge}>
              <Text style={styles.payHereText}>
                <Text style={{ color: '#0057FF' }}>Pay</Text>
                <Text style={{ color: '#F79E1B' }}>Here</Text>
              </Text>
            </View>

            {/* Apple Pay */}
            <View style={styles.paymentBadge}>
              <Ionicons name="logo-apple" size={13} color="#000000" style={{ marginRight: 2 }} />
              <Text style={styles.applePayText}>Pay</Text>
            </View>

            {/* Google Pay */}
            <View style={styles.paymentBadge}>
              <Text style={styles.gPayText}>
                <Text style={{ color: '#4285F4' }}>G</Text> Pay
              </Text>
            </View>
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
                    color="#2563EB"
                    style={styles.checkIcon}
                  />
                  <Text style={styles.featureItemText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* What Our Learners Say Section */}
          <View style={styles.testimonialsSection}>
            <View style={styles.testimonialsHeader}>
              <Text style={styles.testimonialsTitle}>What our learners say</Text>
              <Text style={styles.testimonialsRating}>
                <Text style={{ ...fontStyle('inter', 'bold'), color: '#10213D' }}>4.8/5</Text>
                {' from 2,000+ learners'}
              </Text>
            </View>

            {TESTIMONIALS.map((t) => (
              <View key={t.id} style={styles.testimonialCard}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color="#FBBF24" style={styles.starIcon} />
                  ))}
                </View>
                <Text style={styles.testimonialQuote}>{t.quote}</Text>
                <Text style={styles.testimonialAuthor}>{t.author}</Text>
              </View>
            ))}
          </View>

          {/* Frequently Asked Questions Section */}
          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
            {FAQS.map((faq) => {
              const isOpen = openFaq === faq.id;
              return (
                <Pressable
                  key={faq.id}
                  onPress={() => toggleFaq(faq.id)}
                  style={styles.faqCard}
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#DCEBFE',
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
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  timerBadge: {
    backgroundColor: '#2563EB',
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
    fontSize: 26,
    lineHeight: 33,
    color: '#10213D',
    letterSpacing: -0.6,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 10,
    ...fontStyle('inter', 'extraBold'),
  },
  subtitle: {
    fontSize: 14,
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
    borderRadius: 18,
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
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
      } as any,
      default: {
        elevation: 3,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
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
    backgroundColor: '#2563EB',
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
    fontSize: 16,
    color: '#10213D',
    marginBottom: 8,
    ...fontStyle('inter', 'extraBold'),
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
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutesTitle: {
    fontSize: 12,
    color: '#10213D',
    ...fontStyle('inter', 'bold'),
  },
  minutesSub: {
    fontSize: 10,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  billedInfo: {
    fontSize: 11,
    color: '#94A3B8',
    ...fontStyle('inter', 'medium'),
  },
  planCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceNumber: {
    fontSize: 16,
    color: '#10213D',
    letterSpacing: -0.4,
    ...fontStyle('inter', 'bold'),
  },
  priceNumberSelected: {
    color: '#2563EB',
    ...fontStyle('inter', 'extraBold'),
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
    paddingVertical: 8,
    gap: 4,
  },
  togglePlansText: {
    fontSize: 13,
    color: '#64748B',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 36,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 8,
  },
  visaText: {
    fontSize: 18,
    color: '#1A1F71',
    letterSpacing: 0.5,
    fontStyle: 'italic',
    ...fontStyle('inter', 'extraBold'),
  },
  mastercardDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  payHereText: {
    fontSize: 14,
    ...fontStyle('inter', 'bold'),
  },
  applePayText: {
    fontSize: 13,
    color: '#000000',
    ...fontStyle('inter', 'bold'),
  },
  gPayText: {
    fontSize: 13,
    color: '#5F6368',
    ...fontStyle('inter', 'bold'),
  },
  proFeaturesCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    padding: 22,
    marginBottom: 32,
  },
  proFeaturesTitle: {
    fontSize: 17,
    color: '#10213D',
    marginBottom: 16,
    ...fontStyle('inter', 'extraBold'),
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
    marginBottom: 32,
  },
  testimonialsHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  testimonialsTitle: {
    fontSize: 17,
    color: '#10213D',
    ...fontStyle('inter', 'extraBold'),
  },
  testimonialsRating: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  testimonialCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 2,
  },
  starIcon: {
    marginRight: 1,
  },
  testimonialQuote: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    marginBottom: 8,
    ...fontStyle('inter', 'regular'),
  },
  testimonialAuthor: {
    fontSize: 12,
    color: '#94A3B8',
    ...fontStyle('inter', 'medium'),
  },
  faqSection: {
    width: '100%',
  },
  faqTitle: {
    fontSize: 17,
    color: '#10213D',
    marginBottom: 16,
    ...fontStyle('inter', 'extraBold'),
  },
  faqCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 10,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontSize: 14,
    color: '#10213D',
    flex: 1,
    paddingRight: 10,
    ...fontStyle('inter', 'semiBold'),
  },
  faqAnswerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    marginTop: 10,
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
