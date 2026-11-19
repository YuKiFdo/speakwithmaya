import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';

// Google Noto animated emoji (animated WebP; expo-image plays it on web, Android and iOS)
const FIRE_ANIMATED = require('@/assets/images/fire-animated-small.webp');
const FIRE_ANIMATED_CARD = require('@/assets/images/fire-animated-card.webp');
const STAR_ANIMATED = require('@/assets/images/star-animated-small.webp');
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
/** Fire milestones only: the fire shrinks and flies to Maya's avatar ... */
const FIRE_FLY_MS = 650;
/** ... stays there with the streak count ... */
const FIRE_DOCK_MS = 2600;
/** ... and fades away. */
const FIRE_FADE_MS = 450;
/** XP toast: pop in, count up, hold, fade (hidden between gains). */
const XP_TOAST_HOLD_MS = 2200;

export interface XpGain {
  id: number;
  amount: number;
}

export interface Milestone {
  id: number;
  emoji: string;
  title: string;
  /** Short count shown next to the fire once it docks at Maya's avatar (streaks). */
  badge?: string;
}

const isFireMilestone = (m: Milestone | null) => m?.emoji === '\u{1F525}';
/** How long a milestone stays active (fire milestones also fly to Maya and dock there). */
const milestoneDuration = (m: Milestone) =>
  isFireMilestone(m) ? MILESTONE_MS + FIRE_FLY_MS + FIRE_DOCK_MS + FIRE_FADE_MS : MILESTONE_MS;

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
  const queueMilestone = (emoji: string, title: string, badge?: string) => {
    idRef.current += 1;
    queueRef.current.push({ id: idRef.current, emoji, title, badge });
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
    // Same rule as the server (xp-rules.ts): a turn counts only with real speech
    const text = (u.text || '').trim();
    const isRealSpeech = text.split(/\s+/).filter(Boolean).length >= 2 && !text.startsWith('(');

    setStreak((prev) => {
      const next = usedHint || !isRealSpeech ? 0 : prev + 1;
      if (next >= STREAK_MIN && bonusRef.current < STREAK_CAP) {
        bonusRef.current = Math.min(STREAK_CAP, bonusRef.current + STREAK_XP);
        addXp(STREAK_XP);
        rewardFeedback('streak', 'light');
      }
      if (STREAK_MILESTONES.includes(next)) queueMilestone('\u{1F525}', `${next} in a row!`, `${next}`);
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
      }, milestoneDuration(next));
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
/*  XP toast: hidden normally; on a gain it pops in, counts up, then fades    */
/* -------------------------------------------------------------------------- */

/**
 * Shows only when XP is earned: pops in, counts old -> new total with a floating "+N",
 * holds, then fades out until the next gain. While `busy` (a milestone / the fire is on
 * screen) gains wait and are shown together afterwards, so the two never compete.
 */
export function XpCounter({ sessionXp, gain, busy = false }: { sessionXp: number; gain: XpGain | null; busy?: boolean }) {
  const reduceMotion = useReduceMotion();
  const show = useRef(new Animated.Value(0)).current; // 0 hidden -> 1 visible
  const fly = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [shownXp, setShownXp] = useState(0);
  const [flyLabel, setFlyLabel] = useState<string | null>(null);
  const pendingRef = useRef(0);
  const lastGainIdRef = useRef<number | null>(null);
  const shownTotalRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [tick, setTick] = useState(0);

  // Collect gains (they may arrive while busy)
  useEffect(() => {
    if (!gain || gain.id === lastGainIdRef.current) return;
    lastGainIdRef.current = gain.id;
    pendingRef.current += gain.amount;
    setTick((t) => t + 1);
  }, [gain]);

  // Play when there is something pending and nothing else is on screen
  useEffect(() => {
    if (busy || pendingRef.current <= 0) return;
    const amount = pendingRef.current;
    pendingRef.current = 0;
    const from = sessionXp - amount >= 0 ? sessionXp - amount : shownTotalRef.current;
    const to = sessionXp;
    shownTotalRef.current = to;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setVisible(true);
    setFlyLabel(`+${amount}`);
    setShownXp(from);
    fly.setValue(0);
    Animated.spring(show, { toValue: 1, tension: 160, friction: 7, useNativeDriver: false }).start();

    // Count up from -> to (about 600ms), with the "+N" rising and fading
    const steps = reduceMotion ? 1 : Math.min(12, Math.max(1, to - from));
    for (let i = 1; i <= steps; i++) {
      timersRef.current.push(
        setTimeout(() => setShownXp(Math.round(from + ((to - from) * i) / steps)), 150 + (i * 450) / steps),
      );
    }
    Animated.timing(fly, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

    // Hold, then fade away until the next gain
    timersRef.current.push(
      setTimeout(() => {
        Animated.timing(show, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(
          ({ finished }) => finished && setVisible(false),
        );
      }, XP_TOAST_HOLD_MS),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, tick]);

  // Something else took the stage mid-toast: hide at once
  useEffect(() => {
    if (!busy || !visible) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    Animated.timing(show, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setVisible(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  if (!visible) return null;
  return (
    <View style={styles.hudRow}>
      <Animated.View
        style={[
          styles.xpPill,
          {
            opacity: show,
            transform: [
              { scale: show.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.6, 1] }) },
              { translateY: show.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 6, 0] }) },
            ],
          },
        ]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${shownXp} XP this call`}
      >
        <View style={styles.chipRow}>
          <ExpoImage source={STAR_ANIMATED} style={styles.chipIcon} contentFit="contain" autoplay />
          <Text style={styles.xpText}>{shownXp} XP</Text>
        </View>
      </Animated.View>
      {flyLabel && (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.flyText,
            {
              opacity: fly.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [6, reduceMotion ? 6 : -16] }) }],
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
      <View style={styles.chipRow}>
        <ExpoImage source={FIRE_ANIMATED} style={styles.chipIcon} contentFit="contain" autoplay />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Milestone moment: orange edge glow + big emoji, ~1.3s, full screen        */
/* -------------------------------------------------------------------------- */

type Rect = { x: number; y: number; width: number; height: number };
const measure = (node: any): Promise<Rect | null> =>
  new Promise((resolve) => {
    if (!node?.measureInWindow) return resolve(null);
    try {
      node.measureInWindow((x: number, y: number, width: number, height: number) =>
        resolve(width || height ? { x, y, width, height } : null),
      );
    } catch {
      resolve(null);
    }
  });

/** Docked fire size at Maya's avatar (the card fire is 96px). */
const DOCK_SIZE = 30;

/**
 * Milestone moment. Phase 1: fiery edges fill up. Phase 2: the card bursts in.
 * Fire milestones then: the edges, card and title fade, the fire alone shrinks and flies to
 * Maya's avatar (`targetRef`), stays there with the streak count for a few seconds, and fades.
 */
export function MilestoneOverlay({
  milestone,
  targetRef,
}: {
  milestone: Milestone | null;
  /** Maya's avatar in the header: where the fire flies to. */
  targetRef?: React.RefObject<View | null>;
}) {
  const useNative = Platform.OS !== 'web';
  const reduceMotion = useReduceMotion();
  const layer = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current; // edges fill up 0 -> 1
  const scale = useRef(new Animated.Value(0)).current;
  const chrome = useRef(new Animated.Value(1)).current; // edges + card background + title
  const flyX = useRef(new Animated.Value(0)).current;
  const flyY = useRef(new Animated.Value(0)).current;
  const flyScale = useRef(new Animated.Value(1)).current;
  const dock = useRef(new Animated.Value(0)).current; // docked count badge
  const rootRef = useRef<View>(null);
  const fireRef = useRef<View>(null);
  const [shown, setShown] = useState<Milestone | null>(null);
  const [dockPos, setDockPos] = useState<{ left: number; top: number } | null>(null);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    if (milestone) {
      setShown(milestone);
      setDockPos(null);
      layer.setValue(1);
      fill.setValue(reduceMotion ? 1 : 0);
      scale.setValue(0);
      chrome.setValue(1);
      flyX.setValue(0);
      flyY.setValue(0);
      flyScale.setValue(1);
      dock.setValue(0);
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

      if (isFireMilestone(milestone)) {
        // Phase 3: everything but the fire fades; the fire flies to Maya and docks there
        flyTimerRef.current = setTimeout(async () => {
          const [root, fire, target] = await Promise.all([
            measure(rootRef.current),
            measure(fireRef.current),
            measure(targetRef?.current),
          ]);
          Animated.timing(chrome, { toValue: 0, duration: 300, useNativeDriver: false }).start();
          if (!root || !fire || !target) {
            // Avatar not measurable (e.g. off screen): just fade out in place
            Animated.timing(flyScale, { toValue: 0.4, duration: FIRE_FLY_MS, useNativeDriver: false }).start();
            return;
          }
          const k = DOCK_SIZE / fire.width;
          // Dock on the avatar's top-right corner
          const tx = target.x + target.width - DOCK_SIZE * 0.55;
          const ty = target.y - DOCK_SIZE * 0.35;
          const dx = tx + DOCK_SIZE / 2 - (fire.x + fire.width / 2);
          const dy = ty + DOCK_SIZE / 2 - (fire.y + fire.height / 2);
          setDockPos({ left: tx - root.x + DOCK_SIZE - 4, top: ty - root.y + DOCK_SIZE * 0.55 });
          Animated.sequence([
            Animated.parallel([
              Animated.timing(flyX, { toValue: dx, duration: FIRE_FLY_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
              Animated.timing(flyY, { toValue: dy, duration: FIRE_FLY_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
              Animated.timing(flyScale, { toValue: k, duration: FIRE_FLY_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
            ]),
            // Little landing bounce + the count appears
            Animated.parallel([
              Animated.sequence([
                Animated.timing(flyScale, { toValue: k * 1.25, duration: 140, useNativeDriver: false }),
                Animated.spring(flyScale, { toValue: k, tension: 180, friction: 6, useNativeDriver: false }),
              ]),
              Animated.spring(dock, { toValue: 1, tension: 160, friction: 7, useNativeDriver: false }),
            ]),
          ]).start();
        }, reduceMotion ? 900 : MILESTONE_MS);
      }
    } else if (shown) {
      Animated.timing(layer, { toValue: 0, duration: isFireMilestone(shown) ? FIRE_FADE_MS : 280, useNativeDriver: useNative }).start(
        () => setShown(null),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  useEffect(() => () => {
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
  }, []);

  if (!shown) return null;
  const sideHeight = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const topOpacity = fill.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] });
  const bottomOpacity = fill.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' });
  const isFire = isFireMilestone(shown);

  return (
    <Animated.View ref={rootRef} pointerEvents="none" style={[styles.milestoneLayer, { opacity: layer }]}>
      {/* Fiery edges: bottom lights first, sides climb, top lights when full */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: chrome }]}>
        <Animated.View style={[styles.flameEdge, styles.flameBottom, { opacity: bottomOpacity }]} />
        <Animated.View style={[styles.flameEdge, styles.flameLeft, { height: sideHeight }]} />
        <Animated.View style={[styles.flameEdge, styles.flameRight, { height: sideHeight }]} />
        <Animated.View style={[styles.flameEdge, styles.flameTop, { opacity: topOpacity }]} />
      </Animated.View>

      <Animated.View style={[styles.milestoneCardWrap, { opacity: scale, transform: [{ scale }] }]}>
        {/* Card background + title fade separately so the fire can leave on its own */}
        <Animated.View style={[styles.milestoneCardBg, { opacity: chrome }]} />
        {isFire ? (
          <Animated.View
            ref={fireRef}
            style={{ transform: [{ translateX: flyX }, { translateY: flyY }, { scale: flyScale }] }}
          >
            <ExpoImage source={FIRE_ANIMATED_CARD} style={styles.fireImage} contentFit="contain" autoplay />
          </Animated.View>
        ) : (
          <Text style={styles.milestoneEmoji}>{shown.emoji}</Text>
        )}
        <Animated.Text style={[styles.milestoneTitle, { opacity: chrome }]}>{shown.title}</Animated.Text>
      </Animated.View>

      {/* Streak count next to the docked fire */}
      {isFire && dockPos && shown.badge ? (
        <Animated.View
          style={[
            styles.dockBadge,
            { left: dockPos.left, top: dockPos.top, opacity: dock, transform: [{ scale: dock }] },
          ]}
          accessibilityLabel={`${shown.badge} in a row`}
        >
          <Text style={styles.dockBadgeText}>{shown.badge}</Text>
        </Animated.View>
      ) : null}
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
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipIcon: { width: 16, height: 16 },
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
  milestoneCardWrap: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingVertical: 20,
  },
  dockBadge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#EA580C',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBadgeText: { ...fontStyle('inter', 'bold'), fontSize: 10.5, color: '#FFFFFF', lineHeight: 13 },
  milestoneCardBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 28,
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
