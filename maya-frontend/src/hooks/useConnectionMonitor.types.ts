export type ConnectionQuality =
  | 'connected'
  | 'weak'
  | 'lost'
  | 'reconnecting'
  | 'restored';

export type ConnectionToastPreset =
  | 'weak-connection'
  | 'connection-lost'
  | 'reconnecting'
  | 'connection-restored';

export interface ConnectionMonitorState {
  /**
   * Current connection status
   */
  status: ConnectionQuality;

  /**
   * True if device currently has active network connectivity
   */
  isOnline: boolean;

  /**
   * True if network latency / bandwidth is degraded
   */
  isWeak: boolean;

  /**
   * True while attempting to re-establish connection
   */
  isReconnecting: boolean;

  /**
   * True when network / socket connection is completely severed
   */
  isLost: boolean;

  /**
   * True for 3s immediately after connection recovery
   */
  isRestored: boolean;

  /**
   * Network type (e.g. 'wifi', '4g', '3g', '2g')
   */
  effectiveType?: string;

  /**
   * Round trip time in milliseconds if available
   */
  rtt?: number;

  /**
   * The ToastPill preset corresponding to the current connection state,
   * or null if connection is normal/healthy.
   */
  toastPreset: ConnectionToastPreset | null;

  /**
   * Allows UI or test controls to simulate any connection state
   * Pass null to restore real-time hardware detection.
   */
  simulateStatus: (status: ConnectionQuality | null) => void;
}
