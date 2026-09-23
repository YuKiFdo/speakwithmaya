import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors } from '@/theme/tokens';

interface ResponsiveShellProps {
  children: React.ReactNode;
  testID?: string;
}

export function ResponsiveShell({ children, testID = 'responsive-shell' }: ResponsiveShellProps) {
  const { isPhone, isTablet, isDesktop } = useBreakpoint();

  const maxContentWidth = isDesktop ? 1080 : isTablet ? 720 : '100%';

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            alignItems: 'center',
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={isPhone}
      >
        <View
          style={[
            styles.container,
            {
              maxWidth: maxContentWidth,
              paddingHorizontal: isPhone ? 20 : isTablet ? 32 : 48,
            },
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
