import type { TourRect } from './tour-types';

/**
 * Pure layout maths for the tour tip card (no React, so it is easy to test).
 *
 * Phone: a wide card above or below the target, arrow pointing at the target's centre.
 * Tablet / desktop: a popover beside the target (right, then below, above, left).
 */

export type TourSide = 'top' | 'bottom' | 'left' | 'right';

export interface TourViewport {
  width: number;
  height: number;
  /** Safe-area insets: the card never goes under the status bar / home indicator. */
  insetTop: number;
  insetBottom: number;
}

export interface TourPlacement {
  left: number;
  top: number;
  width: number;
  side: TourSide;
  /** Arrow offset along the card edge that faces the target (px from the card's left/top). */
  arrowOffset: number;
}

export const TOUR_GUTTER = 16;
export const TOUR_GAP = 14;
export const TOUR_POPOVER_WIDTH = 360;
const PHONE_MAX_WIDTH = 440;
const ARROW_INSET = 26;

const clamp = (v: number, min: number, max: number) => (max < min ? min : Math.min(max, Math.max(min, v)));

export function placeTourCard(
  target: TourRect,
  cardHeight: number,
  viewport: TourViewport,
  mode: 'phone' | 'desktop',
): TourPlacement {
  const vw = viewport.width;
  const minTop = viewport.insetTop + TOUR_GUTTER;
  const maxBottom = viewport.height - viewport.insetBottom - TOUR_GUTTER;
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;

  const width =
    mode === 'phone'
      ? Math.min(vw - TOUR_GUTTER * 2, PHONE_MAX_WIDTH)
      : Math.min(TOUR_POPOVER_WIDTH, vw - TOUR_GUTTER * 2);

  const spaceBelow = maxBottom - (target.y + target.height + TOUR_GAP);
  const spaceAbove = target.y - TOUR_GAP - minTop;

  const vertical = (side: 'top' | 'bottom'): TourPlacement => {
    const left = clamp(cx - width / 2, TOUR_GUTTER, vw - TOUR_GUTTER - width);
    const rawTop = side === 'bottom' ? target.y + target.height + TOUR_GAP : target.y - TOUR_GAP - cardHeight;
    return {
      left,
      top: clamp(rawTop, minTop, maxBottom - cardHeight),
      width,
      side,
      arrowOffset: clamp(cx - left, ARROW_INSET, width - ARROW_INSET),
    };
  };

  const horizontal = (side: 'left' | 'right'): TourPlacement => {
    const left = side === 'right' ? target.x + target.width + TOUR_GAP : target.x - TOUR_GAP - width;
    const top = clamp(cy - cardHeight / 2, minTop, maxBottom - cardHeight);
    return { left, top, width, side, arrowOffset: clamp(cy - top, ARROW_INSET, cardHeight - ARROW_INSET) };
  };

  if (mode === 'desktop') {
    if (target.x + target.width + TOUR_GAP + width <= vw - TOUR_GUTTER) return horizontal('right');
    if (spaceBelow >= cardHeight) return vertical('bottom');
    if (spaceAbove >= cardHeight) return vertical('top');
    if (target.x - TOUR_GAP - width >= TOUR_GUTTER) return horizontal('left');
  } else {
    if (spaceBelow >= cardHeight) return vertical('bottom');
    if (spaceAbove >= cardHeight) return vertical('top');
  }
  // Nothing fits cleanly (very tall target): use the roomier side, clamped on screen
  return vertical(spaceBelow >= spaceAbove ? 'bottom' : 'top');
}

/**
 * How far a scroll container should move so the target sits comfortably on screen,
 * leaving room for the tip card. 0 = already fine.
 */
export function scrollDeltaToReveal(target: TourRect, viewport: TourViewport, reservedBottom: number): number {
  const top = viewport.insetTop + 72;
  const bottom = viewport.height - viewport.insetBottom - reservedBottom;
  if (target.y >= top && target.y + target.height <= bottom) return 0;
  // Put the target in the lower-middle of the free area so the card fits above it
  const desiredY = top + (bottom - top) * 0.45;
  return Math.round(target.y - desiredY);
}

/** Even-odd SVG path: the full screen minus a rounded "hole" around the target. */
export function spotlightPath(vw: number, vh: number, r: TourRect, radius: number): string {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  if (r.width <= 0 || r.height <= 0) return outer;
  const rad = Math.max(0, Math.min(radius, r.width / 2, r.height / 2));
  const { x, y, width: w, height: h } = r;
  const hole =
    `M${x + rad} ${y}H${x + w - rad}A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}` +
    `V${y + h - rad}A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}` +
    `H${x + rad}A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}` +
    `V${y + rad}A${rad} ${rad} 0 0 1 ${x + rad} ${y}Z`;
  return outer + hole;
}
