import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Radii } from '@/theme/tokens';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Universal pulsing Skeleton placeholder component.
 * Shimmers smoothly between opacity 0.45 and 1.0.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
  children,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export interface RoadmapTrackSkeletonProps {
  isDesktop?: boolean;
  trackWidth?: number;
  mobileWidth?: number;
}

/**
 * High-fidelity Roadmap Track Skeleton matching the authentic serpentine S-curve design.
 * Features alternating circular milestone nodes, drop dashed lines, and anchor dots.
 */
export function RoadmapTrackSkeleton({
  isDesktop = false,
  trackWidth: trackWidthProp,
  mobileWidth: mobileWidthProp,
}: RoadmapTrackSkeletonProps) {
  const { width: windowWidth } = useWindowDimensions();

  /* ==================================================================== */
  /* DESKTOP SERPENTINE ROADMAP SKELETON                                 */
  /* ==================================================================== */
  if (isDesktop) {
    const calcTrackWidth = trackWidthProp ?? Math.max(900, windowWidth - 340);
    const xLeft = 40;
    const xRight = Math.max(860, calcTrackWidth - 40);
    const R = 90;
    const desktopYStart = 200;
    const desktopRowStep = 225;
    const desktopTrackHeight = desktopYStart + desktopRowStep + 100;
    const col1X = Math.round(xLeft + (xRight - xLeft) * 0.16);
    const col2X = Math.round(xLeft + (xRight - xLeft) * 0.54);

    let desktopSvgPath = `M ${col1X} ${desktopYStart} L ${col2X} ${desktopYStart}`;
    const yNext = desktopYStart + desktopRowStep;
    if (desktopRowStep > 2 * R) {
      desktopSvgPath += ` L ${xRight - R} ${desktopYStart} A ${R} ${R} 0 0 1 ${xRight} ${desktopYStart + R} L ${xRight} ${yNext - R} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext} L ${col2X} ${yNext} L ${col1X} ${yNext}`;
    } else {
      desktopSvgPath += ` L ${xRight - R} ${desktopYStart} A ${R} ${R} 0 0 1 ${xRight - R} ${yNext} L ${col2X} ${yNext} L ${col1X} ${yNext}`;
    }

    const desktopItems = [0, 1, 2, 3];

    return (
      <View style={[styles.roadmapSkeletonDesktopContainer, { height: desktopTrackHeight }]}>
        {/* SVG Serpentine Track Groove and Drop Connectors */}
        <Svg
          style={StyleSheet.absoluteFill}
          width={calcTrackWidth}
          height={desktopTrackHeight}
          viewBox={`0 0 ${calcTrackWidth} ${desktopTrackHeight}`}
        >
          {/* Track Bed Outer Bevel */}
          <Path
            d={desktopSvgPath}
            stroke="#E2E8F0"
            strokeWidth="13"
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Track Bed Inner Groove */}
          <Path
            d={desktopSvgPath}
            stroke="#F8FAFC"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Dotted Drops & Anchor Dots for each node */}
          {desktopItems.map((idx) => {
            const r = Math.floor(idx / 2);
            const isReversedRow = r % 2 === 1;
            const x = isReversedRow
              ? (idx % 2 === 0 ? col2X : col1X)
              : (idx % 2 === 0 ? col1X : col2X);
            const trackY = desktopYStart + r * desktopRowStep;
            const cardTop = 40 + r * desktopRowStep;
            const yStart = cardTop + 82;

            return (
              <React.Fragment key={`dt-skel-drop-${idx}`}>
                <Line
                  x1={x}
                  y1={yStart}
                  x2={x}
                  y2={trackY}
                  stroke="#CBD5E1"
                  strokeWidth="1.8"
                  strokeDasharray="3,3"
                />
                <Circle cx={x} cy={trackY} r={11} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} />
                <Circle cx={x} cy={trackY} r={5} fill="#CBD5E1" />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* 4 Alternating Desktop Card Slots */}
        {desktopItems.map((idx) => {
          const r = Math.floor(idx / 2);
          const isReversedRow = r % 2 === 1;
          const x = isReversedRow
            ? (idx % 2 === 0 ? col2X : col1X)
            : (idx % 2 === 0 ? col1X : col2X);
          const cardTop = 40 + r * desktopRowStep;

          return (
            <View
              key={`dt-skel-card-${idx}`}
              style={[styles.roadmapSkeletonDesktopCardSlot, { top: cardTop, left: x - 44 }]}
            >
              <View style={styles.roadmapSkeletonDesktopCardRow}>
                <View style={styles.roadmapSkeletonHaloCircleDesktop}>
                  <Skeleton width={68} height={68} borderRadius={34} />
                </View>
                <View style={styles.roadmapSkeletonDesktopTextCol}>
                  <Skeleton width={32} height={18} borderRadius={Radii.pill} style={{ marginBottom: 8 }} />
                  <Skeleton width={180} height={18} borderRadius={5} style={{ marginBottom: 6 }} />
                  <Skeleton width={110} height={13} borderRadius={4} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  /* ==================================================================== */
  /* MOBILE SERPENTINE ROADMAP SKELETON                                  */
  /* ==================================================================== */
  const calcMobileWidth = mobileWidthProp ?? Math.min(windowWidth - 40, 420);
  const mobileR = 64;
  const mobileTierHeight = 128;
  const mobileIconSize = 62;
  const mobileYDropLen = 26;
  const mobileYTrack1 = 88;
  const mobileIconLeftX = 10 + mobileR; // 74
  const mobileIconRightX = calcMobileWidth - (10 + mobileR); // calcMobileWidth - 74
  const mobileTotalHeight = mobileYTrack1 + 3 * mobileTierHeight + 92;

  let mobileSvgPath = `M ${mobileIconLeftX} ${mobileYTrack1} L ${mobileIconRightX} ${mobileYTrack1}`;
  for (let i = 0; i < 3; i++) {
    const yNext = mobileYTrack1 + (i + 1) * mobileTierHeight;
    const isLastStep = i === 2;
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

  const mobileItems = [0, 1, 2, 3];

  return (
    <View style={[styles.roadmapSkeletonMobileContainer, { height: mobileTotalHeight }]}>
      {/* Background SVG Serpentine Track with 3D Recessed Effect */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={calcMobileWidth}
        height={mobileTotalHeight}
        viewBox={`0 0 ${calcMobileWidth} ${mobileTotalHeight}`}
      >
        {/* Track Outer Bevel Bed */}
        <Path
          d={mobileSvgPath}
          stroke="#E2E8F0"
          strokeWidth="13"
          fill="none"
          strokeLinecap="round"
          opacity={0.65}
        />
        {/* Track Inner Core Bed */}
        <Path
          d={mobileSvgPath}
          stroke="#F8FAFC"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />

        {/* Dotted Drops & Anchor Dots for each node */}
        {mobileItems.map((idx) => {
          const isLeft = idx % 2 === 0;
          const x = isLeft ? mobileIconLeftX : mobileIconRightX;
          const yTrack = mobileYTrack1 + idx * mobileTierHeight;
          const yStart = yTrack - mobileYDropLen;

          return (
            <React.Fragment key={`mb-skel-drop-${idx}`}>
              <Line
                x1={x}
                y1={yStart}
                x2={x}
                y2={yTrack}
                stroke="#CBD5E1"
                strokeWidth="1.8"
                strokeDasharray="3,3"
              />
              <Circle cx={x} cy={yTrack} r={9} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} />
              <Circle cx={x} cy={yTrack} r={4} fill="#CBD5E1" />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Floating Milestone Node Placeholders (Alternating Left & Right) */}
      {mobileItems.map((idx) => {
        const isLeft = idx % 2 === 0;
        const yTrack = mobileYTrack1 + idx * mobileTierHeight;
        const slotTop = yTrack - mobileYDropLen - mobileIconSize;

        return (
          <View
            key={`mb-skel-slot-${idx}`}
            style={[
              styles.roadmapSkeletonMobileSlot,
              {
                top: slotTop,
                ...(isLeft
                  ? { left: mobileIconLeftX - mobileIconSize / 2 }
                  : { right: calcMobileWidth - mobileIconRightX - mobileIconSize / 2 }),
                maxWidth: calcMobileWidth - 36,
              },
            ]}
          >
            {isLeft ? (
              <View style={styles.roadmapSkeletonMobileNodeRow}>
                <View style={styles.roadmapSkeletonHaloCircleMobile}>
                  <Skeleton width={48} height={48} borderRadius={24} />
                </View>
                <View style={[styles.roadmapSkeletonTextColMobile, { marginLeft: 12 }]}>
                  <Skeleton width={30} height={16} borderRadius={Radii.pill} style={{ marginBottom: 6 }} />
                  <Skeleton width={135} height={16} borderRadius={5} style={{ marginBottom: 5 }} />
                  <Skeleton width={85} height={12} borderRadius={4} />
                </View>
              </View>
            ) : (
              <View style={[styles.roadmapSkeletonMobileNodeRow, { justifyContent: 'flex-end' }]}>
                <View style={[styles.roadmapSkeletonTextColMobile, { marginRight: 12, alignItems: 'flex-end' }]}>
                  <Skeleton width={30} height={16} borderRadius={Radii.pill} style={{ marginBottom: 6 }} />
                  <Skeleton width={140} height={16} borderRadius={5} style={{ marginBottom: 5 }} />
                  <Skeleton width={80} height={12} borderRadius={4} />
                </View>
                <View style={styles.roadmapSkeletonHaloCircleMobile}>
                  <Skeleton width={48} height={48} borderRadius={24} />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Detail column skeleton shown on History desktop view when loading session data.
 */
export function HistoryDetailSkeleton() {
  return (
    <View style={styles.historyDetailSkeletonContainer}>
      {/* Header */}
      <View style={styles.historyDetailHeader}>
        <View style={styles.historyDetailHeaderLeft}>
          <Skeleton width={46} height={46} borderRadius={14} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="55%" height={18} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="35%" height={12} borderRadius={4} />
          </View>
        </View>
        <Skeleton width={90} height={36} borderRadius={10} />
      </View>

      {/* Audio Player Skeleton */}
      <View style={styles.historyAudioPlayerSkeleton}>
        <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="100%" height={8} borderRadius={4} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={36} height={10} borderRadius={3} />
            <Skeleton width={36} height={10} borderRadius={3} />
          </View>
        </View>
      </View>

      {/* Score Cards Skeleton */}
      <View style={styles.historyScoreRow}>
        <Skeleton width="31%" height={74} borderRadius={12} />
        <Skeleton width="31%" height={74} borderRadius={12} />
        <Skeleton width="31%" height={74} borderRadius={12} />
      </View>

      {/* Conversation Messages */}
      <View style={styles.historyMessagesSkeleton}>
        <View style={styles.historyMessageLeft}>
          <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8 }} />
          <Skeleton width="65%" height={62} borderRadius={14} />
        </View>
        <View style={styles.historyMessageRight}>
          <Skeleton width="70%" height={54} borderRadius={14} style={{ marginRight: 8 }} />
          <Skeleton width={32} height={32} borderRadius={16} />
        </View>
        <View style={styles.historyMessageLeft}>
          <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8 }} />
          <Skeleton width="60%" height={58} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

/**
 * Table skeleton shown when loading admin data (subscriptions, usage, roadmap).
 */
export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.adminTableSkeletonContainer}>
      {Array.from({ length: rows }).map((_, idx) => (
        <View key={idx} style={styles.adminTableRowSkeleton}>
          <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
          <View style={{ flex: 2, marginRight: 12 }}>
            <Skeleton width="70%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="45%" height={11} borderRadius={4} />
          </View>
          <View style={{ flex: 1.5, marginRight: 12 }}>
            <Skeleton width="60%" height={13} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="35%" height={11} borderRadius={4} />
          </View>
          <Skeleton width={64} height={22} borderRadius={Radii.pill} style={{ marginRight: 16 }} />
          <Skeleton width={76} height={30} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: '#e2e8f0',
  },

  // Desktop Serpentine Skeleton Track
  roadmapSkeletonDesktopContainer: {
    position: 'relative',
    width: '100%',
    marginTop: 20,
  },
  roadmapSkeletonDesktopCardSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  roadmapSkeletonDesktopCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 360,
    gap: 18,
    paddingVertical: 4,
  },
  roadmapSkeletonHaloCircleDesktop: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 3px 14px rgba(0, 0, 0, 0.07)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  roadmapSkeletonDesktopTextCol: {
    flex: 1,
  },

  // Mobile Serpentine Skeleton Track
  roadmapSkeletonMobileContainer: {
    position: 'relative',
    width: '100%',
    marginTop: 8,
  },
  roadmapSkeletonMobileSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  roadmapSkeletonMobileNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadmapSkeletonHaloCircleMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 3px 12px rgba(0, 0, 0, 0.08)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  roadmapSkeletonTextColMobile: {
    maxWidth: 180,
  },

  // History Detail Skeleton
  historyDetailSkeletonContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  historyDetailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyAudioPlayerSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  historyScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  historyMessagesSkeleton: {
    gap: 16,
  },
  historyMessageLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyMessageRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },

  // Admin Table Skeleton
  adminTableSkeletonContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  adminTableRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
});
