import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ConnectingView } from '@/components/call/connecting-view';

/**
 * Route fallback for /onboarding/connecting.
 * Directly replaces with /onboarding/call so ConnectingView is managed
 * uniformly inside the active call lifecycle without duplicate screen flashes.
 */
export default function ConnectingScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/onboarding/call',
      params,
    });
  }, []);

  return <ConnectingView onCancel={() => router.back()} />;
}
