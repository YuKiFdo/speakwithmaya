import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getLatestSessionReport, ExtendedSessionReport } from '@/utils/session-report-store';

export default function SessionCompleteScreen() {
  const params = useLocalSearchParams<{
    roadmapLevelId?: string;
    levelNumber?: string;
    levelTitle?: string;
    durationSeconds?: string;
    talkTimeSeconds?: string;
    overallScore?: string;
    passed?: string;
    feedbackSinhala?: string;
    feedbackEnglish?: string;
    userSentencesCount?: string;
    xpEarned?: string;
    isGeneralChat?: string;
    callParams?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const { height: windowHeight } = useWindowDimensions();

  // Dynamic avatar size: scales with screen height to fill vertical space nicely
  const avatarSize = useMemo(() => {
    // Proportional to screen height, balanced between 195px and 265px
    const scaled = Math.round(windowHeight * 0.27);
    return Math.min(265, Math.max(195, scaled));
  }, [windowHeight]);

  const parseReportFromParams = (): ExtendedSessionReport => {
    let parsedCallParams: any = undefined;
    if (params.callParams) {
      try {
        parsedCallParams = JSON.parse(params.callParams);
      } catch { }
    }

    const durationSecs = params.durationSeconds ? parseInt(params.durationSeconds, 10) : 180;
    const talkSecs = params.talkTimeSeconds ? parseInt(params.talkTimeSeconds, 10) : durationSecs;
    const scoreVal = params.overallScore ? parseInt(params.overallScore, 10) : 75;
    const isPassedVal = params.passed !== undefined ? params.passed === 'true' : true;
    const isGeneralVal = params.isGeneralChat === 'true' || !params.roadmapLevelId;
    const sentencesVal = params.userSentencesCount ? parseInt(params.userSentencesCount, 10) : 0;
    const xpVal = params.xpEarned ? parseInt(params.xpEarned, 10) : (isGeneralVal ? 50 : (isPassedVal ? 100 : 0));

    return {
      roadmapLevelId: params.roadmapLevelId || '',
      levelNumber: params.levelNumber ? parseInt(params.levelNumber, 10) : undefined,
      levelTitle: params.levelTitle || 'Practice Session',
      durationSeconds: durationSecs,
      talkTimeSeconds: talkSecs,
      overallScore: scoreVal,
      passed: isPassedVal,
      passReason: '',
      feedbackSinhala: params.feedbackSinhala,
      feedbackEnglish: params.feedbackEnglish,
      userSentencesCount: sentencesVal,
      xpEarned: xpVal,
      isGeneralChat: isGeneralVal,
      objectives: [],
      corrections: [],
      callParams: parsedCallParams,
    };
  };

  const report = useMemo<ExtendedSessionReport>(() => {
    const stored = getLatestSessionReport();
    if (stored) return stored;
    return parseReportFromParams();
  }, [
    params.roadmapLevelId,
    params.levelNumber,
    params.levelTitle,
    params.durationSeconds,
    params.talkTimeSeconds,
    params.overallScore,
    params.passed,
    params.userSentencesCount,
    params.xpEarned,
    params.isGeneralChat,
    params.callParams,
  ]);

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const isPassed = report ? report.passed : true;
  const isGeneral = report ? Boolean(report.isGeneralChat) : true;

  // Time metrics
  const totalSecs = report?.durationSeconds || 180;
  const sessionMins = Math.floor(totalSecs / 60);
  const sessionRemSecs = totalSecs % 60;
  const formattedSessionTime = `${String(sessionMins).padStart(2, '0')}:${String(sessionRemSecs).padStart(2, '0')}`;

  const talkSecs = report?.talkTimeSeconds || totalSecs;
  const talkMins = Math.max(1, Math.round(talkSecs / 60));

  // XP & Sentences
  const xpEarned = report?.xpEarned ?? (isGeneral ? (isPassed ? 50 : 0) : (isPassed ? 100 : 0));
  const sentencesCount = report?.userSentencesCount ?? 0;
  const overallScore = report?.overallScore ?? (isGeneral ? 85 : 75);

  // Avatar source: Celebrate when passed/general, sad Maya when failed on roadmap
  const avatarSource = isPassed
    ? require('@/assets/images/maya-celebrate.png')
    : require('@/assets/images/maya-sad.png');

  // Headings
  const titleText = isGeneral
    ? (isPassed ? 'Great job! 🎉' : 'Session Ended Early')
    : (isPassed ? 'Great job! 🎉' : 'Needs a Bit More Practice! 💪');

  // Subtitle / Feedback
  let subtitleText = isGeneral
    ? (isPassed
      ? 'You expressed your ideas clearly. Now let\'s make your English sound even more natural and fluent.'
      : 'You ended the call before practicing. Whenever you\'re ready, come back and practice speaking with Maya!')
    : 'Keep practicing! Review your errors below and try again to master this level.';
  if (!isGeneral && report) {
    if (report.feedbackSinhala) {
      subtitleText = report.feedbackSinhala;
    } else if (report.feedbackEnglish) {
      subtitleText = report.feedbackEnglish;
    } else if (isPassed) {
      subtitleText = 'You communicated naturally and met all lesson goals! Ready for the next challenge.';
    } else {
      subtitleText = 'Session ended before completing all tasks and evaluation. Try again to pass this level.';
    }
  }

  // Button handlers
  const handlePrimaryPress = () => {
    if (isGeneral) {
      router.replace('/history');
    } else if (isPassed) {
      router.replace('/(tabs)/roadmap');
    } else {
      // Re-attempt level with same parameters
      if (report?.callParams) {
        router.replace({
          pathname: '/onboarding/call',
          params: report.callParams,
        });
      } else {
        router.replace('/(tabs)/roadmap');
      }
    }
  };

  const handleSecondaryPress = () => {
    if (!isGeneral) {
      router.replace('/(tabs)/roadmap');
    } else {
      router.replace('/(tabs)/roadmap');
    }
  };

  const primaryButtonText = isGeneral
    ? "Let's Review →"
    : (isPassed ? 'Continue to Roadmap →' : 'Try Again ');

  const secondaryButtonText = isGeneral
    ? 'Back to home'
    : (isPassed ? 'Back to home' : 'Back to Roadmap');

  const totalObjectives = report?.objectives?.length || 0;
  const passedObjectives = report?.objectives?.filter((o) => o.status === 'mastered').length || 0;
  const hasReviewItems = (report?.objectives && report.objectives.length > 0) || (report?.corrections && report.corrections.length > 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={[styles.mainWrapper, !isPhone && styles.mainWrapperDesktop]}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Content (Avatar, Title, Metrics) */}
          <View style={styles.topContentGroup}>
            {/* Top Maya Avatar with Soft Radial Background Aura */}
            <View style={[styles.avatarSection, { width: avatarSize + 20, height: avatarSize }]}>
              <View
                style={[
                  styles.avatarGlowCircle,
                  isPassed ? styles.avatarGlowPassed : styles.avatarGlowRetry,
                  {
                    width: Math.round(avatarSize * 0.85),
                    height: Math.round(avatarSize * 0.85),
                    borderRadius: Math.round(avatarSize * 0.85) / 2,
                    top: Math.round(avatarSize * 0.08),
                  },
                ]}
              />
              <Image
                source={avatarSource}
                style={[styles.avatarImage, { width: avatarSize, height: avatarSize }]}
                resizeMode="contain"
                accessibilityLabel={isPassed ? 'Maya celebrating' : 'Maya encouraging you to try again'}
              />
              {/* White gradient fade blend at bottom to dissolve into surface */}
              <View
                style={[styles.imageBottomFade, { height: Math.round(avatarSize * 0.24) }]}
                pointerEvents="none"
              >
                <Svg width="100%" height="100%" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient
                      id="whiteFadeBlendComplete"
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
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#whiteFadeBlendComplete)" />
                </Svg>
              </View>
            </View>

            {/* Heading and Subtitle */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{titleText}</Text>
              <Text style={styles.subtitle}>{report?.feedbackEnglish || subtitleText}</Text>
            </View>

            {/* Row 1: Talk Time & XP Earned Pill Cards */}
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
              {/* Column 1: Session Time */}
              <View style={styles.metricColumn}>
                <View style={styles.metricIconBadge}>
                  <Ionicons name="time-outline" size={17} color="#3B82F6" />
                </View>
                <Text style={styles.metricValueText}>{formattedSessionTime}</Text>
                <Text style={styles.metricLabelText}>Session time</Text>
              </View>

              {/* Divider Line */}
              <View style={styles.metricDivider} />

              {/* Column 2: Sentences Spoken */}
              <View style={styles.metricColumn}>
                <View style={styles.metricIconBadge}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color="#3B82F6" />
                </View>
                <Text style={styles.metricValueText}>{sentencesCount}</Text>
                <Text style={styles.metricLabelText}>Sentences</Text>
              </View>

              {/* Divider Line */}
              <View style={styles.metricDivider} />

              {/* Column 3: Score % */}
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
                  {overallScore}%
                </Text>
                <Text style={styles.metricLabelText}>
                  {isGeneral ? 'Fluency Score' : 'Roleplay Score'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons (Pinned at Bottom) */}
          <View style={styles.actionButtonsContainer}>
            {/* Primary Action Button */}
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

            {/* Secondary Action Button */}
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
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  mainWrapperDesktop: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: Platform.select({
      web: 42,
      ios: 36,
      default: 34,
    }),
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topContentGroup: {
    width: '100%',
    alignItems: 'center',
  },

  /* Avatar Presentation */
  avatarSection: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  avatarGlowCircle: {
    position: 'absolute',
  },
  avatarGlowPassed: {
    backgroundColor: '#EFF6FF',
  },
  avatarGlowRetry: {
    backgroundColor: '#FEF3C7',
  },
  avatarImage: {
    alignSelf: 'center',
  },
  imageBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },

  /* Title & Subtitle */
  titleSection: {
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 3,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
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

  /* Row 1: Pill Stat Cards */
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
    paddingVertical: 6,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    marginTop: 'auto',
    paddingTop: 12,
    marginBottom: Platform.select({
      web: 16,
      ios: 10,
      default: 10,
    }),
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
