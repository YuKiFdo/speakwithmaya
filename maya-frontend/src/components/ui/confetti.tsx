import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';

const CONFETTI_COLORS = [
  '#2563EB', // Maya Primary Blue
  '#38BDF8', // Sky Blue
  '#60A5FA', // Light Blue
  '#F43F5E', // Rose
  '#E11D48', // Ruby
  '#F59E0B', // Amber
  '#FBBF24', // Gold
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

type ParticleShape = 'ribbon' | 'square' | 'circle' | 'pill';

interface ParticleData {
  id: number;
  color: string;
  shape: ParticleShape;
  size: { width: number; height: number; borderRadius: number };
  yKeyframes: number[];
  xKeyframes: number[];
  spinX: number;
  spinY: number;
  spinZ: number;
  delay: number;
  duration: number;
}

interface ConfettiProps {
  count?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  onComplete?: () => void;
}

// Normalized time steps for 9-point smooth parabolic physics & S-curve flutter
const TIME_STEPS = [0, 0.08, 0.17, 0.27, 0.36, 0.5, 0.66, 0.83, 1];

const ConfettiPiece = React.memo(function ConfettiPiece({
  particle,
  onPieceComplete,
}: {
  particle: ParticleData;
  onPieceComplete: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(particle.delay),
      Animated.timing(anim, {
        toValue: 1,
        duration: particle.duration,
        easing: Easing.linear,
        useNativeDriver: useNative,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onPieceComplete();
      }
    });

    return () => {
      animation.stop();
    };
  }, [anim, particle.delay, particle.duration, onPieceComplete, useNative]);

  const translateY = anim.interpolate({
    inputRange: TIME_STEPS,
    outputRange: particle.yKeyframes,
  });

  const translateX = anim.interpolate({
    inputRange: TIME_STEPS,
    outputRange: particle.xKeyframes,
  });

  const rotateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.spinX}deg`],
  });

  const rotateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.spinY}deg`],
  });

  const rotateZ = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.spinZ}deg`],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.04, 0.78, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.1, 0.35, 0.85, 1],
    outputRange: [0.25, 1.08, 1, 0.95, 0.65],
  });

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
      style={[
        styles.particle,
        {
          width: particle.size.width,
          height: particle.size.height,
          borderRadius: particle.size.borderRadius,
          backgroundColor: particle.color,
          opacity,
          transform: [
            { perspective: 600 },
            { translateX },
            { translateY },
            { rotateX },
            { rotateY },
            { rotateZ },
            { scale },
          ],
        },
      ]}
    />
  );
});

export function ConfettiOverlay({
  count = 65,
  duration = 3400,
  style,
  onComplete,
}: ConfettiProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Lock initial dimensions so mid-animation layout shifts never restart particles
  const dimensionsRef = useRef({
    width: windowWidth || 380,
    height: windowHeight || 800,
  });

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const particles: ParticleData[] = useMemo(() => {
    const screenWidth = dimensionsRef.current.width;
    const screenHeight = dimensionsRef.current.height;
    const list: ParticleData[] = [];
    const shapes: ParticleShape[] = ['ribbon', 'square', 'circle', 'pill'];

    for (let i = 0; i < count; i++) {
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const shape = shapes[i % shapes.length];

      let size = { width: 9, height: 18, borderRadius: 2 };
      if (shape === 'square') {
        const s = 8 + Math.floor(Math.random() * 4);
        size = { width: s, height: s, borderRadius: 2 };
      } else if (shape === 'circle') {
        const s = 8 + Math.floor(Math.random() * 5);
        size = { width: s, height: s, borderRadius: Math.round(s / 2) };
      } else if (shape === 'pill') {
        size = { width: 7, height: 14, borderRadius: 4 };
      } else {
        size = {
          width: 8 + Math.floor(Math.random() * 3),
          height: 16 + Math.floor(Math.random() * 8),
          borderRadius: 2,
        };
      }

      // 3 origin channels: Left cannon (40%), Right cannon (40%), Center fountain (20%)
      const channel = i % 10;
      let startX = 0;
      const startY = screenHeight * (0.64 + Math.random() * 0.24);
      let apexX = 0;

      if (channel < 4) {
        // Left cannon shooting up and right
        startX = screenWidth * (0.02 + Math.random() * 0.12);
        apexX = screenWidth * (0.2 + Math.random() * 0.55);
      } else if (channel < 8) {
        // Right cannon shooting up and left
        startX = screenWidth * (0.86 + Math.random() * 0.12);
        apexX = screenWidth * (0.25 + Math.random() * 0.55);
      } else {
        // Center fountain
        startX = screenWidth * (0.42 + Math.random() * 0.16);
        apexX = screenWidth * (0.12 + Math.random() * 0.76);
      }

      const peakY = screenHeight * (0.04 + Math.random() * 0.3);
      const endY = screenHeight + 60;
      const upDist = startY - peakY;
      const downDist = endY - peakY;

      // Smooth 9-point parabolic trajectory:
      // Fast cannon burst up -> weightless hang at apex (t=0.27..0.36) -> accelerating gravity fall
      const yKeyframes = [
        startY,
        startY - upDist * 0.58,
        startY - upDist * 0.89,
        peakY,
        peakY + downDist * 0.04,
        peakY + downDist * 0.19,
        peakY + downDist * 0.44,
        peakY + downDist * 0.73,
        endY,
      ];

      // Smooth horizontal launch momentum + sinusoidal fluttering sway during descent
      const swayAmp = (18 + Math.random() * 24) * (Math.random() > 0.5 ? 1 : -1);
      const windDrift = (Math.random() - 0.5) * 45;

      const xKeyframes = [
        startX,
        startX + (apexX - startX) * 0.52,
        startX + (apexX - startX) * 0.84,
        apexX,
        apexX + swayAmp * 0.45,
        apexX + swayAmp,
        apexX - swayAmp * 0.65 + windDrift * 0.4,
        apexX + swayAmp * 0.5 + windDrift * 0.75,
        apexX + windDrift,
      ];

      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      const dirZ = Math.random() > 0.5 ? 1 : -1;

      const spinX = dirX * (360 + Math.floor(Math.random() * 720));
      const spinY = dirY * (540 + Math.floor(Math.random() * 900));
      const spinZ = dirZ * (360 + Math.floor(Math.random() * 540));

      const delay = Math.floor(Math.random() * 340);
      const particleDuration = duration - 300 + Math.floor(Math.random() * 650);

      list.push({
        id: i,
        color,
        shape,
        size,
        yKeyframes,
        xKeyframes,
        spinX,
        spinY,
        spinZ,
        delay,
        duration: particleDuration,
      });
    }

    return list;
  }, [count, duration]);

  const completedCount = useRef(0);
  const handlePieceComplete = useCallback(() => {
    completedCount.current += 1;
    if (completedCount.current >= particles.length && onCompleteRef.current) {
      onCompleteRef.current();
    }
  }, [particles.length]);

  return (
    <View pointerEvents="none" style={[styles.overlay, style]}>
      {particles.map((p) => (
        <ConfettiPiece
          key={p.id}
          particle={p}
          onPieceComplete={handlePieceComplete}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    ...Platform.select({
      web: {
        willChange: 'transform, opacity',
        backfaceVisibility: 'visible',
      } as any,
      default: {},
    }),
  },
});