import { useState, useCallback } from 'react';
import {
  ConnectionQuality,
  ConnectionToastPreset,
  ConnectionMonitorState,
} from './useConnectionMonitor.types';

export * from './useConnectionMonitor.types';

export function useConnectionMonitor(): ConnectionMonitorState {
  const [status, setStatus] = useState<ConnectionQuality>('connected');
  const [simulatedStatus, setSimulatedStatus] = useState<ConnectionQuality | null>(null);

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

  const simulateStatus = useCallback((target: ConnectionQuality | null) => {
    setSimulatedStatus(target);
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
    effectiveType: undefined,
    toastPreset: getToastPreset(activeStatus),
    simulateStatus,
  };
}
