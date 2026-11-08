import React from 'react';
import { Animated } from 'react-native';

export interface AmbientGlowProps {
  type: 'purple-bottom' | 'blue-aura';
  opacity: Animated.Value;
  scale?: Animated.Value;
  /** Optional real-time voice volume (0.0 to 1.0) for extra organic reactivity */
  volume?: number;
  /** Optional active flag to speed up fluid wave motion when voice is detected */
  isActive?: boolean;
}

export { AmbientGlow } from './ambient-glow.native';

