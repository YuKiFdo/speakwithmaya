import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ScrollView,
} from 'react-native';
import { fontStyle } from '@/theme/fonts';
import { TranslationToggleButton } from './translation-toggle-button';
import { BeaconRing } from './beacon-ring';

interface ConversationDisplayProps {
  previousText?: string;
  currentText: string;
  isSpeaking: boolean;
  isWebOrDesktop?: boolean;
  translationText?: string;
  isTranslationVisible?: boolean;
  isTranslating?: boolean;
  onToggleTranslation?: () => void;
  isTranslationHighlighted?: boolean;
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
  isTranslationHighlighted = false,
}: ConversationDisplayProps) {
  const scrollRef = useRef<ScrollView>(null);
  const useNative = Platform.OS !== 'web';

  // Progressive word-by-word pacing state
  const [displayedCount, setDisplayedCount] = useState<number>(0);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTurnPrefixRef = useRef<string>('');
  const lastContentHeightRef = useRef<number>(0);

  // Subtle fade animation for the newest revealed word (zero DOM bloat)
  const latestWordFade = useRef(new Animated.Value(1)).current;

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

  // Keep latest target words in a ref so incoming stream chunks don't cancel the active word timer
  const targetWordsRef = useRef<string[]>(allTargetWords);
  targetWordsRef.current = allTargetWords;

  const isSpeakingRef = useRef<boolean>(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const fullSentence = fullRawText || previousText?.trim() || '';
  const { fontSize, lineHeight } = useMemo(
    () => getPromptTypography(fullSentence.length, isWebOrDesktop),
    [fullSentence.length, isWebOrDesktop]
  );

  // 1. Detect brand new turn vs streaming update
  useEffect(() => {
    if (!fullRawText) {
      setDisplayedCount(0);
      lastTurnPrefixRef.current = '';
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
      return;
    }

    const prefix = fullRawText.slice(0, 12);
    const prevPrefix = lastTurnPrefixRef.current;

    const isNewTurn =
      !prevPrefix ||
      (!fullRawText.startsWith(prevPrefix) && !prevPrefix.startsWith(prefix));

    if (isNewTurn) {
      lastTurnPrefixRef.current = prefix;
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
      // Start with the first word immediately
      setDisplayedCount(1);
    } else {
      lastTurnPrefixRef.current = prefix;
      setDisplayedCount((prev) => (prev === 0 ? 1 : prev));
    }
  }, [fullRawText]);

  // 2. Natural Voice-Synced Word Ticker (~135-145 WPM while speaking)
  useEffect(() => {
    const totalWords = targetWordsRef.current.length;

    if (displayedCount === 0 || displayedCount >= totalWords) {
      return;
    }

    // Smoothly fade in the newly revealed word
    latestWordFade.setValue(0.2);
    Animated.timing(latestWordFade, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();

    const lastRevealedWord = targetWordsRef.current[displayedCount - 1] || '';
    const nextWordToReveal = targetWordsRef.current[displayedCount] || '';
    const cleanLen = nextWordToReveal.replace(/[^\w]/g, '').length;

    let nextDelay = 360;

    if (!isSpeakingRef.current) {
      // Maya's audio has finished playing: smoothly finish any remaining words
      nextDelay = 95;
    } else {
      // Maya is actively speaking: pace strictly to natural spoken English (~135-145 WPM)
      // Scales by word length (270ms for short words up to 520ms for longer multi-syllable words)
      nextDelay = Math.max(270, Math.min(520, cleanLen * 52 + 210));

      // Add realistic spoken breath pauses after punctuation on the word just spoken
      if (/[.?!]$/.test(lastRevealedWord)) {
        nextDelay += 380; // End-of-sentence pause
      } else if (/[,;:\-—]$/.test(lastRevealedWord)) {
        nextDelay += 200; // Mid-sentence comma/clause pause
      }
    }

    tickerTimerRef.current = setTimeout(() => {
      tickerTimerRef.current = null;
      setDisplayedCount((prev) =>
        Math.min(prev + 1, targetWordsRef.current.length)
      );
    }, nextDelay);

    return () => {
      if (tickerTimerRef.current) {
        clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
    };
  }, [displayedCount, isSpeaking, latestWordFade, useNative]);

  // If new stream chunks arrive after displayedCount had momentarily caught up, resume ticking
  useEffect(() => {
    if (
      displayedCount > 0 &&
      displayedCount < allTargetWords.length &&
      !tickerTimerRef.current
    ) {
      tickerTimerRef.current = setTimeout(() => {
        tickerTimerRef.current = null;
        setDisplayedCount((prev) =>
          Math.min(prev + 1, targetWordsRef.current.length)
        );
      }, 180);
    }
  }, [allTargetWords.length, displayedCount]);

  // 3. Smooth upward glide & fade transition when previous turn changes
  useEffect(() => {
    if (previousText && previousText !== prevTextRef.current) {
      prevTextRef.current = previousText;

      prevFadeAnim.setValue(0.85);
      prevSlideAnim.setValue(8);

      Animated.parallel([
        Animated.timing(prevFadeAnim, {
          toValue: 0.5,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
        Animated.timing(prevSlideAnim, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
      ]).start();
    }
  }, [previousText, prevFadeAnim, prevSlideAnim, useNative]);

  // 4. Animate translation text fade-in
  useEffect(() => {
    if (isTranslationVisible && translationText) {
      Animated.timing(translationAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }).start();
    } else {
      translationAnim.setValue(0);
    }
  }, [isTranslationVisible, translationText, translationAnim, useNative]);

  // Split visible words into:
  // 1) `settledText` (a single fast string for all already-revealed words)
  // 2) `latestWord` (only the 1 newest word gets an Animated.Text node)
  const { settledText, latestWord, hasVisibleWords } = useMemo(() => {
    const words = allTargetWords.length
      ? allTargetWords.slice(0, Math.min(displayedCount, allTargetWords.length))
      : (previousText || '').trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return { settledText: '', latestWord: '', hasVisibleWords: false };
    }
    if (words.length === 1) {
      return { settledText: '', latestWord: words[0], hasVisibleWords: true };
    }
    return {
      settledText: words.slice(0, -1).join(' ') + ' ',
      latestWord: words[words.length - 1],
      hasVisibleWords: true,
    };
  }, [allTargetWords, displayedCount, previousText]);

  const hasPrevious = !!(
    previousText &&
    previousText.trim().length > 0 &&
    previousText.trim() !== currentText?.trim()
  );

  if (!hasVisibleWords) {
    return null;
  }

  // True when all words have finished appearing and Maya has stopped speaking
  const isTextFinished =
    !isSpeaking &&
    (displayedCount >= allTargetWords.length || !currentText?.trim());

  return (
    <View
      style={[
        styles.outerContainer,
        isWebOrDesktop && styles.outerContainerDesktop,
      ]}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_, contentHeight) => {
          // Only scroll when a new line is added (prevents per-word scroll jitter)
          if (Math.abs(contentHeight - lastContentHeightRef.current) > 8) {
            lastContentHeightRef.current = contentHeight;
            scrollRef.current?.scrollToEnd({ animated: true });
          }
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
              style={[
                styles.previousText,
                isWebOrDesktop && styles.previousTextDesktop,
              ]}
            >
              {previousText}
            </Text>
          </Animated.View>
        )}

        {/* 2. Current Active Model Turn */}
        <View style={styles.currentWrapper}>
          <Text
            style={[
              styles.promptText,
              { fontSize, lineHeight },
              isWebOrDesktop && styles.promptTextDesktop,
            ]}
          >
            {settledText}
            <Animated.Text
              style={[styles.wordItem, { opacity: latestWordFade }]}
            >
              {latestWord}
            </Animated.Text>
          </Text>

          {/* Sinhala Translation of Active Prompt */}
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

          {/* Translation Toggle Pill Button */}
          {!!onToggleTranslation &&
            (isTextFinished || isTranslationHighlighted) && (
              <View style={styles.translationButtonWrapper}>
                <BeaconRing
                  color="#14B8A6"
                  radius={999}
                  active={isTranslationHighlighted}
                />
                <TranslationToggleButton
                  isExpanded={Boolean(isTranslationVisible)}
                  isLoading={isTranslating}
                  onToggle={onToggleTranslation}
                />
              </View>
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
  translationButtonWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 12,
  },
});