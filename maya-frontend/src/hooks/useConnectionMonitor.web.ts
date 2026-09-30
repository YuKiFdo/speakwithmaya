import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConnectionQuality,
  ConnectionToastPreset,
  ConnectionMonitorState,
} from './useConnectionMonitor.types';

export * from './useConnectionMonitor.types';

export function useConnectionMonitor(): ConnectionMonitorState {
  const [status, setStatus] = useState<ConnectionQuality>('connected');
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [rtt, setRtt] = useState<number | undefined>(undefined);
  const [simulatedStatus, setSimulatedStatus] = useState<ConnectionQuality | null>(null);

  const isTransitioningRef = useRef<boolean>(false);
  const restoreTimerRef = useRef<any>(null);

  const getToastPreset = (q: ConnectionQuality): ConnectionToastPreset | null => {
    switch (q) {
      case 'weak':
        return 'weak-connection';
      case 'lost':
        return 'connection-lost';
      case 'reconnecting':
        return 'reconnecting';
      case 'restored':
        return 'connection-restored';
      case 'connected':
      default:
        return null;
    }
  };

  const handleOnline = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Transition: was offline -> now reconnecting -> then restored -> then connected
    setStatus('reconnecting');

    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
    }

    restoreTimerRef.current = setTimeout(() => {
      setStatus('restored');

      // Keep "Connection restored" toast visible for 3 seconds, then return to connected
      restoreTimerRef.current = setTimeout(() => {
        setStatus('connected');
        isTransitioningRef.current = false;
      }, 3000);
    }, 1200);
  }, []);

  const handleOffline = useCallback(() => {
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
    }
    isTransitioningRef.current = false;
    setStatus('lost');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Set initial network state
    if (!navigator.onLine) {
      setStatus('lost');
    }

    // Monitor NetworkInformation API if supported in browser
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const updateConnectionInfo = () => {
      if (connection) {
        setEffectiveType(connection.effectiveType);
        setRtt(connection.rtt);

        if (navigator.onLine) {
          if (
            connection.effectiveType === 'slow-2g' ||
            connection.effectiveType === '2g' ||
            (typeof connection.rtt === 'number' && connection.rtt > 450)
          ) {
            setStatus('weak');
          } else if (status === 'weak') {
            setStatus('connected');
          }
        }
      }
    };

    updateConnectionInfo();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (connection && typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection && typeof connection.removeEventListener === 'function') {
        connection.removeEventListener('change', updateConnectionInfo);
      }
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  // Handle simulation requests
  const simulateStatus = useCallback((target: ConnectionQuality | null) => {
    setSimulatedStatus(target);
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
    }

    if (target === 'restored') {
      restoreTimerRef.current = setTimeout(() => {
        setSimulatedStatus(null);
        setStatus('connected');
      }, 3000);
    }
  }, []);

  const activeStatus = simulatedStatus ?? status;
  const isOnline = activeStatus !== 'lost';

  return {
    status: activeStatus,
    isOnline,
    isWeak: activeStatus === 'weak',
    isReconnecting: activeStatus === 'reconnecting',
    isLost: activeStatus === 'lost',
    isRestored: activeStatus === 'restored',
    effectiveType,
    rtt,
    toastPreset: getToastPreset(activeStatus),
    simulateStatus,
  };
}
