import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { fontStyle } from '@/theme/fonts';

export type MobileBottomTabsProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Tab configuration mapping route names to their display properties.
 * Uses Ionicons (font-based vector icons) for instant rendering on Android
 * instead of SVG-based icons that create multiple native views.
 */
const TAB_CONFIG: Record<
  string,
  {
    label: string;
    iconActive: keyof typeof Ionicons.glyphMap;
    iconInactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  dashboard: {
    label: 'Home',
    iconActive: 'home',
    iconInactive: 'home-outline',
  },
  roadmap: {
    label: 'Roadmap',
    iconActive: 'map',
    iconInactive: 'map-outline',
  },
  history: {
    label: 'History',
    iconActive: 'time',
    iconInactive: 'time-outline',
  },
  account: {
    label: 'Account',
    iconActive: 'person',
    iconInactive: 'person-outline',
  },
};

const ACTIVE_COLOR = '#2B5BFF';
const INACTIVE_COLOR = '#94a3b8';

/**
 * Reusable mobile bottom tab bar component.
 *
 * Performance advantages over the old inline implementation:
 * 1. Uses font-based Ionicons (single native Text view per icon) instead of
 *    SVG icons (multiple Svg/Path/Circle native views per icon).
 * 2. Paired with Expo Router <Tabs> layout so screens stay mounted —
 *    switching tabs is a 0ms view swap, not a full unmount/remount.
 * 3. Includes instant touch feedback via android_ripple and pressed opacity.
 *
 * Hidden on desktop (≥768px) where the DesktopSidebar handles navigation.
 */
export function MobileBottomTabs({
  state,
  descriptors,
  navigation,
}: MobileBottomTabsProps) {
  const { isPhone } = useBreakpoint();
  const insets = useSafeAreaInsets();

  // Desktop uses the sidebar, not the bottom tab bar
  if (!isPhone) return null;

  const safeBottom = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: safeBottom,
          height: 56 + safeBottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name];

        // Skip routes that aren't in our tab config (safety guard)
        if (!config) return null;

        const iconName = isFocused ? config.iconActive : config.iconInactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.tabItemPressed,
            ]}
            android_ripple={{
              color: 'rgba(43, 91, 255, 0.12)',
              borderless: true,
              radius: 28,
            }}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={config.label}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
            <Text
              style={[
                styles.tabLabel,
                isFocused && styles.tabLabelActive,
              ]}
            >
              {config.label}
            </Text>
            {isFocused && <View style={styles.activeDot} />}
          </Pressable>
        );
      })}
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
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 1000,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        } as any)
      : {
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        }),
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minWidth: 60,
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  tabLabelActive: {
    ...fontStyle('outfit', 'bold'),
    color: ACTIVE_COLOR,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACTIVE_COLOR,
    marginTop: 2,
  },
});
