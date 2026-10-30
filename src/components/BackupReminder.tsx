import { useState } from 'react';
import { HardDriveDownload } from 'lucide-react';
import type { Settings } from '@/db/types';
import { Card } from './ui';
import { toast } from './Toast';

const SNOOZE_KEY = 'hh-backup-snooze';
const DAY = 86_400_000;
const INTERVAL_DAYS = 30;
const SNOOZE_DAYS = 7;

/**
 * iOS may clear storage for web apps that go unused, so remind the user to
 * export a backup every 30 days (once they've been tracking for a while).
 */
export function BackupReminder({ settings, firstActivity }: { settings: Settings; firstActivity: string | null }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
    } catch {
      return false;
    }
  });
  const since = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : firstActivity ? Date.parse(firstActivity) : null;
  if (hidden || since === null || Date.now() - since < INTERVAL_DAYS * DAY) return null;

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * DAY));
    } catch {
      /* per-device convenience only */
    }
    setHidden(true);
  };

  return (
    <Card className="mb-4 !p-4">
      <div className="flex items-start gap-3">
        <HardDriveDownload size={24} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-headline">Time for a backup</p>
          <p className="mt-0.5 text-subhead text-secondary">
            {settings.lastBackupAt ? 'It’s been over a month since your last backup.' : 'You haven’t backed up yet.'} Your data lives only on this
            device — save a copy to Files.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                try {
                  // Loaded on demand: the backup module pulls in the validation library.
                  const { backupFileName, exportBackup, saveFile } = await import('@/db/backup');
                  await saveFile(await exportBackup(), backupFileName());
                  toast('Backup saved');
                } catch {
                  /* cancelled */
                }
              }}
              className="h-9 rounded-full bg-accent-fill px-4 text-subhead font-semibold text-white"
            >
              Back up now
            </button>
            <button onClick={snooze} className="h-9 rounded-full px-3 text-subhead text-accent">
              Later
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
