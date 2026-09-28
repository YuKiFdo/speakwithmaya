import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

export interface IconProps {
  color?: string;
  size?: number;
}

export function SearchIcon({ color = '#94A3B8', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 21L16.65 16.65"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FilterLinesIcon({ color = '#0F172A', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6H20M6 12H18M9 18H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MoreVerticalIcon({ color = '#94A3B8', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="1.75" fill={color} />
      <Circle cx="12" cy="12" r="1.75" fill={color} />
      <Circle cx="12" cy="19" r="1.75" fill={color} />
    </Svg>
  );
}

export function HistoryPlayIcon({ size = 36, color = '#2B5BFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Circle cx="18" cy="18" r="18" fill={color} />
      <Path d="M14.5 12L24.5 18L14.5 24V12Z" fill="#FFFFFF" />
    </Svg>
  );
}

export function HistoryPauseIcon({ size = 36, color = '#2B5BFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Circle cx="18" cy="18" r="18" fill={color} />
      <Rect x="13" y="12" width="3.5" height="12" rx="1" fill="#FFFFFF" />
      <Rect x="19.5" y="12" width="3.5" height="12" rx="1" fill="#FFFFFF" />
    </Svg>
  );
}

export function CalendarSmallIcon({ color = '#94A3B8', size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Path d="M16 2V6M8 2V6M3 10H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ClockSmallIcon({ color = '#94A3B8', size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path d="M12 7V12L15 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function TimerSmallIcon({ color = '#94A3B8', size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth="2" />
      <Path d="M12 9V13L14.5 15.5M10 2H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function RefreshCorrectionsIcon({ color = '#94A3B8', size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5V9H8M4 13A8.1 8.1 0 0 0 19.5 15M20 19V15H16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function VolumeSpeakerIcon({ color = '#94A3B8', size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5L6 9H2V15H6L11 19V5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54M19.07 4.93C20.94 6.8 22 9.33 22 12C22 14.67 20.94 17.2 19.07 19.07"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function NextCorrectionIcon({ color = '#0057FF', size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 4L14 12L5 20V4ZM13 4L22 12L13 20V4Z" fill={color} />
    </Svg>
  );
}

export function CloseCrossIcon({ color = '#64748B', size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ color = '#0F172A', size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19L8 12L15 5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Mode Specific Icons ───────────────────────────────────────────────────

export function ModeWorkplaceIcon({ size = 22, color = '#10B981' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="7" width="20" height="14" rx="3" stroke={color} strokeWidth="2" />
      <Path d="M8 7V5C8 3.89543 8.89543 3 10 3H14C15.1046 3 16 3.89543 16 5V7" stroke={color} strokeWidth="2" />
      <Path d="M12 11V13M9 13H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ModeChatBubbleIcon({ size = 22, color = '#2563EB' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.9C9.87812 3.30493 11.1801 2.99656 12.5 3H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8.5" cy="11.5" r="1" fill={color} />
      <Circle cx="12.5" cy="11.5" r="1" fill={color} />
      <Circle cx="16.5" cy="11.5" r="1" fill={color} />
    </Svg>
  );
}

export function ModeUserAvatarIcon({ size = 22, color = '#EA580C' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4.5" stroke={color} strokeWidth="2" />
      <Path
        d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ModePhoneIcon({ size = 22, color = '#DB2777' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4741 21.8325 20.7293C21.7209 20.9845 21.5571 21.2137 21.352 21.4018C21.1468 21.59 20.9046 21.733 20.6407 21.8214C20.3769 21.9099 20.0971 21.9419 19.82 21.91C16.7428 21.5756 13.787 20.5241 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.19 12.85C3.51 10.2412 2.45791 7.27109 2.13 4.18C2.09825 3.90356 2.12999 3.62438 2.22308 3.36113C2.31617 3.09788 2.46864 2.85642 2.67011 2.65275C2.87158 2.44908 3.11767 2.28766 3.39185 2.17937C3.66603 2.07108 3.9622 2.01831 4.26 2.02H7.26C7.74378 2.01524 8.21287 2.18953 8.57797 2.5097C8.94307 2.82987 9.17887 3.27438 9.24 3.76C9.35336 4.67388 9.57655 5.56942 9.9 6.43C10.0326 6.78201 10.0617 7.16518 9.98399 7.53349C9.90627 7.90181 9.72506 8.23883 9.46 8.5L8.19 9.77C9.60597 12.2619 11.6881 14.344 14.18 15.76L15.45 14.49C15.7112 14.2249 16.0482 14.0437 16.4165 13.966C16.7848 13.8883 17.168 13.9174 17.52 14.05C18.3806 14.3735 19.2761 14.5966 20.19 14.71C20.6806 14.7719 21.1292 15.0118 21.4504 15.3831C21.7717 15.7544 21.9439 16.2315 21.93 16.72L22 16.92Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ModeTravelIcon({ size = 22, color = '#0284C7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path
        d="M3.6 9H20.4M3.6 15H20.4M12 3C14.5 5.5 15.8 8.7 16 12C15.8 15.3 14.5 18.5 12 21C9.5 18.5 8.2 15.3 8 12C8.2 8.7 9.5 5.5 12 3Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
