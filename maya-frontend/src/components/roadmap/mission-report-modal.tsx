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
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface MissionObjectiveResult {
  id: string;
  title: string;
  description?: string;
  isMandatory?: boolean;
  status: 'mastered' | 'assisted' | 'struggling' | 'incomplete';
  note?: string;
}

export interface MissionReportData {
  roadmapLevelId: string;
  levelNumber?: number;
  levelTitle?: string;
  topic?: string;
  durationSeconds: number;
  targetDurationSeconds: number;
  userSpeakingSeconds: number;
  userSpeakingShare: number; // 0 - 100%
  targetSpeakingShare: number; // e.g. 40%
  overallScore: number; // 0 - 100%
  fluencyScore: number;
  grammarScore: number;
  pronunciationScore: number;
  passed: boolean;
  passReason: string;
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
  onViewHistory?: () => void;
}

export function MissionReportModal({
  visible,
  report,
  onContinue,
  onRetry,
  onViewHistory,
}: MissionReportModalProps) {
  const { isPhone } = useBreakpoint();
  const [internalVisible, setInternalVisible] = useState(visible);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.9)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && report) {
      setInternalVisible(true);
      cardScaleAnim.setValue(0.9);
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
          damping: 20,
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
      ]).start(() => setInternalVisible(false));
    }
  }, [visible, report]);

  if (!internalVisible || !report) return null;

  const isPassed = report.passed;
  const durationMin = Math.max(1, Math.round(report.durationSeconds / 60));
  const shareMet = report.userSpeakingShare >= report.targetSpeakingShare;

  return (
    <Modal
      transparent
      visible={internalVisible}
      animationType="none"
      onRequestClose={onContinue}
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header Banner */}
            <View
              style={[
                styles.headerBanner,
                isPassed ? styles.bannerPassed : styles.bannerRetry,
              ]}
            >
              <View
                style={[
                  styles.statusIconCircle,
                  isPassed ? styles.iconCirclePassed : styles.iconCircleRetry,
                ]}
              >
                <Feather
                  name={isPassed ? 'award' : 'refresh-cw'}
                  size={26}
                  color={isPassed ? '#059669' : '#d97706'}
                />
              </View>

              <Text
                style={[
                  styles.statusHeaderTag,
                  isPassed ? styles.tagPassed : styles.tagRetry,
                ]}
              >
                {isPassed ? 'LEVEL COMPLETED' : 'PRACTICE RETRY RECOMMENDED'}
              </Text>

              <Text style={styles.sessionTitle}>
                {report.levelTitle || `Level ${report.levelNumber || 1}`}
              </Text>

              <Text style={styles.passReasonText}>{report.passReason}</Text>
            </View>

            {/* Score & Metrics Overview */}
            <View style={styles.metricsRow}>
              {/* Overall Score Circle */}
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>{report.overallScore}%</Text>
                <Text style={styles.scoreLabel}>Overall Score</Text>
                <View
                  style={[
                    styles.gradeBadge,
                    report.overallScore >= 75
                      ? styles.gradeBadgeHigh
                      : styles.gradeBadgeMed,
                  ]}
                >
                  <Text
                    style={[
                      styles.gradeBadgeText,
                      report.overallScore >= 75
                        ? styles.gradeBadgeTextHigh
                        : styles.gradeBadgeTextMed,
                    ]}
                  >
                    {report.overallScore >= 85
                      ? 'Excellent'
                      : report.overallScore >= 75
                      ? 'Proficient'
                      : 'Developing'}
                  </Text>
                </View>
              </View>

              {/* Sub-scores */}
              <View style={styles.subScoresContainer}>
                <View style={styles.subScoreItem}>
                  <Text style={styles.subScoreLabel}>Fluency</Text>
                  <View style={styles.subScoreProgressTrack}>
                    <View
                      style={[
                        styles.subScoreProgressFill,
                        {
                          width: `${report.fluencyScore}%`,
                          backgroundColor: '#3b82f6',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.subScoreValue}>{report.fluencyScore}%</Text>
                </View>

                <View style={styles.subScoreItem}>
                  <Text style={styles.subScoreLabel}>Grammar</Text>
                  <View style={styles.subScoreProgressTrack}>
                    <View
                      style={[
                        styles.subScoreProgressFill,
                        {
                          width: `${report.grammarScore}%`,
                          backgroundColor: '#10b981',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.subScoreValue}>{report.grammarScore}%</Text>
                </View>

                <View style={styles.subScoreItem}>
                  <Text style={styles.subScoreLabel}>Time Practiced</Text>
                  <Text style={styles.timeValue}>{durationMin} min</Text>
                </View>
              </View>
            </View>

            {/* Student Speaking Balance Ratio */}
            <View style={styles.speakingShareCard}>
              <View style={styles.speakingShareHeader}>
                <View style={styles.speakingShareTitleGroup}>
                  <Feather
                    name="mic"
                    size={15}
                    color={shareMet ? '#059669' : '#d97706'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.speakingShareTitle}>
                    Student Speaking Share: {report.userSpeakingShare}%
                  </Text>
                </View>
                <View
                  style={[
                    styles.targetShareBadge,
                    shareMet ? styles.targetShareMet : styles.targetSharePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.targetShareText,
                      shareMet ? styles.targetShareTextMet : styles.targetShareTextPending,
                    ]}
                  >
                    Target: ≥ {report.targetSpeakingShare}% {shareMet ? '✓' : '⚠️'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.shareBarTrack}>
                <View
                  style={[
                    styles.shareBarFillUser,
                    {
                      width: `${Math.min(100, Math.max(8, report.userSpeakingShare))}%`,
                      backgroundColor: shareMet ? '#0d9488' : '#f59e0b',
                    },
                  ]}
                />
              </View>
              <View style={styles.shareBarLegend}>
                <Text style={styles.legendText}>
                  You: {report.userSpeakingShare}%
                </Text>
                <Text style={styles.legendText}>
                  Maya: {Math.max(0, 100 - report.userSpeakingShare)}%
                </Text>
              </View>
            </View>

            {/* Curriculum Objectives Section */}
            {report.objectives && report.objectives.length > 0 && (
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <Feather
                    name="target"
                    size={16}
                    color="#0f172a"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.sectionTitle}>
                    Learning Objectives Checkpoints
                  </Text>
                </View>

                {report.objectives.map((obj, i) => {
                  const isMastered = obj.status === 'mastered';
                  const isAssisted = obj.status === 'assisted';
                  const isIncomplete =
                    obj.status === 'incomplete' || obj.status === 'struggling';

                  return (
                    <View key={obj.id || i} style={styles.objectiveRow}>
                      <View style={styles.objectiveLeftIcon}>
                        {isMastered ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#059669"
                          />
                        ) : isAssisted ? (
                          <Ionicons
                            name="bulb"
                            size={18}
                            color="#0284c7"
                          />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={18}
                            color="#94a3b8"
                          />
                        )}
                      </View>

                      <View style={styles.objectiveContent}>
                        <View style={styles.objectiveTitleRow}>
                          <Text style={styles.objectiveTitleText}>
                            {obj.title}
                          </Text>
                          {obj.isMandatory && (
                            <View style={styles.mandatoryPill}>
                              <Text style={styles.mandatoryPillText}>
                                Required
                              </Text>
                            </View>
                          )}
                        </View>
                        {obj.description ? (
                          <Text style={styles.objectiveDescText}>
                            {obj.description}
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isMastered
                            ? styles.statusMastered
                            : isAssisted
                            ? styles.statusAssisted
                            : styles.statusIncomplete,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeLabel,
                            isMastered
                              ? styles.statusMasteredText
                              : isAssisted
                              ? styles.statusAssistedText
                              : styles.statusIncompleteText,
                          ]}
                        >
                          {isMastered
                            ? 'Mastered 🌟'
                            : isAssisted
                            ? 'With Coach 💡'
                            : 'Incomplete 🔄'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Grammar Mistakes & Corrections */}
            {report.corrections && report.corrections.length > 0 ? (
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <Feather
                    name="edit-3"
                    size={16}
                    color="#0f172a"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.sectionTitle}>
                    Grammar Insights ({report.corrections.length})
                  </Text>
                </View>

                {report.corrections.map((c, i) => (
                  <View key={i} style={styles.correctionCard}>
                    <View style={styles.correctionBefore}>
                      <Text style={styles.correctionOriginal}>
                        "{c.studentSaid}"
                      </Text>
                    </View>
                    <View style={styles.correctionArrowRow}>
                      <Feather
                        name="arrow-down"
                        size={14}
                        color="#10b981"
                        style={{ marginVertical: 3 }}
                      />
                    </View>
                    <View style={styles.correctionAfter}>
                      <Text style={styles.correctionNatural}>
                        "{c.moreNatural}"
                      </Text>
                    </View>
                    {c.explanation ? (
                      <Text style={styles.correctionExplanation}>
                        💡 {c.explanation}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Action CTA Buttons */}
            <View style={styles.actionButtonsContainer}>
              {isPassed ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryCtaBtn,
                    styles.btnPassedCta,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={onContinue}
                >
                  <Text style={styles.primaryCtaText}>
                    CONTINUE TO NEXT LEVEL
                  </Text>
                  <Feather
                    name="arrow-right"
                    size={18}
                    color="#ffffff"
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryCtaBtn,
                    styles.btnRetryCta,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={onRetry}
                >
                  <Feather
                    name="refresh-cw"
                    size={17}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryCtaText}>
                    TRY AGAIN (KEEP PROGRESS)
                  </Text>
                </Pressable>
              )}

              <View style={styles.secondaryButtonsRow}>
                {onViewHistory && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={onViewHistory}
                  >
                    <Text style={styles.secondaryBtnText}>Call Transcript</Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={onContinue}
                >
                  <Text style={styles.secondaryBtnText}>Roadmap Track</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
        } as any)
      : { elevation: 8 }),
  },
  cardContainerDesktop: {
    maxWidth: 580,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  headerBanner: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  bannerPassed: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  bannerRetry: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  statusIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCirclePassed: {
    backgroundColor: '#d1fae5',
  },
  iconCircleRetry: {
    backgroundColor: '#fef3c7',
  },
  statusHeaderTag: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tagPassed: {
    color: '#059669',
  },
  tagRetry: {
    color: '#d97706',
  },
  sessionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  passReasonText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
    gap: 14,
  },
  scoreCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    minWidth: 100,
  },
  scoreValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 32,
    color: '#0f172a',
    lineHeight: 38,
  },
  scoreLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 4,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gradeBadgeHigh: {
    backgroundColor: '#d1fae5',
  },
  gradeBadgeMed: {
    backgroundColor: '#fef3c7',
  },
  gradeBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
  },
  gradeBadgeTextHigh: {
    color: '#059669',
  },
  gradeBadgeTextMed: {
    color: '#d97706',
  },
  subScoresContainer: {
    flex: 1,
    gap: 8,
  },
  subScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subScoreLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#475569',
    width: 82,
  },
  subScoreProgressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  subScoreProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  subScoreValue: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0f172a',
    width: 32,
    textAlign: 'right',
  },
  timeValue: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#0284c7',
    textAlign: 'right',
  },
  speakingShareCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  speakingShareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  speakingShareTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakingShareTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  targetShareBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetShareMet: {
    backgroundColor: '#d1fae5',
  },
  targetSharePending: {
    backgroundColor: '#fef3c7',
  },
  targetShareText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
  },
  targetShareTextMet: {
    color: '#059669',
  },
  targetShareTextPending: {
    color: '#b45309',
  },
  shareBarTrack: {
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  shareBarFillUser: {
    height: '100%',
    borderRadius: 5,
  },
  shareBarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  legendText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  sectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#0f172a',
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  objectiveLeftIcon: {
    width: 22,
    alignItems: 'center',
  },
  objectiveContent: {
    flex: 1,
  },
  objectiveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  objectiveTitleText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#1e293b',
  },
  mandatoryPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mandatoryPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
    color: '#dc2626',
  },
  objectiveDescText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusMastered: {
    backgroundColor: '#ecfdf5',
  },
  statusAssisted: {
    backgroundColor: '#f0f9ff',
  },
  statusIncomplete: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusBadgeLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
  },
  statusMasteredText: {
    color: '#059669',
  },
  statusAssistedText: {
    color: '#0284c7',
  },
  statusIncompleteText: {
    color: '#64748b',
  },
  correctionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
  },
  correctionBefore: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  correctionOriginal: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#dc2626',
  },
  correctionArrowRow: {
    alignItems: 'center',
  },
  correctionAfter: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  correctionNatural: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#059669',
  },
  correctionExplanation: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#475569',
    marginTop: 6,
    lineHeight: 15,
  },
  actionButtonsContainer: {
    marginTop: 6,
    gap: 10,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  btnPassedCta: {
    backgroundColor: '#059669',
  },
  btnRetryCta: {
    backgroundColor: '#2563eb',
  },
  primaryCtaText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  secondaryBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#475569',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
