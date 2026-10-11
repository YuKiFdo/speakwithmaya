import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { fontStyle } from '@/theme/fonts';
import { TranslationToggleButton } from './translation-toggle-button';
import { triggerHaptic } from '@/utils/haptics-audio';

interface ConversationDisplayProps {
  previousText?: string;
  currentText: string;
  isSpeaking: boolean;
  isWebOrDesktop?: boolean;
  translationText?: string;
  isTranslationVisible?: boolean;
  isTranslating?: boolean;
  onToggleTranslation?: () => void;
}

/**
 * Returns large, confident typography matching the official design reference.
 */
function getPromptTypography(textLength: number, isDesktop: boolean) {
  if (isDesktop) {
    if (textLength <= 80) return { fontSize: 32, lineHeight: 44 };
    if (textLength <= 160) return { fontSize: 26, lineHeight: 37 };
    return { fontSize: 22, lineHeight: 32 };
  }

  // Mobile Typography:
  if (textLength <= 70) {
    return { fontSize: 27, lineHeight: 38 };
  } else if (textLength <= 140) {
    return { fontSize: 23.5, lineHeight: 33 };
  } else {
    return { fontSize: 20.5, lineHeight: 29 };
  }
}

function ConversationDisplayComponent({
  previousText,
  currentText,
  isSpeaking,
  isWebOrDesktop = false,
  translationText,
  isTranslationVisible = false,
  isTranslating = false,
  onToggleTranslation,
}: ConversationDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Progressive word-by-word pacing engine
  const [displayedCount, setDisplayedCount] = useState<number>(0);
  const tickerTimerRef = useRef<any>(null);
  const lastProcessedTextRef = useRef<string>('');

  // Transition animations for previous turn
  const prevFadeAnim = useRef(new Animated.Value(0.5)).current;
  const prevSlideAnim = useRef(new Animated.Value(0)).current;

  // Translation text fade-in animation
  const translationAnim = useRef(new Animated.Value(0)).current;

  const prevTextRef = useRef<string>(previousText || '');

  // Parse all words from incoming speech stream
  const fullRawText = (currentText || '').trim();
  const allTargetWords = useMemo(() => {
    if (!fullRawText) return [];
    return fullRawText.split(/\s+/).filter(Boolean);
  }, [fullRawText]);

  // Full length of the active sentence for stable font sizing
  const fullSentence = fullRawText || previousText?.trim() || '';
  const { fontSize, lineHeight } = useMemo(
    () => getPromptTypography(fullSentence.length, isWebOrDesktop),
    [fullSentence.length, isWebOrDesktop]
  );

  // 1. Detect turn changes and reset word count
  useEffect(() => {
    if (!fullRawText) {
      setDisplayedCount(0);
      lastProcessedTextRef.current = '';
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
      return;
    }

    // Detect if this is a brand new sentence/turn
    const isNewTurn =
      !lastProcessedTextRef.current ||
      !fullRawText.startsWith(
        lastProcessedTextRef.current.slice(0, Math.min(10, lastProcessedTextRef.current.length))
      );

    if (isNewTurn && fullRawText !== lastProcessedTextRef.current) {
      lastProcessedTextRef.current = fullRawText;
      // Start immediately with word 1 for instant response
      setDisplayedCount(1);
    } else {
      lastProcessedTextRef.current = fullRawText;
    }
  }, [fullRawText]);

  // 2. Silky-smooth progressive word ticker
  useEffect(() => {
    // If all words are already displayed, stop ticking
    if (displayedCount >= allTargetWords.length) {
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
      return;
    }

    // How many words behind the audio stream are we?
    const wordsBehind = allTargetWords.length - displayedCount;

    // Natural conversational English cadence:
    // ~175ms per word (~160 words per minute, natural speech rate)
    let nextDelay = 175;

    if (!isSpeaking) {
      // Maya has finished speaking: smoothly glide through remaining words
      nextDelay = 65;
    } else if (wordsBehind > 4) {
      // Catch up smoothly if stream buffered
      nextDelay = 95;
    } else if (wordsBehind > 2) {
      nextDelay = 130;
    }

    // Natural punctuation rhythm
    const lastRevealedWord = allTargetWords[displayedCount - 1] || '';
    if (isSpeaking && /[.?!]$/.test(lastRevealedWord)) {
      nextDelay += 140; // Sentence boundary pause
    } else if (isSpeaking && /[,;:\-]$/.test(lastRevealedWord)) {
      nextDelay += 65; // Clause pause
    }

    tickerTimerRef.current = setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + 1, allTargetWords.length));
    }, nextDelay);

    return () => {
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
    };
  }, [displayedCount, allTargetWords.length, isSpeaking]);

  // 2b. Tactile speech-synchronized haptic pulse as transcription words appear
  const lastHapticTimeRef = useRef<number>(0);
  useEffect(() => {
    if (displayedCount > 0) {
      const now = Date.now();
      // Throttle to minimum 65ms so fast stream catchups produce crisp micro-pulses
      if (now - lastHapticTimeRef.current >= 65) {
        lastHapticTimeRef.current = now;
        triggerHaptic('word');
      }
    }
  }, [displayedCount]);

  // 3. Smooth upward glide & fade transition when previous turn changes
  useEffect(() => {
    if (previousText && previousText !== prevTextRef.current) {
      prevTextRef.current = previousText;

      prevFadeAnim.setValue(0.85);
      prevSlideAnim.setValue(8);

      Animated.parallel([
        Animated.timing(prevFadeAnim, {
          toValue: 0.5,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(prevSlideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [previousText]);

  // 4. Animate translation text fade-in
  useEffect(() => {
    if (isTranslationVisible && translationText) {
      triggerHaptic('selection');
      Animated.timing(translationAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      translationAnim.setValue(0);
    }
  }, [isTranslationVisible, translationText]);

  // 5. Auto-scroll as words progressively reveal
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [displayedCount, fullRawText]);

  // Compute words currently visible on screen
  const visibleWords = useMemo(() => {
    if (!allTargetWords.length) {
      return (previousText || '').trim().split(/\s+/).filter(Boolean);
    }
    const count = Math.min(displayedCount, allTargetWords.length);
    return allTargetWords.slice(0, count);
  }, [allTargetWords, displayedCount, previousText]);

  const hasPrevious = !!(
    previousText &&
    previousText.trim().length > 0 &&
    previousText.trim() !== currentText?.trim()
  );

  const hasContent = visibleWords.length > 0;
  if (!hasContent) {
    return null;
  }

  // True when all words have finished appearing and Maya has stopped speaking
  const isTextFinished = !isSpeaking && (displayedCount >= allTargetWords.length || !currentText?.trim());

  return (
    <View style={[styles.outerContainer, isWebOrDesktop && styles.outerContainerDesktop]}>
      {/* CSS Keyframe for silky smooth word fade & soft glide */}
      {Platform.OS === 'web' && (
        <style>{`
          @keyframes wordGlideIn {
            0% {
              opacity: 0;
              transform: translateY(3px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .maya-word-glide {
            display: inline-block;
            animation: wordGlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {/* 1. Previous Model Turn (Faded upward with smooth transition) */}
        {hasPrevious && !!currentText?.trim() && (
          <Animated.View
            style={[
              styles.previousWrapper,
              {
                opacity: prevFadeAnim,
                transform: [{ translateY: prevSlideAnim }],
              },
            ]}
          >
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[styles.previousText, isWebOrDesktop && styles.previousTextDesktop]}
            >
              {previousText}
            </Text>
          </Animated.View>
        )}

        {/* 2. Current Active Model Turn (Smooth word-by-word streaming) */}
        <View style={styles.currentWrapper}>
          <Text
            style={[
              styles.promptText,
              { fontSize, lineHeight },
              isWebOrDesktop && styles.promptTextDesktop,
            ]}
          >
            {visibleWords.map((word, idx) => (
              <Text
                key={`${word}-${idx}`}
                style={[
                  styles.wordItem,
                  Platform.OS === 'web' ? ({ className: 'maya-word-glide' } as any) : null,
                ]}
              >
                {word}{' '}
              </Text>
            ))}
          </Text>

          {/* Sinhala Translation of Active Prompt (Clean text directly underneath matching reference) */}
          {isTranslationVisible && !!translationText && (
            <Animated.Text
              style={[
                styles.sinhalaTranslationText,
                isWebOrDesktop && styles.sinhalaTranslationTextDesktop,
                { opacity: translationAnim },
              ]}
            >
              {translationText}
            </Animated.Text>
          )}

          {/* Translation Toggle Pill Button (ONLY appears when all words have finished appearing) */}
          {!!onToggleTranslation && isTextFinished && (
            <TranslationToggleButton
              isExpanded={Boolean(isTranslationVisible)}
              isLoading={isTranslating}
              onToggle={() => {
                triggerHaptic('light');
                onToggleTranslation();
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export const ConversationDisplay = React.memo(ConversationDisplayComponent);

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    maxHeight: 280,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  outerContainerDesktop: {
    maxHeight: 340,
    maxWidth: 680,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  previousWrapper: {
    marginBottom: 8,
    alignItems: 'center',
  },
  previousText: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 15,
    lineHeight: 22,
    color: '#94A3B8',
    textAlign: 'center',
  },
  previousTextDesktop: {
    fontSize: 17,
    lineHeight: 25,
  },
  currentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    ...fontStyle('outfit', 'bold'),
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  promptTextDesktop: {
    letterSpacing: -0.5,
  },
  wordItem: {
    color: '#0F172A',
  },
  sinhalaTranslationText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 16.5,
    lineHeight: 25,
    color: '#334155',
    textAlign: 'center',
    letterSpacing: -0.1,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  sinhalaTranslationTextDesktop: {
    fontSize: 18.5,
    lineHeight: 27,
  },
});
