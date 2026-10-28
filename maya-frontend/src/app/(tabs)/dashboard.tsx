import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors, Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import {
  HistoryNavIcon,
  CrownSolidIcon,
  BannerCrownIcon,
  BannerRoadmapIcon,
  LockIcon,
} from '@/components/icons/nav-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { MobileTopBar } from '@/components/navigation/mobile-top-bar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { CreateSessionModal, CreateSessionConfig } from '@/components/call/create-session-modal';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useOnboardingStore, OnboardingStore } from '@/services/store/onboarding-store';
import { CallSessionStore } from '@/services/store/call-session-store';
import { authService } from '@/services/auth/auth-service';
import { useUserStats } from '@/hooks/useUserStats';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { useActiveConversation, ActiveConversationStore, isRoadmapOrIntroTopic } from '@/services/store/active-conversation-store';
import { fetchAllPracticeSessions } from '@/services/supabase';
import { paymentApi } from '@/services/payment/payment-api';
import { mayaAlert } from '@/components/ui/alert-modal';

interface ScenarioItem {
  id: string;
  title: string;
  subtitle: string;
  iconBg: string;
  image: any;
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: 'casual-chat',
    title: 'Casual Chat',
    subtitle: 'Chat about anything in everyday life',
    iconBg: '#E6F0FE',
    image: require('@/assets/images/maya-feat/casual-chat.png'),
  },
  {
    id: 'workplace',
    title: 'Workplace',
    subtitle: 'Improve your work communication',
    iconBg: '#DCF7E7',
    image: require('@/assets/images/maya-feat/workplace.png'),
  },
  {
    id: 'travel-english',
    title: 'Travel English',
    subtitle: 'Communicate while you travel',
    iconBg: '#DEF8FC',
    image: require('@/assets/images/maya-feat/travel-english.png'),
  },
  {
    id: 'role-play',
    title: 'Role Play',
    subtitle: 'Practice real-life scenarios',
    iconBg: '#F2E7FE',
    image: require('@/assets/images/maya-feat/roleplay.png'),
  },
  {
    id: 'job-interview',
    title: 'Job Interview',
    subtitle: 'Prepare for your next interview',
    iconBg: '#FEEEDC',
    image: require('@/assets/images/maya-feat/job-interveiw.png'),
  },
  {
    id: 'ielts-speaking',
    title: 'IELTS Speaking',
    subtitle: 'Improve your IELTS speaking score',
    iconBg: '#DEF2FE',
    image: require('@/assets/images/maya-feat/ielts.png'),
  },
];

const SOCIAL_AVATARS = [
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
];

function resolveScenarioFromTopic(topic?: string, scenarioId?: string): { id: string; title: string } | null {
  if (scenarioId) {
    const match = SCENARIOS.find((s) => s.id === scenarioId);
    if (match) return { id: match.id, title: match.title };
  }
  if (!topic) return null;
  if (isRoadmapOrIntroTopic(topic)) return null;

  const lower = topic.toLowerCase().trim();
  if (lower.includes('interview') || lower.includes('job interview')) {
    return { id: 'job-interview', title: 'Job Interview' };
  }
  if (lower.includes('work') || lower.includes('office') || lower.includes('business')) {
    return { id: 'workplace', title: 'Workplace' };
  }
  if (lower.includes('travel english') || lower.includes('travel communication') || lower.includes('flight') || lower.includes('vacation')) {
    return { id: 'travel-english', title: 'Travel English' };
  }
  if (lower.includes('ielts')) {
    return { id: 'ielts-speaking', title: 'IELTS Speaking' };
  }
  if (
    lower === 'casual chat' ||
    lower === 'casual-chat' ||
    lower.includes('casual chat') ||
    lower.includes('everyday english') ||
    lower.includes('chat practice')
  ) {
    return { id: 'casual-chat', title: 'Casual Chat' };
  }
  if (lower === 'role play' || lower === 'role-play') {
    return { id: 'role-play', title: 'Role Play' };
  }
  return null;
}

function getScenarioDetails(scenarioId?: string) {
  const match = SCENARIOS.find((s) => s.id === scenarioId);
  return match || SCENARIOS[0];
}

export default function DashboardScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    pro?: string;
    popup?: string;
  }>();

  const store = useOnboardingStore();
  const stats = useUserStats();
  const user = store.user;
  const displayName = stats.displayName || params.name || '';
  const minutesBalance = stats.minutesBalance;
  const isTimeExpired = stats.isTimeExpired;
  const isSubscriptionLocked = stats.isSubscriptionLocked;
  const hasTelcoSubscription = stats.hasTelcoSubscription;
  const planTier = stats.planTier;
  const isPro = stats.isPro;
  const usedMinutes = stats.usedMinutes;
  const totalMinutes = stats.totalMinutes;
  const resetsInText = stats.resetsInText;

  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    authService.fetchUserProfile();
  }, []);

  // Dynamically scale card & hero heights so they fill space on taller desktop screens,
  // while staying compact enough on laptop screens (≤768px height) to prevent any vertical scrolling:
  const desktopHeroMinHeight = isDesktop
    ? Math.min(325, Math.max(160, Math.round(windowHeight * 0.35)))
    : 170;

  const desktopHeroPaddingV = isDesktop
    ? Math.min(56, Math.max(16, Math.round(windowHeight * 0.055)))
    : 18;

  const desktopCardMinHeight = isDesktop
    ? Math.min(124, Math.max(86, Math.round(windowHeight * 0.135)))
    : 114;

  const desktopCardPaddingV = isDesktop
    ? Math.min(20, Math.max(12, Math.round(windowHeight * 0.02)))
    : 20;

  const desktopMayaImgHeight = isDesktop
    ? Math.min(340, Math.max(225, Math.round(windowHeight * 0.35)))
    : 206;

  // Scale margin-top from 10px on shorter laptop screens up to 40px on taller desktop monitors:
  const desktopHeroMarginTop = isDesktop
    ? Math.min(50, Math.max(10, Math.round((windowHeight - 620) * 0.10) + 10))
    : 16;

  // Bottom banner height & padding:
  const desktopBannerMinHeight = isDesktop
    ? Math.min(94, Math.max(74, Math.round(windowHeight * 0.198)))
    : 78;

  const desktopBannerPaddingV = isDesktop
    ? Math.min(22, Math.max(15, Math.round(windowHeight * 0.022)))
    : 16;

  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(
    (params.popup as PopupPreset) || null
  );
  const [createSessionVisible, setCreateSessionVisible] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<{ id: string; title: string } | null>(null);

  const activeConversation = useActiveConversation();

  // Proactively clear any roadmap sessions if activeConversation happens to hold one
  useEffect(() => {
    if (
      activeConversation &&
      isRoadmapOrIntroTopic(
        activeConversation.topic,
        activeConversation.scenarioTitle,
        activeConversation.scenarioId,
        (activeConversation as any).roadmapLevelId,
        activeConversation.summary
      )
    ) {
      ActiveConversationStore.clear();
    }
  }, [activeConversation]);

  // When user reaches dashboard, ensure database and store record this as their last active step
  useEffect(() => {
    OnboardingStore.setOnboardingCompleted();
    authService.syncStep('/(tabs)/dashboard');
  }, []);

  // Load authoritative latest practice session from database on mount & reconcile with active conversation
  useEffect(() => {
    let mounted = true;
    fetchAllPracticeSessions().then((sessions) => {
      if (!mounted) return;
      if (sessions && sessions.length > 0) {
        // Strictly ignore intro calls, onboarding calls, or ANY roadmap curriculum sessions so the resume banner is NEVER shown for them
        const isRoadmapOrIntroSession = (s: any) => {
          if (!s) return false;
          if (s.roadmap_level_id || s.roadmapLevelId || s.level_number || s.levelNumber || s.is_roadmap) return true;
          return isRoadmapOrIntroTopic(
            s.topic,
            s.scenario_title || s.scenarioTitle,
            s.scenario_id || s.scenarioId,
            s.roadmap_level_id || s.roadmapLevelId,
            s.user_feedback || s.summary
          );
        };

        const latest = sessions.find((s) => {
          if (!s) return false;
          if (isRoadmapOrIntroSession(s)) return false;
          const resolved = resolveScenarioFromTopic(s.topic, s.scenario_id || s.scenarioId);
          return resolved !== null;
        });

        if (latest) {
          const scenario = resolveScenarioFromTopic(latest.topic, latest.scenario_id || latest.scenarioId);
          if (scenario && !isRoadmapOrIntroTopic(latest.topic, scenario.title, scenario.id, null, latest.user_feedback)) {
            ActiveConversationStore.setActive({
              sessionId: latest.id,
              scenarioId: scenario.id,
              scenarioTitle: scenario.title,
              topic: latest.topic || scenario.title,
              summary: latest.user_feedback || null,
              lastPracticedAt: latest.start_time || new Date().toISOString(),
              durationSeconds: latest.duration_seconds,
            });
            return;
          }
        }
        // If the user only has roadmap milestones, intro calls, or no recent dashboard sessions, keep clean "Start a conversation" hero banner
        ActiveConversationStore.clear();
      } else {
        ActiveConversationStore.clear();
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenCreateSession = (scenario?: { id: string; title: string }) => {
    if (isSubscriptionLocked) {
      setActivePopup('reactivate-plan');
      return;
    }
    setSelectedScenario(scenario || null);
    setCreateSessionVisible(true);
  };

  const handleStartSession = (config: CreateSessionConfig) => {
    setCreateSessionVisible(false);

    if (isSubscriptionLocked) {
      setActivePopup('reactivate-plan');
      return;
    }

    if (isTimeExpired) {
      if (!isPro) {
        setActivePopup('daily-limit');
      } else {
        setActivePopup('get-extra-time');
      }
      return;
    }

    if (config.scenarioId && config.scenarioTitle) {
      ActiveConversationStore.setActive({
        scenarioId: config.scenarioId,
        scenarioTitle: config.scenarioTitle,
        topic: config.topic || config.scenarioTitle,
      });
    }

    CallSessionStore.startCall({
      durationSeconds: config.durationSeconds,
      durationMinutes: config.durationMinutes,
      languageMode: config.languageMode,
      sinhalaStyle: config.sinhalaStyle || (config.languageMode === 'sinhala' ? 'balanced' : undefined),
      aiSuggestions: config.aiSuggestions,
      topic: config.topic,
      scenarioId: config.scenarioId || '',
      scenarioTitle: config.scenarioTitle || '',
      userName: user?.displayName || store.name || 'Learner',
    });
  };

  const handleStartTalking = () => {
    if (isSubscriptionLocked) {
      setActivePopup('reactivate-plan');
      return;
    }
    if (isTimeExpired) {
      if (!isPro) {
        setActivePopup('daily-limit');
      } else {
        setActivePopup('get-extra-time');
      }
      return;
    }
    handleOpenCreateSession();
  };

  const handleResumeTalking = () => {
    if (isSubscriptionLocked) {
      setActivePopup('reactivate-plan');
      return;
    }
    if (isTimeExpired) {
      if (!isPro) {
        setActivePopup('daily-limit');
      } else {
        setActivePopup('get-extra-time');
      }
      return;
    }
    if (activeConversation) {
      handleOpenCreateSession({
        id: activeConversation.scenarioId,
        title: activeConversation.scenarioTitle,
      });
    } else {
      handleStartTalking();
    }
  };

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'roadmap') {
      router.replace({
        pathname: '/roadmap',
        params,
      });
    } else if (tab === 'history') {
      router.replace({
        pathname: '/history',
        params,
      });
    } else if (tab === 'account') {
      router.replace({
        pathname: '/account',
        params,
      });
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* ==================================================================== */}
        {/* DESKTOP SIDEBAR NAVIGATION */}
        {/* ==================================================================== */}
        {isDesktop && (
          <DesktopSidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            isPro={isPro}
            planTier={stats.planTier}
            isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
            usedMinutes={usedMinutes}
            totalMinutes={totalMinutes}
            resetsInText={resetsInText}
            onUpgrade={() => router.push('/upgrade')}
            onReactivate={() => router.push('/(tabs)/account')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* ==================================================================== */}
        {/* MAIN CONTAINER WITH FIXED MOBILE TOP BAR */}
        {/* ==================================================================== */}
        <View style={styles.mainContainer}>
          {/* MOBILE FIXED TOP BAR (PINNED) */}
          <MobileTopBar
            pinned
            onLevelPress={() => setActivePopup('level-up')}
          />

          {/* ==================================================================== */}
          {/* MAIN SCROLLABLE CONTENT */}
          {/* ==================================================================== */}
          <ScrollView
            style={[styles.mainScroll, isDesktop && styles.mainScrollDesktop]}
            contentContainerStyle={[
              styles.mainScrollContent,
              isDesktop && styles.mainScrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDesktop || windowHeight < 520}
          >
            {/* TOP SECTION: Header + Hero Banner paired together on desktop */}
            <View style={isDesktop ? styles.desktopTopGroup : undefined}>
              {/* DESKTOP TOP HEADER */}
              {isDesktop && (
                <View style={styles.desktopTopHeader}>
                  <View>
                    <Text style={styles.greetingTitle}>
                      Hello, {displayName}! 👋
                    </Text>
                    <Text style={styles.greetingSubtitle}>
                      Ready to practice English today?
                    </Text>
                  </View>

                  {/* User Level Badge */}
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

              {/* GREETING ON MOBILE */}
              {!isDesktop && (
                <View style={styles.mobileGreetingSection}>
                  <Text style={styles.greetingTitleMobile}>
                    Hello, {displayName}! 👋
                  </Text>
                  <Text style={styles.greetingSubtitleMobile}>
                    Ready to practice English today?
                  </Text>
                </View>
              )}

              {/* HERO BANNER: "Start a conversation" OR "Resume Practice" */}
              <View style={[
                styles.heroCard,
                isDesktop && [
                  styles.heroCardDesktop,
                  {
                    minHeight: desktopHeroMinHeight,
                    paddingVertical: desktopHeroPaddingV,
                    marginTop: desktopHeroMarginTop,
                  },
                ],
              ]}>
                <View style={[styles.heroLeft, isDesktop && styles.heroLeftDesktop]}>
                  {activeConversation &&
                    !isRoadmapOrIntroTopic(
                      activeConversation.topic,
                      activeConversation.scenarioTitle,
                      activeConversation.scenarioId,
                      (activeConversation as any).roadmapLevelId,
                      activeConversation.summary
                    ) ? (
                    <>
                      <Text style={[
                        styles.heroTitle,
                        isDesktop && styles.heroTitleDesktop,
                      ]}>
                        Start a{isDesktop ? ' ' : '\n'}
                        <Text style={styles.heroTitleHighlight}>conversation</Text>
                      </Text>
                      <Text
                        style={[
                          styles.heroSubtitle,
                          styles.resumeSummarySubtitle,
                          isDesktop && styles.heroSubtitleDesktop,
                        ]}
                        numberOfLines={isDesktop ? 4 : 3}
                      >
                        {activeConversation.summary
                          ? `"${activeConversation.summary}"`
                          : activeConversation.topic
                            ? `Topic: ${activeConversation.topic}`
                            : 'Jump into a real-time conversation with your AI English partner.'}
                      </Text>

                      <View style={styles.resumeButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.startTalkingButton,
                            styles.resumeActionButton,
                            isDesktop && styles.startTalkingButtonDesktop,
                            pressed && styles.startTalkingPressed,
                          ]}
                          onPress={handleResumeTalking}
                          accessibilityRole="button"
                          accessibilityLabel={`Resume ${activeConversation.scenarioTitle} with Maya`}
                        >
                          <Text style={[styles.startTalkingText, isDesktop && styles.startTalkingTextDesktop]}>
                            Resume Practice
                          </Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.resumeStartNewButton,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={handleStartTalking}
                          accessibilityRole="button"
                          accessibilityLabel="Start fresh conversation"
                        >
                          <Text style={styles.resumeStartNewText}>New Conversation</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[
                        styles.heroTitle,
                        isDesktop && styles.heroTitleDesktop,
                      ]}>
                        Start a{' '}
                        <Text style={styles.heroTitleHighlight}>conversation</Text>
                      </Text>
                      <Text style={[
                        styles.heroSubtitle,
                        isDesktop && styles.heroSubtitleDesktop,
                      ]}>
                        Jump into a real-time conversation with your AI English partner.
                      </Text>

                      <Pressable
                        style={({ pressed }) => [
                          styles.startTalkingButton,
                          isDesktop && styles.startTalkingButtonDesktop,
                          pressed && styles.startTalkingPressed,
                        ]}
                        onPress={handleStartTalking}
                        accessibilityRole="button"
                        accessibilityLabel="Start Talking with Maya"
                      >
                        <Text style={[styles.startTalkingText, isDesktop && styles.startTalkingTextDesktop]}>
                          Start Talking
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>

                {/* Maya Waving Avatar Illustration */}
                <View style={[styles.heroRight, isDesktop && styles.heroRightDesktop]}>
                  <Image
                    source={require('@/assets/images/maya-waving.png')}
                    style={[
                      styles.mayaWavingImg,
                      isDesktop && [
                        styles.mayaWavingImgDesktop,
                        {
                          height: desktopMayaImgHeight,
                          width: Math.round(desktopMayaImgHeight * 1.18),
                        },
                      ],
                    ]}
                    resizeMode="contain"
                    accessibilityLabel="Maya waving"
                  />
                </View>
              </View>
            </View>

            {/* LOWER SECTION: Scenarios + Bottom Banner grouped together on desktop */}
            <View style={isDesktop ? styles.desktopLowerGroup : undefined}>
              {/* SECTION: "Maya can help you with" */}
              <View style={styles.scenariosSection}>
                <Text style={styles.sectionHeading}>
                  Maya can help you with
                </Text>
                <Text style={styles.sectionSubheading}>
                  Choose what you want to practice today
                </Text>

                {/* Grid of Scenarios */}
                <View
                  style={[
                    styles.scenariosGrid,
                    isDesktop ? styles.scenariosGridDesktop : styles.scenariosGridMobile,
                  ]}
                >
                  {SCENARIOS.map((item) => {
                    const isLocked = !isPro && item.id !== 'casual-chat';

                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.scenarioCard,
                          isDesktop && [
                            styles.scenarioCardDesktop,
                            {
                              minHeight: desktopCardMinHeight,
                              paddingVertical: desktopCardPaddingV,
                            },
                          ],
                          pressed && styles.cardPressed,
                        ]}
                        onPress={() => {
                          if (isLocked) {
                            setActivePopup('unlock-premium');
                          } else {
                            ActiveConversationStore.setActive({
                              scenarioId: item.id,
                              scenarioTitle: item.title,
                              topic: item.title,
                            });
                            handleOpenCreateSession({ id: item.id, title: item.title });
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isLocked
                            ? `${item.title} (Locked, upgrade to Pro to unlock)`
                            : `Practice ${item.title}`
                        }
                      >
                        <View
                          style={[
                            styles.scenarioIconBadge,
                            isDesktop && styles.scenarioIconBadgeDesktop,
                            { backgroundColor: isLocked ? '#F3F4F6' : item.iconBg },
                          ]}
                        >
                          <Image
                            source={item.image}
                            style={[
                              styles.scenarioImage,
                              isDesktop && styles.scenarioImageDesktop,
                              isLocked && styles.scenarioImageLocked,
                            ]}
                            resizeMode="contain"
                          />
                        </View>

                        <View style={styles.scenarioContent}>
                          <Text
                            style={[
                              styles.scenarioTitle,
                              isDesktop && styles.scenarioTitleDesktop,
                              isLocked && styles.scenarioTitleLocked,
                            ]}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[
                              styles.scenarioSubtitle,
                              isDesktop && styles.scenarioSubtitleDesktop,
                              isLocked && styles.scenarioSubtitleLocked,
                            ]}
                          >
                            {item.subtitle}
                          </Text>
                        </View>

                        {isLocked ? (
                          <View style={styles.lockIconContainer}>
                            <LockIcon color="#94A3B8" size={16} />
                          </View>
                        ) : (
                          <Text style={styles.scenarioArrow}>›</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* MOBILE: Talk Time Card */}
              {!isDesktop && (() => {
                const isInactiveMobile = Boolean(stats.isSubscriptionLocked || stats.isTelcoUnsubscribed);
                return (
                  <View
                    style={[
                      styles.talkTimeCardMobile,
                      isInactiveMobile && styles.talkTimeCardMobileInactive,
                    ]}
                  >
                    <View style={styles.talkTimeHeader}>
                      <Text style={styles.talkTimeTitle}>Your Talk Time</Text>
                      {isInactiveMobile ? (
                        <View style={styles.inactiveResetBadgeMobile}>
                          <View style={styles.inactiveResetDotMobile} />
                          <Text style={styles.inactiveResetTextMobile}>Inactive</Text>
                        </View>
                      ) : (
                        <Text style={styles.talkTimeReset}>
                          {resetsInText}
                        </Text>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.talkTimeMinutes,
                        isInactiveMobile && styles.talkTimeMinutesInactive,
                      ]}
                    >
                      {isInactiveMobile ? '00' : String(usedMinutes).padStart(2, '0')}{' '}
                      <Text style={styles.talkTimeTotal}>
                        / {isInactiveMobile ? '0' : totalMinutes} minutes
                      </Text>
                    </Text>

                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          isInactiveMobile
                            ? { width: '0%', backgroundColor: '#CBD5E1' }
                            : {
                                width: `${Math.min(
                                  100,
                                  Math.round((usedMinutes / Math.max(1, totalMinutes)) * 100)
                                )}%`,
                              },
                        ]}
                      />
                    </View>

                    <Pressable
                      style={[
                        styles.extraTimeButton,
                        isInactiveMobile && styles.extraTimeButtonInactiveMobile,
                      ]}
                      onPress={() => {
                        if (isInactiveMobile) {
                          router.push('/(tabs)/account');
                        } else if (!isPro) {
                          setActivePopup('daily-limit');
                        } else {
                          setActivePopup('get-extra-time');
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isInactiveMobile
                          ? 'Reactivate Maya'
                          : isPro
                          ? 'Get Extra Talk Time'
                          : 'Upgrade to premium'
                      }
                    >
                      {isInactiveMobile ? (
                        <>
                          <Feather name="refresh-cw" size={15} color="#DC2626" />
                          <Text style={[styles.extraTimeButtonText, styles.extraTimeButtonTextInactiveMobile]}>
                            Reactivate Maya →
                          </Text>
                        </>
                      ) : isPro ? (
                        <>
                          <HistoryNavIcon color="#2B5BFF" size={17} />
                          <Text style={styles.extraTimeButtonText}>
                            Get Extra Talk Time →
                          </Text>
                        </>
                      ) : (
                        <>
                          <CrownSolidIcon color="#2B5BFF" size={18} />
                          <Text style={styles.extraTimeButtonText}>
                            Upgrade to premium →
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })()}

              {/* Bottom Banner (Desktop & Mobile) */}
              <View style={[
                styles.roadmapBanner,
                isDesktop && [
                  styles.roadmapBannerDesktop,
                  {
                    minHeight: desktopBannerMinHeight,
                    paddingVertical: desktopBannerPaddingV,
                  },
                ],
                !isDesktop && styles.roadmapBannerMobile,
              ]}>
                <View style={[styles.roadmapLeft, !isDesktop && styles.roadmapLeftMobile]}>
                  <View style={styles.roadmapIconWrapper}>
                    {isPro ? (
                      <BannerRoadmapIcon width={28} height={28} color="#2B7FFF" />
                    ) : (
                      <BannerCrownIcon width={30} height={24} color="#0D4EFD" />
                    )}
                  </View>
                  <View style={styles.roadmapTextCol}>
                    {isPro ? (
                      <>
                        <Text style={styles.roadmapTitle}>Your Learning Roadmap</Text>
                        <Text style={styles.roadmapSubtitle}>
                          Follow a structured path, build your skills step by step and become fluent.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.unlockProTitle}>Unlock All Conversation With Pro</Text>
                        <Text style={styles.unlockProSubtitle}>
                          More conversations, AI feedback, advanced lessons & more!
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.roadmapButton,
                    !isDesktop && styles.roadmapButtonMobile,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    if (isPro) {
                      router.push({ pathname: '/roadmap', params });
                    } else {
                      router.push('/upgrade');
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isPro ? 'View Roadmap' : 'Upgrade to Pro'}
                >
                  <Text style={styles.roadmapButtonText}>
                    {isPro ? 'View Roadmap →' : 'Upgrade to Pro →'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>



        {/* ==================================================================== */}
        {/* COMMON POPUP (UNLOCK WITH PREMIUM / DAILY LIMIT / PRACTICE COMPLETE / LEVEL UP) */}
        {/* ==================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'custom'}
          levelNumber={stats.currentLevelNumber}
          title={
            activePopup === 'level-up'
              ? 'Your Level Progress'
              : undefined
          }
          subtitle={
            activePopup === 'level-up'
              ? `You are currently on ${stats.levelLabel} with ${stats.xpLabel}.\nKeep completing speaking lessons to reach Level ${stats.currentLevelNumber + 1}!`
              : undefined
          }
          primaryButtonText={
            activePopup === 'level-up'
              ? 'View Learning Roadmap'
              : undefined
          }
          primaryButtonIcon={
            activePopup === 'level-up' ? 'arrow' : undefined
          }
          showPrimaryArrow={activePopup === 'level-up' ? true : undefined}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={async () => {
            const currentPop = activePopup;
            setActivePopup(null);

            if (currentPop === 'level-up') {
              router.push('/(tabs)/roadmap');
            } else if (currentPop === 'reactivate-plan' || currentPop === 'unlock-premium' || currentPop === 'daily-limit') {
              router.push('/upgrade');
            } else if (currentPop === 'practice-complete') {
              handleStartTalking();
            }
          }}
          onFooterButtonPress={async () => {
            const currentPop = activePopup;
            setActivePopup(null);

            if (currentPop === 'reactivate-plan') {
              if (hasTelcoSubscription) {
                try {
                  const res = await paymentApi.reactivateTelcoSubscription();
                  await stats.refreshStats();
                  if (res.requiresPin) {
                    router.push('/(tabs)/account?reactivatePin=1' as any);
                  } else {
                    await mayaAlert.success(
                      res.message || 'Your mobile airtime subscription has been reactivated successfully!',
                      'Subscription Active'
                    );
                  }
                } catch (err: any) {
                  await mayaAlert.error(err.message || 'Failed to reactivate subscription.', 'Reactivation Error');
                }
              } else {
                router.push('/(tabs)/account?reactivate=1' as any);
              }
              return;
            }

            router.push('/upgrade');
          }}
        />

        {/* CREATE NEW SESSION MODAL */}
        <CreateSessionModal
          visible={createSessionVisible}
          onClose={() => setCreateSessionVisible(false)}
          onStartSession={handleStartSession}
          scenarioId={selectedScenario?.id}
          scenarioTitle={selectedScenario?.title}
          isPro={isPro}
          onUpgradePrompt={() => {
            setCreateSessionVisible(false);
            setActivePopup('unlock-premium');
          }}
        />
      </View>
    </SafeAreaView>
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
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  /* Desktop Sidebar */
  brandAccent: {
    color: '#0085db',
  },
  talkTimeCardMobile: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 18,
    marginTop: 24,
    marginBottom: 16,
  },
  talkTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  talkTimeTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0f172a',
  },
  talkTimeReset: {
    fontFamily: Fonts.inter.regular,
    fontSize: 11,
    color: '#94a3b8',
  },
  talkTimeMinutes: {
    ...fontStyle('inter', 'extraBold'),
    fontSize: 26,
    color: '#0f172a',
    marginTop: 8,
  },
  talkTimeTotal: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#94a3b8',
  },
  progressBarTrack: {
    width: '100%',
    height: 7,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 10,
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
  extraTimeButtonText: {
    ...fontStyle('inter', 'bold'),
    color: '#2B5BFF',
    fontSize: 13.5,
  },
  talkTimeCardMobileInactive: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FECACA',
  },
  inactiveResetBadgeMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  inactiveResetDotMobile: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  inactiveResetTextMobile: {
    ...fontStyle('inter', 'bold'),
    color: '#DC2626',
    fontSize: 10.5,
  },
  talkTimeMinutesInactive: {
    color: '#64748B',
  },
  extraTimeButtonInactiveMobile: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  extraTimeButtonTextInactiveMobile: {
    color: '#DC2626',
  },
  /* Main Content Area */
  mainScroll: {
    flex: 1,
  },
  mainScrollDesktop: {
    height: '100%',
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90, // room for mobile tabs
  },
  mainScrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 16,
    paddingBottom: 16,
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  desktopTopGroup: {
    gap: 0,
  },
  desktopLowerGroup: {
    gap: 16,
  },
  /* Mobile Header */
  mobileTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  brandTitleMobile: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  brandTaglineMobile: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
  },
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
  levelName: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12.5,
    color: '#0f172a',
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
  /* Desktop Top Header */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  greetingTitle: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 20,
    color: '#1D293D',
    lineHeight: 30,
    letterSpacing: 0,
  },
  greetingSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 14,
    color: '#64748b',
    marginTop: 3,
  },
  mobileGreetingSection: {
    marginTop: 18,
    marginBottom: 16,
  },
  greetingTitleMobile: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 20,
    color: '#1D293D',
    lineHeight: 30,
    letterSpacing: 0,
  },
  greetingSubtitleMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 4,
  },
  /* Hero Banner */
  heroCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0EDFE',
    padding: 18,
    overflow: 'visible',
    position: 'relative',
    minHeight: 170,
    justifyContent: 'center',
    marginTop: 16,
  },
  heroCardDesktop: {
    paddingHorizontal: 36,
    minHeight: 220,
    marginTop: 0,
  },
  heroLeft: {
    zIndex: 2,
    width: '100%',
  },
  heroLeftDesktop: {
    maxWidth: 540,
  },
  heroTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 22,
    color: '#090D14',
    letterSpacing: -0.4,
  },
  heroTitleDesktop: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroTitleHighlight: {
    fontFamily: Fonts.outfit.bold,
    color: '#0052FF',
  },
  heroSubtitle: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#334155',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 220,
  },
  heroSubtitleDesktop: {
    fontSize: 13.5,
    color: '#334155',
    marginTop: 8,
    lineHeight: 23,
    maxWidth: 460,
  },
  startTalkingButton: {
    backgroundColor: '#0052FF',
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 3px 10px rgba(0, 82, 255, 0.28)' } as any)
      : {
        shadowColor: '#0052FF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 3,
      }),
  },
  startTalkingButtonDesktop: {
    paddingHorizontal: 32,
    minWidth: 180,
    height: 46,
    borderRadius: 14,
    marginTop: 18,
  },
  startTalkingPressed: {
    backgroundColor: '#0043D6',
    transform: [{ scale: 0.98 }],
  },
  startTalkingText: {
    ...fontStyle('outfit', 'semiBold'),
    color: '#ffffff',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  startTalkingTextDesktop: {
    fontSize: 14.5,
  },
  heroSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  overlappingAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  heroSocialText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginLeft: 2,
  },
  heroSocialTextDesktop: {
    fontSize: 12,
  },
  heroRight: {
    position: 'absolute',
    right: -8,
    bottom: 0,
    zIndex: 1,
  },
  heroRightDesktop: {
    right: 18,
    bottom: 0,
  },
  mayaWavingImg: {
    width: 250,
    height: 206,
    opacity: 0.15,

  },
  mayaWavingImgDesktop: {
    width: 260,
    height: 220,
    opacity: 1
  },
  /* Scenarios Section */
  scenariosSection: {
    marginTop: 6,

  },
  sectionHeading: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  scenariosGrid: {
    width: '100%',
  },
  scenariosGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  scenariosGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scenarioCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ECEEF5',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 20,
    minHeight: 114,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.02)' } as any)
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
      }),
  },
  scenarioCardDesktop: {
    ...Platform.select({
      web: {
        width: 'calc((100% - 24px) / 3)',
      } as any,
      default: {
        width: '31.8%',
      },
    }),
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 84,
    gap: 12,
    borderRadius: 18,
    marginBottom: 0,
  },
  scenarioIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scenarioIconBadgeDesktop: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  scenarioImage: {
    width: 34,
    height: 34,
  },
  scenarioImageDesktop: {
    width: 38,
    height: 38,
  },
  scenarioContent: {
    flex: 1,
    minWidth: 0,
  },
  scenarioTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 16,
  },
  scenarioTitleDesktop: {
    fontSize: 14.5,
    lineHeight: 19,
  },
  scenarioSubtitle: {
    fontFamily: Fonts.inter.regular,
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 13.5,
  },
  scenarioSubtitleDesktop: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  scenarioArrow: {
    ...fontStyle('inter', 'regular'),
    fontSize: 16,
    color: '#CBD5E1',
    marginLeft: 'auto',
  },
  scenarioImageLocked: {
    opacity: 0.35,
    ...Platform.select({
      web: {
        filter: 'grayscale(100%)',
      } as any,
    }),
  },
  scenarioTitleLocked: {
    color: '#475569',
  },
  scenarioSubtitleLocked: {
    color: '#94a3b8',
  },
  lockIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  /* Roadmap / Pro Banner */
  roadmapBanner: {
    backgroundColor: '#0057FF',
    borderRadius: 18,
    paddingHorizontal: 26,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roadmapBannerDesktop: {
    borderRadius: 20,
    paddingHorizontal: 30,
  },
  roadmapLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flex: 1,
  },
  roadmapIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  roadmapSubtitle: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 3,
  },
  unlockProTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  unlockProSubtitle: {
    fontFamily: Fonts.inter.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 3,
  },
  roadmapBannerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 18,
    gap: 16,
    marginTop: 18,
  },
  roadmapLeftMobile: {
    width: '100%',
  },
  roadmapTextCol: {
    flex: 1,
  },
  roadmapButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapButtonMobile: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  roadmapButtonText: {
    ...fontStyle('outfit', 'bold'),
    color: '#0057FF',
    fontSize: 15,
    textAlign: 'center',
  },

  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonPressed: {
    opacity: 0.85,
  },
  minutesQuotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 14,
  },
  minutesQuotaPillExpired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  minutesQuotaText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#0284C7',
  },
  resumePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resumeScenarioPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  resumeScenarioPillText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11.5,
    color: '#0F172A',
  },
  resumeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  resumeLastActiveText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748B',
  },
  resumeSummarySubtitle: {
    color: '#334155',
    maxWidth: 270,
    lineHeight: 19,
  },
  resumeButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    flexWrap: 'nowrap',
  },
  resumeActionButton: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
  },
  resumeStartNewButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  resumeStartNewText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0052FF',
  },
});
