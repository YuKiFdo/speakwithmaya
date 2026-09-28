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
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';
import { Fonts, fontStyle } from '@/theme/fonts';
import {
  HomeNavIcon,
  RoadmapNavIcon,
  HistoryNavIcon,
  AccountNavIcon,
  LockIcon,
} from '@/components/icons/nav-icons';
import {
  RoadmapRobotIcon,
  RoadmapChatIcon,
  RoadmapCheckIcon,
  RoadmapFamilyIcon,
  RoadmapHomeIcon,
  RoadmapWaveIcon,
  RoadmapDirectionsIcon,
} from '@/components/icons/roadmap-icons';
import { DesktopSidebar, DashboardTab } from '@/components/navigation/desktop-sidebar';
import { CommonPopup, PopupPreset } from '@/components/ui/common-popup';
import { UserLevelBadge } from '@/components/ui/user-level-badge';

interface MilestoneItem {
  id: string;
  number: string;
  title: string;
  sessionTime: string;
  status: 'completed' | 'in-progress' | 'locked';
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  align?: 'left' | 'right';
  numberColor: string;
  haloColor: string;
  haloBorderColor?: string;
  innerBg: string;
}

const MILESTONES: MilestoneItem[] = [
  {
    id: '01',
    number: '01',
    title: 'Meet your AI partner',
    sessionTime: 'Session time · 5 min',
    status: 'completed',
    iconType: 'robot',
    align: 'left',
    numberColor: '#0057FF',
    haloColor: '#EFF6FF',
    haloBorderColor: '#BFDBFE',
    innerBg: '#FFFFFF',
  },
  {
    id: '02',
    number: '02',
    title: 'Talking about your day',
    sessionTime: 'Session time · 5 min',
    status: 'in-progress',
    iconType: 'chat',
    align: 'right',
    numberColor: '#9333EA',
    haloColor: '#FAF5FF',
    haloBorderColor: '#E9D5FF',
    innerBg: '#FFFFFF',
  },
  {
    id: '03',
    number: '03',
    title: 'Family and friends',
    sessionTime: 'Session time · 10 min',
    status: 'locked',
    iconType: 'family',
    align: 'left',
    numberColor: '#E11D48',
    haloColor: '#FFF1F2',
    haloBorderColor: '#FECDD3',
    innerBg: '#FFFFFF',
  },
  {
    id: '04',
    number: '04',
    title: 'Describing your home town',
    sessionTime: 'Session time · 10 min',
    status: 'locked',
    iconType: 'home',
    align: 'right',
    numberColor: '#16A34A',
    haloColor: '#F0FDF4',
    haloBorderColor: '#BBF7D0',
    innerBg: '#FFFFFF',
  },
  {
    id: '05',
    number: '05',
    title: 'Greetings & introductions in public',
    sessionTime: 'Session time · 10 min',
    status: 'locked',
    iconType: 'wave',
    align: 'left',
    numberColor: '#F59E0B',
    haloColor: '#FFFBEB',
    haloBorderColor: '#FDE68A',
    innerBg: '#FFFFFF',
  },
  {
    id: '06',
    number: '06',
    title: 'Asking for directions',
    sessionTime: 'Session time · 10 min',
    status: 'locked',
    iconType: 'directions',
    align: 'right',
    numberColor: '#0057FF',
    haloColor: '#EFF6FF',
    haloBorderColor: '#BFDBFE',
    innerBg: '#FFFFFF',
  },
  {
    id: '07',
    number: '07',
    title: 'Asking for directions',
    sessionTime: 'Session time · 10 min',
    status: 'locked',
    iconType: 'directions',
    align: 'left',
    numberColor: '#0057FF',
    haloColor: '#EFF6FF',
    haloBorderColor: '#BFDBFE',
    innerBg: '#FFFFFF',
  },
];

export default function RoadmapScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name || 'Shehal';
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<DashboardTab>('roadmap');
  const [isPro, setIsPro] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupPreset | null>(null);

  // Responsive full-width calculations for desktop track & milestone columns:
  const [layoutTrackWidth, setLayoutTrackWidth] = useState<number | null>(null);
  const trackWidth = layoutTrackWidth ?? (isDesktop ? Math.max(900, windowWidth - 340) : windowWidth - 40);

  const xLeft = 40;
  const xRight = Math.max(860, trackWidth - 40);
  const R = 90;
  const desktopYStart = 200;
  const desktopRowStep = 180;
  const lastIdx = MILESTONES.length - 1;
  const finalR = Math.max(0, Math.floor(lastIdx / 2));
  const finalCol = lastIdx >= 0 ? lastIdx % 2 : 0;
  const desktopRowCount = finalR + 1;
  const desktopTrackHeight = desktopYStart + finalR * desktopRowStep + 90;

  // Symmetrically distribute column 1 and column 2 across the full container width:
  const col1X = Math.round(xLeft + (xRight - xLeft) * 0.16);
  const col2X = Math.round(xLeft + (xRight - xLeft) * 0.54);

  // Dynamically generate Desktop Serpentine Track:
  // Starts directly at the 1st milestone anchor point (col1X) and ends directly at the final milestone
  let desktopSvgPath = '';
  if (MILESTONES.length === 1) {
    desktopSvgPath = `M ${col1X} ${desktopYStart} L ${col1X} ${desktopYStart}`;
  } else if (MILESTONES.length > 1) {
    desktopSvgPath = `M ${col1X} ${desktopYStart}`;

    for (let r = 0; r <= finalR; r++) {
      const yRow = desktopYStart + r * desktopRowStep;
      const isFinalRow = r === finalR;

      if (r === 0) {
        if (isFinalRow) {
          // Row 0 is final (2 items: index 0 at col1X, index 1 at col2X)
          desktopSvgPath += ` L ${col2X} ${yRow}`;
        } else {
          // More rows follow: line to right turn and curve down to row 1
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
        }
      } else if (r % 2 === 1) {
        // Odd row: moving Right to Left
        // Current position is at (xRight - R, yRow)
        if (isFinalRow) {
          // Stops at col1X (where the final milestone in this row is)
          desktopSvgPath += ` L ${col1X} ${yRow}`;
        } else {
          // More rows follow: line to left turn and curve down to next row
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xLeft + R} ${yRow} A ${R} ${R} 0 0 0 ${xLeft + R} ${yNext}`;
        }
      } else {
        // Even row (r >= 2): moving Left to Right
        // Current position is at (xLeft + R, yRow)
        if (isFinalRow) {
          // Stops at final milestone in this row
          const targetX = finalCol === 0 ? col1X : col2X;
          desktopSvgPath += ` L ${targetX} ${yRow}`;
        } else {
          // More rows follow: line to right turn and curve down to next row
          const yNext = desktopYStart + (r + 1) * desktopRowStep;
          desktopSvgPath += ` L ${xRight - R} ${yRow} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext}`;
        }
      }
    }
  }

  // Responsive calculations for mobile track & milestone positions:
  const [layoutMobileWidth, setLayoutMobileWidth] = useState<number | null>(null);
  const mobileWidth = layoutMobileWidth ?? (!isDesktop ? Math.min(windowWidth - 40, 420) : 350);

  // Mobile serpentine geometry (Natural default circular arcs A R R + Desktop Inner Shadow)
  const mobileR = 64;
  const mobileTierHeight = mobileR * 2; // 128
  const mobileIconSize = 62;
  const mobileYDropLen = 26;
  const mobileYTrack1 = 88;

  const mobileIconLeftX = 10 + mobileR; // 74
  const mobileIconRightX = mobileWidth - (10 + mobileR); // mobileWidth - 74

  const mobileTotalHeight =
    MILESTONES.length > 0
      ? mobileYTrack1 + (MILESTONES.length - 1) * mobileTierHeight + 92
      : 820;

  // Dynamically generate Mobile Serpentine Track:
  // Starts at 1st milestone and ends directly at the final milestone
  let mobileSvgPath = '';
  if (MILESTONES.length === 1) {
    mobileSvgPath = `M ${mobileIconLeftX} ${mobileYTrack1} L ${mobileIconLeftX} ${mobileYTrack1}`;
  } else if (MILESTONES.length > 1) {
    mobileSvgPath = `M ${mobileIconLeftX} ${mobileYTrack1} L ${mobileIconRightX} ${mobileYTrack1}`;
    for (let i = 0; i < MILESTONES.length - 1; i++) {
      const yNext = mobileYTrack1 + (i + 1) * mobileTierHeight;
      const isLastStep = i === MILESTONES.length - 2;

      if (i % 2 === 0) {
        mobileSvgPath += ` A ${mobileR} ${mobileR} 0 0 1 ${mobileIconRightX} ${yNext}`;
        if (!isLastStep) {
          mobileSvgPath += ` L ${mobileIconLeftX} ${yNext}`;
        }
      } else {
        mobileSvgPath += ` A ${mobileR} ${mobileR} 0 0 0 ${mobileIconLeftX} ${yNext}`;
        if (!isLastStep) {
          mobileSvgPath += ` L ${mobileIconRightX} ${yNext}`;
        }
      }
    }
  }

  const handleSelectTab = (tab: DashboardTab) => {
    if (tab === 'home') {
      router.push({ pathname: '/dashboard', params });
    } else if (tab === 'history') {
      router.push({ pathname: '/history', params });
    } else if (tab === 'account') {
      router.push({ pathname: '/account', params });
    } else {
      setActiveTab(tab);
    }
  };

  const handleMilestonePress = (item: MilestoneItem) => {
    if (item.status === 'locked' && !isPro) {
      setActivePopup('unlock-premium');
    } else {
      router.push({
        pathname: '/onboarding/connecting',
        params,
      });
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
            activeTab="roadmap"
            onSelectTab={handleSelectTab}
            isPro={isPro}
            onUpgrade={() => router.push('/upgrade')}
            onGetExtraTime={() => setActivePopup('get-extra-time')}
          />
        )}

        {/* ==================================================================== */}
        {/* MAIN CONTAINER WITH FIXED MOBILE TOP BAR */}
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
                  <Text style={styles.headingTitle}>Your Learning Roadmap</Text>
                  <Text style={styles.headingSubtitle}>
                    Your journey to fluency starts here!
                  </Text>
                </View>

                {/* User Level Badge */}
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
              <Text style={styles.headingTitleMobile}>Your Learning Roadmap</Text>
              <Text style={styles.headingSubtitleMobile}>
                Your journey to fluency starts here!
              </Text>
            </View>
          )}

          {/* ==================================================================== */}
          {/* ROADMAP TRACK & MILESTONES */}
          {/* ==================================================================== */}
          {isDesktop ? (
            /* ================================================================ */
            /* DESKTOP ROADMAP (100% FULL WIDTH WITH ACCURATE CONNECTIONS)      */
            /* ================================================================ */
            <View
              style={[styles.roadmapTrackContainerDesktop, { height: desktopTrackHeight }]}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - trackWidth) > 5) {
                  setLayoutTrackWidth(w);
                }
              }}
            >
              <Svg
                style={StyleSheet.absoluteFill}
                width={trackWidth}
                height={desktopTrackHeight}
                viewBox={`0 0 ${trackWidth} ${desktopTrackHeight}`}
              >
                {/* 1. Outer Emboss / Bevel Shadow */}
                <Path
                  d={desktopSvgPath}
                  stroke="#c8c8c8ff"
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.65}
                />

                {/* 2. Main Track Bed */}
                <Path
                  d={desktopSvgPath}
                  stroke="#f2f2f2ff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 3. Inner Inset Shadow (Recessed Groove Depth) */}
                <Path
                  d={desktopSvgPath}
                  stroke="rgba(201, 201, 201, 0.09)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 4. Center Core Inset Highlight */}
                <Path
                  d={desktopSvgPath}
                  stroke="rgba(235, 235, 235, 0.75)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Vertical Dotted Drops from Card Icons down to Anchors */}
                {MILESTONES.map((_, idx) => {
                  const r = Math.floor(idx / 2);
                  const x = idx % 2 === 0 ? col1X : col2X;
                  const trackY = desktopYStart + r * desktopRowStep;
                  const dropYStart = 128 + r * desktopRowStep;
                  return (
                    <Line
                      key={`desktop-drop-${idx}`}
                      x1={x}
                      y1={dropYStart}
                      x2={x}
                      y2={trackY}
                      stroke="#93C5FD"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {/* Blue Glow Anchor Dots on the Track */}
                {MILESTONES.map((_, idx) => {
                  const r = Math.floor(idx / 2);
                  const x = idx % 2 === 0 ? col1X : col2X;
                  const trackY = desktopYStart + r * desktopRowStep;
                  return (
                    <React.Fragment key={`desktop-dot-${idx}`}>
                      <Circle cx={x} cy={trackY} r={10} fill="rgba(0, 87, 255, 0.18)" />
                      <Circle cx={x} cy={trackY} r={5} fill="#0057FF" stroke="#FFFFFF" strokeWidth={1.8} />
                    </React.Fragment>
                  );
                })}
              </Svg>

              {/* Milestone Cards Overlay - Symmetrically Distributed Across Full Width */}
              {MILESTONES.map((item, idx) => {
                const r = Math.floor(idx / 2);
                const x = idx % 2 === 0 ? col1X : col2X;
                const cardTop = 40 + r * desktopRowStep;
                return (
                  <View
                    key={item.id}
                    style={[styles.desktopCardSlot, { top: cardTop, left: x - 44 }]}
                  >
                    <MilestoneCardDesktop
                      item={item}
                      onPress={() => handleMilestonePress(item)}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            /* ================================================================ */
            /* MOBILE SERPENTINE ROADMAP (MATCHES DESKTOP INNER SHADOW & NODES) */
            /* ================================================================ */
            <View
              style={[styles.mobileRoadmapContainer, { height: mobileTotalHeight }]}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - mobileWidth) > 3) {
                  setLayoutMobileWidth(w);
                }
              }}
            >
              {/* Background SVG Serpentine Track with 3D Inner Shadow (Matches Desktop) */}
              <Svg
                style={StyleSheet.absoluteFill}
                width={mobileWidth}
                height={mobileTotalHeight}
                viewBox={`0 0 ${mobileWidth} ${mobileTotalHeight}`}
              >
                {/* 1. Outer Emboss / Bevel Shadow */}
                <Path
                  d={mobileSvgPath}
                  stroke="#c8c8c8ff"
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.65}
                />

                {/* 2. Main Track Bed */}
                <Path
                  d={mobileSvgPath}
                  stroke="#f2f2f2ff"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 3. Inner Inset Shadow (Recessed Groove Depth) */}
                <Path
                  d={mobileSvgPath}
                  stroke="rgba(201, 201, 201, 0.09)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* 4. Center Core Inset Highlight */}
                <Path
                  d={mobileSvgPath}
                  stroke="rgba(235, 235, 235, 0.75)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Vertical Dotted Drops from Card Avatar bottom down to Track Dots */}
                {MILESTONES.map((_, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  const yStart = yTrack - mobileYDropLen;
                  return (
                    <Line
                      key={`mobile-drop-${idx}`}
                      x1={x}
                      y1={yStart}
                      x2={x}
                      y2={yTrack}
                      stroke="#93C5FD"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {/* Blue Glow Anchor Dots on the Track */}
                {MILESTONES.map((_, idx) => {
                  const x = idx % 2 === 0 ? mobileIconLeftX : mobileIconRightX;
                  const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                  return (
                    <React.Fragment key={`mobile-dot-${idx}`}>
                      <Circle
                        cx={x}
                        cy={yTrack}
                        r={10}
                        fill="rgba(0, 87, 255, 0.18)"
                      />
                      <Circle
                        cx={x}
                        cy={yTrack}
                        r={5}
                        fill="#0057FF"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    </React.Fragment>
                  );
                })}
              </Svg>

              {/* Absolute Floating Milestone Nodes (Same floating style as desktop, no card box) */}
              {MILESTONES.map((item, idx) => {
                const isLeft = idx % 2 === 0;
                const yTrack = mobileYTrack1 + idx * mobileTierHeight;
                const slotTop = yTrack - mobileYDropLen - mobileIconSize;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.mobileNodeSlot,
                      {
                        top: slotTop,
                        ...(isLeft
                          ? { left: mobileIconLeftX - mobileIconSize / 2 }
                          : { right: mobileWidth - mobileIconRightX - mobileIconSize / 2 }),
                        maxWidth: mobileWidth - 36,
                      },
                    ]}
                  >
                    <MilestoneCardMobile
                      item={item}
                      isLeft={isLeft}
                      onPress={() => handleMilestonePress(item)}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Bottom extra scroll clearance */}
          <View style={{ height: 80 }} />
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
              onPress={() => setActiveTab('roadmap')}
            >
              <RoadmapNavIcon active={true} size={24} color="#0057FF" />
              <Text style={[styles.mobileTabLabel, styles.mobileTabLabelActive]}>
                Roadmap
              </Text>
              <View style={styles.activeIndicatorDot} />
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
              onPress={() => router.push({ pathname: '/account', params })}
            >
              <AccountNavIcon active={false} size={24} />
              <Text style={styles.mobileTabLabel}>Account</Text>
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
 * Milestone Icon Renderer
 */
function MilestoneIcon({ type, size = 30 }: { type: MilestoneItem['iconType']; size?: number }) {
  switch (type) {
    case 'robot':
      return <RoadmapRobotIcon size={size} />;
    case 'chat':
      return <RoadmapChatIcon size={size} />;
    case 'family':
      return <RoadmapFamilyIcon size={size} />;
    case 'home':
      return <RoadmapHomeIcon size={size} />;
    case 'wave':
      return <RoadmapWaveIcon size={size} />;
    case 'directions':
      return <RoadmapDirectionsIcon size={size} />;
    default:
      return <LockIcon color="#94A3B8" size={Math.round(size * 0.7)} />;
  }
}

function getBorderColor(id: string) {
  switch (id) {
    case '01':
      return '#BFDBFE';
    case '02':
      return '#E9D5FF';
    case '03':
      return '#FECDD3';
    case '04':
      return '#A7F3D0';
    case '05':
      return '#FDE68A';
    case '06':
      return '#BFDBFE';
    default:
      return '#E2E8F0';
  }
}

/**
 * Desktop Milestone Node Component
 */
function MilestoneCardDesktop({
  item,
  onPress,
}: {
  item: MilestoneItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.milestoneCardDesktop,
        pressed && styles.milestoneCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Milestone ${item.number}: ${item.title}`}
    >
      <View style={[styles.haloCircleDesktop, { backgroundColor: item.haloColor, borderColor: item.haloBorderColor || getBorderColor(item.id) }]}>
        <View style={styles.innerIconCircleDesktop}>
          <MilestoneIcon type={item.iconType} />
        </View>

        {item.status === 'completed' && (
          <View style={styles.checkBadgeWrapper}>
            <RoadmapCheckIcon size={22} />
          </View>
        )}
      </View>

      <View style={styles.milestoneTextCol}>
        <View style={styles.numberBadgeRow}>
          <Text style={[styles.milestoneNumber, { color: item.numberColor }]}>
            {item.number}
          </Text>
          {item.status === 'completed' && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>COMPLETED</Text>
            </View>
          )}
        </View>

        <Text style={styles.milestoneTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.milestoneSessionTime}>{item.sessionTime}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Mobile Milestone Node Component (Matches Desktop Floating Style without Card Box)
 */
function MilestoneCardMobile({
  item,
  isLeft = true,
  onPress,
}: {
  item: MilestoneItem;
  isLeft?: boolean;
  onPress: () => void;
}) {
  const borderColor = item.haloBorderColor || getBorderColor(item.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.mobileMilestoneNode,
        isLeft ? styles.mobileMilestoneNodeLeft : styles.mobileMilestoneNodeRight,
        pressed && styles.milestoneCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Milestone ${item.number}: ${item.title}`}
    >
      {/* LEFT ALIGNED: Avatar on Left, Text on Right */}
      {isLeft ? (
        <>
          <View
            style={[
              styles.haloCircleMobile,
              { backgroundColor: item.haloColor, borderColor },
            ]}
          >
            <View style={styles.innerIconCircleMobile}>
              <MilestoneIcon type={item.iconType} size={24} />
            </View>

            {item.status === 'completed' && (
              <View style={styles.checkBadgeWrapperMobile}>
                <RoadmapCheckIcon size={18} />
              </View>
            )}
          </View>

          <View style={[styles.mobileNodeTextCol, { marginLeft: 12 }]}>
            <View style={styles.numberBadgeRowMobile}>
              <Text style={[styles.milestoneNumberMobile, { color: item.numberColor }]}>
                {item.number}
              </Text>
              {item.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>COMPLETED</Text>
                </View>
              )}
            </View>
            <Text style={styles.milestoneTitleMobile} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.milestoneSessionTimeMobile}>
              {item.sessionTime}
            </Text>
          </View>
        </>
      ) : (
        /* RIGHT ALIGNED: Text on Left, Avatar on Right */
        <>
          <View style={[styles.mobileNodeTextCol, { marginRight: 12, alignItems: 'flex-end' }]}>
            <View style={[styles.numberBadgeRowMobile, { justifyContent: 'flex-end' }]}>
              {item.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>COMPLETED</Text>
                </View>
              )}
              <Text style={[styles.milestoneNumberMobile, { color: item.numberColor }]}>
                {item.number}
              </Text>
            </View>
            <Text style={[styles.milestoneTitleMobile, { textAlign: 'right' }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.milestoneSessionTimeMobile, { textAlign: 'right' }]}>
              {item.sessionTime}
            </Text>
          </View>

          <View
            style={[
              styles.haloCircleMobile,
              { backgroundColor: item.haloColor, borderColor },
            ]}
          >
            <View style={styles.innerIconCircleMobile}>
              <MilestoneIcon type={item.iconType} size={24} />
            </View>

            {item.status === 'completed' && (
              <View style={styles.checkBadgeWrapperMobile}>
                <RoadmapCheckIcon size={18} />
              </View>
            )}
          </View>
        </>
      )}
    </Pressable>
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
    backgroundColor: '#ffffff',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainScrollDesktop: {
    marginLeft: 0,
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90, // room for mobile tabs (matches home/dashboard)
  },
  mainScrollContentDesktop: {
    paddingHorizontal: 38,
    paddingTop: 16,
    paddingBottom: 24,
    maxWidth: 1600,
    alignSelf: 'center',
    width: '100%',
    flexGrow: 1,
  },

  /* Desktop Header */
  desktopTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headingTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 30,
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headingSubtitle: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 14.5,
    color: '#64748B',
    marginTop: 3,
  },

  /* User Badge Row — now handled by <UserLevelBadge /> */

  /* Mobile Fixed Top Bar (Pinned at top) */
  mobileFixedTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
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
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headingSubtitleMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },

  /* Desktop Roadmap Track (Matches Image 2 reference, 100% full width) */
  roadmapTrackContainerDesktop: {
    position: 'relative',
    width: '100%',
    height: 680,
    marginTop: 20,
  },
  desktopCardSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  milestoneCardDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 360,
    gap: 18,
    paddingVertical: 4,
  },
  haloCircleDesktop: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.04)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  innerIconCircleDesktop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        }),
  },

  /* ==================================================================== */
  /* MOBILE SERPENTINE ROADMAP STYLING (FLOATING NODES, NO CARD BOX)     */
  /* ==================================================================== */
  mobileRoadmapContainer: {
    position: 'relative',
    width: '100%',
    height: 820,
    marginTop: 8,
  },
  mobileNodeSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  mobileMilestoneNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
  },
  mobileMilestoneNodeLeft: {
    gap: 12,
  },
  mobileMilestoneNodeRight: {
    gap: 12,
  },
  haloCircleMobile: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.04)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  innerIconCircleMobile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        }),
  },
  checkBadgeWrapperMobile: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  mobileNodeTextCol: {
    flexShrink: 1,
    maxWidth: 220,
  },
  numberBadgeRowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  milestoneNumberMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    letterSpacing: 0.1,
  },
  milestoneTitleMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13.5,
    color: '#0F172A',
    lineHeight: 17.5,
  },
  milestoneSessionTimeMobile: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Common Components */
  milestoneCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  checkBadgeWrapper: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  milestoneTextCol: {
    flex: 1,
  },
  numberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  milestoneNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    letterSpacing: -0.2,
  },
  completedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  completedBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#10B981',
    letterSpacing: 0.4,
  },
  milestoneTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
    lineHeight: 22,
  },
  milestoneSessionTime: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
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
  },
  mobileTabLabel: {
    fontFamily: Fonts.outfit.medium,
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 3,
  },
  mobileTabLabelActive: {
    color: '#0057FF',
    fontFamily: Fonts.outfit.bold,
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0057FF',
    marginTop: 3,
  },
});
