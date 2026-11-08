import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  PressableProps,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { HistoryPlayIcon, HistoryPauseIcon } from '@/components/icons/history-icons';

/* -------------------------------------------------------------------------- */
/* Haptics (no-op on web)                                                     */
/* -------------------------------------------------------------------------- */

const canHaptic = Platform.OS !== 'web';

export type HapticKind = 'selection' | 'light' | 'medium' | 'none';

export const haptic = {
  selection: () => {
    if (canHaptic) Haptics.selectionAsync();
  },
  light: () => {
    if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  success: () => {
    if (canHaptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};

function fireHaptic(kind: HapticKind) {
  if (kind === 'selection') haptic.selection();
  else if (kind === 'light') haptic.light();
  else if (kind === 'medium') haptic.medium();
}

/* -------------------------------------------------------------------------- */
/* PressableScale: springs down on press, bounces back on release             */
/* -------------------------------------------------------------------------- */

const PRESS_IN = { damping: 18, stiffness: 420, mass: 0.6 };
const PRESS_OUT = { damping: 10, stiffness: 320, mass: 0.6 };

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Style for the inner Pressable. Supports the function form (e.g. web `hovered`). */
  style?: PressableProps['style'];
  /** Style for the outer animated wrapper (margins, flex, etc.). */
  wrapperStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: HapticKind;
};

export function PressableScale({
  style,
  wrapperStyle,
  scaleTo = 0.97,
  haptic: hapticKind = 'none',
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[wrapperStyle, animatedStyle]}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={(e) => {
          if (!reduce) scale.value = withSpring(scaleTo, PRESS_IN);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reduce) scale.value = withSpring(1, PRESS_OUT);
          onPressOut?.(e);
        }}
        onPress={(e) => {
          fireHaptic(hapticKind);
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Reveal: staggered entrance                                                 */
/* -------------------------------------------------------------------------- */

type RevealProps = {
  index?: number;
  variant?: 'up' | 'fade' | 'slide';
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: React.ReactNode;
};

export function Reveal({ index = 0, variant = 'up', style, onLayout, children }: RevealProps) {
  const reduce = useReducedMotion();
  const delay = Math.min(index, 8) * 45; // cap so long lists don't take forever

  // Reanimated web layout reanimation requires named WebEasings (e.g. Easing.ease).
  // Composite functions like Easing.out(Easing.cubic) trigger "Selected easing is not currently supported on web".
  const enterEase = Platform.OS === 'web' ? Easing.ease : Easing.out(Easing.cubic);

  const entering = reduce
    ? undefined
    : variant === 'fade'
    ? FadeIn.delay(delay).duration(240)
    : variant === 'slide'
    ? FadeInRight.duration(260).easing(enterEase)
    : FadeInDown.delay(delay).duration(320).easing(enterEase);

  return (
    <Animated.View entering={entering} style={style} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* SpringScale + SelectionAccent: selected-card feedback                      */
/* -------------------------------------------------------------------------- */

export function SpringScale({
  to,
  style,
  children,
}: {
  to: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const s = useSharedValue(to);

  useEffect(() => {
    s.value = reduce ? to : withSpring(to, { damping: 11, stiffness: 240, mass: 0.7 });
  }, [to, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Thin accent bar on the left edge that grows in when a card is selected. */
export function SelectionAccent({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    v.value = reduce
      ? active ? 1 : 0
      : active
      ? withSpring(1, { damping: 14, stiffness: 220, mass: 0.7 })
      : withTiming(0, { duration: 140 });
  }, [active, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scaleY: 0.3 + 0.7 * v.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.accentBar, animatedStyle]} />
  );
}

/* -------------------------------------------------------------------------- */
/* Equalizer: three bouncing bars (playing indicator)                         */
/* -------------------------------------------------------------------------- */

function EqBar({
  index,
  active,
  color,
  maxH,
}: {
  index: number;
  active: boolean;
  color: string;
  maxH: number;
}) {
  const v = useSharedValue(0.3);

  useEffect(() => {
    if (active) {
      const d = 280 + index * 110;
      const ease = Platform.OS === 'web' ? Easing.ease : Easing.inOut(Easing.quad);
      v.value = withDelay(
        index * 90,
        withRepeat(
          withSequence(
            withTiming(1, { duration: d, easing: ease }),
            withTiming(0.3, { duration: d, easing: ease })
          ),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(v);
      v.value = withTiming(0.3, { duration: 120 });
    }
    return () => cancelAnimation(v);
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({ height: maxH * v.value }));

  return (
    <Animated.View
      style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, animatedStyle]}
    />
  );
}

export function Equalizer({
  active = true,
  color = '#2B5BFF',
  size = 12,
}: {
  active?: boolean;
  color?: string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: size }}>
      {[0, 1, 2].map((i) => (
        <EqBar key={i} index={i} active={active && !reduce} color={color} maxH={size} />
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* PlayToggle: play/pause with pop + pulsing ring while playing               */
/* -------------------------------------------------------------------------- */

export function PlayToggle({
  playing,
  size = 40,
  onPress,
  label,
  color = '#2B5BFF',
  haptic: kind = 'light',
}: {
  playing: boolean;
  size?: number;
  onPress: (e: GestureResponderEvent) => void;
  label?: string;
  color?: string;
  haptic?: HapticKind;
}) {
  const reduce = useReducedMotion();
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);
  const first = useRef(true);

  // Pop when the icon swaps (skip first render)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    pop.value = withSequence(
      withTiming(0.8, { duration: 70 }),
      withSpring(1, { damping: 7, stiffness: 280, mass: 0.6 })
    );
  }, [playing]);

  // Expanding ring while playing
  useEffect(() => {
    if (playing && !reduce) {
      ring.value = 0;
      ring.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Platform.OS === 'web' ? Easing.ease : Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      cancelAnimation(ring);
      ring.value = 0;
    }
    return () => cancelAnimation(ring);
  }, [playing, reduce]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : (1 - ring.value) * 0.3,
    transform: [{ scale: 1 + ring.value * 0.6 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      scaleTo={0.88}
      haptic={kind}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? (playing ? 'Pause recording' : 'Play recording')}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          ringStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        {playing ? (
          <HistoryPauseIcon size={size} color={color} />
        ) : (
          <HistoryPlayIcon size={size} color={color} />
        )}
      </Animated.View>
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------- */
/* SpeedPill: bounces whenever the speed changes                              */
/* -------------------------------------------------------------------------- */

export function SpeedPill({ speed, onPress }: { speed: number; onPress: () => void }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    s.value = withSequence(
      withTiming(1.14, { duration: 90 }),
      withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 })
    );
  }, [speed]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Animated.View style={popStyle}>
      <PressableScale
        scaleTo={0.92}
        haptic="selection"
        onPress={onPress}
        style={styles.speedPill}
        accessibilityRole="button"
        accessibilityLabel={`Change speed: current ${speed.toFixed(1)}x`}
      >
        <Text style={styles.speedPillText}>{speed.toFixed(1)}x</Text>
      </PressableScale>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* ListenPill: per-turn audio button with equalizer while playing             */
/* -------------------------------------------------------------------------- */

export function ListenPill({
  playing,
  isUser,
  onPress,
}: {
  playing: boolean;
  isUser: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.94}
      haptic="light"
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Play ${isUser ? 'your' : 'AI'} audio turn`}
      style={[styles.listenPill, playing && styles.listenPillActive]}
    >
      {playing ? (
        <Equalizer size={11} color="#2B5BFF" />
      ) : (
        <Ionicons name="volume-medium" size={13} color="#64748B" />
      )}
      <Text style={[styles.listenText, playing && styles.listenTextActive]}>
        {playing ? 'Playing' : 'Listen'}
      </Text>
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------- */
/* Corrections: chevron, smooth card height, collapsible body                 */
/* -------------------------------------------------------------------------- */

export function CorrectionChevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const r = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    r.value = reduce ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r.value * 180}deg` }],
  }));

  return (
    <Animated.View style={[{ marginLeft: 2 }, animatedStyle]}>
      <Ionicons name="chevron-down" size={14} color="#64748B" />
    </Animated.View>
  );
}

/** Card that smoothly animates its height when the body inside it appears/disappears. */
export function AnimatedCard({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(220)} style={style}>
      {children}
    </Animated.View>
  );
}

export function AnimatedCollapse({
  open,
  children,
}: {
  open: boolean;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (!open) return null;
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(180)}
      exiting={reduce ? undefined : FadeOutUp.duration(120)}
    >
      {children}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* AnimatedSearchBar: border and background animate on focus                  */
/* -------------------------------------------------------------------------- */

export function AnimatedSearchBar({
  value,
  onChangeText,
  placeholder,
  containerStyle,
  inputStyle,
  leading,
  clearIcon,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: any;
  leading?: React.ReactNode;
  clearIcon?: React.ReactNode;
}) {
  const focus = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], ['#E2E8F0', '#93B4FF']),
    backgroundColor: interpolateColor(focus.value, [0, 1], ['#F8FAFC', '#FFFFFF']),
  }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      {leading}
      <TextInput
        style={[inputStyle, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          focus.value = withTiming(1, { duration: 160 });
        }}
        onBlur={() => {
          focus.value = withTiming(0, { duration: 160 });
        }}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Animated.View entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(100)}>
          <Pressable
            onPress={() => {
              haptic.selection();
              onChangeText('');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            {clearIcon}
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* PulseView: soft loading pulse for skeletons                                */
/* -------------------------------------------------------------------------- */

export function PulseView({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const o = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    const pulseEase = Platform.OS === 'web' ? Easing.ease : Easing.inOut(Easing.quad);
    o.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 800, easing: pulseEase }),
        withTiming(1, { duration: 800, easing: pulseEase })
      ),
      -1,
      false
    );
    return () => cancelAnimation(o);
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: '#2B5BFF',
  },
  speedPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0F172A',
  },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  listenPillActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  listenText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748B',
  },
  listenTextActive: {
    color: '#2B5BFF',
  },
});