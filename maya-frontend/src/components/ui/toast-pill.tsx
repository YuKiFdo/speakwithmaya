import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ViewStyle,
  TextStyle,
  Pressable,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { Radii } from '@/theme/tokens';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── SVG ICONS FOR TOAST PILL ────────────────────────────────────────────────

interface IconProps {
  color: string;
  size?: number;
}

export function ToastClockIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7V12L15 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ToastSpeakerLoudIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5L6 9H2V15H6L11 19V5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54M19.07 4.93C20.94 6.8 22 9.33 22 12C22 14.67 20.94 17.2 19.07 19.07"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ToastMicMoveIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="2" />
      <Path
        d="M5 10C5 13.866 8.134 17 12 17C15.866 17 19 13.866 19 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path d="M12 17V21M8 21H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ToastMicOffIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 9V11C9 11.28 9.04 11.55 9.11 11.8M15 11C15 11.28 14.96 14.89 11.8M12 3C10.34 3 9 4.34 9 6V7M15 8V6C15 4.34 13.66 3 12 3Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M19 11C19 14.54 16.39 17.47 13 17.93M5 11C5 12.35 5.37 13.62 6.03 14.71M12 18V21M8 21H16M2 2L22 22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ToastWifiWeakIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1.42 9C4.33 6.09 8.21 4.5 12 4.5C15.79 4.5 19.67 6.09 22.58 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      <Path
        d="M5 12.5C6.98 10.52 9.49 9.5 12 9.5C14.51 9.5 17.02 10.52 19 12.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8.5 16C9.5 15 10.75 14.5 12 14.5C13.25 14.5 14.5 15 15.5 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="19.5" r="1.5" fill={color} />
    </Svg>
  );
}

export function ToastWifiOffIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1.42 9C4.33 6.09 8.21 4.5 12 4.5C13.88 4.5 15.76 4.9 17.44 5.67M22.58 9C21.84 8.26 21 7.6 20.1 7.02M5 12.5C6.98 10.52 9.49 9.5 12 9.5C13.12 9.5 14.24 9.71 15.28 10.12M19 12.5C18.25 11.75 17.4 11.12 16.48 10.63M8.5 16C9.5 15 10.75 14.5 12 14.5C12.55 14.5 13.08 14.6 13.57 14.78M2 2L22 22"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="19.5" r="1.5" fill={color} />
    </Svg>
  );
}

export function ToastWifiIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1.42 9C4.33 6.09 8.21 4.5 12 4.5C15.79 4.5 19.67 6.09 22.58 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M5 12.5C6.98 10.52 9.49 9.5 12 9.5C14.51 9.5 17.02 10.52 19 12.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8.5 16C9.5 15 10.75 14.5 12 14.5C13.25 14.5 14.5 15 15.5 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="19.5" r="1.5" fill={color} />
    </Svg>
  );
}

export function ToastRefreshIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5V9H8M4 13A8.1 8.1 0 0 0 19.5 15M20 19V15H16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ToastWaveformIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12H6L9 4L13 20L17 10L19 14H21"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ToastHeadphonesIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 14V12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12V14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Rect x="2" y="14" width="4" height="6" rx="2" stroke={color} strokeWidth="2" />
      <Rect x="18" y="14" width="4" height="6" rx="2" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function ToastInfoCircleIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={color} />
      <Path d="M12 8V8.01" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M12 11V16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ToastAlertCircleIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={color} />
      <Path d="M12 7V12" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M12 16V16.01" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

// ─── TYPES & PRESETS ──────────────────────────────────────────────────────────

export type ToastVariant = 'warning' | 'error' | 'info';

export type ToastPillPreset =
  // Warning / Warm:
  | 'session-ends'
  | 'speak-louder'
  | 'move-closer'
  | 'couldnt-hear'
  | 'weak-connection'
  | 'slow-connection'
  | 'reconnecting'
  | 'noise-detected'
  | 'quiet-place'
  | 'reduce-noise'
  // Error / Red:
  | 'connection-lost'
  | 'something-wrong'
  | 'try-again'
  // Info / Blue:
  | 'connection-restored'
  | 'getting-ready'
  | 'please-wait';

export interface ToastPillConfig {
  variant: ToastVariant;
  text: string;
  icon: (color: string) => React.ReactNode;
}

export const TOAST_PRESET_CONFIGS: Record<ToastPillPreset, ToastPillConfig> = {
  // ── Column 1 (Audio / Volume / Session) ──
  'session-ends': {
    variant: 'warning',
    text: 'Session ends in 10 seconds',
    icon: (color) => <ToastClockIcon color={color} size={15} />,
  },
  'speak-louder': {
    variant: 'warning',
    text: 'Speak a little louder',
    icon: (color) => <ToastSpeakerLoudIcon color={color} size={15} />,
  },
  'move-closer': {
    variant: 'warning',
    text: 'Move closer to your mic',
    icon: (color) => <ToastMicMoveIcon color={color} size={15} />,
  },
  'couldnt-hear': {
    variant: 'warning',
    text: "We couldn't hear you",
    icon: (color) => <ToastMicOffIcon color={color} size={15} />,
  },

  // ── Column 2 (Connection Lifecycle) ──
  'weak-connection': {
    variant: 'warning',
    text: 'Weak connection',
    icon: (color) => <ToastWifiWeakIcon color={color} size={15} />,
  },
  'slow-connection': {
    variant: 'info',
    text: 'Maya is thinking...',
    icon: (color) => <ToastClockIcon color={color} size={15} />,
  },
  'reconnecting': {
    variant: 'warning',
    text: 'Reconnecting...',
    icon: (color) => <ToastRefreshIcon color={color} size={15} />,
  },
  'connection-lost': {
    variant: 'error',
    text: 'Connection lost',
    icon: (color) => <ToastWifiOffIcon color={color} size={15} />,
  },
  'connection-restored': {
    variant: 'info',
    text: 'Connection restored',
    icon: (color) => <ToastWifiIcon color={color} size={15} />,
  },

  // ── Column 3 (Noise & Environment) ──
  'noise-detected': {
    variant: 'warning',
    text: 'Background noise detected',
    icon: (color) => <ToastWaveformIcon color={color} size={15} />,
  },
  'quiet-place': {
    variant: 'warning',
    text: 'Try a quieter place',
    icon: (color) => <ToastMicOffIcon color={color} size={15} />,
  },
  'reduce-noise': {
    variant: 'warning',
    text: 'Reduce background noise',
    icon: (color) => <ToastHeadphonesIcon color={color} size={15} />,
  },

  // ── Column 4 (Status & Feedback) ──
  'getting-ready': {
    variant: 'info',
    text: 'Getting ready...',
    icon: (color) => <ToastInfoCircleIcon color={color} size={16} />,
  },
  'please-wait': {
    variant: 'info',
    text: 'Please wait...',
    icon: (color) => <ToastRefreshIcon color={color} size={15} />,
  },
  'something-wrong': {
    variant: 'error',
    text: 'Something went wrong',
    icon: (color) => <ToastAlertCircleIcon color={color} size={16} />,
  },
  'try-again': {
    variant: 'error',
    text: "Let's try again",
    icon: (color) => <ToastRefreshIcon color={color} size={15} />,
  },
};

// ─── THEME PALETTES ──────────────────────────────────────────────────────────

const VARIANT_PALETTES: Record<
  ToastVariant,
  {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  warning: {
    backgroundColor: '#FFF7ED', // Warm peach/cream
    borderColor: '#FED7AA',     // Soft peach border
    textColor: '#C2410C',       // Warm orange-brown
    iconColor: '#EA580C',       // Vibrant amber-orange
  },
  error: {
    backgroundColor: '#FFF1F2', // Soft rose pink
    borderColor: '#FECDD3',     // Soft red border
    textColor: '#DC2626',       // Error red
    iconColor: '#EF4444',       // Vibrant red
  },
  info: {
    backgroundColor: '#F0F9FF', // Ice blue
    borderColor: '#BAE6FD',     // Soft blue border
    textColor: '#0284C7',       // Cyan-blue
    iconColor: '#0284C7',       // Vibrant blue
  },
};

// ─── PROPS ────────────────────────────────────────────────────────────────────

export interface ToastPillProps {
  preset?: ToastPillPreset;
  text?: string;
  secondsRemaining?: number;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  visible?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const PILL_MORPH_ANIM = LayoutAnimation.create(
  180,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

/**
 * ToastPill: Common pill notification component matching Figma design
 * for in-call warnings, network alerts, noise detection, and session countdowns.
 */
export function ToastPill({
  preset = 'session-ends',
  text,
  secondsRemaining,
  variant: propVariant,
  icon: propIcon,
  visible = true,
  onPress,
  style,
  textStyle,
}: ToastPillProps) {
  const useNative = Platform.OS !== 'web';
  const [shouldRender, setShouldRender] = useState(visible);

  const config =
    TOAST_PRESET_CONFIGS[preset] || TOAST_PRESET_CONFIGS['session-ends'];
  const variant = propVariant || config.variant;
  const palette = VARIANT_PALETTES[variant];

  // Resolve display text:
  let displayText = text || config.text;
  if (
    preset === 'session-ends' &&
    typeof secondsRemaining === 'number' &&
    !text
  ) {
    displayText = `The session ends in ${secondsRemaining} second${
      secondsRemaining === 1 ? '' : 's'
    }`;
  }

  // Entrance / Exit animations (starts at 0 so conditional mounting always animates in!)
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const translateYAnim = useRef(new Animated.Value(-8)).current;

  // Icon micro-animations (spin for reconnecting, pulse for thinking/countdown)
  const iconSpinAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;

  // 1. Mount / Visibility Entrance & Exit
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 110,
          friction: 8,
          useNativeDriver: useNative,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          tension: 110,
          friction: 8,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 160,
          useNativeDriver: useNative,
        }),
        Animated.timing(translateYAnim, {
          toValue: -6,
          duration: 160,
          useNativeDriver: useNative,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, opacityAnim, scaleAnim, translateYAnim, useNative]);

  // 2. Smooth morph pop when switching between different presets while already visible
  const prevPresetRef = useRef(preset);
  useEffect(() => {
    if (visible && prevPresetRef.current !== preset) {
      prevPresetRef.current = preset;
      LayoutAnimation.configureNext(PILL_MORPH_ANIM);
      scaleAnim.setValue(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 130,
        friction: 7,
        useNativeDriver: useNative,
      }).start();
    }
  }, [preset, visible, scaleAnim, useNative]);

  // 3. Continuous Spin for 'reconnecting' / 'please-wait' OR Pulse for 'slow-connection'
  useEffect(() => {
    if (!visible) return;

    const isSpinningPreset =
      preset === 'reconnecting' || preset === 'please-wait';
    const isPulsingPreset =
      preset === 'slow-connection' ||
      preset === 'connection-lost' ||
      (preset === 'session-ends' &&
        typeof secondsRemaining === 'number' &&
        secondsRemaining <= 10);

    let spinLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (isSpinningPreset) {
      iconSpinAnim.setValue(0);
      spinLoop = Animated.loop(
        Animated.timing(iconSpinAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: useNative,
        })
      );
      spinLoop.start();
    } else {
      iconSpinAnim.setValue(0);
    }

    if (isPulsingPreset) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulseAnim, {
            toValue: 1.16,
            duration: 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(iconPulseAnim, {
            toValue: 0.92,
            duration: 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
        ])
      );
      pulseLoop.start();
    } else {
      iconPulseAnim.setValue(1);
    }

    return () => {
      spinLoop?.stop();
      pulseLoop?.stop();
    };
  }, [
    preset,
    visible,
    secondsRemaining !== undefined && secondsRemaining <= 10,
    iconSpinAnim,
    iconPulseAnim,
    useNative,
  ]);

  if (!shouldRender) {
    return null;
  }

  const renderedIcon =
    propIcon !== undefined ? propIcon : config.icon(palette.iconColor);

  const iconRotate = iconSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const content = (
    <Animated.View
      style={[
        styles.pillContainer,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: opacityAnim,
          transform: [
            { translateY: translateYAnim },
            { scale: scaleAnim },
          ],
        },
        style,
      ]}
    >
      {renderedIcon && (
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [
                { rotate: iconRotate },
                { scale: iconPulseAnim },
              ],
            },
          ]}
        >
          {renderedIcon}
        </Animated.View>
      )}
      <Text
        style={[
          styles.pillText,
          { color: palette.textColor },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {displayText}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        userSelect: 'none',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    letterSpacing: -0.15,
    fontVariant: ['tabular-nums'],
  },
});