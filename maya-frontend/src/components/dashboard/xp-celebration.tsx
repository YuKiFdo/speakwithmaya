import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontStyle } from '@/theme/fonts';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { markXpSeenLocally, type XpSnapshot } from '@/hooks/useUserStats';
import { playRewardSound } from '@/services/sound/sound-service';
import { triggerHaptic } from '@/utils/haptics-audio';

const XP_PER_LEVEL = 500;
const FILL_MS = 1600;

/** Saves "this XP total has been celebrated" on the server: one celebration across all devices. */
function postXpSeen(xp: number) {
  const token = OnboardingStore.getState().accessToken;
  if (!token) return;
  fetch(`${getBackendBaseUrl()}/v1/roadmap/xp-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ xp }),
  }).catch(() => {});
}

const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

export interface XpCelebration {
  /** Animated overrides for the top bar while celebrating (undefined = use live stats). */
  progress?: number;
  xpLabel?: string;
  gain: number;
  levelUpTo: number | null;
  /** Changes per celebration; the burst animates when it changes. */
  runId: number;
}

/**
 * Plays the dashboard XP fill exactly once per new XP:
 * - server total > last_seen_xp  -> animate old -> new, and save "seen" at the START
 *   (so closing the app mid-animation or opening another device never replays it);
 * - last_seen_xp never set       -> save silently (no fake "+1200 XP" on first launch);
 * - total went down              -> save silently (never animate backwards).
 */
export function useXpCelebration(
  snapshot: XpSnapshot | null,
  refreshStats?: () => Promise<void>,
): XpCelebration {
  const [state, setState] = useState<XpCelebration>({ gain: 0, levelUpTo: null, runId: 0 });
  const runRef = useRef(0);

  // The call may finalize a few seconds after the learner lands here: check once more
  useEffect(() => {
    const t = setTimeout(() => refreshStats?.(), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const { totalXp, lastSeenXp } = snapshot;
    if (lastSeenXp === null || totalXp < lastSeenXp) {
      markXpSeenLocally(totalXp);
      postXpSeen(totalXp);
      return;
    }
    if (totalXp === lastSeenXp) return;

    // New XP: mark seen first, then animate
    const from = lastSeenXp;
    const to = totalXp;
    markXpSeenLocally(to);
    postXpSeen(to);
    runRef.current += 1;
    const runId = runRef.current;
    const levelUpTo = levelOf(to) > levelOf(from) ? levelOf(to) : null;

    try {
      playRewardSound(levelUpTo ? 'milestone' : 'xp');
    } catch {}
    triggerHaptic(levelUpTo ? 'medium' : 'light');

    const start = Date.now();
    let frame: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / FILL_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const xp = Math.round(from + (to - from) * eased);
      const inLevel = xp % XP_PER_LEVEL;
      setState({
        progress: p >= 1 ? undefined : inLevel / XP_PER_LEVEL,
        xpLabel: p >= 1 ? undefined : `${inLevel} / ${XP_PER_LEVEL} XP`,
        gain: to - from,
        levelUpTo,
        runId,
      });
      if (p < 1) frame = setTimeout(tick, 33);
    };
    tick();
    return () => {
      if (frame) clearTimeout(frame);
    };
  }, [snapshot?.totalXp, snapshot?.lastSeenXp]);

  return state;
}

/** "+45 XP" glow burst under the top bar (and "Level 3!" when a level was crossed). */
export function XpGainBurst({ celebration }: { celebration: XpCelebration }) {
  const insets = useSafeAreaInsets();
  const useNative = Platform.OS !== 'web';
  const anim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!celebration.runId) return;
    setVisible(true);
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, tension: 120, friction: 7, useNativeDriver: useNative }),
      Animated.delay(FILL_MS + 400),
      Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: useNative }),
    ]).start(({ finished }) => finished && setVisible(false));
  }, [celebration.runId, anim, useNative]);

  if (!visible || celebration.gain <= 0) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { top: insets.top + 78 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.burst,
          {
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.6, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : -10, 0] }) },
            ],
          },
        ]}
      >
        <Text style={styles.gain}>{'⭐'} +{celebration.gain} XP</Text>
        {celebration.levelUpTo ? <Text style={styles.level}>Level {celebration.levelUpTo}!</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9000 },
  burst: {
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    ...Platform.select({
      web: { boxShadow: '0 0 24px 6px rgba(251, 191, 36, 0.55)' } as any,
      default: { shadowColor: '#F59E0B', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
    }),
  },
  gain: { ...fontStyle('inter', 'bold'), fontSize: 17, color: '#B45309' },
  level: { ...fontStyle('outfit', 'bold'), fontSize: 14, color: '#C2410C', marginTop: 2 },
});
