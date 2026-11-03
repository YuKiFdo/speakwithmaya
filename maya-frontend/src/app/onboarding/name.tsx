import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Legacy route redirect: First-time signup combines name, phone, and email into /onboarding/create-account.
 */
export default function NameScreen() {
  useEffect(() => {
    router.replace('/onboarding/create-account' as any);
  }, []);

  return null;
}
