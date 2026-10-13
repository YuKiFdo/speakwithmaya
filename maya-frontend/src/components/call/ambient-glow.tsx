import React from 'react';
import { Animated } from 'react-native';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
  scale?: Animated.Value;
  /** Optional real-time voice volume (0.0 to 1.0) for extra organic reactivity */
  volume?: number;
  /** Optional active flag to speed up fluid wave motion when voice is detected */
  isActive?: boolean;
}

export function AmbientGlow({
  type,
  opacity,
  scale,
  volume = 0,
  isActive = false,
}: AmbientGlowProps) {
  // Clamp volume between 0 and 1 for safe CSS math
  const clampedVol = Math.max(0, Math.min(1, volume));

  if (type === 'purple-bottom') {
    // Dynamic reactive metrics driven by live mic volume
    const activeLift = clampedVol * 48; // Rises up the screen as user speaks louder
    const hotspotScale = 1 + clampedVol * 0.55;
    const lobeSpread = clampedVol * 18;

    return (
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 460,
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
              transform: scale(1.09) translateY(-6px);
            }
          }
          @keyframes mayaPurpleLobeLeft {
            0%, 100% {
              transform: translate3d(-6%, 4px, 0) scale(1);
            }
            50% {
              transform: translate3d(8%, -10px, 0) scale(1.14);
            }
          }
          @keyframes mayaPurpleLobeRight {
            0%, 100% {
              transform: translate3d(6%, -4px, 0) scale(1.08);
            }
            50% {
              transform: translate3d(-8%, 8px, 0) scale(0.96);
            }
          }
          @keyframes mayaPurpleRipple {
            0% {
              transform: translateY(10px) scaleX(0.85) scaleY(0.9);
              opacity: 0.7;
            }
            50% {
              transform: translateY(-8px) scaleX(1.08) scaleY(1.15);
              opacity: 1;
            }
            100% {
              transform: translateY(10px) scaleX(0.85) scaleY(0.9);
              opacity: 0.7;
            }
          }
        `}</style>

        {/* Layer 1: Primary Maya Purple Voice Wave Flare */}
        <div
          style={{
            position: 'absolute',
            bottom: -20 + activeLift * 0.5,
            left: '-15%',
            width: '130%',
            height: '100%',
            background:
              'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(217, 70, 239, 0.75) 0%, rgba(192, 38, 211, 0.52) 25%, rgba(168, 85, 247, 0.28) 55%, rgba(168, 85, 247, 0.08) 80%, rgba(255, 255, 255, 0) 100%)',
            animation: `mayaPurplePulse ${isActive ? '1.8s' : '4s'} ease-in-out infinite`,
            transition: 'bottom 120ms ease-out',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2: Interactive Left/Right Fluid Vocal Lobes (creates liquid aurora motion) */}
        <div
          style={{
            position: 'absolute',
            bottom: -30 + activeLift * 0.7,
            left: `${5 - lobeSpread * 0.3}%`,
            width: '65%',
            height: '78%',
            background:
              'radial-gradient(ellipse 75% 65% at 50% 100%, rgba(217, 70, 239, 0.65) 0%, rgba(168, 85, 247, 0.28) 55%, transparent 100%)',
            filter: 'blur(30px)',
            animation: `mayaPurpleLobeLeft ${isActive ? '2.2s' : '5.2s'} ease-in-out infinite`,
            transition: 'bottom 100ms ease-out, left 120ms ease-out',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -30 + activeLift * 0.7,
            right: `${5 - lobeSpread * 0.3}%`,
            width: '65%',
            height: '78%',
            background:
              'radial-gradient(ellipse 75% 65% at 50% 100%, rgba(192, 38, 211, 0.65) 0%, rgba(168, 85, 247, 0.28) 55%, transparent 100%)',
            filter: 'blur(30px)',
            animation: `mayaPurpleLobeRight ${isActive ? '2.5s' : '5.6s'} ease-in-out infinite`,
            transition: 'bottom 100ms ease-out, right 120ms ease-out',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 3: Center Hotspot Flare for Immediate Mic Activity */}
        <div
          style={{
            position: 'absolute',
            bottom: -40 + activeLift,
            left: '15%',
            width: '70%',
            height: '75%',
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(192, 38, 211, 0.6) 0%, rgba(217, 70, 239, 0.45) 30%, rgba(168, 85, 247, 0.3) 55%, transparent 100%)',
            filter: `blur(${28 - clampedVol * 8}px)`,
            transform: `scale(${hotspotScale})`,
            transformOrigin: '50% 100%',
            animation: 'mayaPurpleRipple 2.4s ease-in-out infinite',
            transition: 'transform 75ms ease-out, bottom 75ms ease-out, filter 100ms ease-out',
            pointerEvents: 'none',
          }}
        />
      </Animated.View>
    );
  }

  // Maya Signature Electric Blue Speaking Aura ('blue-aura')
  const dynamicInsetOuter = Math.round(120 + clampedVol * 75);
  const dynamicInsetMid = Math.round(50 + clampedVol * 45);
  const dynamicInsetInner = Math.round(20 + clampedVol * 25);
  const clearCenterStop = Math.max(22, Math.round(35 - clampedVol * 12));

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
            opacity: 0.78;
            transform: scale(1.0);
          }
          50% {
            opacity: 1;
            transform: scale(1.035);
          }
        }
        @keyframes mayaBlueWaveFlow {
          0%, 100% {
            transform: scale(1.0) rotate(0deg);
          }
          33% {
            transform: scale(1.03, 0.98) rotate(0.6deg);
          }
          66% {
            transform: scale(0.98, 1.03) rotate(-0.6deg);
          }
        }
      `}</style>

      {/* Layer 1: Luminous Maya Blue Ambient Vignette with Voice-Reactive Edge Contraction */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse 85% 75% at 50% 50%, rgba(255, 255, 255, 0) ${clearCenterStop}%, rgba(186, 230, 253, 0.35) 65%, rgba(56, 189, 248, 0.52) 90%, rgba(14, 165, 233, 0.68) 100%)`,
          animation: `mayaBlueBreathe ${isActive ? '1.9s' : '3.6s'} ease-in-out infinite`,
          boxShadow: `inset 0 0 ${dynamicInsetOuter}px rgba(56, 189, 248, 0.5), inset 0 0 ${dynamicInsetMid}px rgba(14, 165, 233, 0.4), inset 0 0 ${dynamicInsetInner}px rgba(2, 132, 199, 0.3)`,
          transition: 'box-shadow 90ms ease-out, background 90ms ease-out',
        }}
      />

      {/* Layer 2: Organic Rippling Edge Shimmer (responds to Maya's syllables) */}
      <div
        style={{
          position: 'absolute',
          top: '-4%',
          left: '-4%',
          width: '108%',
          height: '108%',
          background:
            'radial-gradient(ellipse 78% 68% at 50% 50%, rgba(255, 255, 255, 0) 52%, rgba(186, 230, 253, 0.25) 75%, rgba(56, 189, 248, 0.45) 92%, rgba(14, 165, 233, 0.6) 100%)',
          filter: 'blur(18px)',
          opacity: 0.45 + clampedVol * 0.55,
          animation: 'mayaBlueWaveFlow 4.2s ease-in-out infinite',
          transition: 'opacity 85ms ease-out',
          pointerEvents: 'none',
        }}
      />
    </Animated.View>
  );
}