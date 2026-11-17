import { useState } from 'react';

/**
 * Client-side "show more" paging for long admin lists.
 * Renders `pageSize` rows at first and grows by `pageSize` per showMore().
 * The count resets automatically whenever `resetKey` changes (e.g. search/filter/tab),
 * without a setState-in-effect.
 */
export function useShowMore<T>(items: T[], resetKey: string, pageSize = 25) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = state.key === resetKey ? state.count : pageSize;
  const visible = items.slice(0, count);
  const remaining = Math.max(0, items.length - count);
  return {
    visible,
    total: items.length,
    remaining,
    hasMore: remaining > 0,
    nextBatch: Math.min(pageSize, remaining),
    showMore: () => setState({ key: resetKey, count: count + pageSize }),
  };
}
