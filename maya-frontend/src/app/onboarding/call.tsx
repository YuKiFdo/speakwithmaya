import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AmbientGlow } from '@/components/call/ambient-glow';
import { Radii } from '@/theme/tokens';
import { EndCallIcon } from '@/components/icons/call-icons';
import { ToastPill, ToastPillPreset } from '@/components/ui/toast-pill';
import {
  GrammarFeedbackModal,
  GrammarFeedbackData,
} from '@/components/call/grammar-feedback-modal';
import { ConversationDisplay } from '@/components/call/conversation-display';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { fontStyle } from '@/theme/fonts';

import { useLiveCall } from '@/hooks/useLiveCall';
import { ConnectingView } from '@/components/call/connecting-view';
import { MicrophonePermissionPopup } from '@/components/call/microphone-permission-popup';
import { MissionReportModal } from '@/components/roadmap/mission-report-modal';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    userName?: string;
    isIntroCall?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    duration?: string;
    durationMinutes?: string;
    languageMode?: 'sinhala' | 'english';
    sinhalaStyle?: 'smart' | 'balanced' | 'deep_guidance';
    aiSuggestions?: string;
    topic?: string;
    scenarioId?: string;
    scenarioTitle?: string;
    roadmapLevelId?: string;
    scenarioRole?: string;
    coachingFocus?: string;
    openingQuestion?: string;
    customPromptAddon?: string;
    levelNumber?: string;
    targetSpeakingShare?: string;
    learningObjectives?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Real-time network & connection monitor
  const connection = useConnectionMonitor();

  const durationSec = params.duration ? parseInt(params.duration, 10) : 300;
  const targetDuration = isNaN(durationSec) ? 300 : durationSec;
  const aiSug = params.aiSuggestions !== 'false';
  const langMode = params.languageMode === 'english' ? 'english' : 'sinhala';
  const sinhalaStyle =
    params.sinhalaStyle === 'deep_guidance'
      ? 'deep_guidance'
      : params.sinhalaStyle === 'balanced'
        ? 'balanced'
        : 'smart';
  const effectiveTopic = params.topic || params.goal || 'General Speaking Practice';
  const effectiveUserName = (params.name || params.userName || '').trim() || 'Tharindu';
  const isIntro = params.isIntroCall === 'true';

  const hasGuidedPrompt = Boolean(
    params.scenarioRole || params.coachingFocus || params.openingQuestion || params.customPromptAddon,
  );

  let parsedObjectives = undefined;
  if (params.learningObjectives) {
    try {
      parsedObjectives = JSON.parse(params.learningObjectives);
    } catch (e) {
      console.warn('[call.tsx] Could not parse learningObjectives param:', e);
    }
  }

  // Core Gemini Live Audio & Call Engine
  const liveCall = useLiveCall({
    topic: effectiveTopic,
    goal: params.goal,
    level: params.level,
    durationSeconds: targetDuration,
    languageMode: langMode,
    sinhalaStyle,
    aiSuggestions: aiSug,
    scenarioId: params.scenarioId,
    userName: effectiveUserName,
    isIntroCall: isIntro,
    roadmapLevelId: params.roadmapLevelId,
    levelNumber: params.levelNumber ? parseInt(params.levelNumber, 10) : undefined,
    levelTitle: params.scenarioTitle || params.topic,
    targetSpeakingShare: params.targetSpeakingShare ? parseInt(params.targetSpeakingShare, 10) : 40,
    learningObjectives: parsedObjectives,
    guidedPrompt: (hasGuidedPrompt || parsedObjectives)
      ? {
          scenarioRole: params.scenarioRole,
          coachingFocus: params.coachingFocus,
          openingQuestion: params.openingQuestion,
          customPromptAddon: params.customPromptAddon,
          learningObjectives: parsedObjectives,
        }
      : undefined,
  });


  const liveCallRef = useRef(liveCall);
  useEffect(() => {
    liveCallRef.current = liveCall;
  }, [liveCall]);

  // Auto-start Gemini Live call session on component mount with cleanup on unmount
  useEffect(() => {
    liveCall.startCall();
    return () => {
      liveCallRef.current.endCall(false);
    };
  }, []);


  // Timer: user gets the FULL targetDuration for uninterrupted conversation.
  // Farewell only fires AFTER time is up. Display freezes at the target so extra farewell time is invisible.
  const hasTriggeredFarewellRef = useRef(false);
  const farewellGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTimeUp = liveCall.secondsElapsed >= targetDuration && liveCall.secondsElapsed > 0;

  // Freeze displayed time at targetDuration — farewell grace period is invisible to the user
  const displayedElapsed = Math.min(liveCall.secondsElapsed, targetDuration);
  const remainingSeconds = Math.max(0, targetDuration - displayedElapsed);
  const isFarewellPhase = isTimeUp && hasTriggeredFarewellRef.current;

  // When time is up, send the farewell cue to Maya (she speaks goodbye AFTER the full session)
  useEffect(() => {
    if (
      isTimeUp &&
      !hasTriggeredFarewellRef.current &&
      (liveCall.status === 'speaking' || liveCall.status === 'listening')
    ) {
      hasTriggeredFarewellRef.current = true;
      console.log(`[call.tsx] ⏰ Session time reached (${targetDuration}s) -> dispatching farewell cue to Maya`);
      liveCall.sendTimeWrapupCue(0);

      // Safety: auto-end the call after 25s grace period if Maya/Gemini fails to conclude
      farewellGraceTimerRef.current = setTimeout(() => {
        console.log('[call.tsx] ⏰ Farewell grace period (25s) elapsed -> auto-ending call');
        liveCall.endCall();
      }, 25000);
    }
  }, [isTimeUp, liveCall.status]);

  // Cleanup grace timer on unmount
  useEffect(() => {
    return () => {
      if (farewellGraceTimerRef.current) clearTimeout(farewellGraceTimerRef.current);
    };
  }, []);

  const isCallActive = liveCall.status === 'speaking' || liveCall.status === 'listening';
  const isCallReconnecting = liveCall.status === 'reconnecting' || connection.isReconnecting;
  const isCallConnectionLost = (connection.isLost || !connection.isOnline) && liveCall.status !== 'ended';
  const isSlowNetwork = liveCall.isSlowResponse || connection.isWeak;

  const isSessionEndingNear = (remainingSeconds <= 30 && liveCall.secondsElapsed > 0) || isFarewellPhase;

  // Priority:
  // 1. Critical connection alerts (connection lost / reconnecting) - active throughout the session
  // 2. Slow network / delayed response warning (>3.5s waiting for Maya response or backpressure)
  // 3. Session ending countdown & farewell wrap-up (takes top priority as time nears end)
  // 4. Ambient network notices (weak connection, connection restored)
  const activeToastPreset: ToastPillPreset | null = isCallConnectionLost
    ? 'connection-lost'
    : isCallReconnecting
    ? 'reconnecting'
    : liveCall.isSlowResponse
    ? 'slow-connection'
    : isSessionEndingNear
    ? 'session-ends'
    : connection.toastPreset;

  const displayedStatusText = isCallConnectionLost
    ? 'Connection lost'
    : isCallReconnecting
    ? 'Reconnecting...'
    : liveCall.status === 'ended'
    ? 'Session ended'
    : liveCall.isSlowResponse
    ? 'Waiting for Maya...'
    : connection.isWeak
    ? 'Weak connection'
    : liveCall.status === 'speaking'
    ? 'Speaking..'
    : liveCall.status === 'connecting'
    ? 'Connecting...'
    : 'Listening...';

  // Animation values for dynamic speech-reactive ambient glows
  const purpleGlowAnim = useRef(new Animated.Value(0.38)).current;
  const purpleScaleAnim = useRef(new Animated.Value(1.0)).current;
  const blueAuraAnim = useRef(new Animated.Value(0)).current;
  const blueScaleAnim = useRef(new Animated.Value(1.0)).current;

  // Smooth cinematic entrance transition from ConnectingView into active CallScreen
  const [connectingVisible, setConnectingVisible] = useState(true);
  const connectingFadeAnim = useRef(new Animated.Value(1)).current;
  const hasTransitionedRef = useRef(false);

  useEffect(() => {
    if (liveCall.status !== 'connecting' && liveCall.status !== 'idle' && !hasTransitionedRef.current) {
      hasTransitionedRef.current = true;
      Animated.timing(connectingFadeAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setConnectingVisible(false);
      });
    }
  }, [liveCall.status]);

  // Animate glows reactively based on voice strength and call status
  useEffect(() => {
    if (liveCall.status === 'speaking') {
      // Maya speaking: fade out purple bottom glow
      Animated.parallel([
        Animated.timing(purpleGlowAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(purpleScaleAnim, {
          toValue: 0.95,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        // Blue edge aura pulses with Maya's voice intensity
        Animated.timing(blueAuraAnim, {
          toValue: 0.38 + liveCall.modelVolume * 0.62,
          duration: liveCall.modelVolume > 0.05 ? 80 : 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(blueScaleAnim, {
          toValue: 1.0 + liveCall.modelVolume * 0.08,
          duration: liveCall.modelVolume > 0.05 ? 80 : 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      // Maya listening / idle: fade out blue aura
      // Resting purple bottom glow stays low (~0.38 opacity, scale 1.0) when silent.
      // When user speaks into the mic, it swells up and intensifies in real time!
      const isUserSpeaking = liveCall.userVolume > 0.02;
      const targetPurpleOpacity = 0.38 + liveCall.userVolume * 0.62;
      const targetPurpleScale = 1.0 + liveCall.userVolume * 0.28;

      Animated.parallel([
        Animated.timing(blueAuraAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(blueScaleAnim, {
          toValue: 1.0,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(purpleGlowAnim, {
          toValue: targetPurpleOpacity,
          duration: isUserSpeaking ? 60 : 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(purpleScaleAnim, {
          toValue: targetPurpleScale,
          duration: isUserSpeaking ? 60 : 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [liveCall.status, liveCall.userVolume, liveCall.modelVolume]);

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };


  const handleToggleMute = () => {
    if (liveCall.status === 'speaking') {
      liveCall.interrupt();
    } else {
      liveCall.toggleMute();
    }
  };

  const handleHangup = () => {
    if (farewellGraceTimerRef.current) {
      clearTimeout(farewellGraceTimerRef.current);
      farewellGraceTimerRef.current = null;
    }
    liveCall.endCall();
  };

  const handleBackToHome = () => {
    if (farewellGraceTimerRef.current) {
      clearTimeout(farewellGraceTimerRef.current);
      farewellGraceTimerRef.current = null;
    }
    liveCall.endCall();
  };

  const handleScreenTouch = () => {
    if (liveCall.status === 'speaking') {
      liveCall.interrupt();
    } else {
      liveCall.resumeAudio();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContentWrapper}>
        <Pressable style={styles.fullScreenTouch}>
          <View style={[styles.container, isWebOrDesktop && styles.containerDesktop]}>

          {/* Ambient Edge Aura for Speaking State */}
          <AmbientGlow type="blue-aura" opacity={blueAuraAnim} />

          {/* Top Bar Header */}
          {isWebOrDesktop ? (
            /* Desktop / Web Top Bar */
            <View style={styles.desktopTopBar}>
              {/* Left: Back to Home */}
              <Pressable
                style={({ pressed }) => [
                  styles.backLink,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleBackToHome}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
              >
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backText}>Back to Home</Text>
              </Pressable>

              {/* Right: Settings & End Session Pill */}
              <View style={styles.desktopRightActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.settingsButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Call settings"
                >
                  <Text style={styles.settingsIcon}>⚙️</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.endSessionPillButton,
                    pressed && styles.endSessionPressed,
                  ]}
                  onPress={handleHangup}
                  accessibilityRole="button"
                  accessibilityLabel="End Session"
                >
                  <EndCallIcon size={20} color="#ffffff" />
                  <Text style={styles.endSessionText}>End Session</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Mobile Phone Top Bar */
            <View style={styles.mobileTopBar}>
              <Pressable
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Call settings"
              >
                <Text style={styles.settingsIcon}>⚙️</Text>
              </Pressable>

              <View style={styles.mobileHeaderInfo}>
                <View style={styles.avatarWrapperMobile}>
                  <Image
                    source={require('@/assets/images/maya-avatar.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    accessibilityLabel="Maya"
                  />
                </View>

                <View style={styles.headerTexts}>
                  <Text style={styles.mayaNameMobile}>Maya</Text>
                  <View style={styles.timerRow}>
                    <View
                      style={[
                        styles.statusDot,
                        isCallConnectionLost
                          ? styles.statusDotRed
                          : isCallReconnecting || isSlowNetwork
                          ? styles.statusDotOrange
                          : styles.statusDotGreen,
                      ]}
                    />
                    <Text style={styles.timerText}>
                      {formatTime(displayedElapsed)}{' '}
                      <Text style={styles.timerMax}>/ {formatTime(targetDuration)}</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabel,
                      isCallConnectionLost
                        ? styles.stateLabelLost
                        : isCallReconnecting || isSlowNetwork
                        ? styles.stateLabelWarning
                        : liveCall.status === 'speaking'
                        ? styles.stateLabelSpeaking
                        : styles.stateLabelListening,
                    ]}
                  >
                    {displayedStatusText}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.mobileHangupButton,
                  pressed && styles.hangupButtonPressed,
                ]}
                onPress={handleHangup}
                accessibilityRole="button"
                accessibilityLabel="End call"
              >
                <EndCallIcon size={28} color="#ffffff" />
              </Pressable>
            </View>
          )}

          {/* Center Content Section */}
          <View style={[styles.centerContent, isWebOrDesktop && styles.centerContentDesktop]}>
            {/* On Desktop: Centered Avatar & Maya Status */}
            {isWebOrDesktop && (
              <View style={styles.desktopAvatarCard}>
                <View style={styles.avatarWrapperDesktop}>
                  <Image
                    source={require('@/assets/images/maya-avatar.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    accessibilityLabel="Maya"
                  />
                </View>

                <View style={styles.desktopInfoTexts}>
                  <Text style={styles.mayaNameDesktop}>Maya</Text>
                  <View style={styles.timerRow}>
                    <View
                      style={[
                        styles.statusDot,
                        isCallConnectionLost
                          ? styles.statusDotRed
                          : isCallReconnecting || isSlowNetwork
                          ? styles.statusDotOrange
                          : styles.statusDotGreen,
                      ]}
                    />
                    <Text style={styles.timerTextDesktop}>
                      {formatTime(displayedElapsed)}{' '}
                      <Text style={styles.timerMax}>/ {formatTime(targetDuration)}</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabelDesktop,
                      isCallConnectionLost
                        ? styles.stateLabelLost
                        : isCallReconnecting || isSlowNetwork
                        ? styles.stateLabelWarning
                        : liveCall.status === 'speaking'
                        ? styles.stateLabelSpeaking
                        : styles.stateLabelListening,
                    ]}
                  >
                    {displayedStatusText}
                  </Text>
                </View>
              </View>
            )}

            {/* Session Ending & Network Connection Toast Pill */}
            <View style={styles.noticeWrapper}>
              {activeToastPreset && (
                <ToastPill
                  preset={activeToastPreset}
                  secondsRemaining={activeToastPreset === 'session-ends' && remainingSeconds > 0 ? remainingSeconds : undefined}
                  text={activeToastPreset === 'session-ends' && remainingSeconds === 0 ? 'Wrapping up session...' : undefined}
                  visible={true}
                />
              )}
            </View>

            {/* Conversation Display with Multi-Turn History (Image 2 Design) */}
            <ConversationDisplay
              previousText={liveCall.previousSubtitles}
              currentText={liveCall.subtitles}
              isSpeaking={liveCall.status === 'speaking'}
              isWebOrDesktop={isWebOrDesktop}
            />
          </View>

          {/* Bottom Purple Ambient Glow for Listening State (Speech-Reactive) */}
          <AmbientGlow type="purple-bottom" opacity={purpleGlowAnim} />
        </View>
      </Pressable>
    </View>

      {/* Smooth connecting overlay with clean opacity crossfade */}
      {connectingVisible && (
        <Animated.View
          style={[
            styles.connectingOverlay,
            {
              opacity: connectingFadeAnim,
            },
          ]}
          pointerEvents={liveCall.status === 'connecting' ? 'auto' : 'none'}
        >
          <ConnectingView onCancel={handleHangup} />
        </Animated.View>
      )}

      {/* Grammar Feedback Modal (Bottom Sheet on Mobile / Centered Card on Desktop) */}
      <GrammarFeedbackModal
        visible={liveCall.feedbackVisible}
        onClose={liveCall.closeFeedbackModal}
        feedback={liveCall.feedbackData || undefined}
      />

      {/* Microphone Permission Modal (matches common popup design language) */}
      <MicrophonePermissionPopup
        visible={liveCall.isPermissionModalVisible}
        onClose={() => {
          liveCall.closePermissionModal();
          handleHangup();
        }}
        onAllow={liveCall.requestMicrophoneAndStart}
        errorType={liveCall.permissionErrorType}
      />

      {/* Post-Call Mission Report Modal for Curriculum Roadmap Levels */}
      <MissionReportModal
        visible={Boolean(liveCall.missionReport)}
        report={liveCall.missionReport}
        onContinue={() => {
          liveCall.setMissionReport(null);
          router.replace('/(tabs)/roadmap');
        }}
        onRetry={() => {
          liveCall.setMissionReport(null);
          router.replace({
            pathname: '/onboarding/call',
            params: { ...params },
          });
        }}
        onViewHistory={() => {
          liveCall.setMissionReport(null);
          router.replace('/history');
        }}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    position: 'relative',
  },
  mainContentWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  connectingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 100,
    ...(Platform.OS === 'web' ? ({ willChange: 'opacity' } as any) : {}),
  },
  fullScreenTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  containerDesktop: {
    maxWidth: '100%',
  },
  /* Desktop Top Bar */
  desktopTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 20,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 22,
    color: '#64748b',
    lineHeight: 22,
  },
  backText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14,
    color: '#64748b',
  },
  desktopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  endSessionPillButton: {
    backgroundColor: '#ef4444',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 8px rgba(239, 68, 68, 0.3)' } as any,
      default: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  endSessionPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.98 }],
  },
  endSessionIcon: {
    fontSize: 16,
    color: '#ffffff',
    transform: [{ rotate: '135deg' }],
  },
  endSessionText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 14,
  },
  /* Mobile Top Bar */
  mobileTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 20,
  },
  mobileHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginLeft: 16,
  },
  avatarWrapperMobile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: { boxShadow: '0 3px 8px rgba(0, 133, 219, 0.15)' } as any,
      default: {
        shadowColor: '#0085db',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  mobileHangupButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 10px rgba(239, 68, 68, 0.35)' } as any,
      default: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  headerTexts: {
    justifyContent: 'center',
  },
  mayaNameMobile: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  /* Desktop Centered Avatar Card */
  desktopAvatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  avatarWrapperDesktop: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(0, 133, 219, 0.2)' } as any,
      default: {
        shadowColor: '#0085db',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },

  desktopInfoTexts: {
    justifyContent: 'center',
  },
  mayaNameDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  timerTextDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#0f172a',
  },
  stateLabelDesktop: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    marginTop: 3,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#22c55e',
  },
  statusDotRed: {
    backgroundColor: '#ef4444',
  },
  statusDotOrange: {
    backgroundColor: '#f59e0b',
  },
  timerText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0f172a',
  },
  timerMax: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13,
    color: '#94a3b8',
  },
  stateLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    marginTop: 2,
  },
  stateLabelSpeaking: {
    color: '#0ea5e9',
  },
  stateLabelListening: {
    color: '#a855f7',
  },
  stateLabelWarning: {
    color: '#f59e0b',
  },
  stateLabelLost: {
    color: '#ef4444',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
    zIndex: 10,
  },
  centerContentDesktop: {
    maxWidth: 780,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 36,
  },
  noticeWrapper: {
    minHeight: 40,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  promptTextDesktop: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 28,
    lineHeight: 40,
    maxWidth: 720,
  },
  hangupButtonPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.95 }],
  },
  hangupIcon: {
    fontSize: 22,
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
