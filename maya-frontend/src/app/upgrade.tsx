import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Fonts, fontStyle } from '@/theme/fonts';
import { Radii } from '@/theme/tokens';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import {
  HomeNavIcon,
  RoadmapNavIcon,
  HistoryNavIcon,
  AccountNavIcon,
} from '@/components/icons/nav-icons';

// ─── Plan Data ───────────────────────────────────────────────────────────────

interface PlanFeature {
  text: string;
}

interface PricingPlan {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  period: string;
  features: PlanFeature[];
  ctaLabel: string;
  highlighted: boolean;
  badgeLabel?: string;
  iconColor: string;
  iconBg: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    subtitle: 'Great for getting started',
    price: 'LKR 2,700',
    period: '/ month',
    features: [
      { text: '450 AI conversation minutes' },
      { text: 'AI conversation partner' },
      { text: 'Grammar corrections' },
      { text: 'Session transcript' },
      { text: 'Voice captions' },
    ],
    ctaLabel: 'Upgrade to Basic',
    highlighted: false,
    iconColor: '#64748b',
    iconBg: '#f1f5f9',
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Best for consistent learners',
    price: 'LKR 3,600',
    period: '/ month',
    features: [
      { text: '600 AI conversation minutes' },
      { text: 'Everything in Starter' },
      { text: 'Advanced pronunciation feedback' },
      { text: 'Rephrasing suggestions' },
      { text: 'Conversation history' },
      { text: 'Progress tracking' },
    ],
    ctaLabel: 'Upgrade to Pro',
    highlighted: true,
    badgeLabel: 'Most Popular',
    iconColor: '#ffffff',
    iconBg: '#0057FF',
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'For serious learners',
    price: 'LKR 7,200',
    period: '/ month',
    features: [
      { text: '1,200 AI conversation minutes' },
      { text: 'Everything in Pro' },
      { text: 'Detailed speaking analytics' },
      { text: 'Personalized learning insights' },
      { text: 'Priority AI responses' },
      { text: 'Early access to new features' },
    ],
    ctaLabel: 'Upgrade to Premium',
    highlighted: false,
    iconColor: '#64748b',
    iconBg: '#f1f5f9',
  },
];

// ─── Trust Badges ────────────────────────────────────────────────────────────

interface TrustBadge {
  icon: 'shield' | 'bolt' | 'ai' | 'users';
  title: string;
  subtitle: string;
}

const TRUST_BADGES: TrustBadge[] = [
  { icon: 'shield', title: 'Secure Payment', subtitle: 'Your data is safe with us' },
  { icon: 'bolt', title: 'Instant Access', subtitle: 'Start using premium features immediately' },
  { icon: 'ai', title: 'AI Powered', subtitle: '24/7 speaking partner' },
  { icon: 'users', title: 'Join Thousands', subtitle: 'Building confidence every day' },
];

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

function ShieldIcon({ color = '#0057FF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 14.5l-4-4 1.41-1.41L11 13.67l6.59-6.59L19 8.5l-8 8z"
        fill={color}
      />
    </Svg>
  );
}

function BoltIcon({ color = '#0057FF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z" fill={color} />
    </Svg>
  );
}

function AIIcon({ color = '#0057FF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h6l-2 3v1h8v-1l-2-3h6a2 2 0 002-2V5a2 2 0 00-2-2zm0 12H4V5h16v10z"
        fill={color}
      />
      <Circle cx="8" cy="10" r="1.5" fill={color} />
      <Circle cx="12" cy="10" r="1.5" fill={color} />
      <Circle cx="16" cy="10" r="1.5" fill={color} />
    </Svg>
  );
}

function UsersIcon({ color = '#0057FF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
        fill={color}
      />
    </Svg>
  );
}

function MapPinIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        fill={color}
      />
    </Svg>
  );
}

function CrownIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" fill={color} />
    </Svg>
  );
}

function BarChartIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18h2v-4H4v4zm5 0h2v-8H9v8zm5 0h2V6h-2v12zm5 0h2v-14h-2v14z" fill={color} />
    </Svg>
  );
}

function PlanIcon({ planId, color }: { planId: string; color: string }) {
  const size = 18;
  if (planId === 'basic') return <MapPinIcon color={color} size={size} />;
  if (planId === 'pro') return <CrownIcon color={color} size={size} />;
  return <BarChartIcon color={color} size={size} />;
}

function CheckIcon({ color = '#0057FF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill={color} />
      <Path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckOutlineIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#94a3b8" />
    </Svg>
  );
}

function BackArrowIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="#0f172a" />
    </Svg>
  );
}

const TRUST_ICON_MAP = {
  shield: ShieldIcon,
  bolt: BoltIcon,
  ai: AIIcon,
  users: UsersIcon,
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function UpgradeScreen() {
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<DashboardTab>('upgrade');

  // Dynamic scaling so the desktop upgrade page fills available height naturally
  // (pricing cards and trust badges expand to fill screen space without any vertical scrolling):
  const isCompact = isDesktop && windowHeight < 800;

  // Header bottom margin
  const desktopHeaderMarginBottom = isDesktop
    ? Math.min(22, Math.max(10, Math.round(windowHeight * 0.018)))
    : 24;

  // Pricing cards padding and spacing - generous to fill the space
  const desktopCardPaddingV = isDesktop
    ? Math.min(28, Math.max(16, Math.round(windowHeight * 0.026)))
    : 22;
  const desktopCardPaddingH = isDesktop
    ? Math.min(22, Math.max(14, Math.round(windowWidth * 0.014)))
    : 20;

  const desktopCardsMarginBottom = isDesktop
    ? Math.min(18, Math.max(10, Math.round(windowHeight * 0.016)))
    : 24;

  const desktopCardHeaderMarginBottom = isDesktop
    ? Math.min(18, Math.max(10, Math.round(windowHeight * 0.016)))
    : 16;

  const desktopPriceMarginBottom = isDesktop
    ? Math.min(16, Math.max(8, Math.round(windowHeight * 0.014)))
    : 14;

  const desktopDividerMarginBottom = isDesktop
    ? Math.min(16, Math.max(8, Math.round(windowHeight * 0.014)))
    : 14;

  const desktopFeatureGap = isDesktop
    ? Math.min(14, Math.max(8, Math.round(windowHeight * 0.013)))
    : 10;

  const desktopFeatureMarginBottom = isDesktop
    ? Math.min(22, Math.max(12, Math.round(windowHeight * 0.018)))
    : 20;

  const desktopCtaHeight = isDesktop
    ? Math.min(50, Math.max(42, Math.round(windowHeight * 0.048)))
    : 46;

  // Trust badges row padding & margin - give more height as requested
  const desktopTrustPaddingV = isDesktop
    ? Math.min(20, Math.max(14, Math.round(windowHeight * 0.02)))
    : 14;
  const desktopTrustMarginBottom = isDesktop
    ? Math.min(16, Math.max(10, Math.round(windowHeight * 0.014)))
    : 16;

  // Testimonial card padding
  const desktopTestimonialPaddingV = isDesktop
    ? Math.min(16, Math.max(12, Math.round(windowHeight * 0.016)))
    : 16;

  const handleSelectPlan = (planId: string) => {
    // TODO: integrate payment flow
    console.log('Selected plan:', planId);
  };

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.push('/dashboard');
    } else if (tab === 'roadmap') {
      router.push('/roadmap');
    } else {
      setActiveTab(tab);
    }
  };

  // Mobile bottom nav tab data
  const MOBILE_TABS: { id: DashboardTab; label: string; Icon: typeof HomeNavIcon }[] = [
    { id: 'home', label: 'Home', Icon: HomeNavIcon },
    { id: 'roadmap', label: 'Roadmap', Icon: RoadmapNavIcon },
    { id: 'history', label: 'History', Icon: HistoryNavIcon },
    { id: 'account', label: 'Account', Icon: AccountNavIcon },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* ──────────── DESKTOP SIDEBAR ──────────── */}
        {isDesktop && (
          <DesktopSidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            isPro={false}
            usedMinutes={320}
            totalMinutes={600}
            resetsInText="Resets in 12 days"
            onUpgrade={() => {}}
            onGetExtraTime={() => {}}
          />
        )}

        {/* ──────────── MAIN CONTAINER WITH FIXED MOBILE TOP BAR ──────────── */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR (PINNED) */}
          {!isDesktop && (
            <View style={styles.mobileFixedTopBar}>
              <View style={styles.mobileBrandRow}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <BackArrowIcon size={20} />
                </Pressable>
                <View>
                  <Text style={styles.brandTitleMobile}>
                    Speakwith<Text style={styles.brandAccent}>Maya</Text>
                  </Text>
                  <Text style={styles.brandTaglineMobile}>
                    Practice · Improve · Be Confident
                  </Text>
                </View>
              </View>

              <UserLevelBadge
                isPro={false}
                avatarSource={require('@/assets/images/maya-avatar.png')}
              />
            </View>
          )}

          {/* ──────────── MAIN CONTENT ──────────── */}
          <ScrollView
            style={[styles.scroll, isDesktop && styles.scrollDesktop]}
            contentContainerStyle={[
              styles.scrollContent,
              isDesktop && styles.scrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDesktop || windowHeight < 560}
          >
            {/* ──────────── HEADER ──────────── */}
            {isDesktop ? (
              <View
                style={[
                  styles.headerDesktop,
                  { marginBottom: desktopHeaderMarginBottom },
                ]}
              >
                <View>
                  <Text style={[styles.pageTitle, styles.pageTitleDesktop]}>
                    Upgrade to Pro
                  </Text>
                  <Text style={[styles.pageSubtitle, styles.pageSubtitleDesktop]}>
                    Unlock more practice time and powerful features to improve your English faster.
                  </Text>
                </View>
                <UserLevelBadge
                  isPro={false}
                  avatarSource={require('@/assets/images/maya-avatar.png')}
                />
              </View>
            ) : (
              <View style={styles.mobileHeadingSection}>
                <Text style={styles.pageTitle}>
                  Upgrade to Pro
                </Text>
                <Text style={styles.pageSubtitle}>
                  Unlock more practice time and powerful features to improve your English faster.
                </Text>
              </View>
            )}

          {/* ──────────── PRICING CARDS ──────────── */}
          <View
            style={[
              styles.cardsRow,
              isDesktop && [
                styles.cardsRowDesktop,
                { marginBottom: desktopCardsMarginBottom },
              ],
            ]}
          >
            {PLANS.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  isDesktop && [
                    styles.cardDesktop,
                    {
                      paddingVertical: desktopCardPaddingV,
                      paddingHorizontal: desktopCardPaddingH,
                    },
                  ],
                  plan.highlighted && styles.cardHighlighted,
                ]}
              >
                {/* "Most Popular" badge */}
                {plan.badgeLabel && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{plan.badgeLabel}</Text>
                  </View>
                )}

                <View style={[styles.cardTopContent, isDesktop && styles.cardTopContentDesktop]}>
                  {/* Plan header */}
                  <View
                    style={[
                      styles.cardHeader,
                      isDesktop && { marginBottom: desktopCardHeaderMarginBottom },
                    ]}
                  >
                    <View style={[
                      styles.planIconWrap,
                      isDesktop && styles.planIconWrapDesktop,
                      { backgroundColor: plan.iconBg },
                    ]}>
                      <PlanIcon planId={plan.id} color={plan.iconColor} />
                    </View>
                    <View style={styles.planNameCol}>
                      <Text
                        style={[
                          styles.planName,
                          isDesktop && styles.planNameDesktop,
                          plan.highlighted && styles.planNameHighlighted,
                        ]}
                      >
                        {plan.name}
                      </Text>
                      <Text
                        style={[
                          styles.planSubtitle,
                          isDesktop && styles.planSubtitleDesktop,
                          plan.highlighted && styles.planSubtitleHighlighted,
                        ]}
                      >
                        {plan.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Price */}
                  <View
                    style={[
                      styles.priceRow,
                      isDesktop && { marginBottom: desktopPriceMarginBottom },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priceText,
                        isDesktop && styles.priceTextDesktop,
                        isCompact && styles.priceTextCompact,
                        plan.highlighted && styles.priceTextHighlighted,
                      ]}
                    >
                      {plan.price}
                    </Text>
                    <Text
                      style={[
                        styles.pricePeriod,
                        isDesktop && styles.pricePeriodDesktop,
                        plan.highlighted && styles.pricePeriodHighlighted,
                      ]}
                    >
                      {plan.period}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View
                    style={[
                      styles.divider,
                      isDesktop && { marginBottom: desktopDividerMarginBottom },
                      plan.highlighted && styles.dividerHighlighted,
                    ]}
                  />

                  {/* Features list */}
                  <View
                    style={[
                      styles.featuresList,
                      isDesktop && [
                        styles.featuresListDesktop,
                        {
                          gap: desktopFeatureGap,
                          marginBottom: desktopFeatureMarginBottom,
                        },
                      ],
                    ]}
                  >
                    {plan.features.map((feat, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        {plan.highlighted ? (
                          <CheckIcon color="#0057FF" size={isDesktop ? 18 : 16} />
                        ) : (
                          <CheckOutlineIcon size={isDesktop ? 18 : 16} />
                        )}
                        <Text
                          style={[
                            styles.featureText,
                            isDesktop && styles.featureTextDesktop,
                            plan.highlighted && styles.featureTextHighlighted,
                          ]}
                        >
                          {feat.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* CTA button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButton,
                    isDesktop && { height: desktopCtaHeight },
                    plan.highlighted ? styles.ctaButtonHighlighted : styles.ctaButtonOutline,
                    pressed && styles.ctaButtonPressed,
                  ]}
                  onPress={() => handleSelectPlan(plan.id)}
                  accessibilityRole="button"
                  accessibilityLabel={plan.ctaLabel}
                >
                  <Text
                    style={[
                      styles.ctaButtonText,
                      plan.highlighted && styles.ctaButtonTextHighlighted,
                    ]}
                  >
                    {plan.ctaLabel}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* ──────────── TRUST BADGES ──────────── */}
          <View
            style={[
              styles.trustRow,
              isDesktop && [
                styles.trustRowDesktop,
                {
                  paddingVertical: desktopTrustPaddingV,
                  marginBottom: desktopTrustMarginBottom,
                },
              ],
            ]}
          >
            {TRUST_BADGES.map((badge, idx) => {
              const Icon = TRUST_ICON_MAP[badge.icon];
              const isLast = idx === TRUST_BADGES.length - 1;
              return (
                <View
                  key={badge.icon}
                  style={[
                    styles.trustBadge,
                    isDesktop && styles.trustBadgeDesktop,
                    isDesktop && isLast && { borderRightWidth: 0 },
                  ]}
                >
                  <View style={[styles.trustIconWrap, isDesktop && styles.trustIconWrapDesktop]}>
                    <Icon color="#0057FF" size={isDesktop ? 20 : 17} />
                  </View>
                  <View style={styles.trustTextCol}>
                    <Text style={[styles.trustTitle, isDesktop && styles.trustTitleDesktop]}>
                      {badge.title}
                    </Text>
                    <Text
                      style={[styles.trustSubtitle, isDesktop && styles.trustSubtitleDesktop]}
                      numberOfLines={1}
                    >
                      {badge.subtitle}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ──────────── TESTIMONIAL ──────────── */}
          <View
            style={[
              styles.testimonialCard,
              isDesktop && [
                styles.testimonialCardDesktop,
                { paddingVertical: desktopTestimonialPaddingV },
              ],
            ]}
          >
            <View style={styles.testimonialQuoteRow}>
              <Text style={styles.testimonialQuoteMark}>"</Text>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text
                  style={[
                    styles.testimonialText,
                    isDesktop && styles.testimonialTextDesktop,
                  ]}
                >
                  "SpeakwithMaya has really helped me improve my confidence. The extra practice time in Pro is worth it!"
                </Text>
                <View style={styles.testimonialMetaCol}>
                  <Text style={styles.testimonialAuthor}>— Sanduni, Sri Lanka</Text>
                  <Text style={styles.testimonialStars}>⭐⭐⭐⭐⭐</Text>
                </View>
              </View>
            </View>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' }}
              style={styles.testimonialAvatar}
              resizeMode="cover"
            />
          </View>

          {/* Room for mobile tabs on phone */}
          {!isDesktop && <View style={{ height: 100 }} />}
        </ScrollView>
      </View>
    </View>

      {/* ──────────── MOBILE BOTTOM NAV ──────────── */}
      {!isDesktop && (
        <View style={styles.mobileBottomTabs}>
          {MOBILE_TABS.map((tab) => {
            const isActive = false;
            return (
              <Pressable
                key={tab.id}
                style={styles.mobileTabItem}
                onPress={() => handleSelectTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <tab.Icon
                  color={isActive ? '#0085db' : '#94a3b8'}
                  size={22}
                />
                <Text style={styles.mobileTabLabel}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContainer: {
    flex: 1,
  },
  mobileFixedTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  brandAccent: {
    color: '#0057FF',
  },
  brandTaglineMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  mobileHeadingSection: {
    marginTop: 18,
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollDesktop: {
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 16,
    paddingBottom: 16,
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  /* ── Header ── */
  header: {
    marginBottom: 20,
  },
  headerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  pageTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 24,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  pageTitleDesktop: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 28,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 19,
  },
  pageSubtitleDesktop: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
  },

  /* ── Cards Row ── */
  cardsRow: {
    gap: 16,
    marginBottom: 20,
  },
  cardsRowDesktop: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
    marginBottom: 16,
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 20,
    position: 'relative',
  },
  cardDesktop: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHighlighted: {
    borderColor: '#0057FF',
    borderWidth: 2,
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  cardTopContent: {
    width: '100%',
  },
  cardTopContentDesktop: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  /* "Most Popular" pill */
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#0057FF',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    zIndex: 1,
    left: '50%',
    ...Platform.select({
      web: {
        transform: [{ translateX: '-50%' }],
      } as any,
      default: {},
    }),
  },
  popularBadgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  /* Plan header */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  planIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconWrapDesktop: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  planNameCol: {
    flex: 1,
  },
  planName: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0f172a',
  },
  planNameDesktop: {
    fontSize: 18.5,
  },
  planNameHighlighted: {
    color: '#0f172a',
  },
  planSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  planSubtitleDesktop: {
    fontSize: 12.5,
  },
  planSubtitleHighlighted: {
    color: '#64748b',
  },

  /* Price */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 12,
  },
  priceText: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 26,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  priceTextCompact: {
    fontSize: 24,
  },
  priceTextDesktop: {
    fontSize: 29,
  },
  priceTextHighlighted: {
    fontSize: 28,
    color: '#0f172a',
  },
  pricePeriod: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#94a3b8',
  },
  pricePeriodDesktop: {
    fontSize: 13,
  },
  pricePeriodHighlighted: {
    color: '#64748b',
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  dividerHighlighted: {
    backgroundColor: '#e0e7ff',
  },

  /* Features */
  featuresList: {
    gap: 8,
    marginBottom: 16,
  },
  featuresListDesktop: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#475569',
    flex: 1,
  },
  featureTextDesktop: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  featureTextHighlighted: {
    color: '#1e293b',
  },

  /* CTA Button */
  ctaButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonOutline: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  ctaButtonHighlighted: {
    backgroundColor: '#0057FF',
    borderWidth: 0,
    shadowColor: '#0057FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  ctaButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#0f172a',
  },
  ctaButtonTextHighlighted: {
    color: '#ffffff',
  },

  /* ── Trust Badges ── */
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trustRowDesktop: {
    flexWrap: 'nowrap',
    gap: 0,
    paddingHorizontal: 20,
    minHeight: 100,
    alignItems: 'center',
    marginBottom: 14,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '48%',
    paddingVertical: 4,
  },
  trustBadgeDesktop: {
    flex: 1,
    width: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  trustIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustIconWrapDesktop: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  trustTextCol: {
    flex: 1,
  },
  trustTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12.5,
    color: '#0f172a',
  },
  trustTitleDesktop: {
    fontSize: 13,
  },
  trustSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  trustSubtitleDesktop: {
    fontSize: 11,
    marginTop: 2,
  },

  /* ── Testimonial ── */
  testimonialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  testimonialCardDesktop: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 110,
  },
  testimonialQuoteRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  testimonialQuoteMark: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 34,
    lineHeight: 34,
    color: '#93c5fd',
    marginTop: -4,
  },
  testimonialText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  testimonialTextDesktop: {
    fontSize: 13,
    lineHeight: 19,
  },
  testimonialMetaCol: {
    marginTop: 4,
  },
  testimonialAuthor: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  testimonialStars: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 1,
  },
  testimonialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  /* ── Mobile Bottom Navigation ── */
  mobileBottomTabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  mobileTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minWidth: 60,
  },
  mobileTabLabel: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
});
