import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { DEFAULT_SETTINGS } from '@/db/repo';
import type { Settings } from '@/db/types';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS;
}
