import { useEffect } from 'react';
import type { TourKeyHandlers } from './tour-keyboard';

export type { TourKeyHandlers } from './tour-keyboard';

/** Web: arrow keys move between steps, Esc closes the tour. Enter / Space use the focused button. */
export function useTourKeyboard(active: boolean, handlers: TourKeyHandlers): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handlers.next();
      else if (e.key === 'ArrowLeft') handlers.back();
      else if (e.key === 'Escape') handlers.skip();
      else return;
      e.preventDefault();
      // Window capture runs first, so Esc closes the tour without also closing a Modal under it
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, handlers]);
}
