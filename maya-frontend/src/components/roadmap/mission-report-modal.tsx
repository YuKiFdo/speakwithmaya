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
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface MissionObjectiveResult {
  id: string;
  title: string;
  description?: string;
  status: 'mastered' | 'assisted' | 'struggling' | 'incomplete';
  note?: string;
}

export interface MissionReportData {
  roadmapLevelId: string;
  levelNumber?: number;
  levelTitle?: string;
  topic?: string;
  durationSeconds: number;
  overallScore: number; // 0 - 100%
  passingScorePercent?: number; // e.g. 75%
  fluencyScore?: number;
  grammarScore?: number;
  passed: boolean;
  passReason: string;
  feedbackSinhala?: string;
  feedbackEnglish?: string;
  userSentencesCount?: number;
  talkTimeSeconds?: number;
  xpEarned?: number;
  isGeneralChat?: boolean;
  objectives: MissionObjectiveResult[];
  corrections: Array<{
    studentSaid: string;
    moreNatural: string;
    explanation: string;
  }>;
}

interface MissionReportModalProps {
  visible: boolean;
  report: MissionReportData | null;
  onContinue: () => void;
  onRetry: () => void;
  onBackToHome?: () => void;
  onViewHistory?: () => void;
}

export function MissionReportModal({
  visible,
  report,
  onContinue,
  onRetry,
  onBackToHome,
  onViewHistory,
}: MissionReportModalProps) {
  const { isPhone } = useBreakpoint();
  const [internalVisible, setInternalVisible] = useState(visible);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.92)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && report) {
      setInternalVisible(true);
      cardScaleAnim.setValue(0.92);
      cardOpacityAnim.setValue(0);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(cardScaleAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else if (!visible && internalVisible) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        setInternalVisible(false);
        setIsDetailsExpanded(false);
      });
    }
  }, [visible, report]);

  if (!internalVisible || !report) return null;

  const isPassed = report.passed;
  const isGeneral = Boolean(report.isGeneralChat);

  // Time metrics
  const totalSecs = report.durationSeconds || 0;
  const sessionMins = Math.floor(totalSecs / 60);
  const sessionRemSecs = totalSecs % 60;
  const formattedSessionTime = `${String(sessionMins).padStart(2, '0')}:${String(sessionRemSecs).padStart(2, '0')}`;

  const talkSecs = report.talkTimeSeconds || totalSecs;
  const talkMins = Math.floor(talkSecs / 60);

  // XP & Sentence metrics (preserve 0 accurately)
  const xpEarned = report.xpEarned ?? 0;
  const sentencesCount = report.userSentencesCount ?? 0;

  // Avatar source: Celebrate when passed, gentle sad/encouraging when failed
  const avatarSource = isPassed
    ? require('@/assets/images/maya-celebrate.png')
    : require('@/assets/images/maya-sad.png');

  // Headings
  const titleText = isGeneral
    ? 'Great job! 🎉'
    : (isPassed ? 'Great job! 🎉' : 'Needs a Bit More Practice! 💪');

  // Subtitle / Feedback text
  let subtitleText = 'You expressed your ideas clearly. Now let\'s make your English sound even more natural and fluent.';
  if (!isGeneral) {
    if (report.feedbackSinhala) {
      subtitleText = report.feedbackSinhala;
    } else if (report.feedbackEnglish) {
      subtitleText = report.feedbackEnglish;
    } else if (isPassed) {
      subtitleText = 'You communicated naturally and met all lesson goals! Ready for the next challenge.';
    } else {
      subtitleText = 'Keep practicing! Review your errors below and try again to master this level.';
    }
  }

  // Button Labels & Callbacks
  const primaryButtonText = isGeneral
    ? "Let's Review →"
    : (isPassed ? 'Continue to Roadmap →' : 'Try Again 🔄');

  const secondaryButtonText = isGeneral
    ? 'Back to home'
    : (isPassed ? 'Back to home' : 'Back to Roadmap');

  const handlePrimaryPress = () => {
    if (!isGeneral && !isPassed) {
      onRetry();
    } else {
      onContinue();
    }
  };

  const handleSecondaryPress = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      onContinue();
    }
  };

  const totalObjectives = report.objectives?.length || 0;
  const passedObjectives = report.objectives?.filter((o) => o.status === 'mastered').length || 0;
  const hasReviewItems = (report.objectives && report.objectives.length > 0) || (report.corrections && report.corrections.length > 0);

  return (
    <Modal
      transparent
      visible={internalVisible}
      animationType="none"
      onRequestClose={handleSecondaryPress}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Animated.View
          style={[
            styles.cardContainer,
            !isPhone && styles.cardContainerDesktop,
            {
              transform: [{ scale: cardScaleAnim }],
              opacity: cardOpacityAnim,
            },
          ]}
        >
          <SafeAreaView style={styles.safeAreaView} edges={['top', 'bottom']}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Top Maya Avatar with Soft Aura */}
              <View style={styles.avatarSection}>
                <View
                  style={[
                    styles.avatarGlowCircle,
                    isPassed ? styles.avatarGlowPassed : styles.avatarGlowRetry,
                  ]}
                />
                <Image
                  source={avatarSource}
                  style={styles.avatarImage}
                  resizeMode="contain"
                  accessibilityLabel={isPassed ? 'Maya celebrating' : 'Maya encouraging you to try again'}
                />
                {/* White gradient fade blend at bottom to dissolve into card surface */}
                <View style={styles.imageBottomFade} pointerEvents="none">
                  <Svg width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient
                        id="whiteFadeBlendModal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                        <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.8" />
                        <Stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#whiteFadeBlendModal)" />
                  </Svg>
                </View>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>{titleText}</Text>
                <Text style={styles.subtitle}>{subtitleText}</Text>
                {!isGeneral && report.feedbackEnglish && report.feedbackSinhala ? (
                  <Text style={styles.secondarySubtitle}>{report.feedbackEnglish}</Text>
                ) : null}
              </View>

              {/* Row 1: Talk Time & XP Earned Cards */}
              <View style={styles.rowOneStats}>
                {/* Talk Time */}
                <View style={styles.pillStatCard}>
                  <View style={styles.clockIconBadge}>
                    <Ionicons name="time-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statValueBold}>{talkMins} min</Text>
                    <Text style={styles.statLabelMuted}>Talk time</Text>
                  </View>
                </View>

                {/* XP Earned */}
                <View style={styles.pillStatCard}>
                  <View style={styles.starIconBadge}>
                    <Ionicons name="star" size={18} color="#EAB308" />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statValueBold}>+{xpEarned} XP</Text>
                    <Text style={styles.statLabelMuted}>Earned today</Text>
                  </View>
                </View>
              </View>

              {/* Row 2: 3-Metric Summary Card (Session Time | Sentences | Score) */}
              <View style={styles.threeMetricCard}>
                {/* Metric 1: Session Time */}
                <View style={styles.metricColumn}>
                  <View style={styles.metricIconBadge}>
                    <Ionicons name="time-outline" size={17} color="#3B82F6" />
                  </View>
                  <Text style={styles.metricValueText}>{formattedSessionTime}</Text>
                  <Text style={styles.metricLabelText}>Session time</Text>
                </View>

                {/* Divider Line */}
                <View style={styles.metricDivider} />

                {/* Metric 2: Sentences Spoken */}
                <View style={styles.metricColumn}>
                  <View style={styles.metricIconBadge}>
                    <Ionicons name="chatbubble-ellipses-outline" size={17} color="#3B82F6" />
                  </View>
                  <Text style={styles.metricValueText}>{sentencesCount}</Text>
                  <Text style={styles.metricLabelText}>Sentences</Text>
                </View>

                {/* Divider Line */}
                <View style={styles.metricDivider} />

                {/* Metric 3: Score % */}
                <View style={styles.metricColumn}>
                  <View
                    style={[
                      styles.metricIconBadge,
                      !isPassed && !isGeneral && styles.metricIconBadgeRetry,
                    ]}
                  >
                    <Ionicons
                      name="star"
                      size={17}
                      color={isPassed || isGeneral ? '#3B82F6' : '#D97706'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.metricValueText,
                      !isPassed && !isGeneral && styles.metricValueTextRetry,
                    ]}
                  >
                    {report.overallScore}%
                  </Text>
                  <Text style={styles.metricLabelText}>
                    {isGeneral ? 'Fluency Score' : 'Roleplay Score'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                {/* Primary Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  onPress={handlePrimaryPress}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
                </Pressable>

                {/* Secondary Outlined Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  onPress={handleSecondaryPress}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
                </Pressable>
              </View>

              {/* Optional Collapsible Practice Review for Deliberate Learning */}
              {hasReviewItems && !isGeneral && (
                <View style={styles.reviewAccordionContainer}>
                  <Pressable
                    style={styles.reviewAccordionHeader}
                    onPress={() => setIsDetailsExpanded((prev) => !prev)}
                  >
                    <View style={styles.accordionHeaderLeft}>
                      <Ionicons
                        name="clipboard-outline"
                        size={17}
                        color="#475569"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.accordionHeaderText}>
                        Review Practice Tasks ({passedObjectives}/{totalObjectives})
                      </Text>
                    </View>
                    <Ionicons
                      name={isDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>

                  {isDetailsExpanded && (
                    <View style={styles.reviewAccordionBody}>
                      {/* Checkpoint Tasks List */}
                      {report.objectives?.map((obj, idx) => {
                        const isTaskPassed = obj.status === 'mastered';
                        return (
                          <View key={obj.id || idx} style={styles.taskItemCard}>
                            <View style={styles.taskItemHeader}>
                              <Text style={styles.taskItemTitle}>
                                {idx + 1}. {obj.title}
                              </Text>
                              <View
                                style={[
                                  styles.taskStatusBadge,
                                  isTaskPassed
                                    ? styles.taskStatusBadgePassed
                                    : styles.taskStatusBadgeGuided,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.taskStatusText,
                                    isTaskPassed
                                      ? styles.taskStatusTextPassed
                                      : styles.taskStatusTextGuided,
                                  ]}
                                >
                                  {isTaskPassed ? 'Roleplay Passed 🌟' : 'Guided with Coach 💡'}
                                </Text>
                              </View>
                            </View>
                            {obj.note ? (
                              <Text style={styles.taskItemNote}>{obj.note}</Text>
                            ) : null}
                          </View>
                        );
                      })}

                      {/* Grammar & Phrasing Corrections */}
                      {report.corrections && report.corrections.length > 0 && (
                        <View style={styles.correctionsBox}>
                          <Text style={styles.correctionsBoxTitle}>
                            Key Phrases & Corrections:
                          </Text>
                          {report.corrections.map((corr, cIdx) => (
                            <View key={cIdx} style={styles.correctionRow}>
                              <Text style={styles.correctionOriginal}>
                                ❌ "{corr.studentSaid}"
                              </Text>
                              <Text style={styles.correctionBetter}>
                                ✨ "{corr.moreNatural}"
                              </Text>
                              {corr.explanation ? (
                                <Text style={styles.correctionExpl}>
                                  {corr.explanation}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  cardContainerDesktop: {
    flex: undefined,
    maxWidth: 440,
    width: '92%',
    maxHeight: '92%',
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
    overflow: 'hidden',
  },
  safeAreaView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },

  /* Avatar Presentation */
  avatarSection: {
    width: 220,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  avatarGlowCircle: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: 15,
  },
  avatarGlowPassed: {
    backgroundColor: '#EFF6FF',
  },
  avatarGlowRetry: {
    backgroundColor: '#FEF3C7',
  },
  avatarImage: {
    width: 200,
    height: 200,
  },
  imageBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    pointerEvents: 'none',
  },

  /* Title & Subtitle */
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 26,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  secondarySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 12,
  },

  /* Row 1: Side-by-side Pill Stat Cards */
  rowOneStats: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  pillStatCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clockIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF9C3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTexts: {
    flex: 1,
    justifyContent: 'center',
  },
  statValueBold: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabelMuted: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
  },

  /* Row 2: 3-Metric Summary Card */
  threeMetricCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  metricIconBadgeRetry: {
    backgroundColor: '#FEF3C7',
  },
  metricValueText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0F172A',
  },
  metricValueTextRetry: {
    color: '#D97706',
  },
  metricLabelText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
  },
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E2E8F0',
  },

  /* Action Buttons */
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: '#EFF6FF',
    opacity: 0.9,
  },
  secondaryButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#2563EB',
  },

  /* Collapsible Review Accordion */
  reviewAccordionContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 6,
  },
  reviewAccordionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionHeaderText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#475569',
  },
  reviewAccordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    gap: 10,
  },
  taskItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  taskItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  taskItemTitle: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taskStatusBadgePassed: {
    backgroundColor: '#ECFDF5',
  },
  taskStatusBadgeGuided: {
    backgroundColor: '#FEF3C7',
  },
  taskStatusText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  taskStatusTextPassed: {
    color: '#059669',
  },
  taskStatusTextGuided: {
    color: '#D97706',
  },
  taskItemNote: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  correctionsBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  correctionsBoxTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
  },
  correctionRow: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 2,
  },
  correctionOriginal: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#DC2626',
  },
  correctionBetter: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#059669',
  },
  correctionExpl: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
