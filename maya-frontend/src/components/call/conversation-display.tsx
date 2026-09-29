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

interface ConversationDisplayProps {
  previousText?: string;
  currentText: string;
  isSpeaking: boolean;
  isWebOrDesktop?: boolean;
}

/**
 * Returns large, confident typography matching the official design reference.
 * Typography size is calculated from the full sentence length so the font
 * stays rock-solid and stable throughout the word-by-word voice stream.
 */
function getPromptTypography(textLength: number, isDesktop: boolean) {
  if (isDesktop) {
    if (textLength <= 80) return { fontSize: 32, lineHeight: 44 };
    if (textLength <= 160) return { fontSize: 26, lineHeight: 37 };
    return { fontSize: 22, lineHeight: 32 };
  }

  // Mobile Typography:
  if (textLength <= 70) {
    // Standard conversational prompt (e.g. "That's great! What do you usually do on weekends?")
    return { fontSize: 27, lineHeight: 38 };
  } else if (textLength <= 140) {
    // Moderate response
    return { fontSize: 23.5, lineHeight: 33 };
  } else {
    // Multi-sentence longer reply
    return { fontSize: 20.5, lineHeight: 29 };
  }
}

function ConversationDisplayComponent({
  previousText,
  currentText,
  isSpeaking,
  isWebOrDesktop = false,
}: ConversationDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Progressive word-by-word reveal synchronized with voice playback rate
  const [revealedWordCount, setRevealedWordCount] = useState<number>(0);
  const wordsRef = useRef<string[]>([]);
  const timerRef = useRef<any>(null);
  const lastProcessedTextRef = useRef<string>('');

  // Transition animations for previous and current turns
  const prevFadeAnim = useRef(new Animated.Value(0.5)).current;
  const prevSlideAnim = useRef(new Animated.Value(0)).current;

  const currentFadeAnim = useRef(new Animated.Value(1)).current;
  const currentSlideAnim = useRef(new Animated.Value(0)).current;

  // Dancing audio wave indicator bars while Maya is speaking
  const wave1Anim = useRef(new Animated.Value(0.3)).current;
  const wave2Anim = useRef(new Animated.Value(0.7)).current;
  const wave3Anim = useRef(new Animated.Value(0.4)).current;
  const wave4Anim = useRef(new Animated.Value(0.8)).current;
  const wave5Anim = useRef(new Animated.Value(0.35)).current;

  const prevTextRef = useRef<string>(previousText || '');

  // Full length of the active sentence for stable font sizing
  const fullSentence = currentText?.trim() || previousText?.trim() || '';
  const { fontSize, lineHeight } = useMemo(
    () => getPromptTypography(fullSentence.length, isWebOrDesktop),
    [fullSentence.length, isWebOrDesktop]
  );

  // Voice-Synchronized Word Reveal Engine:
  // Paces words at ~360ms–400ms matching Maya's natural conversational cadence (~140 wpm)
  // with natural pauses on punctuation marks.
  useEffect(() => {
    const trimmed = (currentText || '').trim();
    if (!trimmed) {
      setRevealedWordCount(0);
      lastProcessedTextRef.current = '';
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const words = trimmed.split(/\s+/);
    wordsRef.current = words;

    // Detect if a fresh new turn started
    const isBrandNewTurn =
      !lastProcessedTextRef.current ||
      !trimmed.startsWith(lastProcessedTextRef.current.slice(0, Math.min(12, lastProcessedTextRef.current.length)));

    if (isBrandNewTurn && trimmed !== lastProcessedTextRef.current) {
      lastProcessedTextRef.current = trimmed;
      setRevealedWordCount(1);
    } else {
      lastProcessedTextRef.current = trimmed;
    }

    // When Maya stops speaking (turn ended or barge-in), immediately reveal full text
    if (!isSpeaking) {
      setRevealedWordCount(words.length);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Schedule progressive reveal of words synced with speech rate
    const scheduleNextWord = (currentIdx: number) => {
      if (currentIdx >= wordsRef.current.length) {
        timerRef.current = null;
        return;
      }

      const justRevealedWord = wordsRef.current[currentIdx - 1] || '';

      // Conversational audio cadence: ~360ms per word (~145 words/min)
      let wordDelay = 360;
      if (/[.?!]$/.test(justRevealedWord)) {
        wordDelay += 280; // Natural sentence boundary breath pause
      } else if (/[,;:\-]$/.test(justRevealedWord)) {
        wordDelay += 140; // Natural comma/clause pause
      }

      timerRef.current = setTimeout(() => {
        setRevealedWordCount((prev) => {
          const next = prev + 1;
          scheduleNextWord(next);
          return next;
        });
      }, wordDelay);
    };

    if (!timerRef.current && isSpeaking) {
      scheduleNextWord(revealedWordCount || 1);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentText, isSpeaking]);

  // Smooth upward glide & fade transition when switching turns
  useEffect(() => {
    if (previousText && previousText !== prevTextRef.current) {
      prevTextRef.current = previousText;

      // Start previous text from active position and animate upward & faded
      prevFadeAnim.setValue(0.85);
      prevSlideAnim.setValue(8);

      // Start current text slightly below and fade in to 100%
      currentFadeAnim.setValue(0.3);
      currentSlideAnim.setValue(14);

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
        Animated.timing(currentFadeAnim, {
          toValue: 1.0,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(currentSlideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [previousText]);

  // Live dancing waveform animation when Maya is actively speaking
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wave1Anim, { toValue: 1.0, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave1Anim, { toValue: 0.25, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave2Anim, { toValue: 0.2, duration: 210, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave2Anim, { toValue: 1.0, duration: 290, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave3Anim, { toValue: 1.0, duration: 260, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave3Anim, { toValue: 0.3, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave4Anim, { toValue: 0.25, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave4Anim, { toValue: 0.95, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
          ]),
          Animated.sequence([
            Animated.timing(wave5Anim, { toValue: 0.9, duration: 230, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(wave5Anim, { toValue: 0.2, duration: 270, useNativeDriver: Platform.OS !== 'web' }),
          ]),
        ])
      );
      anim.start();
    } else {
      Animated.parallel([
        Animated.timing(wave1Anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wave2Anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wave3Anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wave4Anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wave5Anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }

    return () => {
      if (anim) anim.stop();
    };
  }, [isSpeaking]);

  // Auto-scroll as words progressively reveal
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [revealedWordCount, currentText]);

  // Compute text to display: progressive words up to revealedWordCount
  const displayedCurrentText = useMemo(() => {
    if (currentText && currentText.trim()) {
      if (!isSpeaking) {
        return currentText.trim();
      }
      const words = currentText.trim().split(/\s+/);
      const count = Math.min(Math.max(1, revealedWordCount), words.length);
      return words.slice(0, count).join(' ');
    }
    return previousText?.trim() || '';
  }, [currentText, isSpeaking, revealedWordCount, previousText]);

  const hasPrevious = !!(
    previousText &&
    previousText.trim().length > 0 &&
    previousText.trim() !== currentText?.trim()
  );

  const hasContent = !!displayedCurrentText;
  if (!hasContent) {
    return null;
  }

  return (
    <View style={[styles.outerContainer, isWebOrDesktop && styles.outerContainerDesktop]}>
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
        {/* 1. Previous Model Turn (Faded, elevated upward with smooth transition) */}
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

        {/* 2. Current Active Model Turn (Progressive word-by-word reveal synchronized with voice) */}
        <Animated.View
          style={[
            styles.currentWrapper,
            {
              opacity: currentFadeAnim,
              transform: [{ translateY: currentSlideAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.promptText,
              { fontSize, lineHeight },
              isWebOrDesktop && styles.promptTextDesktop,
            ]}
          >
            {displayedCurrentText}
          </Text>

          {/* Dancing Audio Waveform Bars (Active while Maya is speaking) */}
          {isSpeaking && (
            <View style={styles.waveContainer}>
              <Animated.View style={[styles.waveBar, { transform: [{ scaleY: wave1Anim }] }]} />
              <Animated.View style={[styles.waveBar, { transform: [{ scaleY: wave2Anim }] }]} />
              <Animated.View style={[styles.waveBar, { transform: [{ scaleY: wave3Anim }] }]} />
              <Animated.View style={[styles.waveBar, { transform: [{ scaleY: wave4Anim }] }]} />
              <Animated.View style={[styles.waveBar, { transform: [{ scaleY: wave5Anim }] }]} />
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    minHeight: 140,
    maxHeight: 310,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerContainerDesktop: {
    maxWidth: 720,
    minHeight: 170,
    maxHeight: 380,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  previousWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  previousText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  previousTextDesktop: {
    fontSize: 18,
    lineHeight: 26,
  },
  currentWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    ...fontStyle('outfit', 'bold'),
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  promptTextDesktop: {
    maxWidth: 680,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 28,
    marginTop: 18,
  },
  waveBar: {
    width: 4,
    height: 24,
    backgroundColor: '#0ea5e9', // Maya sky-blue
    borderRadius: 2,
  },
});

export const ConversationDisplay = React.memo(ConversationDisplayComponent);
