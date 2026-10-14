import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { ConnectingView } from '@/components/call/connecting-view';

/**
 * Route fallback for /onboarding/connecting.
 * Directly replaces with /onboarding/call so ConnectingView is managed
 * uniformly inside the active call lifecycle without duplicate screen flashes.
 */
export default function ConnectingScreen() {
  useEffect(() => {
    router.replace('/onboarding/call');
  }, []);

  return <ConnectingView onCancel={() => router.back()} />;
}
