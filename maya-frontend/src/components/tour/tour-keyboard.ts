import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export interface TourKeyHandlers {
  next: () => void;
  back: () => void;
  skip: () => void;
}

/** Native: the Android hardware back button closes the tour instead of leaving the screen. */
export function useTourKeyboard(active: boolean, handlers: TourKeyHandlers): void {
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handlers.skip();
      return true;
    });
    return () => sub.remove();
  }, [active, handlers]);
}
