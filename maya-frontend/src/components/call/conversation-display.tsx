import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import type { SpeechSyncSource } from '@/utils/speech-sync';

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
  /**
   * Optional but recommended: any value that changes when Maya starts a new
   * reply (turn index, message id...). Without it, new turns are detected by
   * comparing words with the previous text.
   */
  turnId?: string | number;
  /**
   * Audio-synced reveal. Pass `liveCall.speechSync`: words then appear exactly
   * as the voice reaches them. Without it (or before the first real
   * transcript, e.g. the intro guide text) a timer-based reveal is used.
   */
  speechSync?: SpeechSyncSource;
}

/* -------------------------------------------------------------------------- */
/*  Typography (3 steps; a turn may only move to a SMALLER step, never bigger) */
/* -------------------------------------------------------------------------- */

const TYPE_SCALE = {
  desktop: {
    thresholds: [80, 160],
    sizes: [
      { fontSize: 32, lineHeight: 44 },
      { fontSize: 26, lineHeight: 37 },
      { fontSize: 22, lineHeight: 32 },
    ],
  },
  mobile: {
    thresholds: [70, 140],
    sizes: [
      { fontSize: 27, lineHeight: 38 },
      { fontSize: 23.5, lineHeight: 33 },
      { fontSize: 20.5, lineHeight: 29 },
    ],
  },
} as const;

function levelFor(len: number, isDesktop: boolean): 0 | 1 | 2 {
  const [a, b] = (isDesktop ? TYPE_SCALE.desktop : TYPE_SCALE.mobile).thresholds;
  return len <= a ? 0 : len <= b ? 1 : 2;
}

/* -------------------------------------------------------------------------- */
/*  Pacing                                                                    */
/* -------------------------------------------------------------------------- */

const MIN_DELAY = 270;
const MAX_DELAY = 520;
const FLUSH_DELAY = 90; // after Maya stops talking, finish remaining words quickly
const SPEAKING_GRACE_MS = 800; // ignore short "speaking" -> "listening" flickers
const NEWEST_WORD_COLOR = '#64748B'; // set to '#0F172A' to disable the "typing" shade
const TEXT_COLOR = '#0F172A';

/** Delay to wait AFTER word number `n` (1-based) has been revealed. */
function delayAfter(words: string[], n: number, speaking: boolean): number {
  if (!speaking) return FLUSH_DELAY;

  const last = words[n - 1] || '';
  const next = words[n] || '';
  const cleanLen = next.replace(/[^\w]/g, '').length;

  let d = Math.max(MIN_DELAY, Math.min(MAX_DELAY, cleanLen * 52 + 210));
  if (/[.?!]["')\]]*$/.test(last)) d += 380;
  else if (/[,;:\-\u2013\u2014]$/.test(last)) d += 200;

  // Big backlog (text arrived much faster than we reveal): speed up a little
  const backlog = words.length - n;
  if (backlog > 14) d *= 0.6;
  else if (backlog > 8) d *= 0.8;
  return d;
}

/** True when `next` is the same reply as `prev`, just with more/updated words. */
function isContinuation(prev: string[], next: string[]): boolean {
  if (prev.length === 0) return false;
  const max = Math.min(prev.length, next.length);
  let common = 0;
  while (common < max && prev[common] === next[common]) common += 1;
  // allow the last word to change (partial word completing while streaming)
  return common >= prev.length - 1;
}

const EMPTY_WORDS: string[] = [];

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

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
  turnId,
  speechSync,
}: ConversationDisplayProps) {
  const useNative = Platform.OS !== 'web';
  const scrollRef = useRef<ScrollView>(null);
  const viewportH = useRef(0);
  const contentH = useRef(0);

  /* ----------------------------- Words + turns ----------------------------- */

  const fullRawText = (currentText || '').trim();
  const allWords = useMemo(
    () => (fullRawText ? fullRawText.split(/\s+/).filter(Boolean) : EMPTY_WORDS),
    [fullRawText],
  );
  const wordsRef = useRef<string[]>(allWords);
  wordsRef.current = allWords;

  const fallbackWords = useMemo(
    () => (previousText || '').trim().split(/\s+/).filter(Boolean),
    [previousText],
  );

  // Turn tracking is derived during render so the very first frame of a new
  // turn already has the right key / font size (no flash of old state).
  const turnRef = useRef<{
    key: number;
    words: string[];
    turnId: string | number | undefined;
    level: number;
  }>({ key: 0, words: EMPTY_WORDS, turnId: undefined, level: 0 });
  const turn = turnRef.current;

  if (allWords.length === 0) {
    turn.words = EMPTY_WORDS; // next text starts a new turn
  } else if (turn.words !== allWords) {
    // A changed turnId always means a new reply; otherwise compare the words
    // (this also restarts cleanly when the intro text is replaced by live text).
    const turnIdChanged = turnId !== undefined && turn.key > 0 && turn.turnId !== turnId;
    const sameTurn = turnIdChanged ? false : isContinuation(turn.words, allWords);
    if (!sameTurn) {
      turn.key += 1;
      turn.level = 0;
    }
    turn.words = allWords;
    turn.turnId = turnId;
  }
  const turnKey = turn.key;

  const showingFallback = allWords.length === 0;
  const shownWords = showingFallback ? fallbackWords : allWords;

  /* ------------------------------- Typography ------------------------------ */

  const lvl = levelFor(
    (fullRawText || previousText?.trim() || '').length,
    isWebOrDesktop,
  );
  if (!showingFallback) turn.level = Math.max(turn.level, lvl);
  const level = showingFallback ? lvl : turn.level;
  const { fontSize, lineHeight } = (
    isWebOrDesktop ? TYPE_SCALE.desktop : TYPE_SCALE.mobile
  ).sizes[level];

  /* ------------------------------ Reveal engine ---------------------------- */

  // `reveal.key` ties the count to a turn so a new turn never shows the old count
  const [reveal, setReveal] = useState({ key: -1, count: 0 });
  const displayedCount = reveal.key === turnKey ? reveal.count : 0;

  // Audio-synced mode: active as soon as the speech timeline has words for the
  // current reply. The timer engine below then stays idle.
  const syncMode = !!speechSync && speechSync.getWordCount() > 0;
  const syncModeRef = useRef(syncMode);
  syncModeRef.current = syncMode;

  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextAtRef = useRef(0);
  const lastKeyRef = useRef(-1);
  const turnKeyRef = useRef(turnKey);
  turnKeyRef.current = turnKey;

  const isSpeakingRef = useRef(isSpeaking);
  const lastSpeakingAtRef = useRef(0);
  isSpeakingRef.current = isSpeaking;
  if (isSpeaking) lastSpeakingAtRef.current = Date.now();

  // One self-correcting loop. Reveals every word that is "due", so if the JS
  // thread was busy it catches up instead of falling further behind.
  const run = useCallback(() => {
    timerRef.current = null;
    if (syncModeRef.current) return; // audio clock drives the reveal instead
    const words = wordsRef.current;
    let n = countRef.current;
    if (n >= words.length) return;

    const now = Date.now();
    const speaking =
      isSpeakingRef.current || now - lastSpeakingAtRef.current < SPEAKING_GRACE_MS;

    while (n < words.length && now >= nextAtRef.current) {
      n += 1;
      nextAtRef.current += delayAfter(words, n, speaking);
    }

    if (n !== countRef.current) {
      countRef.current = n;
      setReveal({ key: turnKeyRef.current, count: n });
    }
    if (n < words.length) {
      timerRef.current = setTimeout(run, Math.max(0, nextAtRef.current - Date.now()));
    }
  }, []);

  useEffect(() => {
    if (allWords.length === 0 || syncModeRef.current) return;

    if (lastKeyRef.current !== turnKey) {
      lastKeyRef.current = turnKey;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      countRef.current = 0;
      nextAtRef.current = Date.now();
    }
    if (!timerRef.current) {
      nextAtRef.current = Math.max(nextAtRef.current, Date.now());
      run();
    }
  }, [turnKey, allWords, run]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Audio-synced reveal: poll the speech timeline (~30Hz while speaking) and
  // only re-render when the number of visible words actually changes.
  useEffect(() => {
    if (!speechSync) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      if (speechSync.getWordCount() > 0) {
        const n = Math.min(speechSync.getRevealedCount(now), wordsRef.current.length);
        const key = turnKeyRef.current;
        setReveal((prev) => (prev.key === key && prev.count === n ? prev : { key, count: n }));
      }
      timer = setTimeout(tick, speechSync.isBusy(now) ? 33 : 120);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [speechSync]);

  const total = shownWords.length;
  const count = showingFallback ? total : Math.min(displayedCount, total);
  const isRevealing = !showingFallback && count < total;

  /* -------------------------- Scroll (only if overflow) -------------------- */

  useEffect(() => {
    const overflow = contentH.current - viewportH.current;
    if (!showingFallback && overflow > 4 && total > 0) {
      scrollRef.current?.scrollTo({
        y: overflow * (count / total),
        animated: false,
      });
    }
  }, [count, total, showingFallback]);

  /* -------------------------------- Animations ----------------------------- */

  // Whole-turn fade-in (opacity on a View works natively, unlike nested Text)
  const turnFade = useRef(new Animated.Value(0)).current;
  useLayoutEffect(() => {
    turnFade.setValue(0);
    Animated.timing(turnFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();
  }, [turnKey, turnFade, useNative]);

  // Previous turn glide
  const prevFadeAnim = useRef(new Animated.Value(0.5)).current;
  const prevSlideAnim = useRef(new Animated.Value(0)).current;
  const prevTextRef = useRef<string>(previousText || '');
  useLayoutEffect(() => {
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

  // Translation text fade-in
  const translationAnim = useRef(new Animated.Value(0)).current;
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

  // Translation button: space is always reserved (no layout jump), it only
  // fades in once the text is done, and only after it stays done for a moment.
  const isTextFinished = !isSpeaking && (showingFallback || count >= total);
  const [buttonVisible, setButtonVisible] = useState(false);
  useEffect(() => {
    if (!isTextFinished && !isTranslationHighlighted) {
      setButtonVisible(false);
      return;
    }
    const t = setTimeout(
      () => setButtonVisible(true),
      isTranslationHighlighted ? 0 : 350,
    );
    return () => clearTimeout(t);
  }, [isTextFinished, isTranslationHighlighted]);

  const buttonFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(buttonFade, {
      toValue: buttonVisible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();
  }, [buttonVisible, buttonFade, useNative]);

  /* --------------------------------- Segments ------------------------------ */

  // The WHOLE sentence is always rendered so the layout never changes while
  // words appear. Unrevealed words are simply transparent.
  const { settled, latest, rest } = useMemo(() => {
    const n = Math.min(count, shownWords.length);
    if (n <= 0) return { settled: '', latest: '', rest: shownWords.join(' ') };
    return {
      settled: n > 1 ? shownWords.slice(0, n - 1).join(' ') + ' ' : '',
      latest: shownWords[n - 1],
      rest: n < shownWords.length ? ' ' + shownWords.slice(n).join(' ') : '',
    };
  }, [shownWords, count]);

  if (shownWords.length === 0) return null;

  const hasPrevious = !!(
    previousText &&
    previousText.trim().length > 0 &&
    previousText.trim() !== currentText?.trim()
  );

  return (
    <View style={[styles.outerContainer, isWebOrDesktop && styles.outerContainerDesktop]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, h) => {
          contentH.current = h;
        }}
      >
        {/* Previous model turn */}
        {hasPrevious && !!currentText?.trim() && (
          <Animated.View
            style={[
              styles.previousWrapper,
              { opacity: prevFadeAnim, transform: [{ translateY: prevSlideAnim }] },
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

        {/* Current turn */}
        <Animated.View style={[styles.currentWrapper, { opacity: turnFade }]}>
          <Text
            style={[
              styles.promptText,
              { fontSize, lineHeight },
              isWebOrDesktop && styles.promptTextDesktop,
            ]}
          >
            {settled}
            <Text style={{ color: isRevealing ? NEWEST_WORD_COLOR : TEXT_COLOR }}>
              {latest}
            </Text>
            <Text style={styles.hiddenText}>{rest}</Text>
          </Text>

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

          {!!onToggleTranslation && (
            <Animated.View
              pointerEvents={buttonVisible ? 'auto' : 'none'}
              style={[styles.translationButtonWrapper, { opacity: buttonFade }]}
            >
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
            </Animated.View>
          )}
        </Animated.View>
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
    color: TEXT_COLOR,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  promptTextDesktop: {
    letterSpacing: -0.5,
  },
  hiddenText: {
    color: 'transparent',
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