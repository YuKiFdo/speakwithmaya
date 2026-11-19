import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { fontStyle } from '@/theme/fonts';

const STAR_ANIMATED = require('@/assets/images/star-animated-small.webp');

export interface XpGainSignal {
  amount: number;
  /** Changes per gain; the star plays again when it changes. */
  runId: number;
  /** How long to stay before fading (e.g. while the XP number counts up). */
  holdMs?: number;
}

/**
 * Small ⭐ with a "+N" badge, docked on the top-right corner of an avatar (same look as the
 * in-call XP / streak fire). Pops in with a wiggle, stays for `holdMs`, then fades out.
 * Place it inside a `position: relative` wrapper around the avatar.
 */
export function XpStarDock({ gain, top = -10, right = -12 }: { gain: XpGainSignal | null; top?: number; right?: number }) {
  const show = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<XpGainSignal | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(!!v))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!gain || gain.amount <= 0) return;
    if (timer.current) clearTimeout(timer.current);
    setShown(gain);
    show.setValue(0);
    wiggle.setValue(0);
    Animated.parallel([
      Animated.spring(show, { toValue: 1, tension: 160, friction: 7, useNativeDriver: false }),
      Animated.timing(wiggle, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.timing(show, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(
        ({ finished }) => finished && setShown(null),
      );
    }, gain.holdMs ?? 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gain?.runId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!shown) return null;
  return (
    <View pointerEvents="none" style={[styles.dock, { top, right }]} accessibilityLiveRegion="polite" accessibilityLabel={`Plus ${shown.amount} XP`}>
      <Animated.View
        style={{
          opacity: show,
          transform: [
            { translateY: show.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 10, 0] }) },
            { scale: show.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.3, 1] }) },
            {
              rotate: wiggle.interpolate({
                inputRange: [0, 0.15, 0.3, 0.45, 1],
                outputRange: reduceMotion ? ['0deg', '0deg', '0deg', '0deg', '0deg'] : ['0deg', '-14deg', '10deg', '-4deg', '0deg'],
              }),
            },
          ],
        }}
      >
        <ExpoImage source={STAR_ANIMATED} style={styles.star} contentFit="contain" autoplay />
        <Animated.View
          style={[
            styles.badge,
            { transform: [{ scale: wiggle.interpolate({ inputRange: [0, 0.2, 0.35, 1], outputRange: [0.4, 1.25, 1, 1] }) }] },
          ]}
        >
          <Text style={styles.badgeText}>+{shown.amount}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', zIndex: 40, elevation: 40 },
  star: { width: 30, height: 30 },
  badge: {
    position: 'absolute',
    bottom: -5,
    right: -12,
    minWidth: 26,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#EA580C',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...fontStyle('inter', 'bold'), fontSize: 11.5, color: '#FFFFFF', lineHeight: 14 },
});
