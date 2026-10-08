import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle, Fonts } from '@/theme/fonts';
import { MilestoneItem } from '@/app/(tabs)/roadmap';
import {
  RoadmapRobotIcon,
  RoadmapChatIcon,
  RoadmapCheckIcon,
  RoadmapFamilyIcon,
  RoadmapHomeIcon,
  RoadmapWaveIcon,
  RoadmapDirectionsIcon,
} from '@/components/icons/roadmap-icons';
import { LockIcon } from '@/components/icons/nav-icons';
import { SvgXml } from 'react-native-svg';
import { adaptSvgColor } from '@/app/admin/roadmap';
import { parseCanonicalLessonContent } from '@/utils/roadmap-canonical';

interface MissionCardModalProps {
  visible: boolean;
  item: MilestoneItem | null;
  userName?: string;
  nextItem?: MilestoneItem | null;
  onClose: () => void;
  onStartPractice: (item: MilestoneItem) => void;
  onNextLevel?: (nextItem: MilestoneItem) => void;
  onViewHistory?: () => void;
}

export function MissionCardModal({
  visible,
  item,
  userName = 'Tharindu',
  nextItem,
  onClose,
  onStartPractice,
  onNextLevel,
  onViewHistory,
}: MissionCardModalProps) {
  const [internalVisible, setInternalVisible] = useState(visible);
  const [isStarting, setIsStarting] = useState(false);
  const [isStartBtnHovered, setIsStartBtnHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  // Modal backdrop & card entry/exit animations
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.9)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  // Button arrow nudge animation on hover
  const arrowNudgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && item) {
      setInternalVisible(true);
      setIsStarting(false);
      cardScaleAnim.setValue(0.9);
      cardTranslateY.setValue(28);
      cardOpacityAnim.setValue(0);
      backdropAnim.setValue(0);

      // Smooth spring entry
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(cardScaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 190,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (!visible && internalVisible) {
      handleAnimatedClose();
    }
  }, [visible, item]);

  // Handle arrow nudge on button hover
  useEffect(() => {
    Animated.timing(arrowNudgeAnim, {
      toValue: isStartBtnHovered ? 4 : 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isStartBtnHovered]);

  const handleAnimatedClose = () => {
    if (isStarting) return;

    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 0.9,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardTranslateY, {
        toValue: 24,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setInternalVisible(false);
      onClose();
    });
  };

  if (!internalVisible || !item) {
    return null;
  }

  const isCompleted = item.status === 'completed';
  const themeColor = item.numberColor || '#0057FF';

  const handleStart = (targetItem: MilestoneItem = item) => {
    if (isStarting) return;
    setIsStarting(true);

    // Tactile launch transition
    Animated.parallel([
      Animated.timing(cardScaleAnim, {
        toValue: 0.97,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setInternalVisible(false);
      onStartPractice(targetItem);
    });
  };

  return (
    <Modal
      transparent
      visible={internalVisible}
      animationType="none"
      onRequestClose={handleAnimatedClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        {/* Backdrop tap to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleAnimatedClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss mission card"
        />

        {/* Central Gamified Mission Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [
                { scale: cardScaleAnim },
                { translateY: cardTranslateY },
              ],
              opacity: cardOpacityAnim,
            },
          ]}
        >
          {/* Close button with interactive hover & press */}
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              isCloseHovered && styles.closeButtonHovered,
              pressed && styles.closeButtonPressed,
            ]}
            onPress={handleAnimatedClose}
            onHoverIn={() => setIsCloseHovered(true)}
            onHoverOut={() => setIsCloseHovered(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close mission preview"
          >
            <Feather name="x" size={19} color={isCloseHovered ? '#0F172A' : '#64748B'} />
          </Pressable>

          {/* Top Header Badge & Level Number */}
          <View style={styles.topBadgeRow}>
            <View
              style={[
                styles.levelTag,
                {
                  backgroundColor: isCompleted ? '#ECFDF5' : item.haloColor,
                  borderColor: isCompleted ? '#A7F3D0' : item.haloBorderColor || '#BFDBFE',
                },
              ]}
            >
              <Text
                style={[
                  styles.levelTagText,
                  { color: isCompleted ? '#059669' : themeColor },
                ]}
              >
                LEVEL {item.number} {isCompleted ? '✓' : ''}
              </Text>
            </View>

            {isCompleted ? (
              <View style={styles.completedBadgePill}>
                <Feather name="check" size={12} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.completedBadgeText}>COMPLETED</Text>
              </View>
            ) : null}

            <View style={styles.xpRewardPill}>
              <Feather name="award" size={13} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.xpRewardText}>
                {isCompleted ? `+${item.xpReward} XP Earned` : `+${item.xpReward} XP`}
              </Text>
            </View>
          </View>

          {/* Icon Halo & Title Section */}
          <View style={styles.heroSection}>
            <View
              style={[
                styles.iconHalo,
                {
                  backgroundColor: isCompleted ? '#ECFDF5' : item.haloColor,
                  borderColor: isCompleted ? '#6EE7B7' : item.haloBorderColor || '#BFDBFE',
                },
              ]}
            >
              <View style={styles.iconInner}>
                <MissionIcon
                  type={item.iconType}
                  customSvg={item.customSvg}
                  color={isCompleted ? '#059669' : themeColor}
                  size={36}
                />
              </View>
              {isCompleted ? (
                <View style={styles.completedIconCheckBadge}>
                  <Feather name="check" size={11} color="#FFFFFF" />
                </View>
              ) : null}
            </View>

            <Text style={styles.missionTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.topic ? (
              <Text style={styles.missionTopic}>
                Topic: <Text style={{ color: '#0F172A', ...fontStyle('outfit', 'semiBold') }}>{item.topic}</Text>
              </Text>
            ) : null}

            {isCompleted ? (
              <View style={styles.masteredRibbon}>
                <Feather name="check-circle" size={13} color="#059669" style={{ marginRight: 5 }} />
                <Text style={styles.masteredRibbonText}>Level Cleared & Mastered!</Text>
              </View>
            ) : null}
          </View>

          {/* Mission Details Cards */}
          <View style={styles.metaBoxContainer}>
            <View style={styles.metaBox}>
              <Feather
                name={isCompleted ? 'check-circle' : 'award'}
                size={16}
                color={isCompleted ? '#059669' : '#0057FF'}
              />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.metaLabel}>{isCompleted ? 'Status' : 'Pass Requirement'}</Text>
                <Text style={[styles.metaValue, isCompleted && { color: '#059669' }]}>
                  {isCompleted ? 'Completed ✓' : `≥ ${item.passingScorePercent || 75}% Score`}
                </Text>
              </View>
            </View>

            <View style={styles.metaDivider} />

            <View style={styles.metaBox}>
              <Feather
                name="zap"
                size={16}
                color={isCompleted ? '#D97706' : '#10B981'}
              />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.metaLabel}>{isCompleted ? 'XP Reward' : 'XP Reward'}</Text>
                <Text style={[styles.metaValue, isCompleted && { color: '#D97706' }]}>
                  {isCompleted ? `+${item.xpReward} XP Collected` : `+${item.xpReward || 100} XP`}
                </Text>
              </View>
            </View>
          </View>

          {/* Practice Points Preview / What you'll practice */}
          {(() => {
            const points = (item.practicePoints && item.practicePoints.length > 0)
              ? item.practicePoints
              : (item.canonicalContent ? parseCanonicalLessonContent(item.canonicalContent).practicePoints : []);
            if (points.length === 0) return null;

            return (
              <View
                style={[
                  styles.objectivesPreviewCard,
                  isCompleted && styles.objectivesPreviewCardCompleted,
                ]}
              >
                <View style={styles.objectivesPreviewHeader}>
                  <Feather
                    name={isCompleted ? 'check-circle' : 'target'}
                    size={13}
                    color="#059669"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.objectivesPreviewTitle}>
                    {isCompleted ? 'Points Mastered' : "What You'll Practice"}
                  </Text>
                </View>
                <View style={styles.objectivesPillsRow}>
                  {points.map((pt: string, idx: number) => (
                    <View key={`pt-${idx}`} style={styles.objectivePill}>
                      <Text style={styles.objectivePillText} numberOfLines={2}>
                        {isCompleted ? '✓ ' : '• '}{pt}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* Maya Coach Speech Preview Bubble */}
          <View
            style={[
              styles.coachSpeechContainer,
              isCompleted && styles.coachSpeechContainerCompleted,
            ]}
          >
            <Image
              source={require('@/assets/images/maya-avatar.png')}
              style={styles.coachAvatar}
              resizeMode="cover"
            />
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>
                {isCompleted
                  ? `"Awesome job mastering this lesson, ${userName}! You've already cleared this topic. Replay it anytime to sharpen your fluency, or keep your momentum going on the next level!"`
                  : `Hi ${userName}! Let's practice speaking naturally together in English. I'll guide you step by step!`}
              </Text>
            </View>
          </View>

          {/* Action Buttons: Context-Aware for Completed vs In-Progress */}
          {isCompleted ? (
            <View style={styles.completedActionsContainer}>
              {nextItem && nextItem.status !== 'locked' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryNextButton,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => {
                    if (onNextLevel) {
                      onNextLevel(nextItem);
                    } else {
                      handleStart(nextItem);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue to next level ${nextItem.number}`}
                >
                  <Feather name="arrow-right-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryNextButtonText}>
                    CONTINUE TO LEVEL {nextItem.number}
                  </Text>
                  <Feather name="arrow-right" size={17} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </Pressable>
              ) : null}

              <View style={styles.completedSecondaryRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.reviewPracticeButton,
                    (!nextItem || nextItem.status === 'locked') && styles.reviewPracticeButtonFull,
                    pressed && styles.btnPressed,
                    isStarting && styles.startButtonStarting,
                  ]}
                  onPress={() => handleStart(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Practice this level again"
                >
                  <Feather name="rotate-ccw" size={16} color="#0057FF" style={{ marginRight: 6 }} />
                  <Text style={styles.reviewPracticeButtonText}>
                    {isStarting ? 'CONNECTING...' : 'PRACTICE AGAIN (REVIEW)'}
                  </Text>
                </Pressable>

                {onViewHistory ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.historyButton,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={onViewHistory}
                    accessibilityRole="button"
                    accessibilityLabel="View call history and transcript"
                  >
                    <Feather name="file-text" size={15} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.historyButtonText}>History</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.startButton,
                { backgroundColor: themeColor },
                isStartBtnHovered && styles.startButtonHovered,
                pressed && styles.startButtonPressed,
                isStarting && styles.startButtonStarting,
              ]}
              onPress={() => handleStart(item)}
              onHoverIn={() => setIsStartBtnHovered(true)}
              onHoverOut={() => setIsStartBtnHovered(false)}
              accessibilityRole="button"
              accessibilityLabel={`Start Level ${item.number} practice with Maya`}
            >
              <Feather name="mic" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.startButtonText}>
                {isStarting ? 'CONNECTING...' : 'START PRACTICE'}
              </Text>
              <Animated.View style={{ transform: [{ translateX: arrowNudgeAnim }] }}>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </Animated.View>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function MissionIcon({
  type,
  size = 36,
  customSvg,
  color = '#0057FF',
}: {
  type: MilestoneItem['iconType'];
  size?: number;
  customSvg?: string;
  color?: string;
}) {
  if (customSvg && customSvg.trim()) {
    try {
      const adapted = adaptSvgColor(customSvg, color);
      if (adapted) {
        return <SvgXml xml={adapted} width={size} height={size} />;
      }
    } catch (e) {
      // fallback
    }
  }

  switch (type) {
    case 'robot':
      return <RoadmapRobotIcon size={size} color={color} />;
    case 'chat':
      return <RoadmapChatIcon size={size} color={color} />;
    case 'family':
      return <RoadmapFamilyIcon size={size} color={color} />;
    case 'home':
      return <RoadmapHomeIcon size={size} color={color} />;
    case 'wave':
      return <RoadmapWaveIcon size={size} color={color} />;
    case 'directions':
      return <RoadmapDirectionsIcon size={size} color={color} />;
    default:
      return <LockIcon color={color || '#94A3B8'} size={Math.round(size * 0.7)} />;
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({ willChange: 'opacity' } as any)
      : {}),
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          willChange: 'transform, opacity',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 12,
        }),
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        } as any)
      : {}),
  },
  closeButtonHovered: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 1.1 }, { rotate: '90deg' }],
  },
  closeButtonPressed: {
    backgroundColor: '#CBD5E1',
    transform: [{ scale: 0.92 }, { rotate: '90deg' }],
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  levelTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  levelTagText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    letterSpacing: 0.6,
  },
  xpRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  xpRewardText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11.5,
    color: '#B45309',
    letterSpacing: 0.3,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },
  iconHalo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0, 87, 255, 0.15)' } as any)
      : { elevation: 3 }),
  },
  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  missionTopic: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  metaBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 18,
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  metaLabel: {
    fontFamily: Fonts.outfit.regular,
    fontSize: 10.5,
    color: '#64748B',
  },
  metaValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#0F172A',
  },
  coachSpeechContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  coachAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  speechBubble: {
    flex: 1,
  },
  speechText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#1E3A8A',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0, 87, 255, 0.35)',
          transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        } as any)
      : {
          shadowColor: '#0057FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }),
  },
  startButtonHovered: {
    transform: [{ translateY: -2 }, { scale: 1.02 }],
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 12px 28px rgba(0, 87, 255, 0.45)',
        } as any)
      : {}),
  },
  startButtonPressed: {
    transform: [{ translateY: 2 }, { scale: 0.96 }],
    opacity: 0.92,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(0, 87, 255, 0.25)',
        } as any)
      : {}),
  },
  startButtonStarting: {
    opacity: 0.85,
  },
  startButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  objectivesPreviewCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    width: '100%',
    marginBottom: 14,
  },
  objectivesPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  objectivesPreviewTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  objectivesPillsRow: {
    gap: 4,
  },
  objectivePill: {
    paddingVertical: 1,
  },
  objectivePillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#15803D',
  },
  completedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  completedBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    color: '#059669',
    letterSpacing: 0.5,
  },
  completedIconCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#059669',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)' } as any)
      : { elevation: 2 }),
  },
  masteredRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  masteredRibbonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#15803D',
  },
  objectivesPreviewCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  coachSpeechContainerCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  completedActionsContainer: {
    width: '100%',
    gap: 10,
  },
  primaryNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(5, 150, 105, 0.35)',
        } as any)
      : { elevation: 4 }),
  },
  primaryNextButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  completedSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  reviewPracticeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  reviewPracticeButtonFull: {
    flex: 1,
  },
  reviewPracticeButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0057FF',
    letterSpacing: 0.4,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  historyButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#475569',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
