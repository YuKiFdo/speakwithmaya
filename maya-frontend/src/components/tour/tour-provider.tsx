import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playOtherButtonSound } from '@/services/sound/sound-service';
import { triggerHaptic } from '@/utils/haptics-audio';
import { TourOverlay } from './tour-overlay';
import { scrollDeltaToReveal } from './tour-placement';
import { hasSeenTour, markTourSeen } from './tour-storage';
import { useTourKeyboard } from './tour-keyboard';
import type { TourDefinition, TourRect, TourRunOptions, TourStep } from './tour-types';

/* ------------------------------------------------------------------------------------------
 * Registry: screens register the elements a tour can point at, and their scroll containers.
 * Several instances may share an id (each tab screen renders its own sidebar); the first one
 * that is actually laid out on screen wins.
 * ---------------------------------------------------------------------------------------- */

interface TargetEntry {
  node: any;
  scrollKey?: string;
}

interface ScrollEntry {
  scrollTo: (y: number) => void;
  getOffset: () => number;
}

interface TourRegistry {
  registerTarget: (id: string, key: symbol, entry: TargetEntry) => void;
  unregisterTarget: (id: string, key: symbol) => void;
  registerScroll: (key: string, entry: ScrollEntry) => () => void;
  start: (def: TourDefinition, opts: TourRunOptions) => boolean;
}

const TourContext = createContext<TourRegistry | null>(null);

/** Live run state, read only by <TourHost> so screens do not re-render while a tour plays. */
interface TourRunState {
  run: TourRun | null;
  step: TourStep | null;
  target: TourRect | null;
  measuring: boolean;
  attachOverlay: (node: View | null) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finishPrimary: () => void;
  hostGone: (name: string) => void;
}

const TourRunContext = createContext<TourRunState | null>(null);

const hostOf = (run: TourRun | null) => run?.def.host ?? 'root';

interface TourRun {
  def: TourDefinition;
  opts: TourRunOptions;
  steps: TourStep[];
  index: number;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const devLog = (...args: unknown[]) => {
  if (__DEV__) console.log('[tour]', ...args);
};

function measureNode(node: any): Promise<TourRect | null> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 400);
    try {
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const targets = useRef(new Map<string, Map<symbol, TargetEntry>>());
  const scrolls = useRef(new Map<string, ScrollEntry>());
  const overlayRef = useRef<View>(null);
  const runRef = useRef<TourRun | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const scrolledKeys = useRef(new Set<string>());
  const shownRef = useRef(false);

  const [run, setRunState] = useState<TourRun | null>(null);
  const [target, setTarget] = useState<TourRect | null>(null);
  /** Which step + window size the current `target` was measured for. */
  const [measuredFor, setMeasuredFor] = useState('');

  const { width: vw, height: vh } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const setRun = useCallback((next: TourRun | null) => {
    runRef.current = next;
    setRunState(next);
  }, []);

  const registry = useMemo<TourRegistry>(
    () => ({
      registerTarget(id, key, entry) {
        let m = targets.current.get(id);
        if (!m) targets.current.set(id, (m = new Map()));
        m.set(key, entry);
      },
      unregisterTarget(id, key) {
        targets.current.get(id)?.delete(key);
      },
      registerScroll(key, entry) {
        scrolls.current.set(key, entry);
        return () => {
          if (scrolls.current.get(key) === entry) scrolls.current.delete(key);
        };
      },
      start(def, opts) {
        if (runRef.current) return false;
        // Drop spotlight steps whose element is not on this layout (e.g. hidden by plan state)
        const steps = def.steps.filter((s) => s.kind === 'sheet' || (s.target && (targets.current.get(s.target)?.size ?? 0) > 0));
        if (!steps.some((s) => s.kind === 'spot')) {
          devLog(def.id, 'not started: none of its targets are registered');
          return false;
        }
        devLog(def.id, 'started with steps', steps.map((s) => s.id).join(', '));
        shownRef.current = false;
        directionRef.current = 1;
        scrolledKeys.current.clear();
        setTarget(null);
        setRun({ def, opts, steps, index: 0 });
        return true;
      },
    }),
    [setRun],
  );

  /** Rect of a target in overlay coordinates, or null if none of its instances is laid out. */
  const locate = useCallback(async (id: string): Promise<{ rect: TourRect; scrollKey?: string } | null> => {
    const entries = targets.current.get(id);
    if (!entries?.size) return null;
    const origin = (await measureNode(overlayRef.current)) ?? { x: 0, y: 0, width: 0, height: 0 };
    for (const entry of entries.values()) {
      const r = await measureNode(entry.node);
      if (!r) continue;
      const rect = { ...r, x: r.x - origin.x, y: r.y - origin.y };
      if (rect.x + rect.width <= 0 || rect.x >= vw) continue; // off-screen horizontally (another tab)
      return { rect, scrollKey: entry.scrollKey };
    }
    return null;
  }, [vw]);

  const finish = useCallback(
    (primary: boolean) => {
      const current = runRef.current;
      if (!current) return;
      try {
        playOtherButtonSound();
      } catch {}
      for (const key of scrolledKeys.current) scrolls.current.get(key)?.scrollTo(0);
      scrolledKeys.current.clear();
      setRun(null);
      setTarget(null);
      if (primary && current.opts.onFinishPrimary) setTimeout(current.opts.onFinishPrimary, 250);
    },
    [setRun],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      const current = runRef.current;
      if (!current) return;
      const index = current.index + dir;
      if (index >= current.steps.length) return finish(false);
      if (index < 0) return;
      directionRef.current = dir;
      try {
        playOtherButtonSound();
      } catch {}
      if (Platform.OS !== 'web') triggerHaptic('selection');
      setRun({ ...current, index });
    },
    [finish, setRun],
  );

  // Measure (and scroll to) the current step's target whenever the step or window size changes
  const step = run ? run.steps[run.index] : null;
  const measureKey = run ? `${run.def.id}:${run.index}:${vw}x${vh}` : '';
  const measuring = Boolean(step && step.kind === 'spot' && measuredFor !== measureKey);
  useEffect(() => {
    if (!run || !step || step.kind === 'sheet' || !step.target) return;
    let cancelled = false;
    (async () => {
      let found = await locate(step.target!);
      for (let i = 0; !found && i < 6 && !cancelled; i++) {
        await wait(150);
        found = await locate(step.target!);
      }
      if (cancelled) return;
      if (!found) {
        devLog(run.def.id, `step "${step.id}" skipped: target "${step.target}" is not on screen`);
        go(directionRef.current); // element vanished: skip this step
        return;
      }
      const scroll = found.scrollKey ? scrolls.current.get(found.scrollKey) : undefined;
      if (scroll && found.scrollKey) {
        const delta = scrollDeltaToReveal(
          found.rect,
          { width: vw, height: vh, insetTop: insets.top, insetBottom: insets.bottom },
          Platform.OS === 'web' ? 80 : 90,
        );
        if (delta !== 0) {
          scroll.scrollTo(Math.max(0, scroll.getOffset() + delta));
          scrolledKeys.current.add(found.scrollKey);
          await wait(450);
          if (cancelled) return;
          found = (await locate(step.target!)) ?? found;
        }
      }
      if (cancelled) return;
      const pad = step.padding ?? 6;
      setTarget({
        x: found.rect.x - pad,
        y: found.rect.y - pad,
        width: found.rect.width + pad * 2,
        height: found.rect.height + pad * 2,
      });
      setMeasuredFor(measureKey);
      if (!shownRef.current) {
        shownRef.current = true;
        run.opts.onShown?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.def.id, run?.index, vw, vh]);

  const keyHandlers = useMemo(
    () => ({
      next: () => go(1),
      back: () => {
        const current = runRef.current;
        // Back moves between highlighted steps only (never back to the welcome sheet)
        if (current && current.steps[current.index - 1]?.kind === 'spot') go(-1);
      },
      skip: () => finish(false),
    }),
    [go, finish],
  );
  useTourKeyboard(Boolean(run), keyHandlers);

  // The host's container closed under the tour (e.g. the modal was dismissed): end the tour quietly
  // A welcome sheet counts as shown as soon as it renders
  useEffect(() => {
    if (run && step?.kind === 'sheet' && !shownRef.current) {
      shownRef.current = true;
      run.opts.onShown?.();
    }
  }, [run, step]);

  const hostGone = useCallback(
    (name: string) => {
      if (runRef.current && hostOf(runRef.current) === name) {
        setRun(null);
        setTarget(null);
      }
    },
    [setRun],
  );

  const attachOverlay = useCallback((node: View | null) => {
    overlayRef.current = node;
  }, []);

  const runState = useMemo<TourRunState>(
    () => ({
      run,
      step,
      target,
      measuring,
      attachOverlay,
      next: keyHandlers.next,
      back: keyHandlers.back,
      skip: keyHandlers.skip,
      finishPrimary: () => finish(true),
      hostGone,
    }),
    [run, step, target, measuring, attachOverlay, keyHandlers, finish, hostGone],
  );

  return (
    <TourContext.Provider value={registry}>
      <TourRunContext.Provider value={runState}>
        {children}
        <TourHost name="root" />
      </TourRunContext.Provider>
    </TourContext.Provider>
  );
}

/**
 * Where a tour's overlay is drawn. The root host covers the app; a native / web Modal draws
 * above it, so a tour of a modal's contents sets `host` and the modal renders its own
 * <TourHost name="..." /> as its last child.
 */
export function TourHost({ name }: { name: string }) {
  const state = useContext(TourRunContext);
  const run = state?.run ?? null;
  const step = state?.step ?? null;
  const target = state?.target ?? null;
  const measuring = state?.measuring ?? false;
  const attachOverlay = state?.attachOverlay;
  const next = state?.next;
  const back = state?.back;
  const skip = state?.skip;
  const finishPrimary = state?.finishPrimary;
  const hostGone = state?.hostGone;
  const active = Boolean(run && step && hostOf(run) === name);

  useEffect(() => {
    if (!active || !hostGone) return;
    return () => hostGone(name);
  }, [active, hostGone, name]);

  if (!active || !run || !step || !next || !back || !skip || !finishPrimary) return null;
  return (
    <View ref={attachOverlay} style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
      <TourOverlay
        run={run}
        step={step}
        target={target}
        measuring={measuring}
        onNext={next}
        onBack={back}
        onSkip={skip}
        onFinishPrimary={finishPrimary}
      />
    </View>
  );
}

/* ------------------------------------------------------------------------------------------
 * Hooks used by screens
 * ---------------------------------------------------------------------------------------- */

/**
 * Marks an element as a tour target. Returns a ref callback for a View / Pressable.
 * `scrollKey` names the useTourScrollContainer() the element lives in, so the tour can scroll to it.
 */
export function useTourTarget(id: string, opts?: { scrollKey?: string; enabled?: boolean }) {
  const ctx = useContext(TourContext);
  const [key] = useState(() => Symbol(id));
  const entryRef = useRef<TargetEntry>({ node: null });
  const scrollKey = opts?.scrollKey;
  const enabled = opts?.enabled !== false;

  useEffect(() => {
    if (!ctx || !enabled) return;
    const entry = entryRef.current;
    entry.scrollKey = scrollKey;
    ctx.registerTarget(id, key, entry);
    return () => ctx.unregisterTarget(id, key);
  }, [ctx, id, key, enabled, scrollKey]);

  return useCallback((node: any) => {
    entryRef.current.node = node;
  }, []);
}

/** Lets the tour scroll a ScrollView to bring a target into view. Pass `attach` as the ScrollView ref plus onScroll / scrollEventThrottle. */
export function useTourScrollContainer(key: string) {
  const ctx = useContext(TourContext);
  const node = useRef<ScrollView | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    if (!ctx) return;
    return ctx.registerScroll(key, {
      scrollTo: (y) => node.current?.scrollTo({ y, animated: true }),
      getOffset: () => offset.current,
    });
  }, [ctx, key]);

  const attach = useCallback((n: ScrollView | null) => {
    node.current = n;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { attach, onScroll, scrollEventThrottle: 32 } as const;
}

/**
 * Starts `def` once per learner (across devices) when `ready` turns true and stays true
 * for a moment, i.e. after data loaded and celebrations / popups closed.
 */
export function useFirstVisitTour(def: TourDefinition, ready: boolean, opts: TourRunOptions) {
  const ctx = useContext(TourContext);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const started = useRef(false);

  useEffect(() => {
    if (!ctx || !ready || started.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const seen = await hasSeenTour(def.id);
      if (cancelled || seen || started.current) return;
      const latest = optsRef.current;
      if (
        ctx.start(def, {
          ...latest,
          // Always call the newest handler (closures change between renders)
          onFinishPrimary: () => optsRef.current.onFinishPrimary?.(),
          // Saved once the first step is really on screen (closing the app mid-tour never replays it,
          // and a tour whose targets could not be found is not marked seen)
          onShown: () => markTourSeen(def.id),
        })
      ) {
        started.current = true;
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ctx, ready, def]);
}
