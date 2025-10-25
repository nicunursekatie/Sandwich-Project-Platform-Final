/**
 * Responsive Design Utilities
 *
 * Helper functions and hooks for responsive design and breakpoint management.
 */

import { useState, useEffect } from 'react';

/**
 * Breakpoint values (must match tailwind.config.ts)
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,  // Mobile breakpoint
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook to get current window width
 */
export function useWindowWidth(): number {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowWidth;
}

/**
 * Hook to check if screen is at or above a breakpoint
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS[breakpoint];
}

/**
 * Hook to get current breakpoint
 */
export function useCurrentBreakpoint(): Breakpoint {
  const windowWidth = useWindowWidth();

  if (windowWidth >= BREAKPOINTS['2xl']) return '2xl';
  if (windowWidth >= BREAKPOINTS.xl) return 'xl';
  if (windowWidth >= BREAKPOINTS.lg) return 'lg';
  if (windowWidth >= BREAKPOINTS.md) return 'md';
  if (windowWidth >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * Check if screen is mobile (below md breakpoint)
 */
export function useIsMobileScreen(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth < BREAKPOINTS.md;
}

/**
 * Check if screen is tablet (md to lg)
 */
export function useIsTablet(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS.md && windowWidth < BREAKPOINTS.lg;
}

/**
 * Check if screen is desktop (lg and above)
 */
export function useIsDesktop(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS.lg;
}

/**
 * Responsive value helper
 * Returns different values based on current breakpoint
 */
export function useResponsiveValue<T>(values: {
  base: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T {
  const breakpoint = useCurrentBreakpoint();

  // Return the most specific value available
  if (breakpoint === '2xl' && values['2xl']) return values['2xl'];
  if (breakpoint === 'xl' && values.xl) return values.xl;
  if (breakpoint === 'lg' && values.lg) return values.lg;
  if (breakpoint === 'md' && values.md) return values.md;
  if (breakpoint === 'sm' && values.sm) return values.sm;

  // Fall back to base value
  return values.base;
}

/**
 * Get columns for responsive grid
 */
export function useResponsiveColumns(config: {
  mobile: number;
  tablet: number;
  desktop: number;
}): number {
  const isMobile = useIsMobileScreen();
  const isTablet = useIsTablet();

  if (isMobile) return config.mobile;
  if (isTablet) return config.tablet;
  return config.desktop;
}

/**
 * Responsive class helper
 * Returns different class names based on breakpoint
 */
export function responsiveClass(
  base: string,
  responsive: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  }
): string {
  const classes = [base];

  if (responsive.sm) classes.push(`sm:${responsive.sm}`);
  if (responsive.md) classes.push(`md:${responsive.md}`);
  if (responsive.lg) classes.push(`lg:${responsive.lg}`);
  if (responsive.xl) classes.push(`xl:${responsive.xl}`);
  if (responsive['2xl']) classes.push(`2xl:${responsive['2xl']}`);

  return classes.join(' ');
}

/**
 * Container max width helper
 */
export const CONTAINER_WIDTHS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
} as const;

/**
 * Get container class for responsive width
 */
export function getContainerClass(maxWidth: keyof typeof CONTAINER_WIDTHS = 'xl'): string {
  return `w-full max-w-${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`;
}

/**
 * Responsive spacing helper
 */
export function useResponsiveSpacing(config: {
  mobile: string;
  tablet?: string;
  desktop?: string;
}): string {
  const isMobile = useIsMobileScreen();
  const isTablet = useIsTablet();

  if (isMobile) return config.mobile;
  if (isTablet && config.tablet) return config.tablet;
  if (config.desktop) return config.desktop;

  return config.mobile;
}

/**
 * Safe area inset helper for notched devices
 */
export function useSafeAreaInsets(): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  return {
    top: 'env(safe-area-inset-top)',
    right: 'env(safe-area-inset-right)',
    bottom: 'env(safe-area-inset-bottom)',
    left: 'env(safe-area-inset-left)',
  };
}

/**
 * Orientation detection
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return orientation;
}

/**
 * Responsive grid classes helper
 */
export function getResponsiveGridClasses(config: {
  mobile: number;
  tablet?: number;
  desktop?: number;
  gap?: string;
}): string {
  const classes = [`grid`, `grid-cols-${config.mobile}`];

  if (config.tablet) {
    classes.push(`md:grid-cols-${config.tablet}`);
  }

  if (config.desktop) {
    classes.push(`lg:grid-cols-${config.desktop}`);
  }

  if (config.gap) {
    classes.push(`gap-${config.gap}`);
  }

  return classes.join(' ');
}

/**
 * Touch device detection
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasTouchScreen =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;

    setIsTouch(hasTouchScreen);
  }, []);

  return isTouch;
}

/**
 * Prefers reduced motion detection (for accessibility)
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Viewport height helper (accounts for mobile browser chrome)
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setHeight(window.innerHeight);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
}
