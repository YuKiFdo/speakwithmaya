import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';
import { fillTourVars } from './tour-language';
import { placeTourCard, spotlightPath, type TourPlacement } from './tour-placement';
import type { TourDefinition, TourRect, TourRunOptions, TourStep } from './tour-types';

const DIM = 'rgba(8,18,38,0.62)';
const BRAND = '#0D4EFD';
const MOVE_MS = 420;

interface TourOverlayProps {
  run: { def: TourDefinition; opts: TourRunOptions; steps: TourStep[]; index: number };
  step: TourStep;
  target: TourRect | null;
  measuring: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinishPrimary: () => void;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Slides the spotlight hole from the previous target to the new one (JS-driven, works on every platform). */
function useAnimatedRect(target: TourRect | null, reduceMotion: boolean): TourRect | null {
  const [rect, setRect] = useState<TourRect | null>(target);
  const current = useRef<TourRect | null>(target);

  useEffect(() => {
    const from = current.current;
    if (!target || !from || reduceMotion) {
      current.current = target;
      setRect(target);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / MOVE_MS);
      const e = easeOutCubic(p);
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        width: from.width + (target.width - from.width) * e,
        height: from.height + (target.height - from.height) * e,
      };
      current.current = next;
      setRect(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target?.x, target?.y, target?.width, target?.height, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return rect;
}

export function TourOverlay({ run, step, target, measuring, onNext, onBack, onSkip, onFinishPrimary }: TourOverlayProps) {
  const { isPhone, width: vw, height: vh } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const hole = useAnimatedRect(target, reduceMotion);

  const { def, opts, steps, index } = run;
  const lang = def.copy[opts.lang] ? opts.lang : 'en';
  const ui = def.copy[lang].ui;
  const raw = def.copy[lang].steps[step.id] ?? def.copy.en.steps[step.id];
  const title = fillTourVars(raw?.title ?? '', opts.vars);
  const body = fillTourVars((!isPhone && raw?.bodyDesktop) || raw?.body || '', opts.vars);
  const scriptLang = lang !== 'en';

  const spotSteps = steps.filter((s) => s.kind === 'spot');
  const spotIndex = spotSteps.indexOf(step);
  const isLastSpot = spotIndex === spotSteps.length - 1;
  const isIntro = step.kind === 'sheet' && index === 0;

  // Fade the whole overlay in once
  const overlayOpacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 260 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  // Card / sheet entrance per step
  const enter = useSharedValue(0);
  useEffect(() => {
    if (measuring) return;
    enter.value = 0;
    enter.value = reduceMotion ? 1 : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [index, measuring]); // eslint-disable-line react-hooks/exhaustive-deps
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }, { scale: 0.98 + enter.value * 0.02 }],
  }));

  // Soft pulse around the highlighted element
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  // Card height is only known after layout; position it once measured
  const [cardHeight, setCardHeight] = useState(0);
  const onCardLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(h - cardHeight) > 1) setCardHeight(h);
  };

  // Web: move keyboard focus to the primary button on each step; screen readers: announce the step
  const primaryRef = useRef<View>(null);
  useEffect(() => {
    if (measuring) return;
    if (Platform.OS === 'web') {
      const t = setTimeout(() => (primaryRef.current as any)?.focus?.(), 60);
      return () => clearTimeout(t);
    }
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [index, measuring]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewport = { width: vw, height: vh, insetTop: insets.top, insetBottom: insets.bottom };
  const placement: TourPlacement | null =
    step.kind === 'spot' && target && cardHeight > 0 ? placeTourCard(target, cardHeight, viewport, isPhone ? 'phone' : 'desktop') : null;
  const radius = step.radius ?? (hole ? Math.min(hole.height / 2, 28) : 0);

  const titleStyle = [styles.title, scriptLang && styles.titleScript];
  const bodyStyle = [styles.body, scriptLang && styles.bodyScript];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}>
      {/* Dim layer with a rounded hole; it also swallows taps so the app underneath stays still */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => {}}>
        <Svg width={vw} height={vh} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={spotlightPath(vw, vh, step.kind === 'spot' && hole ? hole : { x: 0, y: 0, width: 0, height: 0 }, radius)}
            fill={DIM}
            fillRule="evenodd"
          />
        </Svg>
      </Pressable>

      {step.kind === 'spot' && hole && (
        <>
          <View
            pointerEvents="none"
            style={[styles.ring, { left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderRadius: radius }]}
          />
          {!reduceMotion && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulse,
                { left: hole.x - 4, top: hole.y - 4, width: hole.width + 8, height: hole.height + 8, borderRadius: radius + 4 },
                pulseStyle,
              ]}
            />
          )}
        </>
      )}

      {/* ---------------- Spotlight tip card ---------------- */}
      {step.kind === 'spot' && !measuring && target && (
        <Animated.View
          onLayout={onCardLayout}
          role="dialog"
          aria-modal
          aria-label={title}
          accessibilityViewIsModal
          style={[
            styles.card,
            placement
              ? { left: placement.left, top: placement.top, width: placement.width }
              : { left: 16, right: 16, top: -9999, opacity: 0 },
            placement && enterStyle,
          ]}
        >
          {placement && <View style={[styles.arrow, arrowPosition(placement)]} />}
          <View style={styles.cardHeader}>
            <Text style={styles.stepBadge}>
              {spotIndex + 1} / {spotSteps.length}
            </Text>
            <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}>
              <Text style={styles.skipText} maxFontSizeMultiplier={1.3}>
                {ui.skip}
              </Text>
            </Pressable>
          </View>
          <Text style={titleStyle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={bodyStyle} maxFontSizeMultiplier={1.3}>
            {body}
          </Text>
          <View style={styles.cardFooter}>
            <View style={styles.dots} accessible={false}>
              {spotSteps.map((s, i) => (
                <View key={s.id} style={[styles.dot, i === spotIndex && styles.dotActive, i < spotIndex && styles.dotDone]} />
              ))}
            </View>
            <View style={styles.footerButtons}>
              {spotIndex > 0 && (
                <Pressable onPress={onBack} accessibilityRole="button" style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={[styles.secondaryText, scriptLang && styles.btnScript]} maxFontSizeMultiplier={1.3}>
                    {ui.back}
                  </Text>
                </Pressable>
              )}
              <Pressable
                ref={primaryRef}
                onPress={onNext}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.primaryText, scriptLang && styles.btnScript]} maxFontSizeMultiplier={1.3}>
                  {isLastSpot ? ui.done : ui.next}
                </Text>
              </Pressable>
            </View>
          </View>
          {!isPhone && Platform.OS === 'web' && (
            <View style={styles.keysRow} accessible={false}>
              <Text style={styles.key}>←</Text>
              <Text style={styles.key}>→</Text>
              <Text style={styles.keysText}>navigate</Text>
              <Text style={[styles.key, { marginLeft: 8 }]}>Esc</Text>
              <Text style={styles.keysText}>close</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* ---------------- Welcome / finish sheet ---------------- */}
      {step.kind === 'sheet' && (
        <View style={isPhone ? styles.sheetHostPhone : styles.sheetHostDesktop} pointerEvents="box-none">
          <Animated.View
            role="dialog"
            aria-modal
            aria-label={title}
            accessibilityViewIsModal
            style={[isPhone ? [styles.sheetPhone, { paddingBottom: 22 + insets.bottom }] : styles.sheetDesktop, enterStyle]}
          >
            {isPhone && <View style={styles.grabber} />}
            <View style={[styles.mayaPanel, !isPhone && styles.mayaPanelDesktop]}>
              <Image
                source={require('@/assets/images/maya-waving.png')}
                style={isPhone ? styles.mayaImg : styles.mayaImgDesktop}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                accessible={false}
              />
            </View>
            <Text style={[styles.sheetTitle, !isPhone && styles.sheetTitleDesktop, scriptLang && styles.titleScript]} maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            <Text style={[styles.sheetBody, scriptLang && styles.bodyScript]} maxFontSizeMultiplier={1.3}>
              {body}
            </Text>
            <View style={isPhone ? styles.sheetButtonsPhone : styles.sheetButtonsDesktop}>
              <Pressable
                ref={primaryRef}
                onPress={isIntro ? onNext : onFinishPrimary}
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetPrimary, !isPhone && styles.sheetBtnDesktop, pressed && styles.pressed]}
              >
                <Text style={[styles.sheetPrimaryText, scriptLang && styles.btnScript]} maxFontSizeMultiplier={1.3}>
                  {isIntro ? ui.start : ui.cta}
                </Text>
              </Pressable>
              <Pressable
                onPress={onSkip}
                accessibilityRole="button"
                style={({ pressed }) => [
                  isPhone ? styles.sheetSecondaryPhone : [styles.sheetSecondaryDesktop, styles.sheetBtnDesktop],
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.sheetSecondaryText, !isPhone && styles.sheetSecondaryTextDesktop, scriptLang && styles.btnScript]} maxFontSizeMultiplier={1.3}>
                  {isIntro ? ui.later : ui.explore}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

function arrowPosition(p: TourPlacement) {
  const offset = p.arrowOffset - 7;
  switch (p.side) {
    case 'bottom':
      return { top: -7, left: offset };
    case 'top':
      return { bottom: -7, left: offset };
    case 'right':
      return { left: -7, top: offset };
    case 'left':
      return { right: -7, top: offset };
  }
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pulse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    boxShadow: '0 18px 50px rgba(8,18,38,0.28)',
  },
  arrow: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepBadge: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: BRAND,
    backgroundColor: '#EFF4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  skipBtn: {
    minHeight: 36,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 10,
  },
  skipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#5B6B84',
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 19,
    lineHeight: 26,
    color: '#0C1B33',
    marginTop: 8,
  },
  titleScript: {
    lineHeight: 30,
  },
  body: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginTop: 6,
  },
  bodyScript: {
    lineHeight: 25,
  },
  cardFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D5DEEB',
  },
  dotDone: {
    backgroundColor: '#9DB8FF',
  },
  dotActive: {
    width: 20,
    backgroundColor: BRAND,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D5DEEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#0C1B33',
  },
  btnScript: {
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.8,
  },
  keysRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  key: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#5B6B84',
    borderWidth: 1,
    borderColor: '#D5DEEB',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  keysText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#5B6B84',
  },
  sheetHostPhone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetHostDesktop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheetPhone: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(8,18,38,0.25)',
  },
  sheetDesktop: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 22,
    boxShadow: '0 30px 80px rgba(8,18,38,0.35)',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D5DEEB',
    alignSelf: 'center',
    marginTop: 10,
  },
  mayaPanel: {
    marginTop: 14,
    height: 150,
    borderRadius: 22,
    backgroundColor: '#EAF1FE',
    overflow: 'hidden',
    alignItems: 'center',
  },
  mayaPanelDesktop: {
    marginTop: 0,
    height: 180,
  },
  mayaImg: {
    width: 230,
    height: 195,
    marginTop: 6,
  },
  mayaImgDesktop: {
    width: 270,
    height: 229,
    marginTop: 8,
  },
  sheetTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    lineHeight: 30,
    color: '#0C1B33',
    textAlign: 'center',
    marginTop: 18,
  },
  sheetTitleDesktop: {
    fontSize: 26,
    lineHeight: 34,
    marginTop: 20,
  },
  sheetBody: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    lineHeight: 23,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    alignSelf: 'center',
    maxWidth: 340,
  },
  sheetButtonsPhone: {
    marginTop: 20,
  },
  sheetButtonsDesktop: {
    marginTop: 24,
    flexDirection: 'row-reverse',
    gap: 10,
  },
  sheetBtnDesktop: {
    flex: 1,
  },
  sheetPrimary: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheetPrimaryText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 16,
    color: '#FFFFFF',
  },
  sheetSecondaryPhone: {
    marginTop: 6,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryDesktop: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#D5DEEB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheetSecondaryText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#5B6B84',
  },
  sheetSecondaryTextDesktop: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 15,
    color: '#0C1B33',
  },
});
