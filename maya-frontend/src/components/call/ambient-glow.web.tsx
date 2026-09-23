import React from 'react';
import { Animated } from 'react-native';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
}

export function AmbientGlow({ type, opacity }: AmbientGlowProps) {
  if (type === 'purple-bottom') {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 380,
          opacity,
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background:
              'radial-gradient(ellipse 110% 80% at 50% 100%, rgba(217, 70, 239, 0.72) 0%, rgba(192, 38, 211, 0.48) 25%, rgba(168, 85, 247, 0.22) 55%, rgba(168, 85, 247, 0.05) 80%, rgba(255, 255, 255, 0) 100%)',
            filter: 'blur(24px)',
            transform: 'scale(1.1) translateY(10px)',
          }}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(ellipse 85% 75% at 50% 50%, rgba(255, 255, 255, 0) 40%, rgba(186, 230, 253, 0.4) 70%, rgba(56, 189, 248, 0.55) 95%, rgba(14, 165, 233, 0.7) 100%)',
          boxShadow:
            'inset 0 0 120px rgba(56, 189, 248, 0.45), inset 0 0 50px rgba(14, 165, 233, 0.35)',
        }}
      />
    </Animated.View>
  );
}
