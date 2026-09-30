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

export default function CallScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Real-time network & connection monitor
  const connection = useConnectionMonitor();

  // Core Gemini Live Audio & Call Engine
  const liveCall = useLiveCall({
    topic: params.goal || 'General Speaking Practice',
    goal: params.goal,
    level: params.level,
  });

  const [sessionEndNotice, setSessionEndNotice] = useState(false);

  // Auto-start Gemini Live call session on component mount with cleanup on unmount
  useEffect(() => {
    liveCall.startCall();
    return () => {
      liveCall.endCall(false);
    };
  }, []);


  const isReconnecting = liveCall.status === 'reconnecting' || connection.isReconnecting;
  const isConnectionLost = connection.isLost;

  // Priority: 1. Live network connection alert -> 2. Session ending notice -> 3. Idle / Hidden
  const activeToastPreset: ToastPillPreset | null = isReconnecting
    ? 'reconnecting'
    : isConnectionLost
    ? 'connection-lost'
    : (connection.toastPreset ?? (sessionEndNotice ? 'session-ends' : null));

  const displayedStatusText = isConnectionLost
    ? 'Connection lost'
    : isReconnecting
    ? 'Reconnecting...'
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
  const connectingScaleAnim = useRef(new Animated.Value(1.0)).current;
  const callContentFadeAnim = useRef(new Animated.Value(0)).current;
  const callContentScaleAnim = useRef(new Animated.Value(0.97)).current;
  const hasTransitionedRef = useRef(false);

  useEffect(() => {
    if (liveCall.status !== 'connecting' && liveCall.status !== 'idle' && !hasTransitionedRef.current) {
      hasTransitionedRef.current = true;
      Animated.parallel([
        Animated.timing(connectingFadeAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(connectingScaleAnim, {
          toValue: 1.04,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(callContentFadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(callContentScaleAnim, {
          toValue: 1.0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
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
    liveCall.endCall();
  };

  const handleBackToHome = () => {
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
      <Animated.View
        style={[
          styles.mainContentWrapper,
          {
            opacity: callContentFadeAnim,
            transform: [{ scale: callContentScaleAnim }],
          },
        ]}
      >
        <Pressable style={styles.fullScreenTouch} onPress={handleScreenTouch}>
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
                        connection.isLost
                          ? styles.statusDotRed
                          : connection.isReconnecting || connection.isWeak
                          ? styles.statusDotOrange
                          : liveCall.status === 'speaking'
                          ? styles.statusDotGreen
                          : styles.statusDotRed,
                      ]}
                    />
                    <Text style={styles.timerText}>
                      {formatTime(liveCall.secondsElapsed)}{' '}
                      <Text style={styles.timerMax}>/ 15:00</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabel,
                      isConnectionLost
                        ? styles.stateLabelLost
                        : isReconnecting || connection.isWeak
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
                        connection.isLost
                          ? styles.statusDotRed
                          : connection.isReconnecting || connection.isWeak
                          ? styles.statusDotOrange
                          : liveCall.status === 'speaking'
                          ? styles.statusDotGreen
                          : styles.statusDotRed,
                      ]}
                    />
                    <Text style={styles.timerTextDesktop}>
                      {formatTime(liveCall.secondsElapsed)}{' '}
                      <Text style={styles.timerMax}>/ 15:00</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabelDesktop,
                      connection.isLost
                        ? styles.stateLabelLost
                        : connection.isReconnecting || connection.isWeak
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
                  text={activeToastPreset === 'session-ends' ? 'The session ends in 4 seconds' : undefined}
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
    </Animated.View>

      {/* Smooth connecting overlay with cinematic crossfade and entrance zoom */}
      {connectingVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.connectingOverlay,
            {
              opacity: connectingFadeAnim,
              transform: [{ scale: connectingScaleAnim }],
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
    zIndex: 999,
    backgroundColor: '#ffffff',
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
