import React from 'react';
import { Animated } from 'react-native';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
  scale?: Animated.Value;
}

export function AmbientGlow({ type, opacity, scale }: AmbientGlowProps) {
  if (type === 'purple-bottom') {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 400,
          opacity,
          transform: scale ? [{ scale }] : undefined,
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <style>{`
          @keyframes mayaPurplePulse {
            0%, 100% {
              filter: blur(28px);
              transform: scale(1.02) translateY(6px);
            }
            50% {
              filter: blur(40px);
              transform: scale(1.08) translateY(-4px);
            }
          }
        `}</style>

        {/* Primary Maya Purple Voice Wave Flare */}
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            left: '-15%',
            width: '130%',
            height: '100%',
            background:
              'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(217, 70, 239, 0.75) 0%, rgba(192, 38, 211, 0.52) 25%, rgba(168, 85, 247, 0.28) 55%, rgba(168, 85, 247, 0.08) 80%, rgba(255, 255, 255, 0) 100%)',
            animation: 'mayaPurplePulse 4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Center Hotspot Flare for Mic Activity */}
        <div
          style={{
            position: 'absolute',
            bottom: -40,
            left: '15%',
            width: '70%',
            height: '70%',
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(192, 38, 211, 0.6) 0%, rgba(168, 85, 247, 0.3) 50%, transparent 100%)',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }}
        />
      </Animated.View>
    );
  }

  // Maya Signature Electric Blue Speaking Aura ('blue-aura')
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
        transform: scale ? [{ scale }] : undefined,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes mayaBlueBreathe {
          0%, 100% {
            opacity: 0.75;
            transform: scale(1.0);
          }
          50% {
            opacity: 1;
            transform: scale(1.03);
          }
        }
      `}</style>

      {/* Luminous Maya Blue Ambient Vignette */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(ellipse 85% 75% at 50% 50%, rgba(255, 255, 255, 0) 35%, rgba(186, 230, 253, 0.35) 65%, rgba(56, 189, 248, 0.52) 90%, rgba(14, 165, 233, 0.68) 100%)',
          animation: 'mayaBlueBreathe 3.6s ease-in-out infinite',
          boxShadow:
            'inset 0 0 120px rgba(56, 189, 248, 0.5), inset 0 0 50px rgba(14, 165, 233, 0.4), inset 0 0 20px rgba(2, 132, 199, 0.3)',
        }}
      />
    </Animated.View>
  );
}
