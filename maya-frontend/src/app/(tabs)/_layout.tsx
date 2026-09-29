import { Tabs } from 'expo-router';
import { MobileBottomTabs } from '@/components/navigation/mobile-bottom-tabs';

/**
 * Tab navigator layout for the main app screens.
 *
 * This replaces the old architecture where each tab was a separate Stack screen
 * navigated via `router.replace()`, causing full unmount/remount on every tab press.
 *
 * With this <Tabs> layout:
 * - All four screens stay mounted in memory after first render
 * - Switching tabs is a 0ms view swap (no React tree destruction)
 * - The custom MobileBottomTabs component provides the tab bar on phone
 * - On desktop (≥768px), the tab bar hides and DesktopSidebar (in each screen) takes over
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <MobileBottomTabs {...props} />}
      screenOptions={{
        headerShown: false,
        // Freeze inactive screens to reduce memory usage while keeping them mounted
        freezeOnBlur: true,
        // Use lazy loading: screens render only when first visited
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="roadmap"
        options={{ title: 'Roadmap' }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History' }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account' }}
      />
    </Tabs>
  );
}
