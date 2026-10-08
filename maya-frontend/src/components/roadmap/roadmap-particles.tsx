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
  if (targetIdx <= 0) return { segments: [], totalLen: 0 };

  const segments: PathSegment[] = [];
  let currX = col1X;
  let currY = desktopYStart;

  for (let i = 0; i < targetIdx; i++) {
    const r = Math.floor(i / 2);
    const yRow = desktopYStart + r * desktopRowStep;
    const yNext = desktopYStart + (r + 1) * desktopRowStep;

    if (i % 2 === 0) {
      const targetX = r % 2 === 0 ? col2X : col1X;
      const len = Math.abs(targetX - currX);
      if (len > 0) {
        segments.push({ type: 'line', x1: currX, y1: currY, x2: targetX, y2: yRow, len });
      }
      currX = targetX;
      currY = yRow;
    } else {
      if (r % 2 === 0) {
        // Going Right
        const l1 = Math.abs(xRight - R - currX);
        if (l1 > 0) {
          segments.push({ type: 'line', x1: currX, y1: currY, x2: xRight - R, y2: yRow, len: l1 });
        }
        const arcLen1 = (Math.PI / 2) * R;
        segments.push({
          type: 'arc',
          cx: xRight - R,
          cy: yRow + R,
          r: R,
          a1: -Math.PI / 2,
          a2: 0,
          len: arcLen1,
        });
        const dropLen = yNext - R - (yRow + R);
        if (dropLen > 0) {
          segments.push({ type: 'line', x1: xRight, y1: yRow + R, x2: xRight, y2: yNext - R, len: dropLen });
        }
        const arcLen2 = (Math.PI / 2) * R;
        segments.push({
          type: 'arc',
          cx: xRight - R,
          cy: yNext - R,
          r: R,
          a1: 0,
          a2: Math.PI / 2,
          len: arcLen2,
        });
        const targetX = col2X;
        const l2 = Math.abs(targetX - (xRight - R));
        if (l2 > 0) {
          segments.push({ type: 'line', x1: xRight - R, y1: yNext, x2: targetX, y2: yNext, len: l2 });
        }
        currX = targetX;
        currY = yNext;
      } else {
        // Going Left
        const l1 = Math.abs(currX - (xLeft + R));
        if (l1 > 0) {
          segments.push({ type: 'line', x1: currX, y1: currY, x2: xLeft + R, y2: yRow, len: l1 });
        }
        const arcLen1 = (Math.PI / 2) * R;
        segments.push({
          type: 'arc',
          cx: xLeft + R,
          cy: yRow + R,
          r: R,
          a1: -Math.PI / 2,
          a2: -Math.PI,
          len: arcLen1,
        });
        const dropLen = yNext - R - (yRow + R);
        if (dropLen > 0) {
          segments.push({ type: 'line', x1: xLeft, y1: yRow + R, x2: xLeft, y2: yNext - R, len: dropLen });
        }
        const arcLen2 = (Math.PI / 2) * R;
        segments.push({
          type: 'arc',
          cx: xLeft + R,
          cy: yNext - R,
          r: R,
          a1: Math.PI,
          a2: Math.PI * 1.5,
          len: arcLen2,
        });
        const targetX = col1X;
        const l2 = Math.abs(targetX - (xLeft + R));
        if (l2 > 0) {
          segments.push({ type: 'line', x1: xLeft + R, y1: yNext, x2: targetX, y2: yNext, len: l2 });
        }
        currX = targetX;
        currY = yNext;
      }
    }
  }

  const totalLen = segments.reduce((acc, s) => acc + s.len, 0);
  return { segments, totalLen };
}

export function buildMobilePathSegments(
  targetIdx: number,
  mobileIconLeftX: number,
  mobileIconRightX: number,
  mobileYTrack1: number,
  mobileTierHeight: number,
  mobileR: number
): { segments: PathSegment[]; totalLen: number } {
  if (targetIdx <= 0) return { segments: [], totalLen: 0 };

  const segments: PathSegment[] = [];
  const clampedTarget = Math.max(1, targetIdx);

  const l0 = Math.abs(mobileIconRightX - mobileIconLeftX);
  segments.push({
    type: 'line',
    x1: mobileIconLeftX,
    y1: mobileYTrack1,
    x2: mobileIconRightX,
    y2: mobileYTrack1,
    len: l0,
  });

  for (let i = 0; i < clampedTarget - 1; i++) {
    const yPrev = mobileYTrack1 + i * mobileTierHeight;
    const yNext = mobileYTrack1 + (i + 1) * mobileTierHeight;
    const isLastStep = i === clampedTarget - 2;

    if (i % 2 === 0) {
      const arcLen = Math.PI * mobileR;
      segments.push({
        type: 'arc',
        cx: mobileIconRightX,
        cy: (yPrev + yNext) / 2,
        r: mobileR,
        a1: -Math.PI / 2,
        a2: Math.PI / 2,
        len: arcLen,
      });
      if (!isLastStep) {
        segments.push({
          type: 'line',
          x1: mobileIconRightX,
          y1: yNext,
          x2: mobileIconLeftX,
          y2: yNext,
          len: l0,
        });
      }
    } else {
      const arcLen = Math.PI * mobileR;
      segments.push({
        type: 'arc',
        cx: mobileIconLeftX,
        cy: (yPrev + yNext) / 2,
        r: mobileR,
        a1: Math.PI / 2,
        a2: Math.PI * 1.5,
        len: arcLen,
      });
      if (!isLastStep) {
        segments.push({
          type: 'line',
          x1: mobileIconLeftX,
          y1: yNext,
          x2: mobileIconRightX,
          y2: yNext,
          len: l0,
        });
      }
    }
  }

  const totalLen = segments.reduce((acc, s) => acc + s.len, 0);
  return { segments, totalLen };
}

interface RoadmapGlowParticlesProps {
  totalLen: number;
  svgPath: string;
  segments?: PathSegment[];
}

/**
 * Modern Linear / Vercel / Magic UI Style Animated Light Beam
 * A continuous, luminous laser pulse traveling seamlessly down the roadmap track
 */
export const RoadmapGlowParticles: React.FC<RoadmapGlowParticlesProps> = ({
  totalLen,
  svgPath,
}) => {
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (totalLen <= 0) return;

    // Smooth 3.2s loop across the path
    const loopDuration = 3200;

    const animate = () => {
      const now = Date.now();
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      setAnimProgress((prev) => (prev + dt / loopDuration) % 1);
      animRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = Date.now();
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [totalLen]);

  if (totalLen <= 0 || !svgPath) return null;

  // Beam length: aerodynamic 180-220px light pulse
  const beamLen = Math.round(Math.min(240, Math.max(140, totalLen * 0.18)));
  const gapLen = totalLen + beamLen;

  // Staggered light pulses traveling smoothly down the path
  const pulses = [0, 0.5];

  return (
    <>
      {pulses.map((pulseOffset, idx) => {
        const progress = (animProgress + pulseOffset) % 1;
        const offset = -(progress * (totalLen + beamLen)) + beamLen;

        return (
          <React.Fragment key={`light-beam-${idx}`}>
            {/* 1. Outer Soft Glowing Aura (Diffuses softly into track groove) */}
            <Path
              d={svgPath}
              stroke="rgba(96, 165, 250, 0.40)"
              strokeWidth="9"
              strokeDasharray={`${beamLen * 1.15} ${gapLen}`}
              strokeDashoffset={offset - beamLen * 0.08}
              fill="none"
              strokeLinecap="round"
            />

            {/* 2. Vibrant Cyan-Blue Core Beam */}
            <Path
              d={svgPath}
              stroke="#3B82F6"
              strokeWidth="4.5"
              strokeDasharray={`${beamLen} ${gapLen}`}
              strokeDashoffset={offset}
              fill="none"
              strokeLinecap="round"
              opacity={0.9}
            />

            {/* 3. Intense Pure White Laser Center */}
            <Path
              d={svgPath}
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeDasharray={`${beamLen * 0.65} ${gapLen}`}
              strokeDashoffset={offset + beamLen * 0.18}
              fill="none"
              strokeLinecap="round"
              opacity={0.95}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};
