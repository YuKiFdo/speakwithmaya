/**
 * Guided-tour ids look like 'dashboard-welcome:v1': lowercase name, optional ':v<N>' version.
 * Bumping the version shows a changed tour again to everyone.
 */
export const TOUR_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}(:v[0-9]{1,4})?$/;

/** Upper bound so a misbehaving client cannot grow the column without limit. */
export const MAX_TOURS_SEEN = 100;

/** Keeps only well-formed, unique ids from whatever is stored (null / missing column -> []). */
export function normalizeToursSeen(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string' && TOUR_ID_PATTERN.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Adds a tour id to the stored list. Returns null when nothing needs writing
 * (already seen). Keeps the newest MAX_TOURS_SEEN ids.
 */
export function addTourSeen(existing: unknown, tourId: string): string[] | null {
  const list = normalizeToursSeen(existing);
  if (list.includes(tourId)) return null;
  list.push(tourId);
  return list.length > MAX_TOURS_SEEN ? list.slice(list.length - MAX_TOURS_SEEN) : list;
}
