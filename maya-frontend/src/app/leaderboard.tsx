import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { MobileTopBar } from '@/components/navigation/mobile-top-bar';
import { UserLevelBadge } from '@/components/ui/user-level-badge';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingStore } from '@/services/store/onboarding-store';
import { useUserStats } from '@/hooks/useUserStats';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';

type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  rank: number | null;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  levelNumber: number;
  xp: number;
  minutesConsumed?: number;
  isCurrentUser?: boolean;
}

const AVATAR_PALETTE = [
  '#0D4EFD',
  '#0EA5E9',
  '#F59E0B',
  '#EC4899',
  '#10B981',
  '#8B5CF6',
  '#3B82F6',
  '#F97316',
];

function getAvatarBgColor(name: string, index: number, isCurrentUser?: boolean): string {
  if (isCurrentUser) return '#0D4EFD';
  let hash = index;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getFirstLetter(name?: string | null): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'U';
  return trimmed.charAt(0).toUpperCase();
}

export default function LeaderboardScreen() {
  const store = useOnboardingStore();
  const stats = useUserStats();
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;

  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [serverEntries, setServerEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  const user = store.user;
  const currentUserId = user?.id || 'current-user';
  const currentUserName = stats.displayName || 'Learner';
  const currentUserAvatarUrl = store.avatarUrl || user?.avatarUrl || null;
  // Strictly use database XP (never calculate XP from minutes)
  const currentUserXp = stats.totalXp;
  const currentUserLevel = stats.currentLevelNumber || 1;

  const fetchLeaderboard = useCallback(
    async (selectedPeriod: LeaderboardPeriod) => {
      setIsLoading(true);
      try {
        const baseUrl = getBackendBaseUrl();
        const token = store.accessToken;
        const headers: Record<string, string> = {};
        const authScheme = 'Bearer';
        if (token) {
          headers['Authorization'] = `${authScheme} ${token}`;
        }
        // 1. Try /v1/users/leaderboard (powered by AuthService.getPublicLeaderboard)
        const usersLeaderboardRes = await fetch(
          `${baseUrl}/v1/users/leaderboard?period=${selectedPeriod}&userId=${encodeURIComponent(
            currentUserId,
          )}`,
          { headers },
        ).catch(() => null);

        if (usersLeaderboardRes && usersLeaderboardRes.ok) {
          const data = await usersLeaderboardRes.json();
          if (Array.isArray(data.entries) && data.entries.length > 0) {
            setServerEntries(data.entries);
            return;
          }
        }

        // 2. Try /v1/roadmap/leaderboard
        const res = await fetch(
          `${baseUrl}/v1/roadmap/leaderboard?period=${selectedPeriod}&userId=${encodeURIComponent(
            currentUserId,
          )}`,
          { headers },
        ).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.entries) && data.entries.length > 0) {
            setServerEntries(data.entries);
            return;
          }
        }

        // Fallback to /v1/admin/users if the backend /v1/roadmap/leaderboard route is not yet built in dist/
        const usersRes = await fetch(`${baseUrl}/v1/admin/users`, { headers });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          if (Array.isArray(usersData.users) && usersData.users.length > 0) {
            const mapped = usersData.users.map((u: any) => {
              const completedCount = Number(u.stats?.completedLevelsCount || 0);
              const practicedMins = Math.max(
                Number(u.stats?.totalPracticedMinutes || 0),
                Math.max(0, Number(u.monthlyMinutesAllowance ?? 5) - Number(u.minutesBalance ?? 5)),
              );
              const lessonXp = completedCount * 100;
              const xp = lessonXp;
              const levelNumber = Math.max(1, Math.floor(lessonXp / 500) + 1);
              const rawName = (u.displayName || '').trim();
              const cleanName =
                rawName && rawName !== 'Anonymous Student'
                  ? rawName
                  : u.phoneNumber
                  ? `Learner ••${String(u.phoneNumber).slice(-4)}`
                  : 'Learner';
              return {
                userId: u.id,
                displayName: cleanName,
                avatarUrl: u.avatarUrl || null,
                levelNumber,
                xp,
                minutesConsumed: practicedMins,
                createdAt: u.createdAt || '',
                isCurrentUser: u.id === currentUserId,
              };
            });

            mapped.sort((a: any, b: any) => {
              if (b.xp !== a.xp) return b.xp - a.xp;
              if (b.minutesConsumed !== a.minutesConsumed) return b.minutesConsumed - a.minutesConsumed;
              return String(a.createdAt).localeCompare(String(b.createdAt));
            });

            let activeRank = 0;
            const withRealRanks: LeaderboardEntry[] = mapped.map((item: any) => {
              const hasActivity = item.xp > 0 || item.minutesConsumed > 0;
              return {
                rank: hasActivity ? ++activeRank : null,
                userId: item.userId,
                displayName: item.displayName,
                avatarUrl: item.avatarUrl,
                levelNumber: item.levelNumber,
                xp: item.xp,
                minutesConsumed: item.minutesConsumed,
                isCurrentUser: item.isCurrentUser,
              };
            });
            setServerEntries(withRealRanks);
          }
        }
      } catch {}
      finally {
        setIsLoading(false);
      }
    },
    [store.accessToken, currentUserId],
  );

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  // Use strictly real database values for XP, minutesConsumed, and rank (null -> N/A when 0 XP & 0 min)
  const { rankedList, myEntry } = useMemo(() => {
    const rawItems = serverEntries.map((item) => {
      const isMe = item.userId === currentUserId || Boolean(item.isCurrentUser);
      const xp = item.xp ?? (isMe ? currentUserXp : 0);
      const minutesConsumed = item.minutesConsumed ?? (isMe ? stats.practicedMinutes : 0);
      return {
        userId: item.userId,
        displayName: isMe ? currentUserName || item.displayName : item.displayName,
        avatarUrl: isMe ? currentUserAvatarUrl || item.avatarUrl : item.avatarUrl,
        levelNumber: item.levelNumber || (isMe ? currentUserLevel : 1),
        xp,
        minutesConsumed,
        isCurrentUser: isMe,
      };
    });

    if (rawItems.length === 0 && user?.id) {
      rawItems.push({
        userId: currentUserId,
        displayName: currentUserName,
        avatarUrl: currentUserAvatarUrl,
        levelNumber: currentUserLevel,
        xp: currentUserXp,
        minutesConsumed: stats.practicedMinutes,
        isCurrentUser: true,
      });
    }

    rawItems.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if ((b.minutesConsumed || 0) !== (a.minutesConsumed || 0)) {
        return (b.minutesConsumed || 0) - (a.minutesConsumed || 0);
      }
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    let activeRankCounter = 0;
    const withRanks: LeaderboardEntry[] = rawItems.map((item) => {
      const hasActivity = item.xp > 0 || (item.minutesConsumed || 0) > 0;
      return {
        ...item,
        rank: hasActivity ? ++activeRankCounter : null,
      };
    });

    const myHasActivity = currentUserXp > 0 || stats.practicedMinutes > 0;
    const me =
      withRanks.find((r) => r.isCurrentUser || r.userId === currentUserId) || {
        rank: myHasActivity ? stats.rank : null,
        userId: currentUserId,
        displayName: currentUserName,
        avatarUrl: currentUserAvatarUrl,
        levelNumber: currentUserLevel,
        xp: currentUserXp,
        minutesConsumed: stats.practicedMinutes,
        isCurrentUser: true,
      };

    return { rankedList: withRanks, myEntry: me };
  }, [
    serverEntries,
    currentUserId,
    currentUserName,
    currentUserAvatarUrl,
    currentUserLevel,
    currentUserXp,
    stats.rank,
    stats.practicedMinutes,
    user?.id,
  ]);

  const top1 = rankedList[0];
  const top2 = rankedList[1];
  const top3 = rankedList[2];

  // Top 3 are displayed in the Podium card above; the list below starts from the 4th learner onward
  const tableRows = useMemo(() => {
    return rankedList.slice(3);
  }, [rankedList]);

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.replace('/(tabs)/dashboard');
    } else if (tab === 'roadmap') {
      router.replace('/(tabs)/roadmap');
    } else if (tab === 'history') {
      router.replace('/(tabs)/history');
    } else if (tab === 'account') {
      router.replace('/(tabs)/account');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* DESKTOP SIDEBAR */}
        {isDesktop && (
          <DesktopSidebar
            activeTab="account"
            onSelectTab={handleSelectTab}
            isPro={stats.isPro}
            planTier={stats.planTier}
            isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
            usedMinutes={stats.usedMinutes}
            totalMinutes={stats.totalMinutes}
            resetsInText={stats.resetsInText}
            onUpgrade={() => router.push('/upgrade')}
            onReactivate={() => setActivePopup('reactivate-plan')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* MAIN CONTENT AREA */}
        <View style={styles.mainContainer}>
          {/* MOBILE TOP BAR */}
          <MobileTopBar
            pinned
            onLevelPress={() => setActivePopup('level-up')}
          />

          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={[
              styles.mainScrollContent,
              isDesktop && styles.mainScrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* DESKTOP TOP HEADER */}
            {isDesktop ? (
              <View style={styles.desktopTopHeader}>
                <View>
                  <Text style={styles.headingTitle}>Leaderboard</Text>
                  <Text style={styles.headingSubtitle}>
                    Practice consistently. Celebrate your progress.
                  </Text>
                </View>

                <UserLevelBadge
                  levelLabel={stats.levelLabel}
                  xpLabel={stats.xpLabel}
                  progress={stats.progress}
                  isPro={stats.isPro}
                  planTier={stats.planTier}
                  isInactive={stats.isSubscriptionLocked || stats.isTelcoUnsubscribed}
                  onPress={() => setActivePopup('level-up')}
                />
              </View>
            ) : (
              /* MOBILE BACK BUTTON + HEADING */
              <View style={styles.mobileHeaderRow}>
                <Pressable
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(tabs)/account');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.mobileBackCircleBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Feather name="chevron-left" size={20} color="#0F172A" />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headingTitleMobile}>Leaderboard</Text>
                  <Text style={styles.headingSubtitleMobile}>
                    Practice consistently. Celebrate your progress.
                  </Text>
                </View>
              </View>
            )}

            {/* PERIOD SEGMENTED CONTROL (Weekly | Monthly | All time) */}
            <View style={[styles.periodTabsContainer, isDesktop && styles.periodTabsContainerDesktop]}>
              {(
                [
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'all_time', label: 'All time' },
                ] as const
              ).map((tab, idx) => {
                const isSelected = period === tab.id;
                return (
                  <React.Fragment key={tab.id}>
                    {idx > 0 && !isSelected && period !== (['weekly', 'monthly', 'all_time'][idx - 1]) && (
                      <View style={styles.periodTabDivider} />
                    )}
                    <Pressable
                      onPress={() => setPeriod(tab.id)}
                      style={[
                        styles.periodTabBtn,
                        isSelected && styles.periodTabBtnActive,
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.periodTabText,
                          isSelected && styles.periodTabTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>

            {/* TOP 3 PODIUM CARD */}
            <View style={[styles.podiumCard, isDesktop && styles.podiumCardDesktop]}>
              {isLoading ? (
                <View style={[styles.podiumColumnsRow, isDesktop && styles.podiumColumnsRowDesktop]}>
                  {/* Skeleton Rank 2 */}
                  <View style={[styles.podiumCol, styles.podiumColSide]}>
                    <View style={styles.podiumAvatarWrap}>
                      <Skeleton
                        width={isDesktop ? 72 : 62}
                        height={isDesktop ? 72 : 62}
                        borderRadius={isDesktop ? 36 : 31}
                      />
                    </View>
                    <View style={[styles.podiumPedestal, styles.podiumPedestalSilver, { gap: 6 }]}>
                      <Skeleton width={68} height={14} borderRadius={6} />
                      <Skeleton width={52} height={12} borderRadius={5} />
                      <Skeleton width={60} height={10} borderRadius={4} />
                    </View>
                  </View>

                  {/* Skeleton Rank 1 */}
                  <View style={[styles.podiumCol, styles.podiumColCenter]}>
                    <View style={{ marginBottom: 6 }}>
                      <Skeleton width={28} height={20} borderRadius={6} />
                    </View>
                    <View style={styles.podiumAvatarWrap}>
                      <Skeleton
                        width={isDesktop ? 84 : 72}
                        height={isDesktop ? 84 : 72}
                        borderRadius={isDesktop ? 42 : 36}
                      />
                    </View>
                    <View style={[styles.podiumPedestal, styles.podiumPedestalGold, { gap: 6 }]}>
                      <Skeleton width={76} height={15} borderRadius={6} />
                      <Skeleton width={56} height={12} borderRadius={5} />
                      <Skeleton width={64} height={10} borderRadius={4} />
                    </View>
                  </View>

                  {/* Skeleton Rank 3 */}
                  <View style={[styles.podiumCol, styles.podiumColSide]}>
                    <View style={styles.podiumAvatarWrap}>
                      <Skeleton
                        width={isDesktop ? 72 : 62}
                        height={isDesktop ? 72 : 62}
                        borderRadius={isDesktop ? 36 : 31}
                      />
                    </View>
                    <View
                      style={[
                        styles.podiumPedestal,
                        isDesktop ? styles.podiumPedestalBronzeDesktop : styles.podiumPedestalBronzeMobile,
                        { gap: 6 },
                      ]}
                    >
                      <Skeleton width={68} height={14} borderRadius={6} />
                      <Skeleton width={52} height={12} borderRadius={5} />
                      <Skeleton width={60} height={10} borderRadius={4} />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.podiumColumnsRow, isDesktop && styles.podiumColumnsRowDesktop]}>
                  {/* LEFT COLUMN: RANK 2 */}
                  <View style={[styles.podiumCol, styles.podiumColSide]}>
                    {top2 ? (
                      <>
                        <View style={styles.podiumAvatarWrap}>
                          <View style={[styles.podiumAvatarHalo, styles.podiumAvatarHaloSilver]}>
                            <LearnerAvatar
                              name={top2.displayName}
                              avatarUrl={top2.avatarUrl}
                              size={isDesktop ? 64 : 54}
                              index={1}
                              isCurrentUser={top2.isCurrentUser}
                            />
                          </View>
                          <View style={styles.podiumMedalBadgeWrap}>
                            <RosetteMedalSvg rank={2} size={isDesktop ? 27 : 24} />
                          </View>
                        </View>

                        <View style={[styles.podiumPedestal, styles.podiumPedestalSilver]}>
                          <Text
                            style={[styles.podiumNameText, !isDesktop && styles.podiumNameTextMobile]}
                            numberOfLines={1}
                          >
                            {top2.displayName.split(' ')[0]}
                          </Text>
                          <Text style={[styles.podiumXpText, !isDesktop && styles.podiumXpTextMobile]}>
                            {top2.xp.toLocaleString()} XP
                          </Text>
                          <Text style={styles.podiumMinutesSubText}>
                            {top2.minutesConsumed ?? 0}m practiced
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={{ height: 90 }} />
                    )}
                  </View>

                  {/* CENTER COLUMN: RANK 1 */}
                  <View style={[styles.podiumCol, styles.podiumColCenter]}>
                    {top1 && (
                      <>
                        <View style={styles.podiumWinnerAvatarSection}>
                          <View style={styles.podiumWinnerCrownWrap}>
                            <CrownSvg size={isDesktop ? 26 : 22} />
                          </View>

                          {/* Arc Confetti Ticks around #1 Avatar */}
                          <View style={styles.confettiOverlayWrap} pointerEvents="none">
                            <ConfettiArcSvg
                              width={isDesktop ? 132 : 112}
                              height={isDesktop ? 84 : 72}
                            />
                          </View>

                          <View style={styles.podiumAvatarWrap}>
                            <View style={[styles.podiumAvatarHalo, styles.podiumAvatarHaloGold]}>
                              <LearnerAvatar
                                name={top1.displayName}
                                avatarUrl={top1.avatarUrl}
                                size={isDesktop ? 76 : 64}
                                index={0}
                                isCurrentUser={top1.isCurrentUser}
                              />
                            </View>
                            <View style={styles.podiumMedalBadgeWrap}>
                              <RosetteMedalSvg rank={1} size={isDesktop ? 30 : 26} />
                            </View>
                          </View>
                        </View>

                        <View style={[styles.podiumPedestal, styles.podiumPedestalGold]}>
                          <Text
                            style={[
                              styles.podiumNameText,
                              styles.podiumNameTextWinner,
                              !isDesktop && styles.podiumNameTextWinnerMobile,
                            ]}
                            numberOfLines={1}
                          >
                            {top1.displayName.split(' ')[0]}
                          </Text>
                          <Text
                            style={[
                              styles.podiumXpText,
                              styles.podiumXpTextWinner,
                              !isDesktop && styles.podiumXpTextMobile,
                            ]}
                          >
                            {top1.xp.toLocaleString()} XP
                          </Text>
                          <Text style={styles.podiumMinutesSubText}>
                            {top1.minutesConsumed ?? 0}m practiced
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* RIGHT COLUMN: RANK 3 */}
                  <View style={[styles.podiumCol, styles.podiumColSide]}>
                    {top3 ? (
                      <>
                        <View style={styles.podiumAvatarWrap}>
                          <View style={[styles.podiumAvatarHalo, styles.podiumAvatarHaloBronze]}>
                            <LearnerAvatar
                              name={top3.displayName}
                              avatarUrl={top3.avatarUrl}
                              size={isDesktop ? 64 : 54}
                              index={2}
                              isCurrentUser={top3.isCurrentUser}
                            />
                          </View>
                          <View style={styles.podiumMedalBadgeWrap}>
                            <RosetteMedalSvg rank={3} size={isDesktop ? 27 : 24} />
                          </View>
                        </View>

                        <View
                          style={[
                            styles.podiumPedestal,
                            isDesktop ? styles.podiumPedestalBronzeDesktop : styles.podiumPedestalBronzeMobile,
                          ]}
                        >
                          <Text
                            style={[styles.podiumNameText, !isDesktop && styles.podiumNameTextMobile]}
                            numberOfLines={1}
                          >
                            {top3.displayName.split(' ')[0]}
                          </Text>
                          <Text style={[styles.podiumXpText, !isDesktop && styles.podiumXpTextMobile]}>
                            {top3.xp.toLocaleString()} XP
                          </Text>
                          <Text style={styles.podiumMinutesSubText}>
                            {top3.minutesConsumed ?? 0}m practiced
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={{ height: 90 }} />
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* LEADERBOARD LIST TABLE CARD */}
            <View style={[styles.tableCard, isDesktop && styles.tableCardDesktop]}>
              {/* Header Row */}
              <View style={[styles.tableHeaderRow, !isDesktop && styles.tableHeaderRowMobile]}>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    isDesktop ? styles.colRankDesktop : styles.colRankMobile,
                  ]}
                >
                  #
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colLearner]}>Learner</Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    isDesktop ? styles.colLevelDesktop : styles.colLevelMobile,
                  ]}
                >
                  Level
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    isDesktop ? styles.colXpDesktop : styles.colXpMobile,
                  ]}
                >
                  XP
                </Text>
              </View>

              {isLoading ? (
                <View style={styles.tableBodyWrap}>
                  {[0, 1, 2, 3, 4, 5].map((skeletonIdx) => (
                    <React.Fragment key={skeletonIdx}>
                      <View style={[styles.tableRow, !isDesktop && styles.tableRowMobile]}>
                        <View style={isDesktop ? styles.colRankDesktop : styles.colRankMobile}>
                          <Skeleton width={18} height={13} borderRadius={4} />
                        </View>

                        <View
                          style={[
                            styles.colLearner,
                            styles.learnerCellRow,
                            !isDesktop && styles.learnerCellRowMobile,
                          ]}
                        >
                          <Skeleton
                            width={isDesktop ? 32 : 28}
                            height={isDesktop ? 32 : 28}
                            borderRadius={isDesktop ? 16 : 14}
                          />
                          <Skeleton width={isDesktop ? 130 : 95} height={14} borderRadius={5} />
                        </View>

                        <View style={isDesktop ? styles.colLevelDesktop : styles.colLevelMobile}>
                          <Skeleton width={44} height={13} borderRadius={4} />
                        </View>

                        <View
                          style={[
                            isDesktop ? styles.colXpDesktop : styles.colXpMobile,
                            { alignItems: 'flex-end', gap: 4 },
                          ]}
                        >
                          <Skeleton width={52} height={13} borderRadius={4} />
                          <Skeleton width={42} height={10} borderRadius={3} />
                        </View>
                      </View>
                      {skeletonIdx < 5 && <View style={styles.tableRowDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <View style={styles.tableBodyWrap}>
                  {tableRows.map((row, idx) => {
                    const isMe = Boolean(row.isCurrentUser);
                    const isLast = idx === tableRows.length - 1;
                    return (
                      <React.Fragment key={row.userId || idx}>
                        <View
                          style={[
                            styles.tableRow,
                            !isDesktop && styles.tableRowMobile,
                            isMe && styles.tableRowHighlighted,
                            isMe && !isDesktop && styles.tableRowHighlightedMobile,
                          ]}
                        >
                          <Text
                            style={[
                              styles.cellRankText,
                              !isDesktop && styles.cellRankTextMobile,
                              isDesktop ? styles.colRankDesktop : styles.colRankMobile,
                              isMe && styles.cellTextHighlighted,
                            ]}
                          >
                            {row.rank && row.rank > 0 ? row.rank : 'N/A'}
                          </Text>

                          <View
                            style={[
                              styles.colLearner,
                              styles.learnerCellRow,
                              !isDesktop && styles.learnerCellRowMobile,
                            ]}
                          >
                            <LearnerAvatar
                              name={row.displayName}
                              avatarUrl={row.avatarUrl}
                              size={isDesktop ? 32 : 28}
                              index={idx}
                              isCurrentUser={isMe}
                            />
                            <Text
                              style={[
                                styles.cellLearnerName,
                                !isDesktop && styles.cellLearnerNameMobile,
                                isMe && styles.cellTextHighlighted,
                              ]}
                              numberOfLines={2}
                            >
                              {row.displayName}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.cellLevelText,
                              !isDesktop && styles.cellLevelTextMobile,
                              isDesktop ? styles.colLevelDesktop : styles.colLevelMobile,
                              isMe && styles.cellTextHighlighted,
                            ]}
                          >
                            Level {row.levelNumber}
                          </Text>

                          <View
                            style={[
                              isDesktop ? styles.colXpDesktop : styles.colXpMobile,
                              { alignItems: 'flex-end' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.cellXpText,
                                !isDesktop && styles.cellXpTextMobile,
                                isMe && styles.cellTextHighlighted,
                              ]}
                            >
                              {row.xp.toLocaleString()} XP
                            </Text>
                            <Text style={styles.cellMinutesSubText}>
                              {row.minutesConsumed ?? 0}m practiced
                            </Text>
                          </View>
                        </View>
                        {!isLast && !isMe && <View style={styles.tableRowDivider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* STICKY BOTTOM MY RANK BAR */}
          <View style={[styles.stickyBottomMyRankOuter, isDesktop && styles.stickyBottomMyRankOuterDesktop]}>
            <View style={[styles.myRankCard, isDesktop && styles.myRankCardDesktop]}>
              {isLoading ? (
                <>
                  <View style={[styles.myRankLeftCol, { gap: 5 }]}>
                    <Skeleton width={48} height={11} borderRadius={4} />
                    <Skeleton width={38} height={24} borderRadius={6} />
                  </View>

                  {isDesktop && <View style={styles.myRankDivider} />}
                  {!isDesktop && <View style={{ width: 16 }} />}

                  <View style={{ marginRight: 11 }}>
                    <Skeleton
                      width={isDesktop ? 42 : 38}
                      height={isDesktop ? 42 : 38}
                      borderRadius={isDesktop ? 21 : 19}
                    />
                  </View>

                  <View style={[styles.myRankInfoCol, { gap: 6 }]}>
                    <Skeleton width={130} height={15} borderRadius={5} />
                    <Skeleton width={155} height={12} borderRadius={4} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.myRankLeftCol}>
                    <Text style={styles.myRankLabel}>My Rank</Text>
                    <Text style={[styles.myRankNumber, !isDesktop && styles.myRankNumberMobile]}>
                      {myEntry.rank && myEntry.rank > 0 ? `#${myEntry.rank}` : 'N/A'}
                    </Text>
                  </View>

                  {isDesktop && <View style={styles.myRankDivider} />}
                  {!isDesktop && <View style={{ width: 16 }} />}

                  <View style={styles.myRankAvatarRing}>
                    <LearnerAvatar
                      name={myEntry.displayName}
                      avatarUrl={myEntry.avatarUrl}
                      size={isDesktop ? 42 : 38}
                      index={0}
                      isCurrentUser={true}
                    />
                  </View>

                  <View style={styles.myRankInfoCol}>
                    <Text
                      style={[styles.myRankUserName, !isDesktop && styles.myRankUserNameMobile]}
                      numberOfLines={1}
                    >
                      {myEntry.displayName}
                    </Text>
                    <View style={styles.myRankMetaRow}>
                      <Text style={styles.myRankMetaText}>Level {myEntry.levelNumber}</Text>
                      <Text style={styles.myRankMetaXp}>{myEntry.xp.toLocaleString()} XP</Text>
                      <Text style={styles.myRankMetaMinutes}>• {myEntry.minutesConsumed ?? 0}m practiced</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <CommonPopup
          visible={activePopup !== null}
          preset={activePopup || 'unlock-premium'}
          levelNumber={stats.currentLevelNumber}
          onClose={() => setActivePopup(null)}
          onPrimaryPress={() => {
            setActivePopup(null);
            router.push('/upgrade');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * Learner Avatar: Shows uploaded profile picture (`avatarUrl`) or first-letter fallback.
 */
function LearnerAvatar({
  name,
  avatarUrl,
  size = 40,
  index = 0,
  isCurrentUser = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  index?: number;
  isCurrentUser?: boolean;
}) {
  const firstLetter = getFirstLetter(name);
  const bgColor = getAvatarBgColor(name, index, isCurrentUser);
  const fontSize = Math.max(13, Math.round(size * 0.4));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            color: '#FFFFFF',
            fontSize,
            ...fontStyle('outfit', 'bold'),
          }}
        >
          {firstLetter}
        </Text>
      )}
    </View>
  );
}

/**
 * Gold Crown SVG above #1 Winner
 */
function CrownSvg({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.85} viewBox="0 0 32 27" fill="none">
      <Path
        d="M3 22L5.5 8.5L11.5 14L16 4.5L20.5 14L26.5 8.5L29 22H3Z"
        fill="#FBBF24"
        stroke="#F59E0B"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Rect x="3" y="23.2" width="26" height="3.2" rx="1.6" fill="#F59E0B" />
      <Circle cx="16" cy="3" r="2" fill="#FBBF24" />
      <Circle cx="5" cy="7" r="1.7" fill="#FBBF24" />
      <Circle cx="27" cy="7" r="1.7" fill="#FBBF24" />
    </Svg>
  );
}

/**
 * Arc Confetti Rays around left & right sides of #1 Winner Avatar (matches Figma Pasted Image 3)
 */
function ConfettiArcSvg({ width = 124, height = 78 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 124 78" fill="none">
      {/* Left arc ticks: top-blue, mid-yellow, bottom-pink */}
      <Rect x="16" y="10" width="7.5" height="3" rx="1.5" transform="rotate(32 16 10)" fill="#2563EB" />
      <Rect x="4" y="34" width="7.5" height="3" rx="1.5" transform="rotate(18 4 34)" fill="#FBBF24" />
      <Rect x="4" y="58" width="7.5" height="3" rx="1.5" transform="rotate(35 4 58)" fill="#F472B6" />

      {/* Right arc ticks: top-yellow, mid-blue, bottom-pink */}
      <Rect x="102" y="14" width="7.5" height="3" rx="1.5" transform="rotate(-34 102 14)" fill="#FBBF24" />
      <Rect x="113" y="36" width="7.5" height="3" rx="1.5" transform="rotate(-28 113 36)" fill="#2563EB" />
      <Rect x="113" y="59" width="7.5" height="3" rx="1.5" transform="rotate(24 113 59)" fill="#F472B6" />
    </Svg>
  );
}

/**
 * Rosette Medal Badge SVG for Podium Ranks 1, 2, 3
 */
function RosetteMedalSvg({ rank, size = 30 }: { rank: 1 | 2 | 3; size?: number }) {
  const palette =
    rank === 1
      ? { outer: '#F59E0B', inner: '#FDE68A', ring: '#D97706', text: '#451A03' }
      : rank === 2
      ? { outer: '#94A3B8', inner: '#F1F5F9', ring: '#64748B', text: '#1E293B' }
      : { outer: '#EA580C', inner: '#FFEDD5', ring: '#C2410C', text: '#431407' };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <Path
          d="M18 1.5L21.7 4.1L26.2 3.7L28.1 7.9L32.3 9.8L31.9 14.3L34.5 18L31.9 21.7L32.3 26.2L28.1 28.1L26.2 32.3L21.7 31.9L18 34.5L14.3 31.9L9.8 32.3L7.9 28.1L3.7 26.2L4.1 21.7L1.5 18L4.1 14.3L3.7 9.8L7.9 7.9L9.8 3.7L14.3 4.1L18 1.5Z"
          fill={palette.outer}
        />
        <Circle
          cx="18"
          cy="18"
          r="11.5"
          fill={palette.inner}
          stroke={palette.ring}
          strokeWidth="1.5"
        />
      </Svg>
      <Text
        style={{
          position: 'absolute',
          fontSize: Math.round(size * 0.44),
          color: palette.text,
          ...fontStyle('outfit', 'extraBold'),
        }}
      >
        {rank}
      </Text>
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
  mainScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 40,
  },
  mainScrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 28,
    paddingBottom: 40,
    maxWidth: 1220,
    alignSelf: 'center',
    width: '100%',
  },

  /* Headers */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headingTitle: {
    fontSize: 28,
    color: '#0F172A',
    letterSpacing: -0.5,
    ...fontStyle('outfit', 'bold'),
  },
  headingSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    ...fontStyle('inter', 'regular'),
  },
  mobileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  mobileBackCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headingTitleMobile: {
    fontSize: 24,
    lineHeight: 30,
    color: '#0F172A',
    letterSpacing: -0.4,
    ...fontStyle('outfit', 'bold'),
  },
  headingSubtitleMobile: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 2,
    ...fontStyle('inter', 'regular'),
  },

  /* Period Tabs */
  periodTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    marginBottom: 16,
  },
  periodTabsContainerDesktop: {
    maxWidth: 520,
  },
  periodTabBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabBtnActive: {
    backgroundColor: '#0D4EFD',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(13, 78, 253, 0.25)',
      } as any,
    }),
  },
  periodTabDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  periodTabText: {
    fontSize: 13.5,
    color: '#475569',
    ...fontStyle('inter', 'semiBold'),
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },

  /* Podium Card */
  podiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
      } as any,
    }),
  },
  podiumCardDesktop: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  podiumColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  podiumColumnsRowDesktop: {
    gap: 16,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 210,
  },
  podiumColSide: {
    paddingTop: 18,
  },
  podiumColCenter: {
    paddingTop: 0,
  },
  podiumWinnerAvatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  podiumWinnerCrownWrap: {
    marginBottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  confettiOverlayWrap: {
    position: 'absolute',
    top: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  podiumAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
    zIndex: 2,
  },
  podiumAvatarHalo: {
    borderRadius: 999,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarHaloGold: {
    backgroundColor: '#FFF6D6',
    borderWidth: 2.5,
    borderColor: '#FDE68A',
  },
  podiumAvatarHaloSilver: {
    backgroundColor: '#E6F2FF',
    borderWidth: 2.5,
    borderColor: '#CFE5FF',
  },
  podiumAvatarHaloBronze: {
    backgroundColor: '#FFEBF0',
    borderWidth: 2.5,
    borderColor: '#FFD6E0',
  },
  podiumMedalBadgeWrap: {
    position: 'absolute',
    bottom: -10,
    zIndex: 5,
  },
  podiumPedestal: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  podiumPedestalGold: {
    backgroundColor: '#FFF9E5',
    paddingTop: 14,
    paddingBottom: 14,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #FFF5D1 0%, #FFFDF5 70%, #FFFFFF 100%)',
      } as any,
    }),
  },
  podiumPedestalSilver: {
    backgroundColor: '#F0F7FF',
    paddingTop: 11,
    paddingBottom: 10,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #EAF3FF 0%, #F8FBFF 70%, #FFFFFF 100%)',
      } as any,
    }),
  },
  podiumPedestalBronzeDesktop: {
    backgroundColor: '#FFF2F4',
    paddingTop: 11,
    paddingBottom: 10,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #FFECEF 0%, #FFF9FA 70%, #FFFFFF 100%)',
      } as any,
    }),
  },
  podiumPedestalBronzeMobile: {
    backgroundColor: '#F0F7FF',
    paddingTop: 11,
    paddingBottom: 10,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #EAF3FF 0%, #F8FBFF 70%, #FFFFFF 100%)',
      } as any,
    }),
  },
  podiumNameText: {
    fontSize: 14,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  podiumNameTextMobile: {
    fontSize: 12.5,
  },
  podiumNameTextWinner: {
    fontSize: 15,
  },
  podiumNameTextWinnerMobile: {
    fontSize: 13.5,
  },
  podiumXpText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    ...fontStyle('inter', 'medium'),
  },
  podiumXpTextMobile: {
    fontSize: 11.5,
  },
  podiumXpTextWinner: {
    fontSize: 13,
  },
  podiumMinutesSubText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
    ...fontStyle('inter', 'regular'),
  },

  /* Leaderboard Table Card */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
      } as any,
    }),
  },
  tableCardDesktop: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableHeaderRowMobile: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tableHeaderCell: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  tableBodyWrap: {
    marginTop: 3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8.5,
    borderRadius: 10,
  },
  tableRowMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableRowHighlighted: {
    backgroundColor: '#EAF2FF',
  },
  tableRowHighlightedMobile: {
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  tableRowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 10,
  },
  colRankDesktop: {
    width: 40,
  },
  colRankMobile: {
    width: 28,
  },
  colLearner: {
    flex: 1,
    paddingRight: 8,
  },
  colLevelDesktop: {
    width: 78,
  },
  colLevelMobile: {
    width: 52,
  },
  colXpDesktop: {
    width: 88,
    textAlign: 'right',
  },
  colXpMobile: {
    width: 64,
    textAlign: 'right',
  },
  learnerCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  learnerCellRowMobile: {
    gap: 8,
  },
  cellRankText: {
    fontSize: 13,
    color: '#334155',
    ...fontStyle('inter', 'semiBold'),
  },
  cellRankTextMobile: {
    fontSize: 12,
  },
  cellLearnerName: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 17,
    color: '#0F172A',
    ...fontStyle('inter', 'semiBold'),
  },
  cellLearnerNameMobile: {
    fontSize: 12.5,
    lineHeight: 15.5,
  },
  cellLevelText: {
    fontSize: 12.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  cellLevelTextMobile: {
    fontSize: 11.5,
  },
  cellXpText: {
    fontSize: 13,
    color: '#475569',
    ...fontStyle('inter', 'medium'),
  },
  cellXpTextMobile: {
    fontSize: 12,
  },
  cellMinutesSubText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
    ...fontStyle('inter', 'regular'),
  },
  cellTextHighlighted: {
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
  },

  /* Sticky Bottom My Rank Bar */
  stickyBottomMyRankOuter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        elevation: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
    }),
  },
  stickyBottomMyRankOuterDesktop: {
    paddingHorizontal: 38,
    paddingTop: 10,
    paddingBottom: 14,
  },
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  myRankCardDesktop: {
    maxWidth: 1220,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  myRankLeftCol: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  myRankLabel: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  myRankNumber: {
    fontSize: 24,
    lineHeight: 29,
    color: '#0D4EFD',
    marginTop: 1,
    ...fontStyle('outfit', 'extraBold'),
  },
  myRankNumberMobile: {
    fontSize: 21,
    lineHeight: 26,
  },
  myRankDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 18,
  },
  myRankAvatarRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#60A5FA',
    padding: 1.5,
    marginRight: 11,
  },
  myRankInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  myRankUserName: {
    fontSize: 14.5,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  myRankUserNameMobile: {
    fontSize: 13.5,
  },
  myRankMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  myRankMetaText: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  myRankMetaXp: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  myRankMetaMinutes: {
    fontSize: 11.5,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
});
