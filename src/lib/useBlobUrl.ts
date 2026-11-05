import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from '@/db/db';

/** An object URL for a stored file, kept in sync with the database and released when no longer shown. */
export function useBlobUrl(id: string | null | undefined): string | null {
  const row = useLiveQuery(() => (id ? db.blobs.get(id) : undefined), [id]);
  const url = useMemo(() => (row?.blob ? URL.createObjectURL(row.blob) : null), [row]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}
