/**
 * "XP / stats changed on the server" signal. Fired when the server confirms a call is finished
 * (the moment XP is awarded), so every mounted screen re-fetches stats immediately instead of
 * waiting for a timer or the next visit. Kept separate from useUserStats / useLiveCall to avoid
 * an import cycle between them.
 */
const listeners = new Set<() => void>();

export function onStatsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyStatsChanged() {
  for (const l of [...listeners]) {
    try {
      l();
    } catch {}
  }
}
