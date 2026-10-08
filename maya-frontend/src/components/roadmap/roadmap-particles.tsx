import React, { useState, useEffect, useRef } from 'react';
import { Path } from 'react-native-svg';

export interface PathSegment {
  type: 'line' | 'arc';
  len: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  a1?: number;
  a2?: number;
}

export function buildDesktopPathSegments(
  targetIdx: number,
  col1X: number,
  col2X: number,
  desktopYStart: number,
  desktopRowStep: number,
  xRight: number,
  xLeft: number,
  R: number
): { segments: PathSegment[]; totalLen: number } {
  return { segments: [], totalLen: 0 };
}

export function buildMobilePathSegments(
  targetIdx: number,
  mobileIconLeftX: number,
  mobileIconRightX: number,
  mobileYTrack1: number,
  mobileTierHeight: number,
  mobileR: number
): { segments: PathSegment[]; totalLen: number } {
  return { segments: [], totalLen: 0 };
}

export interface RoadmapGlowParticlesProps {
  svgPath: string;
  totalLen?: number;
  segments?: PathSegment[];
}

/**
 * Stationary Ambient Glow for Completed Roadmap Path
 * Keeps the path still in the same position with a soft, elegant, breathing ambient glow
 */
export const RoadmapGlowParticles: React.FC<RoadmapGlowParticlesProps> = ({
  svgPath,
}) => {
  const [glowPulse, setGlowPulse] = useState(0.6);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const startTime = Date.now();
    const period = 2600; // 2.6s gentle relaxing breathing wave

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const wave = (Math.sin((elapsed / period) * 2 * Math.PI) + 1) / 2;
      setGlowPulse(0.35 + wave * 0.50);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, []);

  if (!svgPath) return null;

  return (
    <>
      {/* 1. Broad outer ambient glow aura breathing softly in place */}
      <Path
        d={svgPath}
        stroke="rgba(96, 165, 250, 0.28)"
        strokeWidth="13"
        fill="none"
        strokeLinecap="round"
        opacity={glowPulse * 0.8}
      />

      {/* 2. Mid vibrant radiant halo in place */}
      <Path
        d={svgPath}
        stroke="rgba(59, 130, 246, 0.42)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        opacity={glowPulse}
      />
    </>
  );
};
