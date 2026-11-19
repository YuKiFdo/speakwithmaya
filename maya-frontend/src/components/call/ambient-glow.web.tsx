import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { getMayaVoiceLevel, shapeOutputLevel } from '@/services/audio/voice-meter';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
  scale?: Animated.Value;
  /** Optional real-time voice volume (0.0 to 1.0) for extra organic reactivity */
  volume?: number;
  /** Optional active flag to speed up fluid wave motion when voice is detected */
  isActive?: boolean;
  /** Changes once when the call comes alive: one bright sweep around the edge (blue-aura). */
  wakeKey?: number;
}

export function AmbientGlow({
  type,
  opacity,
  scale,
  volume = 0,
  isActive = false,
  wakeKey,
}: AmbientGlowProps) {
  // Clamp volume between 0 and 1 for safe CSS math
  const clampedVol = Math.max(0, Math.min(1, volume));

  // Blue-aura driver: spring physics on Maya's LIVE playback loudness (services/audio/voice-meter),
  // read every frame and written straight to CSS variables (no React re-render per frame).
  //  - loudness follower: fast rise (~25 ms), quicker fall (~140 ms) so word gaps show
  //  - syllable onsets (sudden rise) kick one or two edges outward
  //  - each edge is an under-damped spring, so it bounces and settles like a physical thing
  //  - the colour flow speed follows her voice (no fixed loop)
  const softRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef(0);
  targetRef.current = clampedVol; // guide demo level, or the chunk-volume fallback (see below)
  useEffect(() => {
    if (type !== 'blue-aura') return;
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const K = 190; // spring stiffness
    const C = 13; // damping (under-damped: a little bounce)
    const pos = [12, 12, 12, 12]; // l, t, r, b reach in px
    const vel = [0, 0, 0, 0];
    const names = ['--reach-l', '--reach-t', '--reach-r', '--reach-b'];
    let level = 0;
    let prevLive = 0;
    let meterSilentFor = 0; // s the live meter has read ~0
    let warned = false;
    let angle = 0;
    let t = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // Live playback meter (word-synced). If it reads ~0 while the fallback says Maya is
      // speaking (meter unsupported on this browser), use the fallback so the glow never vanishes.
      const metered = shapeOutputLevel(getMayaVoiceLevel());
      meterSilentFor = metered < 0.02 ? meterSilentFor + dt : 0;
      const fallback = targetRef.current;
      const meterDead = meterSilentFor > 0.4 && fallback > 0.1;
      if (meterDead && !warned) {
        warned = true;
        console.warn('[MayaGlow] Live voice meter reads 0 while Maya speaks: using chunk-volume fallback');
      }
      const live = meterDead ? fallback : Math.max(metered, fallback * 0.25);
      level += (live - level) * (1 - Math.exp(-dt / (live > level ? 0.025 : 0.14)));

      // Syllable onset: a sudden rise kicks one or two edges outward (stronger rise, bigger kick)
      const rise = live - prevLive;
      prevLive = live;
      if (!reduce && rise > 0.1) {
        const i = Math.floor(Math.random() * 4);
        vel[i] += 260 * rise + 40;
        if (rise > 0.22) vel[(i + 2) % 4] += 180 * rise;
      }

      const base = 12 + level * 40;
      for (let i = 0; i < 4; i++) {
        // tiny idle breathing so it never looks frozen, smaller than the voice motion
        const idle = reduce ? 0 : 1.5 * Math.sin(t * (0.9 + i * 0.23) + i * 1.7);
        const target = base + idle;
        const acc = K * (target - pos[i]) - C * vel[i];
        vel[i] += acc * dt;
        pos[i] += vel[i] * dt;
      }
      angle = (angle + dt * (8 + level * 140)) % 360;

      const soft = softRef.current;
      if (soft) {
        for (let i = 0; i < 4; i++) soft.style.setProperty(names[i], `${(24 + Math.max(3, pos[i])).toFixed(1)}px`);
        soft.style.setProperty('--maya-edge-angle', `${angle.toFixed(1)}deg`);
        soft.style.opacity = String(0.3 + level * 0.4);
      }
      const line = lineRef.current;
      if (line) {
        line.style.setProperty('--maya-edge-angle', `${angle.toFixed(1)}deg`);
        line.style.opacity = String(0.5 + level * 0.4);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [type]);


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

  // Maya speaking ('blue-aura'): a flowing gradient of blues (deep -> sky -> pale) around the screen edge
  // (Maya's own palette). Thickness and brightness follow her voice, the colours slowly rotate,
  // and `wakeKey` plays one bright sweep when the call comes alive. Only the edge band is drawn
  // (CSS mask), so the content stays clean; everything animates on the compositor.
  // Driven per frame below (no React re-render): smoothed voice + a wave on each edge.
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
        overflow: 'hidden',
      }}
    >
      <style>{`
        @property --maya-edge-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes mayaEdgeSpin { to { --maya-edge-angle: 360deg; } }
        @keyframes mayaEdgeWake {
          0% { opacity: 0; --maya-edge-angle: 0deg; }
          15% { opacity: 1; }
          100% { opacity: 0; --maya-edge-angle: 300deg; }
        }
        .maya-edge-colors {
          position: absolute; inset: 0;
          background: conic-gradient(from var(--maya-edge-angle),
            #1D4ED8, #3B82F6, #60A5FA, #93C5FD, #2563EB, #60A5FA, #1D4ED8);
          animation: mayaEdgeSpin var(--maya-edge-speed, 7s) linear infinite;
        }
        /* Soft glow: four edge fades (no hard inner border), each reaching --reach px inward */
        /* Soft glow: four eased edge fades, then a blur so the inner corners melt into a soft,
           rounded shape (no rectangular box). The layer reaches 24px past the screen so the blur
           keeps the outer edge solid; --reach-* already include those 24px. */
        .maya-edge-soft {
          inset: -24px;
          filter: blur(14px);
          -webkit-mask-image:
            linear-gradient(to right, #000 24px, rgba(0,0,0,.55) calc(var(--reach-l) * .55), rgba(0,0,0,.18) calc(var(--reach-l) * .8), transparent var(--reach-l)),
            linear-gradient(to left, #000 24px, rgba(0,0,0,.55) calc(var(--reach-r) * .55), rgba(0,0,0,.18) calc(var(--reach-r) * .8), transparent var(--reach-r)),
            linear-gradient(to bottom, #000 24px, rgba(0,0,0,.55) calc(var(--reach-t) * .55), rgba(0,0,0,.18) calc(var(--reach-t) * .8), transparent var(--reach-t)),
            linear-gradient(to top, #000 24px, rgba(0,0,0,.55) calc(var(--reach-b) * .55), rgba(0,0,0,.18) calc(var(--reach-b) * .8), transparent var(--reach-b));
          mask-image:
            linear-gradient(to right, #000 24px, rgba(0,0,0,.55) calc(var(--reach-l) * .55), rgba(0,0,0,.18) calc(var(--reach-l) * .8), transparent var(--reach-l)),
            linear-gradient(to left, #000 24px, rgba(0,0,0,.55) calc(var(--reach-r) * .55), rgba(0,0,0,.18) calc(var(--reach-r) * .8), transparent var(--reach-r)),
            linear-gradient(to bottom, #000 24px, rgba(0,0,0,.55) calc(var(--reach-t) * .55), rgba(0,0,0,.18) calc(var(--reach-t) * .8), transparent var(--reach-t)),
            linear-gradient(to top, #000 24px, rgba(0,0,0,.55) calc(var(--reach-b) * .55), rgba(0,0,0,.18) calc(var(--reach-b) * .8), transparent var(--reach-b));
        }
        /* Crisp 2px line right at the screen edge */
        .maya-edge-line {
          padding: 2px;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
        }
        .maya-edge-wake { animation: mayaEdgeWake 1.1s cubic-bezier(.22,1,.36,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .maya-edge-colors { animation: none; }
          .maya-edge-wake { animation-duration: .4s; }
        }
      `}</style>

      <div ref={softRef} className="maya-edge-colors maya-edge-soft" style={{ ['--reach-l' as any]: '36px', ['--reach-r' as any]: '36px', ['--reach-t' as any]: '36px', ['--reach-b' as any]: '36px', opacity: 0.3, animation: 'none' }} />
      <div ref={lineRef} className="maya-edge-colors maya-edge-line" style={{ opacity: 0.3, animation: 'none' }} />
      {/* One-time wake-up sweep */}
      {wakeKey ? (
        <div
          key={wakeKey}
          className="maya-edge-colors maya-edge-soft maya-edge-wake"
          style={{ ['--reach-l' as any]: '94px', ['--reach-r' as any]: '94px', ['--reach-t' as any]: '94px', ['--reach-b' as any]: '94px' }}
        />
      ) : null}
    </Animated.View>
  );
}
