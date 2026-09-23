import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '@/theme/tokens';

export type BreakpointName = 'phone' | 'tablet' | 'desktop';

export interface BreakpointState {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: BreakpointName;
}

/**
 * Hook to provide reactive responsive breakpoint data
 * Phone: < 768 px
 * Tablet: 768–1023 px
 * Desktop: >= 1024 px
 */
export function useBreakpoint(): BreakpointState {
  const { width, height } = useWindowDimensions();

  const isPhone = width < Breakpoints.tabletMin;
  const isTablet = width >= Breakpoints.tabletMin && width <= Breakpoints.tabletMax;
  const isDesktop = width >= Breakpoints.desktopMin;

  let breakpoint: BreakpointName = 'phone';
  if (isTablet) {
    breakpoint = 'tablet';
  } else if (isDesktop) {
    breakpoint = 'desktop';
  }

  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    breakpoint,
  };
}
