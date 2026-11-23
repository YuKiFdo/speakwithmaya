/**
 * Guided tour types. A tour is plain data (steps + copy per language); the engine in
 * tour-provider.tsx measures the registered targets and draws the spotlight and tip card.
 */

export type TourLang = 'en' | 'si' | 'ta';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourCopy {
  title: string;
  body: string;
  /** Optional wording for pointer devices ("Click" instead of "Tap"). */
  bodyDesktop?: string;
}

export interface TourUiCopy {
  next: string;
  back: string;
  skip: string;
  done: string;
  /** Intro sheet buttons */
  start: string;
  later: string;
  /** Finish sheet buttons */
  cta: string;
  explore: string;
}

export interface TourStep {
  id: string;
  /** 'sheet' = welcome / finish card with Maya; 'spot' = highlights a registered target. */
  kind: 'sheet' | 'spot';
  /** Target id registered with useTourTarget() (spot steps only). */
  target?: string;
  /** Extra space around the highlighted element, in px. */
  padding?: number;
  /** Corner radius of the highlight; defaults to a pill for small targets. */
  radius?: number;
}

export interface TourDefinition {
  /** Stored on the profile when seen. Bump the ':vN' suffix to show a changed tour again. */
  id: string;
  /** <TourHost> that draws the overlay; defaults to 'root'. Modals render their own host. */
  host?: string;
  steps: TourStep[];
  copy: Record<TourLang, { ui: TourUiCopy; steps: Record<string, TourCopy> }>;
}

/** Actions the finish sheet can trigger, supplied by the screen that runs the tour. */
export interface TourRunOptions {
  lang: TourLang;
  /** Replaces {name} etc. in copy. */
  vars?: Record<string, string>;
  /** Called when the learner presses the finish sheet's primary button. */
  onFinishPrimary?: () => void;
  /** Called once, when the first step is actually on screen. */
  onShown?: () => void;
}
