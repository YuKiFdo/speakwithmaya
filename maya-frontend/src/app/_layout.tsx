import { Buffer } from 'buffer';
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

import { DarkTheme, DefaultTheme, ThemeProvider, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium, 
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { DesktopLoadingScreen } from '@/components/ui/desktop-loading-screen';
import { AlertHost } from '@/components/ui/alert-modal';
import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import { OnboardingStore } from '@/services/store/onboarding-store';
if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (
      first.includes('"shadow*" style props are deprecated') ||
      first.includes('props.pointerEvents is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RouteGuard() {
  useRouteGuard();
  return null;
}

function WebDocumentTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    let pageName = '';
    const cleanPath = pathname?.toLowerCase() || '';
    if (cleanPath.includes('/account')) pageName = 'Account';
    else if (cleanPath.includes('/dashboard')) pageName = 'Home';
    else if (cleanPath.includes('/roadmap')) pageName = 'Roadmap';
    else if (cleanPath.includes('/history')) pageName = 'History';
    else if (cleanPath.includes('/upgrade')) pageName = 'Upgrade to Pro';
    else if (cleanPath.includes('/call/feedback')) pageName = 'Call Feedback';
    else if (cleanPath.includes('/call')) pageName = 'Practice Call';
    else if (cleanPath.includes('/onboarding')) pageName = 'Get Started';

    const baseTitle = 'SpeakwithMaya · Practice · Improve · Be Confident';
    const newTitle = pageName ? `${pageName} · SpeakwithMaya` : baseTitle;
    document.title = newTitle;
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // On Web, Google Fonts (Outfit & Inter) are loaded via high-speed WOFF2 CDN in +html.tsx
  // Only native platforms (iOS/Android) need the heavy bundled TTF files from @expo-google-fonts.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === 'web'
      ? {
          ...Ionicons.font,
          ...Feather.font,
          ...MaterialIcons.font,
          ...MaterialCommunityIcons.font,
        }
      : {
          ...Ionicons.font,
          ...Feather.font,
          ...MaterialIcons.font,
          ...MaterialCommunityIcons.font,
          'Outfit-Regular': Outfit_400Regular,
          'Outfit-Medium': Outfit_500Medium,
          'Outfit-SemiBold': Outfit_600SemiBold,
          'Outfit-Bold': Outfit_700Bold,
          'Outfit-ExtraBold': Outfit_800ExtraBold,
          'Inter-Regular': Inter_400Regular,
          'Inter-Medium': Inter_500Medium,
          'Inter-SemiBold': Inter_600SemiBold,
          'Inter-Bold': Inter_700Bold,
          'Inter-ExtraBold': Inter_800ExtraBold,
        }
  );

  const [isAppReady, setIsAppReady] = useState(false);
  const [fontTimeout, setFontTimeout] = useState(false);
  const [isStoreHydrated, setIsStoreHydrated] = useState(OnboardingStore.getState().isHydrated);

  // Safety font timeout: if custom fonts take >400ms on web or >1000ms on native, proceed immediately
  useEffect(() => {
    const timeoutMs = Platform.OS === 'web' ? 400 : 1000;
    const timer = setTimeout(() => {
      setFontTimeout(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Settle initial DOM layout quickly on web without artificial lag
    const timer = setTimeout(() => {
      setIsAppReady(true);
    }, Platform.OS === 'web' ? 60 : 200);
    return () => clearTimeout(timer);
  }, []);

  // Wait for encrypted storage hydration before rendering routes (capped at 800ms safety timeout)
  useEffect(() => {
    if (isStoreHydrated) return;
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) setIsStoreHydrated(true);
    }, 800);

    OnboardingStore.waitForHydration().then(() => {
      if (mounted) setIsStoreHydrated(true);
    });
    const unsub = OnboardingStore.subscribe((state) => {
      if (state.isHydrated && mounted) setIsStoreHydrated(true);
    });
    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsub();
    };
  }, [isStoreHydrated]);

  const isFontsReady = fontsLoaded || !!fontError || fontTimeout;
  const isAppFullyReady = isFontsReady && isAppReady && isStoreHydrated;

  // Seamless transition: ONLY dismiss the pre-bundle HTML loader once React is completely hydrated and ready to render
  useEffect(() => {
    if (isAppFullyReady) {
      SplashScreen.hideAsync().catch(() => {});
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        if ((window as any).__dismissAppLoader) {
          (window as any).__dismissAppLoader();
        } else {
          const loader = document.getElementById('app-initial-loader');
          if (loader) {
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
            setTimeout(() => loader.remove(), 260);
          }
        }
      }
    }
  }, [isAppFullyReady]);

  if (!isAppFullyReady) {
    return <DesktopLoadingScreen message="Loading SpeakwithMaya..." />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RouteGuard />
      <WebDocumentTitle />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          animationTypeForReplace: 'push',
          contentStyle: { backgroundColor: '#ffffff' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SpeakwithMaya' }} />
        <Stack.Screen name="onboarding/name" />
        <Stack.Screen name="onboarding/phone" />
        <Stack.Screen name="onboarding/otp" />
        <Stack.Screen name="onboarding/goal" />
        <Stack.Screen name="onboarding/challenge" />
        <Stack.Screen name="onboarding/level" />
        <Stack.Screen name="onboarding/language" />
        <Stack.Screen name="onboarding/daily-goal" />
        <Stack.Screen name="onboarding/social-proof" />
        <Stack.Screen
          name="onboarding/building-plan"
          options={{ animation: 'fade', animationDuration: 240 }}
        />
        <Stack.Screen
          name="onboarding/connecting"
          options={{ animation: 'fade', animationDuration: 240 }}
        />
        <Stack.Screen
          name="onboarding/call"
          options={{ animation: 'fade', animationDuration: 260, gestureEnabled: false }}
        />
        <Stack.Screen
          name="onboarding/complete"
          options={{ animation: 'fade', animationDuration: 260 }}
        />
        <Stack.Screen
          name="call/index"
          options={{ animation: 'fade', animationDuration: 260, gestureEnabled: false }}
        />
        <Stack.Screen
          name="call/analyzing"
          options={{ animation: 'fade', animationDuration: 240, gestureEnabled: false }}
        />
        <Stack.Screen
          name="call/feedback"
          options={{ animation: 'slide_from_right', animationDuration: 260 }}
        />
        <Stack.Screen
          name="call/complete"
          options={{ animation: 'fade', animationDuration: 260, gestureEnabled: false }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ animation: 'fade', animationDuration: 180 }}
        />
        <Stack.Screen
          name="explore"
          options={{ animation: 'fade', animationDuration: 180 }}
        />
        <Stack.Screen
          name="upgrade"
          options={{ animation: 'slide_from_bottom', animationDuration: 280 }}
        />
        <Stack.Screen
          name="admin/usage"
          options={{ animation: 'fade', animationDuration: 200 }}
        />
        <Stack.Screen
          name="admin/users"
          options={{ animation: 'fade', animationDuration: 200 }}
        />
        <Stack.Screen
          name="admin/settings"
          options={{ animation: 'fade', animationDuration: 200 }}
        />
      </Stack>
      <AlertHost />
    </ThemeProvider>
  );
}
