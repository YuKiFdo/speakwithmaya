import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * Robot icon inside Milestone 01 ("Meet your AI partner")
 */
export function RoadmapRobotIcon({ size = 32, color = '#0057FF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Robot Antenna */}
      <Circle cx="16" cy="5" r="2" fill={color} />
      <Path d="M16 7V10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      
      {/* Robot Head */}
      <Rect
        x="6"
        y="10"
        width="20"
        height="16"
        rx="5"
        fill={color}
      />
      
      {/* Inner Screen */}
      <Rect
        x="9"
        y="13"
        width="14"
        height="10"
        rx="3"
        fill="#FFFFFF"
      />
      
      {/* Robot Eyes */}
      <Circle cx="12.5" cy="17" r="1.5" fill={color} />
      <Circle cx="19.5" cy="17" r="1.5" fill={color} />
      
      {/* Robot Smile */}
      <Path
        d="M13.5 20C14.5 21 17.5 21 18.5 20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Ear nodes */}
      <Rect x="4" y="15" width="2" height="6" rx="1" fill={color} />
      <Rect x="26" y="15" width="2" height="6" rx="1" fill={color} />
    </Svg>
  );
}

/**
 * Speech Bubble with 3 dots inside Milestone 02 ("Talking about your day")
 */
export function RoadmapChatIcon({ size = 32, color = '#9333EA' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Bubble path */}
      <Path
        d="M16 6C10.4772 6 6 10.0294 6 15C6 17.7816 7.42082 20.2458 9.68112 21.8491C9.43126 23.3283 8.7183 24.6465 7.64645 25.7183C7.38792 25.9768 7.50275 26.4172 7.86337 26.4773C10.5186 26.9198 12.8711 25.8643 14.6293 24.5097C15.0766 24.5684 15.5332 24.6 16 24.6C21.5228 24.6 26 20.5706 26 15.6C26 10.6294 21.5228 6 16 6Z"
        fill={color}
      />
      {/* 3 Dots */}
      <Circle cx="11.5" cy="15.2" r="1.6" fill="#FFFFFF" />
      <Circle cx="16" cy="15.2" r="1.6" fill="#FFFFFF" />
      <Circle cx="20.5" cy="15.2" r="1.6" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * Small green badge with white checkmark for completed milestones
 */
export function RoadmapCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Circle cx="9" cy="9" r="9" fill="#10B981" />
      <Path
        d="M5.5 9.2L7.8 11.5L12.5 6.8"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * 03: Family and Friends (People silhouettes in pink/red)
 */
export function RoadmapFamilyIcon({ size = 28, color = '#F43F5E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Center Person */}
      <Circle cx="14" cy="9" r="3.5" fill={color} />
      <Path
        d="M9.5 21C9.5 17.5 11.5 15.5 14 15.5C16.5 15.5 18.5 17.5 18.5 21"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Left Person */}
      <Circle cx="7.5" cy="11.5" r="2.8" fill={color} />
      <Path
        d="M4.5 21C4.5 18.5 6 17 7.5 17"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Right Person */}
      <Circle cx="20.5" cy="11.5" r="2.8" fill={color} />
      <Path
        d="M23.5 21C23.5 18.5 22 17 20.5 17"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * 04: Describing your home town (Green House Icon)
 */
export function RoadmapHomeIcon({ size = 28, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Roof */}
      <Path
        d="M5 13L14 5L23 13"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* House Body */}
      <Path
        d="M7.5 12V22C7.5 22.5523 7.94772 23 8.5 23H19.5C20.0523 23 20.5 22.5523 20.5 22V12"
        fill={color}
      />
      {/* Door */}
      <Path
        d="M12 23V17H16V23"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * 05: Greetings & introductions in public (Orange/Amber Waving Hand)
 */
export function RoadmapWaveIcon({ size = 28, color = '#F59E0B' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M11 6C11 5.17157 11.6716 4.5 12.5 4.5C13.3284 4.5 14 5.17157 14 6V13M14 7.5C14 6.67157 14.6716 6 15.5 6C16.3284 6 17 6.67157 17 7.5V13.5M17 9.5C17 8.67157 17.6716 8 18.5 8C19.3284 8 20 8.67157 20 9.5V15.5C20 19.5 17 22.5 13 22.5C9.5 22.5 7 20 7 17.5L7.5 14C7.8 12.5 9 11.5 10.5 11.5C11.3 11.5 11 12 11 13V6Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * 06: Asking for directions (Blue Directional Signpost)
 */
export function RoadmapDirectionsIcon({ size = 28, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Center Post */}
      <Path d="M14 4V24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Top Sign (Pointing Left) */}
      <Path
        d="M9 7L6 9.5L9 12H19C19.5523 12 20 11.5523 20 11V8C20 7.44772 19.5523 7 19 7H9Z"
        fill={color}
      />
      {/* Bottom Sign (Pointing Right) */}
      <Path
        d="M19 14L22 16.5L19 19H9C8.44772 19 8 18.5523 8 18V15C8 14.4477 8.44772 14 9 14H19Z"
        fill={color}
      />
    </Svg>
  );
}

