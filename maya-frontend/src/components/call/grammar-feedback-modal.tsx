import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { Radii } from '@/theme/tokens';
import { useBreakpoint } from '@/hooks/useBreakpoint';

// ─── SVG ICONS ────────────────────────────────────────────────────────────────

function GrammarDocumentIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="3" width="16" height="18" rx="3" stroke="#2B5BFF" strokeWidth="2" />
      <Path d="M8 8H16" stroke="#2B5BFF" strokeWidth="2" strokeLinecap="round" />
      <Path d="M8 12H13" stroke="#2B5BFF" strokeWidth="2" strokeLinecap="round" />
      <Path
        d="M8 16L10 18L15 13"
        stroke="#2B5BFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LightbulbIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18H15M10 21H14"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M12 2C7.58172 2 4 5.58172 4 10C4 12.89 5.54 15.42 7.85 16.78C8.55 17.19 9 17.92 9 18.73V19H15V18.73C15 17.92 15.45 17.19 16.15 16.78C18.46 15.42 20 12.89 20 10C20 5.58172 16.4183 2 12 2Z"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CircleCrossIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Circle cx="13" cy="13" r="13" fill="#EF4444" />
      <Path
        d="M9 9L17 17M17 9L9 17"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CircleCheckIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Circle cx="13" cy="13" r="13" fill="#10B981" />
      <Path
        d="M8 13.2L11.5 16.7L18 9.5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke="#64748B"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"
        fill="#2B5BFF"
      />
      <Path
        d="M19 16L20 18.5L22.5 19.5L20 20.5L19 23L18 20.5L15.5 19.5L18 18.5L19 16Z"
        fill="#60A5FA"
      />
    </Svg>
  );
}

function InfoCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="2" />
      <Path d="M12 16V12" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1.2" fill="#2563EB" />
    </Svg>
  );
}

// ─── PROPS & TYPES ────────────────────────────────────────────────────────────

export interface GrammarFeedbackData {
  type?: 'grammar' | 'rephrase';
  originalSentence: string;
  highlightedMistake?: string;
  correctedSentence: string;
  highlightedCorrection?: string;
  whyExplanation: string;
  autoDismissSeconds?: number;
}

export interface GrammarFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  feedback?: GrammarFeedbackData;
}

const DEFAULT_FEEDBACK: GrammarFeedbackData = {
  type: 'grammar',
  originalSentence: 'I go to beach every weekend',
  highlightedMistake: 'go',
  correctedSentence: 'I go to the beach every weekend.',
  highlightedCorrection: 'the',
  whyExplanation: 'Use "the beach" because we usually refer to the beach as a specific place.',
  autoDismissSeconds: 8,
};

export function GrammarFeedbackModal({
  visible,
  onClose,
  feedback = DEFAULT_FEEDBACK,
}: GrammarFeedbackModalProps) {
  const { isPhone } = useBreakpoint();
  const isDesktop = !isPhone;
  const { width: windowWidth } = useWindowDimensions();

  const initialSeconds = feedback.autoDismissSeconds ?? 10;
  const [countdown, setCountdown] = useState(initialSeconds);
  const [internalVisible, setInternalVisible] = useState(visible);

  const isClosingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Animation drivers
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(450)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.92)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  // Graceful animated close handler
  const handleAnimatedClose = useCallback((notifyParent: boolean = true) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const useNative = Platform.OS !== 'web';

    const closeAnimations: Animated.CompositeAnimation[] = [
      // 1. Backdrop fade out (200ms)
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
    ];

    if (isDesktop) {
      // Desktop: Scale down slightly and fade out
      closeAnimations.push(
        Animated.timing(cardOpacityAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(cardScaleAnim, {
          toValue: 0.93,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: useNative,
        })
      );
    } else {
      // Mobile: Slide bottom sheet down smoothly off screen
      closeAnimations.push(
        Animated.timing(sheetTranslateY, {
          toValue: 450,
          duration: 220,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: useNative,
        })
      );
    }

    Animated.parallel(closeAnimations).start(() => {
      setInternalVisible(false);
      isClosingRef.current = false;
      if (notifyParent) {
        onClose();
      }
    });
  }, [backdropAnim, cardOpacityAnim, cardScaleAnim, sheetTranslateY, isDesktop, onClose]);

  // Handle open / external close triggers
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setInternalVisible(true);
      setCountdown(initialSeconds);

      // Reset animation values for smooth entrance
      backdropAnim.setValue(0);
      sheetTranslateY.setValue(450);
      cardScaleAnim.setValue(0.92);
      cardOpacityAnim.setValue(0);

      const useNative = Platform.OS !== 'web';

      const openAnimations: Animated.CompositeAnimation[] = [
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.ease),
          useNativeDriver: useNative,
        }),
      ];

      if (isDesktop) {
        openAnimations.push(
          Animated.timing(cardOpacityAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(cardScaleAnim, {
            toValue: 1,
            duration: 260,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: useNative,
          })
        );
      } else {
        openAnimations.push(
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: useNative,
          })
        );
      }

      Animated.parallel(openAnimations).start();

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleAnimatedClose(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      // If parent turned off visible, run animated close before unmounting
      if (internalVisible && !isClosingRef.current) {
        handleAnimatedClose(false);
      }
    }
  }, [
    visible,
    initialSeconds,
    isDesktop,
    handleAnimatedClose,
    internalVisible,
    backdropAnim,
    sheetTranslateY,
    cardScaleAnim,
    cardOpacityAnim,
  ]);

  if (!internalVisible) return null;

  // Render sentence with highlighted token
  const renderSentenceWithHighlight = (
    sentence: string,
    highlightWord: string,
    highlightColor: string
  ) => {
    if (!highlightWord) {
      return <Text style={styles.sentenceBaseText}>{sentence}</Text>;
    }

    const regex = new RegExp(`(${highlightWord})`, 'gi');
    const parts = sentence.split(regex);

    return (
      <Text style={styles.sentenceBaseText}>
        {parts.map((part, index) => {
          if (part.toLowerCase() === highlightWord.toLowerCase()) {
            return (
              <Text
                key={index}
                style={[styles.highlightedToken, { color: highlightColor }]}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={() => handleAnimatedClose(true)}
    >
      <View
        style={[
          styles.overlay,
          isDesktop ? styles.desktopOverlay : styles.mobileOverlay,
        ]}
      >
        {/* Animated Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim },
            Platform.OS === 'web' && ({ willChange: 'opacity' } as any),
          ]}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={() => handleAnimatedClose(true)}
            accessibilityRole="button"
            accessibilityLabel="Close feedback backdrop"
          />
        </Animated.View>

        {/* Modal Card / Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.cardContainer,
            isDesktop ? styles.desktopCard : styles.mobileSheet,
            isDesktop
              ? {
                  opacity: cardOpacityAnim,
                  transform: [{ scale: cardScaleAnim }],
                }
              : {
                  transform: [{ translateY: sheetTranslateY }],
                },
            Platform.OS === 'web' && ({ willChange: 'transform, opacity' } as any),
          ]}
        >
          {/* Mobile Drag Handle */}
          {!isDesktop && <View style={styles.grabHandle} />}

          {/* Top Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerIconSquare}>
              {feedback.type === 'rephrase' ? (
                <SparkleIcon size={24} />
              ) : (
                <GrammarDocumentIcon size={24} />
              )}
            </View>

            <View style={styles.headerTitlesCol}>
              <Text style={styles.headerTitle}>
                {feedback.type === 'rephrase' ? 'Rephrase Suggestion' : 'Grammar Feedback'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {feedback.type === 'rephrase'
                  ? "Here's a more natural way to say it."
                  : 'Here are a few improvements from your last response.'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={() => handleAnimatedClose(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close feedback"
            >
              <CloseIcon size={14} />
            </Pressable>
          </View>

          {feedback.type === 'rephrase' ? (
            <>
              {/* Section: What you said */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>What you said</Text>
                <View style={styles.rephraseWhatYouSaidCard}>
                  <Text style={styles.sentenceBaseText}>{feedback.originalSentence}</Text>
                </View>
              </View>

              {/* Section: A more natural way */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>A more natural way</Text>
                <View style={styles.rephraseNaturalCard}>
                  <View style={styles.sentenceTextWrapper}>
                    <Text style={styles.rephraseNaturalText}>{feedback.correctedSentence}</Text>
                  </View>
                  <View style={styles.badgeWrapper}>
                    <CircleCheckIcon size={24} />
                  </View>
                </View>
              </View>

              {/* Section: Why this sounds more natural */}
              <View style={styles.rephraseWhyCard}>
                <View style={styles.infoCircle}>
                  <InfoCircleIcon size={20} />
                </View>
                <View style={styles.whyTextCol}>
                  <Text style={styles.rephraseWhyTitle}>Why this sounds more natural</Text>
                  <Text style={styles.rephraseWhyExplanationText}>
                    {feedback.whyExplanation}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Section: Your sentence */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>Your sentence</Text>
                <View style={styles.mistakeCard}>
                  <View style={styles.sentenceTextWrapper}>
                    {renderSentenceWithHighlight(
                      feedback.originalSentence,
                      feedback.highlightedMistake || '',
                      '#EF4444'
                    )}
                  </View>
                  <View style={styles.badgeWrapper}>
                    <CircleCrossIcon size={24} />
                  </View>
                </View>
              </View>

              {/* Section: Corrected version */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>Corrected version</Text>
                <View style={styles.correctedCard}>
                  <View style={styles.sentenceTextWrapper}>
                    {renderSentenceWithHighlight(
                      feedback.correctedSentence,
                      feedback.highlightedCorrection || '',
                      '#10B981'
                    )}
                  </View>
                  <View style={styles.badgeWrapper}>
                    <CircleCheckIcon size={24} />
                  </View>
                </View>
              </View>

              {/* Section: Why this is better */}
              <View style={styles.whyCard}>
                <View style={styles.lightbulbCircle}>
                  <LightbulbIcon size={18} />
                </View>
                <View style={styles.whyTextCol}>
                  <Text style={styles.whyTitle}>Why this is better</Text>
                  <Text style={styles.whyExplanationText}>
                    {feedback.whyExplanation}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Action CTA Button */}
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
            onPress={() => handleAnimatedClose(true)}
            accessibilityRole="button"
            accessibilityLabel={`Got it, closing in ${countdown} seconds`}
          >
            <Text style={styles.ctaButtonText}>
              Got it! ({countdown})
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mobileOverlay: {
    justifyContent: 'flex-end',
  },
  desktopOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // ── Card Containers ──
  cardContainer: {
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }),
  },
  mobileSheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  desktopCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
  },

  // ── Grab Handle ──
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },

  // ── Header Row ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  headerIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitlesCol: {
    flex: 1,
  },
  headerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  closeButtonPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.94 }],
  },

  // ── Section Block ──
  sectionBlock: {
    marginBottom: 14,
  },
  sectionLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },

  // ── Mistake Card ──
  mistakeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  sentenceTextWrapper: {
    flex: 1,
  },
  sentenceBaseText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  highlightedToken: {
    ...fontStyle('inter', 'bold'),
  },
  badgeWrapper: {
    marginLeft: 8,
  },

  // ── Corrected Card ──
  correctedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },

  // ── Why Card ──
  whyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 22,
  },
  lightbulbCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  whyTextCol: {
    flex: 1,
  },
  whyTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#2563EB',
    marginBottom: 3,
  },
  whyExplanationText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },

  // ── Rephrase Suggestion Cards ──
  rephraseWhatYouSaidCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rephraseNaturalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rephraseNaturalText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#15803D',
    lineHeight: 22,
  },
  rephraseWhyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 22,
  },
  infoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rephraseWhyTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#1D4ED8',
    marginBottom: 3,
  },
  rephraseWhyExplanationText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 19,
  },

  // ── CTA Button ──
  ctaButton: {
    height: 52,
    backgroundColor: '#2B5BFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
    ...Platform.select({
      web: { boxShadow: '0 4px 8px rgba(43, 91, 255, 0.25)' } as any,
      default: {
        shadowColor: '#2B5BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },

  ctaButtonPressed: {
    backgroundColor: '#1E40AF',
    transform: [{ scale: 0.99 }],
  },
  ctaButtonText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
