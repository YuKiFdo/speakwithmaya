import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';

export type MobileBottomTabsProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

type TabConfig = {
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
};

const TAB_CONFIG: Record<string, TabConfig> = {
  dashboard: { label: 'Home', iconActive: 'home', iconInactive: 'home-outline' },
  roadmap: { label: 'Roleplays', iconActive: 'chatbubbles', iconInactive: 'chatbubbles-outline' },
  history: { label: 'History', iconActive: 'time', iconInactive: 'time-outline' },
  account: { label: 'Account', iconActive: 'person', iconInactive: 'person-outline' },
};

// Colors unchanged
const ACTIVE_COLOR = '#2B5BFF';
const INACTIVE_COLOR = '#94a3b8';
const ACTIVE_TINT = '#E6EBFF'; // solid equivalent of rgba(43,91,255,0.12) on white
const PRESSED_TINT = '#F1F5F9';
const BAR_HEIGHT = 62;

// Shared geometry so the sliding indicator lines up exactly with each tab's pill
const PILL_WIDTH = 56;
const PILL_HEIGHT = 30;
const PILL_TOP = 2; // distance from the top of the tab row to the pill

const PRESS_IN_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };
const PRESS_OUT_SPRING = { damping: 10, stiffness: 320, mass: 0.6 };
const SLIDE_SPRING = { damping: 16, stiffness: 210, mass: 0.8 };

const canHaptic = Platform.OS !== 'web';

type TabItemProps = {
  route: any;
  isFocused: boolean;
  config: TabConfig;
  animationsEnabled: boolean;
  onTabPress: (route: any, isFocused: boolean) => void;
  onTabLongPress: (route: any) => void;
};

/**
 * Individual tab. The active pill is drawn by a single shared indicator that
 * slides underneath. Each tab handles its own icon pop, label color, press
 * scale and pressed tint.
 */
const TabItem = React.memo(function TabItem({
  route,
  isFocused,
  config,
  animationsEnabled,
  onTabPress,
  onTabLongPress,
}: TabItemProps) {
  const active = useSharedValue(isFocused ? 1 : 0);
  const iconScale = useSharedValue(1);
  const iconLift = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!animationsEnabled) {
      active.value = isFocused ? 1 : 0;
      hasMounted.current = true;
      return;
    }

    active.value = withTiming(isFocused ? 1 : 0, { duration: 220 });

    // Skip the pop on first render so the bar doesn't bounce on mount.
    // Slight delay so the icon pops as the indicator arrives beneath it.
    if (hasMounted.current && isFocused) {
      iconScale.value = withDelay(
        60,
        withSequence(
          withTiming(0.8, { duration: 80 }),
          withSpring(1, { damping: 6, stiffness: 260, mass: 0.7 })
        )
      );
      iconLift.value = withDelay(
        60,
        withSequence(
          withTiming(-3, { duration: 110 }),
          withSpring(0, { damping: 8, stiffness: 240, mass: 0.7 })
        )
      );
    }
    hasMounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, animationsEnabled]);

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const pillPressedStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * (1 - active.value),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconLift.value }, { scale: iconScale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(active.value, [0, 1], [INACTIVE_COLOR, ACTIVE_COLOR]),
    transform: [{ translateY: -1.5 * active.value }],
  }));

  return (
    <Animated.View style={[styles.tabItem, itemStyle]}>
      <Pressable
        style={styles.tabPressable}
        onPress={() => onTabPress(route, isFocused)}
        onLongPress={() => onTabLongPress(route)}
        onPressIn={() => {
          if (!animationsEnabled) {
            pressed.value = 1;
            return;
          }
          pressed.value = withTiming(1, { duration: 80 });
          pressScale.value = withSpring(0.92, PRESS_IN_SPRING);
        }}
        onPressOut={() => {
          if (!animationsEnabled) {
            pressed.value = 0;
            return;
          }
          pressed.value = withTiming(0, { duration: 160 });
          pressScale.value = withSpring(1, PRESS_OUT_SPRING);
        }}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={config.label}
      >
        <View style={styles.pill}>
          <Animated.View style={[styles.pillLayer, styles.pillPressed, pillPressedStyle]} />
          <Animated.View style={iconStyle}>
            <Ionicons
              name={isFocused ? config.iconActive : config.iconInactive}
              size={22}
              color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.tabLabel, labelStyle]} numberOfLines={1}>
          {config.label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
});

/**
 * Mobile bottom tab bar. Hidden on desktop (>=768px) where DesktopSidebar takes over.
 */
export function MobileBottomTabs(props: MobileBottomTabsProps) {
  const { state } = props;
  const anyProps = props as any;
  const { isPhone } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const animationsEnabled = !reduceMotion;

  const navigation = anyProps.navigation;
  const emitter = anyProps.emitter;
  const navigateToTab = anyProps.navigateToTab;

  // --- Sliding indicator -----------------------------------------------------
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const indicatorStretch = useSharedValue(1);
  const hasPositioned = useRef(false);

  // Only routes that actually render a tab count toward the layout
  const visibleRoutes = useMemo(
    () => state.routes.filter((r: any) => TAB_CONFIG[r.name]),
    [state.routes],
  );
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = visibleRoutes.findIndex((r: any) => r.key === focusedKey);
  const tabWidth = visibleRoutes.length > 0 ? rowWidth / visibleRoutes.length : 0;

  useEffect(() => {
    if (!rowWidth || activeIndex < 0) {
      indicatorOpacity.value = 0;
      return;
    }

    const target = activeIndex * tabWidth + (tabWidth - PILL_WIDTH) / 2;

    // First measurement (or reduced motion): place it directly, no travel
    if (!hasPositioned.current || !animationsEnabled) {
      indicatorX.value = target;
      indicatorOpacity.value = 1;
      hasPositioned.current = true;
      return;
    }

    indicatorOpacity.value = 1;
    indicatorX.value = withSpring(target, SLIDE_SPRING);
    // Stretch while travelling, then settle back
    indicatorStretch.value = withSequence(
      withTiming(1.3, { duration: 110 }),
      withSpring(1, { damping: 10, stiffness: 220, mass: 0.7 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowWidth, activeIndex, tabWidth, animationsEnabled]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value }, { scaleX: indicatorStretch.value }],
  }));

  const handleRowLayout = useCallback((e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  }, []);

  // --- Navigation handlers ---------------------------------------------------
  const handlePress = useCallback(
    (route: any, isFocused: boolean) => {
      const event = emitter
        ? emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
        : navigation?.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });

      if (!isFocused && !event?.defaultPrevented) {
        if (canHaptic) Haptics.selectionAsync();

        if (navigateToTab) {
          navigateToTab(route.key);
        } else if (navigation?.navigate) {
          navigation.navigate(route.name, route.params);
        }
      }
    },
    [emitter, navigation, navigateToTab],
  );

  const handleLongPress = useCallback(
    (route: any) => {
      if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (emitter) {
        emitter.emit({ type: 'tabLongPress', target: route.key });
      } else if (navigation?.emit) {
        navigation.emit({ type: 'tabLongPress', target: route.key });
      }
    },
    [emitter, navigation],
  );

  if (!isPhone) return null;

  const safeBottom = Math.max(insets.bottom, 6);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: safeBottom, height: BAR_HEIGHT + safeBottom },
      ]}
    >
      <View style={styles.row} onLayout={handleRowLayout}>
        {/* Single shared indicator, rendered beneath the tabs */}
        <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />

        {state.routes.map((route: any, index: number) => {
          const config = TAB_CONFIG[route.name];
          if (!config) return null;

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={state.index === index}
              config={config}
              animationsEnabled={animationsEnabled}
              onTabPress={handlePress}
              onTabLongPress={handleLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          width: '100%',
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.07)',
        } as any)
      : {
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
        }),
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  indicator: {
    position: 'absolute',
    top: PILL_TOP,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: ACTIVE_TINT,
  },
  tabItem: {
    flex: 1,
  },
  tabPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: PILL_TOP,
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLayer: {
    ...StyleSheet.absoluteFill,
  },
  pillPressed: {
    backgroundColor: PRESSED_TINT,
  },
  tabLabel: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11,
    color: INACTIVE_COLOR,
    marginTop: 3,
  },
});