import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export interface NavIconProps {
  active?: boolean;
  color?: string;
  size?: number;
}

export function HomeNavIcon({ active = false, color, size = 24 }: NavIconProps) {
  const activeColor = color || '#2B5BFF';
  const inactiveColor = color || '#9CA3AF';
  const strokeColor = active ? activeColor : inactiveColor;
  const fillColor = active ? activeColor : 'none';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3L21 9.5V20C21 20.2652 20.8946 20.5196 20.7071 20.7071C20.5196 20.8946 20.2652 21 20 21H4C3.73478 21 3.48043 20.8946 3.29289 20.7071C3.10536 20.5196 3 20.2652 3 20V9.5Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M9 21V12H15V21"
        fill={fillColor}
      />
      <Path
        d="M9 21V12H15V21"
        stroke={strokeColor}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function RoadmapNavIcon({ active = false, color, size = 24 }: NavIconProps) {
  const strokeColor = color || (active ? '#2B5BFF' : '#9CA3AF');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 8C7.10457 8 8 7.10457 8 6C8 4.89543 7.10457 4 6 4C4.89543 4 4 4.89543 4 6C4 7.10457 4.89543 8 6 8Z"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M18 14C19.1046 14 20 13.1046 20 12C20 10.8954 19.1046 10 18 10C16.8954 10 16 10.8954 16 12C16 13.1046 16.8954 14 18 14Z"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M6 20C7.10457 20 8 19.1046 8 18C8 16.8954 7.10457 16 6 16C4.89543 16 4 16.8954 4 18C4 19.1046 4.89543 20 6 20Z"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M8 6H13C13.7956 6 14.5587 6.31607 15.1213 6.87868C15.6839 7.44129 16 8.20435 16 9V10M8 18H13C13.7956 18 14.5587 17.6839 15.1213 17.1213C15.6839 16.5587 16 15.7956 16 15V14"
        stroke={strokeColor}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function HistoryNavIcon({ active = false, color, size = 24 }: NavIconProps) {
  const strokeColor = color || (active ? '#2B5BFF' : '#9CA3AF');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M12 7V12L15 15"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AccountNavIcon({ active = false, color, size = 24 }: NavIconProps) {
  const strokeColor = color || (active ? '#2B5BFF' : '#9CA3AF');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <Path
        d="M4 20C4 16 7.6 13 12 13C16.4 13 20 16 20 20"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CrownNavIcon({
  color = '#D97706',
  width = 26,
  height = 26,
  size,
}: {
  color?: string;
  width?: number;
  height?: number;
  size?: number;
}) {
  const w = size || width;
  const h = size || height;

  return (
    <Svg width={w} height={h} viewBox="0 0 26 26" fill="none">
      <Path
        d="M2.5 20.5H23.5L24.5 7.5L18.5 13L13 3.5L7.5 13L1.5 7.5L2.5 20.5Z"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrownSolidIcon({
  color = '#2B5BFF',
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 19H21.5V20.5H2.5V19ZM3.5 17L2 7.5L7.5 12L12 4.5L16.5 12L22 7.5L20.5 17H3.5Z"
        fill={color}
      />
      <Circle cx="2" cy="6.5" r="1.5" fill={color} />
      <Circle cx="12" cy="3.5" r="1.5" fill={color} />
      <Circle cx="22" cy="6.5" r="1.5" fill={color} />
    </Svg>
  );
}

export function BannerCrownIcon({
  width = 32,
  height = 25,
  color = '#0D4EFD',
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 32 25" fill="none">
      <Path
        d="M25.7812 21.875H5.46875C5.03906 21.875 4.6875 22.2266 4.6875 22.6562V24.2188C4.6875 24.6484 5.03906 25 5.46875 25H25.7812C26.2109 25 26.5625 24.6484 26.5625 24.2188V22.6562C26.5625 22.2266 26.2109 21.875 25.7812 21.875ZM28.9062 6.25C27.6123 6.25 26.5625 7.2998 26.5625 8.59375C26.5625 8.94043 26.6406 9.2627 26.7773 9.56055L23.2422 11.6797C22.4902 12.1289 21.5186 11.875 21.084 11.1133L17.1045 4.15039C17.627 3.7207 17.9688 3.07617 17.9688 2.34375C17.9688 1.0498 16.9189 0 15.625 0C14.3311 0 13.2812 1.0498 13.2812 2.34375C13.2812 3.07617 13.623 3.7207 14.1455 4.15039L10.166 11.1133C9.73145 11.875 8.75488 12.1289 8.00781 11.6797L4.47754 9.56055C4.60938 9.26758 4.69238 8.94043 4.69238 8.59375C4.69238 7.2998 3.64258 6.25 2.34863 6.25C1.05469 6.25 0 7.2998 0 8.59375C0 9.8877 1.0498 10.9375 2.34375 10.9375C2.4707 10.9375 2.59766 10.918 2.71973 10.8984L6.25 20.3125H25L28.5303 10.8984C28.6523 10.918 28.7793 10.9375 28.9062 10.9375C30.2002 10.9375 31.25 9.8877 31.25 8.59375C31.25 7.2998 30.2002 6.25 28.9062 6.25Z"
        fill={color}
      />
    </Svg>
  );
}

export function BannerRoadmapIcon({
  width = 28,
  height = 28,
  color = '#2B7FFF',
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28 28" fill="none">
      <Path
        d="M10.839 6.1937H4.64527C3.7901 6.1937 3.09684 6.88695 3.09684 7.74213V10.839C3.09684 11.6942 3.7901 12.3874 4.64527 12.3874H10.839C11.6942 12.3874 12.3874 11.6942 12.3874 10.839V7.74213C12.3874 6.88695 11.6942 6.1937 10.839 6.1937Z"
        stroke={color}
        strokeWidth={2.32265}
      />
      <Path
        d="M23.2265 15.4843H17.0327C16.1776 15.4843 15.4843 16.1776 15.4843 17.0327V20.1296C15.4843 20.9848 16.1776 21.678 17.0327 21.678H23.2265C24.0816 21.678 24.7749 20.9848 24.7749 20.1296V17.0327C24.7749 16.1776 24.0816 15.4843 23.2265 15.4843Z"
        stroke={color}
        strokeWidth={2.32265}
      />
      <Path
        d="M7.74215 12.3874V21.678M20.1296 6.1937V15.4843"
        stroke={color}
        strokeWidth={2.32265}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockIcon({
  color = '#64748B',
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 10V8C6 4.68629 8.68629 2 12 2C15.3137 2 18 4.68629 18 8V10H19C20.1046 10 21 10.8954 21 12V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V12C3 10.8954 3.89543 10 5 10H6ZM8 10H16V8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8V10Z"
        fill={color}
      />
    </Svg>
  );
}
