import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { fontStyle } from '@/theme/fonts';
import { triggerHaptic } from '@/utils/haptics-audio';
import { playRewardSound } from '@/services/sound/sound-service';

/** Short reward "pop" + haptic. Pops are brief so they don't leak into the mic as speech. */
function rewardFeedback(kind: 'xp' | 'streak' | 'milestone' | 'charge', haptic: 'light' | 'medium') {
  try {
    playRewardSound(kind);
  } catch {}
  triggerHaptic(haptic);
}

/* -------------------------------------------------------------------------- */
/*  Rules - mirror the server (sessions.service finishSession + xp-rules.ts)  */
/* -------------------------------------------------------------------------- */

const XP_PER_MINUTE = 5;
const STREAK_MIN = 3;
const STREAK_XP = 2;
const STREAK_CAP = 20;
const STREAK_MILESTONES = [3, 5, 10];
/** Phase 1: the fiery edge glow fills up (with the charge sound). */
const MILESTONE_FILL_MS = 900;
/** Whole milestone: fill + card on screen. */
const MILESTONE_MS = MILESTONE_FILL_MS + 1800;

export interface XpGain {
  id: number;
  amount: number;
}

export interface Milestone {
  id: number;
  emoji: string;
  title: string;
}

interface UseCallRewardsArgs {
  secondsElapsed: number;
  earnsMinuteXp: boolean;
  streakEnabled: boolean;
  lastUserUtterance: { id: number; text: string } | null;
  hintsUsedCount: number;
  passedPoints: number;
  totalPoints: number;
  paused: boolean;
  /** Milestones wait until Maya is not speaking, so they never cover her words. */
  isMayaSpeaking: boolean;
  /** Mutes the mic during a milestone so its sound is not picked up as speech. */
  suppressMicFor?: (ms: number) => void;
  /** A popup/modal is open (feedback card, hint limit, end call, guide...): hold milestones. */
  blocked?: boolean;
}

export function useCallRewards(a: UseCallRewardsArgs) {
  const [sessionXp, setSessionXp] = useState(0);
  const [gain, setGain] = useState<XpGain | null>(null);
  const [streak, setStreak] = useState(0);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const idRef = useRef(0);
  const bonusRef = useRef(0);
  const queueRef = useRef<Milestone[]>([]);
  const [queueTick, setQueueTick] = useState(0);

  const addXp = (amount: number) => {
    idRef.current += 1;
    setSessionXp((x) => x + amount);
    setGain({ id: idRef.current, amount });
  };
  const queueMilestone = (emoji: string, title: string) => {
    idRef.current += 1;
    queueRef.current.push({ id: idRef.current, emoji, title });
    setQueueTick((t) => t + 1);
  };

  // +5 XP at every full practice minute (general sessions)
  const minutes = Math.floor(a.secondsElapsed / 60);
  const minutesRef = useRef(0);
  useEffect(() => {
    if (a.earnsMinuteXp && !a.paused && minutes > minutesRef.current && minutes >= 1) {
      addXp(XP_PER_MINUTE);
      rewardFeedback('xp', 'light');
    }
    minutesRef.current = minutes;
  }, [minutes, a.earnsMinuteXp, a.paused]);

  // Hint-free streak (same rule as the server)
  const lastUtteranceId = useRef<number | null>(null);
  const hintsAtLastTurn = useRef(a.hintsUsedCount);
  useEffect(() => {
    const u = a.lastUserUtterance;
    if (!u || u.id === lastUtteranceId.current) return;
    lastUtteranceId.current = u.id;
    const usedHint = a.hintsUsedCount > hintsAtLastTurn.current;
    hintsAtLastTurn.current = a.hintsUsedCount;
    if (!a.streakEnabled) return;

    setStreak((prev) => {
      const next = usedHint ? 0 : prev + 1;
      if (next >= STREAK_MIN && bonusRef.current < STREAK_CAP) {
        bonusRef.current = Math.min(STREAK_CAP, bonusRef.current + STREAK_XP);
        addXp(STREAK_XP);
        rewardFeedback('streak', 'light');
      }
      if (STREAK_MILESTONES.includes(next)) queueMilestone('\u{1F525}', `${next} in a row!`);
      return next;
    });
  }, [a.lastUserUtterance, a.hintsUsedCount, a.streakEnabled]);

  // Roadmap: each newly passed practice point is a milestone
  const passedRef = useRef(a.passedPoints);
  useEffect(() => {
    if (a.passedPoints > passedRef.current && a.totalPoints > 0) {
      queueMilestone('\u{1F3C6}', a.passedPoints >= a.totalPoints ? 'All goals done!' : `Goal ${a.passedPoints}/${a.totalPoints} done!`);
    }
    passedRef.current = a.passedPoints;
  }, [a.passedPoints, a.totalPoints]);

  // Play queued milestones one at a time, in the pause AFTER Maya's reply.
  // A streak is counted when Maya's reply text starts arriving, a moment before her voice,
  // so "not speaking right now" is not enough: wait until she has spoken and then gone quiet
  // (or 5s with no reply at all), plus a short pause.
  // Timers live in refs: setting `milestone` re-runs this effect, and an effect cleanup
  // would cancel them, leaving the overlay on screen forever.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawMayaSpeakRef = useRef(false);
  const queuedAtRef = useRef(0);
  const [quietTick, setQuietTick] = useState(0);

  useEffect(() => {
    if (queueRef.current.length === 0) return;
    if (!queuedAtRef.current) queuedAtRef.current = Date.now();
    if (a.isMayaSpeaking) sawMayaSpeakRef.current = true;
  }, [a.isMayaSpeaking, queueTick]);

  useEffect(() => {
    if (milestone || a.isMayaSpeaking || a.blocked || a.paused || queueRef.current.length === 0) return;
    const waitedLong = queuedAtRef.current > 0 && Date.now() - queuedAtRef.current > 5000;
    if (!sawMayaSpeakRef.current && !waitedLong) {
      // Maya's voice has not started yet: check again shortly
      const t = setTimeout(() => setQuietTick((x) => x + 1), 500);
      return () => clearTimeout(t);
    }
    // Maya finished: give the room a short pause, then play (cancelled if she speaks again)
    const t = setTimeout(() => {
      const next = queueRef.current.shift();
      if (!next) return;
      sawMayaSpeakRef.current = false;
      queuedAtRef.current = queueRef.current.length > 0 ? Date.now() : 0;
      a.suppressMicFor?.(MILESTONE_MS + 300);
      // Phase 1: fiery edge glow fills up with the "charge" sound; phase 2: card + level-up sound
      rewardFeedback('charge', 'light');
      soundTimerRef.current = setTimeout(() => rewardFeedback('milestone', 'medium'), MILESTONE_FILL_MS);
      setMilestone(next);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setMilestone(null);
      }, MILESTONE_MS);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.isMayaSpeaking, a.blocked, a.paused, milestone, queueTick, quietTick]);

  // A popup opened mid-milestone: hide it at once (queued ones wait). Call wrapping up: drop them.
  useEffect(() => {
    if (a.paused) queueRef.current = [];
    if ((a.blocked || a.paused) && milestone) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
      hideTimerRef.current = null;
      soundTimerRef.current = null;
      setMilestone(null);
    }
  }, [a.blocked, a.paused, milestone]);
  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    },
    [],
  );

  return {
    sessionXp,
    gain,
    streak,
    /** Streak bonus earned this call (same rule and cap as the server). */
    streakBonusXp: bonusRef.current,
    milestone,
    goalProgress: a.totalPoints > 0 ? Math.min(1, a.passedPoints / a.totalPoints) : null,
  };
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduce(!!v))
      .catch(() => {});
  }, []);
  return reduce;
}

/* -------------------------------------------------------------------------- */
/*  Header HUD: XP counter with a flying "+N" and a bounce                     */
/* -------------------------------------------------------------------------- */

export function XpCounter({ sessionXp, gain }: { sessionXp: number; gain: XpGain | null }) {
  const useNative = Platform.OS !== 'web';
  const reduceMotion = useReduceMotion();
  const bounce = useRef(new Animated.Value(1)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const [flyLabel, setFlyLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!gain) return;
    setFlyLabel(`+${gain.amount}`);
    fly.setValue(0);
    bounce.setValue(reduceMotion ? 1 : 1.25);
    Animated.parallel([
      Animated.spring(bounce, { toValue: 1, tension: 180, friction: 6, useNativeDriver: useNative }),
      Animated.timing(fly, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }),
    ]).start();
  }, [gain, bounce, fly, useNative, reduceMotion]);

  if (sessionXp <= 0 && !gain) return null;
  return (
    <View style={styles.hudRow}>
      <Animated.View style={[styles.xpPill, { transform: [{ scale: bounce }] }]} accessibilityLabel={`${sessionXp} XP this call`}>
        <Text style={styles.xpText}>{'\u2B50'} {sessionXp} XP</Text>
      </Animated.View>
      {flyLabel && (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.flyText,
            {
              opacity: fly.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [6, reduceMotion ? 6 : -18] }) }],
            },
          ]}
        >
          {flyLabel}
        </Animated.Text>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Streak chip: pulses and flips its number on every change                  */
/* -------------------------------------------------------------------------- */

export function StreakChip({ streak }: { streak: number }) {
  const useNative = Platform.OS !== 'web';
  const pop = useRef(new Animated.Value(1)).current;
  const visible = streak >= STREAK_MIN;
  useEffect(() => {
    if (!visible) return;
    pop.setValue(1.35);
    Animated.spring(pop, { toValue: 1, tension: 170, friction: 6, useNativeDriver: useNative }).start();
  }, [streak, visible, pop, useNative]);

  if (!visible) return null;
  return (
    <Animated.View
      accessibilityLabel={`${streak} answers in a row without hints`}
      style={[styles.streakChip, { transform: [{ scale: pop }] }]}
    >
      <Text style={styles.streakText}>{'\u{1F525}'} {streak}</Text>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Milestone moment: orange edge glow + big emoji, ~1.3s, full screen        */
/* -------------------------------------------------------------------------- */

const FIRE_ANIMATED = require('@/assets/images/fire-animated.webp');

export function MilestoneOverlay({ milestone }: { milestone: Milestone | null }) {
  const useNative = Platform.OS !== 'web';
  const reduceMotion = useReduceMotion();
  const layer = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current; // edges fill up 0 -> 1
  const scale = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Milestone | null>(null);

  useEffect(() => {
    if (milestone) {
      setShown(milestone);
      layer.setValue(1);
      fill.setValue(reduceMotion ? 1 : 0);
      scale.setValue(0);
      Animated.sequence([
        // Phase 1: fiery glow climbs up the edges (charge sound plays alongside)
        Animated.timing(fill, {
          toValue: 1,
          duration: reduceMotion ? 0 : MILESTONE_FILL_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false, // animates height
        }),
        // Phase 2: the card bursts in
        Animated.spring(scale, { toValue: 1, tension: 140, friction: 6, useNativeDriver: false }),
      ]).start();
    } else if (shown) {
      Animated.timing(layer, { toValue: 0, duration: 280, useNativeDriver: useNative }).start(() => setShown(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  if (!shown) return null;
  const sideHeight = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const topOpacity = fill.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] });
  const bottomOpacity = fill.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' });
  const isFire = shown.emoji === '\u{1F525}';

  return (
    <Animated.View pointerEvents="none" style={[styles.milestoneLayer, { opacity: layer }]}>
      {/* Fiery edges: bottom lights first, sides climb, top lights when full */}
      <Animated.View style={[styles.flameEdge, styles.flameBottom, { opacity: bottomOpacity }]} />
      <Animated.View style={[styles.flameEdge, styles.flameLeft, { height: sideHeight }]} />
      <Animated.View style={[styles.flameEdge, styles.flameRight, { height: sideHeight }]} />
      <Animated.View style={[styles.flameEdge, styles.flameTop, { opacity: topOpacity }]} />

      <Animated.View style={[styles.milestoneCard, { opacity: scale, transform: [{ scale }] }]}>
        {isFire ? (
          <ExpoImage source={FIRE_ANIMATED} style={styles.fireImage} contentFit="contain" autoplay />
        ) : (
          <Text style={styles.milestoneEmoji}>{shown.emoji}</Text>
        )}
        <Text style={styles.milestoneTitle}>{shown.title}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Goal ring around Maya's avatar (roadmap practice points)                  */
/* -------------------------------------------------------------------------- */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function GoalRing({ size, progress, children }: { size: number; progress: number | null; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(progress ?? 0)).current;
  useEffect(() => {
    if (progress === null) return;
    Animated.timing(anim, { toValue: progress, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, anim]);

  if (progress === null) return <>{children}</>;
  const stroke = 3;
  const ringSize = size + stroke * 2 + 4;
  const r = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
        <Circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={r}
          stroke="#22C55E"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset as any}
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Session progress bar: XP toward the next level (500 XP per level)         */
/* -------------------------------------------------------------------------- */

export function LevelProgressBar({ levelXp, sessionXp, perLevel = 500 }: { levelXp: number; sessionXp: number; perLevel?: number }) {
  const value = Math.min(1, ((levelXp + sessionXp) % perLevel) / perLevel);
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <View style={styles.levelTrack} accessibilityLabel={`${Math.round(value * 100)}% to next level`}>
      <Animated.View style={[styles.levelFill, { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hudRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  xpPill: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  xpText: { ...fontStyle('inter', 'bold'), fontSize: 12, color: '#A16207' },
  flyText: { ...fontStyle('inter', 'bold'), fontSize: 13, color: '#CA8A04', marginLeft: 6 },
  streakChip: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  streakText: { ...fontStyle('inter', 'bold'), fontSize: 12, color: '#C2410C' },
  milestoneLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 9000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameEdge: {
    position: 'absolute',
    backgroundColor: 'rgba(249, 115, 22, 0.55)',
    ...Platform.select({
      web: { boxShadow: '0 0 28px 14px rgba(251, 146, 60, 0.75)' } as any,
      default: { shadowColor: '#F97316', shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
    }),
  },
  flameBottom: { left: 0, right: 0, bottom: 0, height: 12 },
  flameLeft: { left: 0, bottom: 0, width: 12 },
  flameRight: { right: 0, bottom: 0, width: 12 },
  flameTop: { left: 0, right: 0, top: 0, height: 12 },
  fireImage: { width: 96, height: 96 },
  milestoneCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 28,
    paddingHorizontal: 34,
    paddingVertical: 20,
    ...Platform.select({
      web: { boxShadow: '0 20px 50px -10px rgba(249, 115, 22, 0.45)' } as any,
      default: { shadowColor: '#F97316', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
    }),
  },
  milestoneEmoji: { fontSize: 72, lineHeight: 84 },
  milestoneTitle: { ...fontStyle('outfit', 'bold'), fontSize: 26, color: '#C2410C', marginTop: 4 },
  levelTrack: { height: 4, width: '100%', backgroundColor: '#E2E8F0', overflow: 'hidden' },
  levelFill: { height: 4, backgroundColor: '#F59E0B', borderRadius: 2 },
});
