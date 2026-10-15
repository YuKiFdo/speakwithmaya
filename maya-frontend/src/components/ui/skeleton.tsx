import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle, DimensionValue } from 'react-native';
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

/**
 * Roadmap track skeleton shown when loading roadmap milestones.
 */
export function RoadmapTrackSkeleton({ isDesktop = false }: { isDesktop?: boolean }) {
  const items = [1, 2, 3, 4];

  if (isDesktop) {
    return (
      <View style={styles.roadmapSkeletonDesktopContainer}>
        <View style={styles.roadmapSkeletonDesktopGrid}>
          {items.map((key) => (
            <View key={key} style={styles.roadmapSkeletonDesktopCard}>
              <View style={styles.roadmapSkeletonHeaderRow}>
                <Skeleton width={44} height={44} borderRadius={14} />
                <View style={styles.roadmapSkeletonHeaderCol}>
                  <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="40%" height={12} borderRadius={4} />
                </View>
              </View>
              <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 14, marginBottom: 8 }} />
              <Skeleton width="75%" height={12} borderRadius={4} style={{ marginBottom: 16 }} />
              <View style={styles.roadmapSkeletonFooter}>
                <Skeleton width={70} height={20} borderRadius={Radii.pill} />
                <Skeleton width={80} height={32} borderRadius={8} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.roadmapSkeletonMobileContainer}>
      {items.map((key) => (
        <View key={key} style={styles.roadmapSkeletonMobileItem}>
          <View style={styles.roadmapSkeletonNode}>
            <Skeleton width={52} height={52} borderRadius={26} />
            {key !== 4 && <Skeleton width={3} height={36} borderRadius={2} style={styles.roadmapSkeletonConnector} />}
          </View>
          <View style={styles.roadmapSkeletonMobileCard}>
            <Skeleton width="50%" height={15} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="85%" height={12} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={18} borderRadius={Radii.pill} />
          </View>
        </View>
      ))}
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

  // Roadmap Skeleton
  roadmapSkeletonMobileContainer: {
    paddingVertical: 12,
    gap: 16,
  },
  roadmapSkeletonMobileItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  roadmapSkeletonNode: {
    alignItems: 'center',
    width: 52,
  },
  roadmapSkeletonConnector: {
    marginTop: 6,
    backgroundColor: '#e2e8f0',
  },
  roadmapSkeletonMobileCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadmapSkeletonDesktopContainer: {
    paddingVertical: 16,
    width: '100%',
  },
  roadmapSkeletonDesktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  roadmapSkeletonDesktopCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadmapSkeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadmapSkeletonHeaderCol: {
    flex: 1,
    marginLeft: 12,
  },
  roadmapSkeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
