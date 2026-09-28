import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  ConnectionQuality,
  ConnectionToastPreset,
  ConnectionMonitorState,
} from './useConnectionMonitor.types';

export * from './useConnectionMonitor.types';

export function useConnectionMonitor(): ConnectionMonitorState {
  const [status, setStatus] = useState<ConnectionQuality>('connected');
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [simulatedStatus, setSimulatedStatus] = useState<ConnectionQuality | null>(null);

  const prevConnectedRef = useRef<boolean>(true);
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

  const handleNetState = useCallback((netState: NetInfoState) => {
    // A connection is truly offline if isConnected is false, or type is 'none',
    // or isInternetReachable is explicitly false
    const isDisconnected =
      netState.isConnected === false ||
      netState.type === 'none' ||
      netState.isInternetReachable === false;

    setEffectiveType(netState.type);

    if (isDisconnected) {
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
      prevConnectedRef.current = false;
      setStatus('lost');
    } else {
      if (!prevConnectedRef.current) {
        // Transition: was offline -> now reconnecting -> then restored -> then connected
        prevConnectedRef.current = true;
        setStatus('reconnecting');

        if (restoreTimerRef.current) {
          clearTimeout(restoreTimerRef.current);
        }

        restoreTimerRef.current = setTimeout(() => {
          setStatus('restored');

          restoreTimerRef.current = setTimeout(() => {
            setStatus('connected');
          }, 3000);
        }, 1200);
      } else {
        // Check for cellular 2g weak signal
        const isCellular2G =
          netState.type === 'cellular' &&
          (netState.details as any)?.cellularGeneration === '2g';

        if (isCellular2G) {
          setStatus('weak');
        } else if (status === 'weak') {
          setStatus('connected');
        }
      }
    }
  }, [status]);

  useEffect(() => {
    // 1. Immediately fetch the current state upon mounting
    NetInfo.fetch().then((initialState) => {
      handleNetState(initialState);
    });

    // 2. Listen to real-time network change events
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      handleNetState(netState);
    });

    return () => {
      unsubscribe();
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
    };
  }, [handleNetState]);

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
    toastPreset: getToastPreset(activeStatus),
    simulateStatus,
  };
}
