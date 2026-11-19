import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSmoothedVoiceLevel } from './voice-level';

export type VoiceOrbMode = 'maya' | 'user' | 'thinking' | 'idle';

/** Maya's own palette (not Google's): Maya and thinking = blues only, learner = violet -> pink. */
const PALETTE = {
  maya: { core: '#2563EB', edge: '#60A5FA', glow: 'rgba(59, 130, 246, 0.55)' },
  user: { core: '#A855F7', edge: '#EC4899', glow: 'rgba(168, 85, 247, 0.5)' },
  thinking: { core: '#1D4ED8', edge: '#93C5FD', glow: 'rgba(37, 99, 235, 0.32)' },
  idle: { core: '#94A3B8', edge: '#CBD5E1', glow: 'rgba(148, 163, 184, 0.25)' },
} as const;

const RIPPLES = 3;

interface Props {
  /** Avatar diameter (the orb draws around it). */
  size: number;
  mode: VoiceOrbMode;
  /** Raw voice level 0..1 of whoever is speaking (shaped + smoothed inside). */
  level: number;
  /** Changes once when the call comes alive: plays a one-time wake-up burst. */
  wakeKey?: number;
  /** Maya speaking: follow her live playback loudness word by word (voice-meter). */
  liveMaya?: boolean;
  children: React.ReactNode;
}

/**
 * Voice orb around Maya's avatar. Maya speaking: blue halo that breathes with her voice,
 * rings rippling out on stronger syllables. Learner speaking: violet/pink. Thinking: a slow
 * rotating arc. Idle: a dim thin ring. Only transform/opacity animate, driven per frame without
 * React re-renders, so it stays smooth on low-end phones.
 */
export function VoiceOrb({ size, mode, level, wakeKey, liveMaya = false, children }: Props) {
  const useNative = Platform.OS !== 'web';
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
  }, []);

  const speaking = mode === 'maya' || mode === 'user';
  const lvl = useSmoothedVoiceLevel(speaking ? level : 0, !liveMaya && speaking && level > 0.02, 0.18, liveMaya);

  // Mode cross-fade (0 = previous look, 1 = current)
  const modeIn = useRef(new Animated.Value(1)).current;
  const [shownMode, setShownMode] = useState<VoiceOrbMode>(mode);
  useEffect(() => {
    if (mode === shownMode) return;
    Animated.timing(modeIn, { toValue: 0, duration: 140, useNativeDriver: false }).start(() => {
      setShownMode(mode);
      Animated.timing(modeIn, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Ripples: continuous loops; their visibility scales with the voice level
  const ripples = useRef(Array.from({ length: RIPPLES }, () => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loops = ripples.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * 1800) / RIPPLES),
          Animated.timing(r, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [ripples, reduceMotion]);

  // Thinking arc rotation
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (shownMode !== 'thinking' || reduceMotion) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: useNative }),
    );
    loop.start();
    return () => loop.stop();
  }, [shownMode, spin, reduceMotion, useNative]);

  // One-time wake-up burst when the call comes alive
  const wake = useRef(new Animated.Value(0)).current;
  const firstWake = useRef(true);
  useEffect(() => {
    if (wakeKey === undefined) return;
    if (firstWake.current && !wakeKey) {
      firstWake.current = false;
      return;
    }
    firstWake.current = false;
    wake.setValue(0);
    Animated.timing(wake, {
      toValue: 1,
      duration: reduceMotion ? 300 : 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [wakeKey, wake, reduceMotion]);

  const pal = PALETTE[shownMode];
  const pad = Math.round(size * 0.45);
  const box = size + pad * 2;
  const haloSize = size + Math.round(size * 0.34);

  const haloScale = lvl.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion ? 1.04 : 1.22] });
  const haloOpacity = Animated.multiply(
    modeIn,
    lvl.interpolate({ inputRange: [0, 1], outputRange: [speaking ? 0.45 : shownMode === 'thinking' ? 0.35 : 0.18, 0.95] }),
  );
  const ringOpacity = Animated.multiply(modeIn, shownMode === 'idle' ? 0.45 : 0.9);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const arc = 2 * Math.PI * ((size + 8) / 2);
  const ringD = size + 8;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center', margin: -pad }} pointerEvents="box-none">
      {/* Ripples (only visible while someone speaks; stronger voice = brighter, wider) */}
      {speaking &&
        ripples.map((r, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.circle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 2,
                borderColor: pal.edge,
                opacity: Animated.multiply(
                  Animated.multiply(modeIn, lvl),
                  r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.75, 0] }),
                ),
                transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (box / size - 1) * 0.95] }) }],
              },
            ]}
          />
        ))}

      {/* Soft halo that breathes with the voice */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.circle,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: pal.glow,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
          Platform.OS === 'web'
            ? ({ filter: `blur(${Math.round(size * 0.12)}px)` } as any)
            : { shadowColor: pal.core, shadowOpacity: 0.8, shadowRadius: size * 0.25, shadowOffset: { width: 0, height: 0 } },
        ]}
      />

      {/* Wake-up burst: a bright ring that expands once and fades */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: PALETTE.maya.edge,
            opacity: wake.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
            transform: [{ scale: wake.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
          },
        ]}
      />

      {/* Gradient ring hugging the avatar (rotating arc while thinking) */}
      {/* Opacity (JS driver) and rotation (native driver) live on separate views: mixing drivers
          on one view throws on native. */}
      <Animated.View pointerEvents="none" style={[styles.circle, { width: ringD + 4, height: ringD + 4, opacity: ringOpacity }]}>
      <Animated.View
        pointerEvents="none"
        style={[{ width: ringD + 4, height: ringD + 4 }, shownMode === 'thinking' ? { transform: [{ rotate }] } : null]}
      >
        <Svg width={ringD + 4} height={ringD + 4}>
          <Defs>
            <LinearGradient id={`orb-${shownMode}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={pal.edge} />
              <Stop offset="1" stopColor={pal.core} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={(ringD + 4) / 2}
            cy={(ringD + 4) / 2}
            r={ringD / 2}
            stroke={`url(#orb-${shownMode})`}
            strokeWidth={shownMode === 'idle' ? 1.5 : 2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={shownMode === 'thinking' ? `${arc * 0.28} ${arc}` : undefined}
          />
        </Svg>
      </Animated.View>
      </Animated.View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
});
