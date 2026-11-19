import React from 'react';

const SIZE = 54;
const R = 25;
const ARC = `${2 * Math.PI * R * 0.3} ${2 * Math.PI * R}`;

/**
 * Spinning progress arc around the analysis step that is currently running (web).
 * A plain <svg> rotated by a CSS @keyframes animation: runs on the browser's compositor, so it
 * keeps spinning on phones even while the page is busy, and needs no react-native-web style
 * translation (animationKeyframes) or react-native-svg web shim.
 */
export function StepSpinner() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes mayaStepSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .maya-step-spin { animation: mayaStepSpin 1.1s linear infinite; transform-origin: 50% 50%; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .maya-step-spin { animation-duration: 3s; } }
      `}</style>
      <svg className="maya-step-spin" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: 'block' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#E0F2FE" strokeWidth={2.5} fill="none" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#0284C7"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={ARC}
        />
      </svg>
    </div>
  );
}
