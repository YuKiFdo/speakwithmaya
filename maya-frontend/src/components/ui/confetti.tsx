import React, { useEffect, useMemo, useRef } from 'react';
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
  startX: number;
  startY: number;
  peakY: number;
  endY: number;
  midX1: number;
  midX2: number;
  midX3: number;
  endX: number;
  spinZ: number;
  spinY: number;
  delay: number;
  duration: number;
}

interface ConfettiProps {
  count?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  onComplete?: () => void;
}

function ConfettiPiece({
  particle,
  onComplete,
}: {
  particle: ParticleData;
  onComplete?: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      Animated.timing(anim, {
        toValue: 1,
        duration: particle.duration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished && onComplete) {
          onComplete();
        }
      });
    }, particle.delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [anim, particle, onComplete]);

  const translateY = anim.interpolate({
    inputRange: [0, 0.28, 0.58, 0.82, 1],
    outputRange: [
      particle.startY,
      particle.peakY,
      (particle.peakY + particle.endY) * 0.42,
      (particle.peakY + particle.endY) * 0.72,
      particle.endY,
    ],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      particle.startX,
      particle.midX1,
      particle.midX2,
      particle.midX3,
      particle.endX,
    ],
  });

  const rotateZ = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.spinZ}deg`],
  });

  const rotateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${particle.spinY}deg`],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.05, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0.3, 1, 1, 0.7],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: particle.size.width,
          height: particle.size.height,
          borderRadius: particle.size.borderRadius,
          backgroundColor: particle.color,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotateZ },
            { rotateY },
            { scale },
          ],
        },
      ]}
    />
  );
}

export function ConfettiOverlay({
  count = 65,
  duration = 3400,
  style,
  onComplete,
}: ConfettiProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenWidth = windowWidth || 380;
  const screenHeight = windowHeight || 800;

  const particles: ParticleData[] = useMemo(() => {
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
        // ribbon
        size = {
          width: 8 + Math.floor(Math.random() * 3),
          height: 16 + Math.floor(Math.random() * 8),
          borderRadius: 2,
        };
      }

      // 3 origin channels: Left cannon (42%), Right cannon (42%), Center fountain (16%)
      const channel = i % 10;
      let startX = 0;
      let startY = screenHeight * (0.65 + Math.random() * 0.25);
      let targetSpreadX = 0;

      if (channel < 4) {
        // Left cannon shooting up and right
        startX = screenWidth * (0.02 + Math.random() * 0.12);
        targetSpreadX = screenWidth * (0.2 + Math.random() * 0.55);
      } else if (channel < 8) {
        // Right cannon shooting up and left
        startX = screenWidth * (0.86 + Math.random() * 0.12);
        targetSpreadX = screenWidth * (0.25 + Math.random() * 0.55);
      } else {
        // Center fountain
        startX = screenWidth * (0.42 + Math.random() * 0.16);
        targetSpreadX = screenWidth * (0.1 + Math.random() * 0.8);
      }

      const peakY = screenHeight * (0.04 + Math.random() * 0.32);
      const endY = screenHeight + 50;

      // Realistic fluttering drift on X axis
      const drift1 = (Math.random() - 0.5) * 40;
      const drift2 = (Math.random() - 0.5) * 50;
      const drift3 = (Math.random() - 0.5) * 40;

      const midX1 = (startX * 0.6 + targetSpreadX * 0.4) + drift1;
      const midX2 = targetSpreadX + drift2;
      const midX3 = targetSpreadX + drift3;
      const endX = targetSpreadX + (Math.random() - 0.5) * 60;

      const spinDirection = Math.random() > 0.5 ? 1 : -1;
      const spinZ = spinDirection * (360 + Math.floor(Math.random() * 720));
      const spinY = 360 + Math.floor(Math.random() * 1080);

      const delay = Math.floor(Math.random() * 380);
      const particleDuration = duration - 300 + Math.floor(Math.random() * 600);

      list.push({
        id: i,
        color,
        shape,
        size,
        startX,
        startY,
        peakY,
        endY,
        midX1,
        midX2,
        midX3,
        endX,
        spinZ,
        spinY,
        delay,
        duration: particleDuration,
      });
    }

    return list;
  }, [count, duration, screenWidth, screenHeight]);

  const completedCount = useRef(0);
  const handlePieceComplete = () => {
    completedCount.current += 1;
    if (completedCount.current >= particles.length && onComplete) {
      onComplete();
    }
  };

  return (
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        style,
      ]}
    >
      {particles.map((p) => (
        <ConfettiPiece
          key={p.id}
          particle={p}
          onComplete={handlePieceComplete}
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
  },
});
