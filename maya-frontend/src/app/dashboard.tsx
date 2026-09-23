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
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors, Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import {
  HomeNavIcon,
  RoadmapNavIcon,
  HistoryNavIcon,
  AccountNavIcon,
  CrownSolidIcon,
  BannerCrownIcon,
  BannerRoadmapIcon,
  LockIcon,
} from '@/components/icons/nav-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';

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

export default function DashboardScreen() {
  const params = useLocalSearchParams<{
    name?: string;
  }>();

  const displayName = params.name || 'Shehal';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { height: windowHeight } = useWindowDimensions();

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
  const [isPro, setIsPro] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  const handleStartTalking = () => {
    router.push({
      pathname: '/onboarding/connecting',
      params,
    });
  };

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'roadmap') {
      router.push({
        pathname: '/roadmap',
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
            onUpgrade={() => router.push('/upgrade')}
            onGetExtraTime={() => setActivePopup('practice-complete')}
          />
        )}

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
          {/* MOBILE TOP BAR */}
          {!isDesktop && (
            <View style={styles.mobileTopBar}>
              <View>
                <Text style={styles.brandTitleMobile}>
                  Speakwith<Text style={styles.brandAccent}>Maya</Text>
                </Text>
                <Text style={styles.brandTaglineMobile}>
                  Practice · Improve · Be Confident
                </Text>
              </View>

              {/* User Level Badge */}
              <Pressable
                style={styles.userBadgeRow}
                onPress={() => setActivePopup('level-up')}
                accessibilityRole="button"
                accessibilityLabel="View Level 4 progress"
              >
                <View style={styles.levelProgressCol}>
                  <View style={styles.levelNameRow}>
                    <Text style={styles.levelName}>Level 4</Text>
                    {isPro && (
                      <View style={styles.proBadge}>
                        <CrownSolidIcon color="#ffffff" size={10} />
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.xpText}>420 / 800 XP</Text>
                  <View style={styles.miniProgressTrack}>
                    <View style={[styles.miniProgressFill, { width: '52%' }]} />
                  </View>
                </View>
                <View style={styles.userAvatarWrapper}>
                  <Image
                    source={require('@/assets/images/maya-avatar.png')}
                    style={styles.userAvatarImage}
                    resizeMode="cover"
                  />
                </View>
              </Pressable>
            </View>
          )}

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
                <Pressable
                  style={styles.userBadgeRow}
                  onPress={() => setActivePopup('level-up')}
                  accessibilityRole="button"
                  accessibilityLabel="View Level 4 progress"
                >
                  <View style={styles.levelProgressCol}>
                    <View style={styles.levelNameRow}>
                      <Text style={styles.levelName}>Level 4</Text>
                      {isPro && (
                        <View style={styles.proBadge}>
                          <CrownSolidIcon color="#ffffff" size={10} />
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.xpText}>420 / 800 XP</Text>
                    <View style={styles.miniProgressTrack}>
                      <View style={[styles.miniProgressFill, { width: '52%' }]} />
                    </View>
                  </View>
                  <View style={styles.userAvatarWrapper}>
                    <Image
                      source={require('@/assets/images/maya-avatar.png')}
                      style={styles.userAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
                </Pressable>
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

            {/* HERO BANNER: "Start a conversation" */}
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

              {/* Social Proof */}
              <View style={styles.heroSocialRow}>
                <View style={styles.overlappingAvatars}>
                  {SOCIAL_AVATARS.map((url, i) => (
                    <View
                      key={i}
                      style={[
                        styles.avatarCircle,
                        { zIndex: 3 - i, marginLeft: i > 0 ? -7 : 0 },
                      ]}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.avatarPhoto}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </View>
                <Text style={[styles.heroSocialText, isDesktop && styles.heroSocialTextDesktop]}>
                  2,458+ conversations today
                </Text>
              </View>
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
                          handleStartTalking();
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
            {!isDesktop && (
              <View style={styles.talkTimeCardMobile}>
                <View style={styles.talkTimeHeader}>
                  <Text style={styles.talkTimeTitle}>Your Talk Time</Text>
                  <Text style={styles.talkTimeReset}>
                    {isPro ? 'Resets in 12 days' : 'Resets in 24 hours'}
                  </Text>
                </View>

                <Text style={styles.talkTimeMinutes}>
                  {isPro ? '320' : '01'}{' '}
                  <Text style={styles.talkTimeTotal}>
                    / {isPro ? '600' : '5'} minutes
                  </Text>
                </Text>

                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: isPro ? '53%' : '20%' },
                    ]}
                  />
                </View>

                <Pressable
                  style={styles.extraTimeButton}
                  onPress={() => {
                    if (!isPro) {
                      setActivePopup('daily-limit');
                    } else {
                      setActivePopup('practice-complete');
                    }
                  }}
                >
                  {isPro ? (
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
            )}

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

        {/* ==================================================================== */}
        {/* MOBILE BOTTOM NAVIGATION TABS */}
        {/* ==================================================================== */}
        {!isDesktop && (
          <View style={styles.mobileBottomTabs}>
            <Pressable
              style={styles.mobileTabItem}
              onPress={() => setActiveTab('home')}
            >
              <HomeNavIcon active={activeTab === 'home'} size={24} />
              <Text
                style={[
                  styles.mobileTabLabel,
                  activeTab === 'home' && styles.mobileTabLabelActive,
                ]}
              >
                Home
              </Text>
              {activeTab === 'home' && <View style={styles.activeDot} />}
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => router.push({ pathname: '/roadmap', params })}
            >
              <RoadmapNavIcon active={activeTab === 'roadmap'} size={24} />
              <Text
                style={[
                  styles.mobileTabLabel,
                  activeTab === 'roadmap' && styles.mobileTabLabelActive,
                ]}
              >
                Roadmap
              </Text>
              {activeTab === 'roadmap' && <View style={styles.activeDot} />}
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => setActiveTab('history')}
            >
              <HistoryNavIcon active={activeTab === 'history'} size={24} />
              <Text
                style={[
                  styles.mobileTabLabel,
                  activeTab === 'history' && styles.mobileTabLabelActive,
                ]}
              >
                History
              </Text>
              {activeTab === 'history' && <View style={styles.activeDot} />}
            </Pressable>

            <Pressable
              style={styles.mobileTabItem}
              onPress={() => setActiveTab('account')}
            >
              <AccountNavIcon active={activeTab === 'account'} size={24} />
              <Text
                style={[
                  styles.mobileTabLabel,
                  activeTab === 'account' && styles.mobileTabLabelActive,
                ]}
              >
                Account
              </Text>
              {activeTab === 'account' && <View style={styles.activeDot} />}
            </Pressable>
          </View>
        )}

        {/* ==================================================================== */}
        {/* COMMON POPUP (UNLOCK WITH PREMIUM / DAILY LIMIT / PRACTICE COMPLETE / LEVEL UP) */}
        {/* ==================================================================== */}
        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'custom'}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={() => {
            if (activePopup === 'unlock-premium' || activePopup === 'daily-limit') {
              router.push('/upgrade');
            } else if (activePopup === 'practice-complete') {
              handleStartTalking();
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
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
    paddingBottom: 16,
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
    maxWidth: '62%',
  },
  heroLeftDesktop: {
    maxWidth: 500,
  },
  heroTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 20,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  heroTitleDesktop: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroTitleHighlight: {
    fontFamily: Fonts.outfit.semiBold,
    color: '#0057FF',
  },
  heroSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 210,
  },
  heroSubtitleDesktop: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 22,
    maxWidth: 460,
  },
  startTalkingButton: {
    backgroundColor: '#0057FF',
    paddingHorizontal: 32,
    minWidth: 120,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 3px 8px rgba(0, 87, 255, 0.2)' } as any)
      : {
          shadowColor: '#0057FF',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  startTalkingButtonDesktop: {
    paddingHorizontal: 36,
    minWidth: 210,
    height: 46,
    borderRadius: 12,
    marginTop: 16,
  },
  startTalkingPressed: {
    backgroundColor: '#0047D4',
    transform: [{ scale: 0.98 }],
  },
  startTalkingText: {
    ...fontStyle('outfit', 'medium'),
    color: '#ffffff',
    fontSize: 13,
  },
  startTalkingTextDesktop: {
    fontSize: 16,
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
  },
  mayaWavingImgDesktop: {
    width: 260,
    height: 220,
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
  /* Mobile Bottom Navigation */
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
  mobileTabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  mobileTabIconActive: {
    opacity: 1,
  },
  mobileTabLabel: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  mobileTabLabelActive: {
    ...fontStyle('outfit', 'bold'),
    color: '#2B5BFF',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2B5BFF',
    marginTop: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
