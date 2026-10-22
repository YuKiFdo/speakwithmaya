import { useEffect } from 'react';
import { router } from 'expo-router';
import { AdminAuthStore } from '@/services/store/admin-auth-store';

export default function AdminIndexRedirect() {
  useEffect(() => {
    if (AdminAuthStore.isAuthenticated()) {
      router.replace('/admin/users' as any);
    } else {
      router.replace('/admin/login' as any);
    }
  }, []);

  return null;
}
