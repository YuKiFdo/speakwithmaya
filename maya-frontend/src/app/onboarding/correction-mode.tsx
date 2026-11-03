import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Legacy route redirect: AI Correction selection has been replaced by Language Help in the onboarding funnel.
 */
export default function CorrectionModeScreen() {
  useEffect(() => {
    router.replace('/onboarding/language-help' as any);
  }, []);

  return null;
}
