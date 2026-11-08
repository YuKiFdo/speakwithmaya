import React, { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
  scale?: Animated.Value;
  /** Optional real-time voice volume (0.0 to 1.0) for extra organic reactivity */
  volume?: number;
  /** Optional active flag to speed up fluid wave motion when voice is detected */
  isActive?: boolean;
}

type GradientStop = { offset: number; color: string; opacity: number };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Soft elliptical radial gradient that fills its parent (replaces CSS radial-gradient + blur). */
function GradientFill({
  id,
  stops,
  cx = '50%',
  cy = '50%',
  rx,
  ry,
}: {
  id: string;
  stops: GradientStop[];
  cx?: string;
  cy?: string;
  rx: string;
  ry: string;
}) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} rx={rx} ry={ry} fx={cx} fy={cy}>
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Looping 0 -> 1 -> 0 value (like a CSS ease-in-out infinite alternate keyframe). */
function useBreath(durationMs: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, v]);
  return v;
}

/** Smooths the incoming volume so the glow reacts organically instead of jittering. */
function useSmoothedVolume(volume: number) {
  const v = useRef(new Animated.Value(volume)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: volume,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [volume, v]);
  return v;
}

const lerp = (v: Animated.Value, out: (number | string)[]) =>
  v.interpolate({ inputRange: [0, 1], outputRange: out as any });

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function AmbientGlow({
  type,
  opacity,
  scale,
  volume = 0,
  isActive = false,
}: AmbientGlowProps) {
  const clampedVol = Math.max(0, Math.min(1, volume));
  const vol = useSmoothedVolume(clampedVol);
  const { width: screenW } = useWindowDimensions();

  /* Animation clocks (speed up when voice is active, same as web) */
  const pulse = useBreath(isActive ? 1800 : 4000);
  const lobeL = useBreath(isActive ? 2200 : 5200);
  const lobeR = useBreath(isActive ? 2500 : 5600);
  const ripple = useBreath(2400);
  const blueBreathe = useBreath(isActive ? 1900 : 3600);
  const blueWave = useBreath(4200);

  const rootStyle = {
    opacity,
    transform: scale ? [{ scale }] : undefined,
    zIndex: 1,
    overflow: 'hidden' as const,
  };

  /* ---------------------------- PURPLE BOTTOM ---------------------------- */
  if (type === 'purple-bottom') {
    const H = 460;

    // Voice lift (web: activeLift = vol * 48)
    const lift = lerp(vol, [0, -48]);
    const liftHalf = lerp(vol, [0, -24]);
    const liftLobe = lerp(vol, [0, -34]);
    const spread = lerp(vol, [0, screenW * 0.05]);
    const spreadNeg = lerp(vol, [0, -screenW * 0.05]);

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: H,
          },
          rootStyle,
        ]}
      >
        {/* Layer 1: primary wave flare */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -20,
            left: '-15%',
            width: '130%',
            height: '100%',
            opacity: lerp(pulse, [0.85, 1]),
            transform: [
              { translateY: Animated.add(liftHalf, lerp(pulse, [6, -6])) },
              { scale: lerp(pulse, [1.02, 1.09]) },
            ],
          }}
        >
          <GradientFill
            id="mayaPurpleMain"
            cx="50%"
            cy="100%"
            rx="50%"
            ry="80%"
            stops={[
              { offset: 0, color: '#D946EF', opacity: 0.75 },
              { offset: 0.25, color: '#C026D3', opacity: 0.52 },
              { offset: 0.55, color: '#A855F7', opacity: 0.28 },
              { offset: 0.8, color: '#A855F7', opacity: 0.08 },
              { offset: 1, color: '#FFFFFF', opacity: 0 },
            ]}
          />
        </Animated.View>

        {/* Layer 2a: left fluid lobe */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -30,
            left: '5%',
            width: '65%',
            height: '78%',
            transform: [
              { translateX: Animated.add(spreadNeg, lerp(lobeL, [-screenW * 0.04, screenW * 0.05])) },
              { translateY: Animated.add(liftLobe, lerp(lobeL, [4, -10])) },
              { scale: lerp(lobeL, [1, 1.14]) },
            ],
          }}
        >
          <GradientFill
            id="mayaPurpleLeft"
            cx="50%"
            cy="100%"
            rx="50%"
            ry="65%"
            stops={[
              { offset: 0, color: '#D946EF', opacity: 0.65 },
              { offset: 0.55, color: '#A855F7', opacity: 0.28 },
              { offset: 1, color: '#A855F7', opacity: 0 },
            ]}
          />
        </Animated.View>

        {/* Layer 2b: right fluid lobe */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -30,
            right: '5%',
            width: '65%',
            height: '78%',
            transform: [
              { translateX: Animated.add(spread, lerp(lobeR, [screenW * 0.04, -screenW * 0.05])) },
              { translateY: Animated.add(liftLobe, lerp(lobeR, [-4, 8])) },
              { scale: lerp(lobeR, [1.08, 0.96]) },
            ],
          }}
        >
          <GradientFill
            id="mayaPurpleRight"
            cx="50%"
            cy="100%"
            rx="50%"
            ry="65%"
            stops={[
              { offset: 0, color: '#C026D3', opacity: 0.65 },
              { offset: 0.55, color: '#A855F7', opacity: 0.28 },
              { offset: 1, color: '#A855F7', opacity: 0 },
            ]}
          />
        </Animated.View>

        {/* Layer 3: center hotspot, reacts instantly to mic */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -40,
            left: '15%',
            width: '70%',
            height: '75%',
            opacity: lerp(ripple, [0.7, 1]),
            transform: [
              { translateY: Animated.add(lift, lerp(ripple, [10, -8])) },
              { scaleX: Animated.multiply(lerp(vol, [1, 1.55]), lerp(ripple, [0.85, 1.08])) },
              { scaleY: Animated.multiply(lerp(vol, [1, 1.55]), lerp(ripple, [0.9, 1.15])) },
            ],
          }}
        >
          <GradientFill
            id="mayaPurpleHot"
            cx="50%"
            cy="100%"
            rx="50%"
            ry="60%"
            stops={[
              { offset: 0, color: '#C026D3', opacity: 0.6 },
              { offset: 0.3, color: '#D946EF', opacity: 0.45 },
              { offset: 0.55, color: '#A855F7', opacity: 0.3 },
              { offset: 1, color: '#A855F7', opacity: 0 },
            ]}
          />
        </Animated.View>
      </Animated.View>
    );
  }

  /* ----------------------------- BLUE AURA ----------------------------- */
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        rootStyle,
      ]}
    >
      {/* Layer 1: luminous edge vignette, breathes; center stays clear */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: lerp(blueBreathe, [0.78, 1]),
          transform: [{ scale: lerp(blueBreathe, [1, 1.035]) }],
        }}
      >
        <GradientFill
          id="mayaBlueBase"
          rx="75%"
          ry="70%"
          stops={[
            { offset: 0.3, color: '#FFFFFF', opacity: 0 },
            { offset: 0.65, color: '#BAE6FD', opacity: 0.35 },
            { offset: 0.9, color: '#38BDF8', opacity: 0.52 },
            { offset: 1, color: '#0EA5E9', opacity: 0.68 },
          ]}
        />
      </Animated.View>

      {/* Layer 1b: extra inner glow that pushes toward the center as voice gets louder
          (replaces the web's animated inset box-shadow) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: lerp(vol, [0.35, 1]),
          transform: [{ scale: lerp(vol, [1.04, 1]) }],
        }}
      >
        <GradientFill
          id="mayaBlueInset"
          rx="62%"
          ry="58%"
          stops={[
            { offset: 0.45, color: '#FFFFFF', opacity: 0 },
            { offset: 0.8, color: '#38BDF8', opacity: 0.28 },
            { offset: 1, color: '#0284C7', opacity: 0.45 },
          ]}
        />
      </Animated.View>

      {/* Layer 2: rippling edge shimmer */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '-4%',
          left: '-4%',
          width: '108%',
          height: '108%',
          opacity: lerp(vol, [0.45, 1]),
          transform: [
            { scaleX: lerp(blueWave, [1.0, 1.03]) },
            { scaleY: lerp(blueWave, [1.0, 0.98]) },
            { rotate: lerp(blueWave, ['0deg', '0.6deg']) },
          ],
        }}
      >
        <GradientFill
          id="mayaBlueShimmer"
          rx="70%"
          ry="62%"
          stops={[
            { offset: 0.52, color: '#FFFFFF', opacity: 0 },
            { offset: 0.75, color: '#BAE6FD', opacity: 0.25 },
            { offset: 0.92, color: '#38BDF8', opacity: 0.45 },
            { offset: 1, color: '#0EA5E9', opacity: 0.6 },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}