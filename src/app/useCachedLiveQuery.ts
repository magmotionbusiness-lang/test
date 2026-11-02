import { useLiveQuery } from 'dexie-react-hooks';

const cache = new Map<string, unknown>();

/**
 * useLiveQuery that remembers its last result per key. Tab screens remount
 * on every switch; starting from the previous result means they render fully
 * formed immediately instead of empty-then-filled (which made content jump).
 */
export function useCachedLiveQuery<T>(key: string, query: () => Promise<T>, deps: unknown[]): T | undefined {
  const fresh = useLiveQuery(query, deps, cache.get(key) as T | undefined);
  if (fresh !== undefined) cache.set(key, fresh);
  return fresh;
}
