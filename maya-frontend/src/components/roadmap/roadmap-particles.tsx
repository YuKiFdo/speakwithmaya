import React, { useState, useEffect, useRef } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface PathSegment {
  type: 'line' | 'arc';
  len: number;
  // Line
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Arc
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
      // Connect milestones on the same row
      const targetX = r % 2 === 0 ? col2X : col1X;
      const len = Math.abs(targetX - currX);
      if (len > 0) {
        segments.push({ type: 'line', x1: currX, y1: currY, x2: targetX, y2: yRow, len });
      }
      currX = targetX;
      currY = yRow;
    } else {
      // U-turn loop to next row
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

  // First horizontal line
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
      // Right turn semi-circle
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
      // Left turn semi-circle
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

export function getPointOnPath(segments: PathSegment[], totalLen: number, progressRatio: number): { x: number; y: number } {
  if (segments.length === 0 || totalLen <= 0) return { x: 0, y: 0 };
  const normalizedT = Math.max(0, Math.min(1, progressRatio));
  let rem = normalizedT * totalLen;

  for (const s of segments) {
    if (rem <= s.len) {
      const u = s.len > 0 ? rem / s.len : 0;
      if (s.type === 'line') {
        const x1 = s.x1 ?? 0;
        const y1 = s.y1 ?? 0;
        const x2 = s.x2 ?? 0;
        const y2 = s.y2 ?? 0;
        return { x: x1 + u * (x2 - x1), y: y1 + u * (y2 - y1) };
      } else {
        const cx = s.cx ?? 0;
        const cy = s.cy ?? 0;
        const r = s.r ?? 0;
        const a1 = s.a1 ?? 0;
        const a2 = s.a2 ?? 0;
        const ang = a1 + u * (a2 - a1);
        return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
      }
    }
    rem -= s.len;
  }

  const last = segments[segments.length - 1];
  if (last.type === 'line') {
    return { x: last.x2 ?? 0, y: last.y2 ?? 0 };
  } else {
    const cx = last.cx ?? 0;
    const cy = last.cy ?? 0;
    const r = last.r ?? 0;
    const a2 = last.a2 ?? 0;
    return { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
  }
}

interface RoadmapGlowParticlesProps {
  segments: PathSegment[];
  totalLen: number;
  svgPath: string;
}

export const RoadmapGlowParticles: React.FC<RoadmapGlowParticlesProps> = ({
  segments,
  totalLen,
  svgPath,
}) => {
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (totalLen <= 0) return;

    // Smooth continuous 60fps loop that wraps smoothly from 0 to 1
    // Total cycle: 4.5 seconds for complete loop across the entire path
    const loopDuration = 4500;

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

  if (totalLen <= 0) return null;

  // We render 3 traveling glowing particles evenly spaced around the path loop
  const particleFractions = [0, 0.33, 0.66];
  // Calculate stroke-dashoffset for continuous flowing particle stream
  const dashOffset = -(animProgress * 180);

  return (
    <>
      {/* 1. Continuous flowing energy dotted stream along the path */}
      {svgPath ? (
        <Path
          d={svgPath}
          stroke="#60A5FA"
          strokeWidth="2.5"
          strokeDasharray="4, 16"
          strokeDashoffset={dashOffset}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      ) : null}

      {/* 2. Traveling Glowing Energy Particles (Core + Halos + Comet Sparks) */}
      {particleFractions.map((fraction, idx) => {
        const pProgress = (animProgress + fraction) % 1;
        const pt = getPointOnPath(segments, totalLen, pProgress);

        // Trailing sparks behind the particle
        const trail1Progress = (pProgress - 0.018 + 1) % 1;
        const trail1 = getPointOnPath(segments, totalLen, trail1Progress);

        const trail2Progress = (pProgress - 0.035 + 1) % 1;
        const trail2 = getPointOnPath(segments, totalLen, trail2Progress);

        return (
          <React.Fragment key={`glow-particle-${idx}`}>
            {/* Comet tail spark 2 */}
            <Circle
              cx={trail2.x}
              cy={trail2.y}
              r={1.6}
              fill="#BFDBFE"
              opacity={0.4}
            />

            {/* Comet tail spark 1 */}
            <Circle
              cx={trail1.x}
              cy={trail1.y}
              r={2.4}
              fill="#93C5FD"
              opacity={0.65}
            />

            {/* Outer soft ambient glowing halo */}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={11}
              fill="rgba(96, 165, 250, 0.30)"
            />

            {/* Vibrant cyan-blue particle glow */}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={5.5}
              fill="#3B82F6"
              opacity={0.85}
            />

            {/* Bright white star center */}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={2.6}
              fill="#FFFFFF"
            />
          </React.Fragment>
        );
      })}
    </>
  );
};
