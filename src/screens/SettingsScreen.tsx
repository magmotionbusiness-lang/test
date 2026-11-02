import { confirmAction } from '@/lib/confirm';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Database, Download, Eye, FileDown, FileUp, Moon, Palette, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { aiUsage } from '@/ai/client';
import { useSettings } from '@/app/useSettings';
import { badgeSupported } from '@/app/useAppBadge';
import { clearCustomSound, playCompletionSound, setCustomSound } from '@/lib/sound';
import { db } from '@/db/db';
import { backupFileName, exportBackup, importBackup, parseBackup, saveFile } from '@/db/backup';
import { loadDemoData } from '@/db/demo';
import { eraseAll, hasAnyData, updateSettings } from '@/db/repo';
import type { ThemePref } from '@/db/types';
import { ColorPicker, FieldRow, Stepper } from '@/components/form';
import { InstallGuide } from '@/components/InstallGuide';
import { Page } from '@/components/Page';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { IconTile, ListGroup, ListRow, Segmented, Toggle } from '@/components/ui';
import { buildReviewPayload } from '@/domain/aggregate';
import { formatDay, shiftDate, today as todayFn, weekStartOf } from '@/domain/dates';

export function SettingsScreen() {
  const settings = useSettings();
  const location = useLocation();
  const [installOpen, setInstallOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);
  const usage = useLiveQuery(() => aiUsage(), [settings.aiCallsToday, settings.aiCallsDate, settings.aiDailyLimit]);

  useEffect(() => {
    if ((location.state as { focus?: string } | null)?.focus === 'ai') setPreviewOpen(true);
  }, [location.state]);

  const onLoadDemo = async () => {
    if ((await hasAnyData()) && !confirmAction('Replace everything on this device with demo data? Your current habits and history will be erased.'))
      return;
    setBusy('demo');
    try {
      await loadDemoData();
      toast('Demo data loaded');
    } finally {
      setBusy(null);
    }
  };

  const onErase = async () => {
    if (!confirmAction('Erase all data on this device? This can’t be undone.')) return;
    if (!confirmAction('Are you absolutely sure? Every habit, entry, goal and note will be deleted.')) return;
    await eraseAll();
    toast('All data erased');
  };

  const onExport = async () => {
    setBusy('export');
    try {
      await saveFile(await exportBackup(), backupFileName());
      toast('Backup saved');
    } catch {
      /* cancelled from the share sheet */
    } finally {
      setBusy(null);
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const n = backup.data.habits.length;
      if (
        !confirmAction(
          `Replace everything on this device with this backup from ${formatDay(backup.exportedAt.slice(0, 10), 'd MMM yyyy')} (${n} habits)?`,
        )
      )
        return;
      const s = await importBackup(backup);
      toast(`Imported ${s.habits} habits and ${s.entries} entries`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onSoundFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('sound');
    try {
      await setCustomSound(file);
      await updateSettings({ completionSoundName: file.name.replace(/\.[^.]+$/, '') });
      void playCompletionSound();
      toast('Completion sound saved');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t use that file');
    } finally {
      setBusy(null);
      if (soundRef.current) soundRef.current.value = '';
    }
  };

  // Drops the cached app files (never your data, which lives in IndexedDB) and reloads,
  // so the newest published version is fetched fresh.
  const onCheckUpdates = async () => {
    setBusy('update');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update().catch(() => undefined);
      if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      await reg?.unregister();
    } finally {
      window.location.reload();
    }
  };

  const onBadgeToggle = async (on: boolean) => {
    if (!on) {
      await updateSettings({ appBadge: false });
      return;
    }
    if (!badgeSupported() || typeof Notification === 'undefined') {
      toast('Add Habit Hub to your Home Screen first (iOS 16.4 or later), then turn this on there');
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      await updateSettings({ appBadge: true });
      toast('Badge on — it updates whenever you open the app');
    } else toast('iOS needs notification permission for badges. Allow it in iOS Settings → Habit Hub → Notifications');
  };

  const backupAge = settings.lastBackupAt ? Math.floor((Date.now() - Date.parse(settings.lastBackupAt)) / 86_400_000) : null;

  return (
    <Page title="Settings">
      <ListGroup header="Appearance">
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-3">
            <IconTile color="#5856D6">
              <Moon size={17} aria-hidden />
            </IconTile>
            <span className="text-body">Theme</span>
          </div>
          <Segmented<ThemePref>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-body">First day of the week</div>
          <Segmented<'0' | '1'>
            label="First day of the week"
            value={String(settings.weekStart) as '0' | '1'}
            onChange={(v) => updateSettings({ weekStart: Number(v) as 0 | 1 })}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </div>
        <div className="pt-3">
          <div className="flex items-center gap-3 px-4">
            <IconTile color="#FF2D55">
              <Palette size={17} aria-hidden />
            </IconTile>
            <span className="text-body">Accent color</span>
          </div>
          <ColorPicker value={settings.accent} onChange={(accent) => updateSettings({ accent })} />
        </div>
      </ListGroup>

      <ListGroup
        header="Sounds"
        footer="Plays once when every habit due today is done. Pick any audio file or a screen recording; only its sound is kept, trimmed and stored on this device. With the ringer switch on silent, iPhone may stay quiet."
      >
        <FieldRow label="Pop when tapping Done">
          <Toggle checked={settings.tapSound !== false} onChange={(tapSound) => updateSettings({ tapSound })} label="Pop when tapping Done" />
        </FieldRow>
        <FieldRow label="Sound when all done">
          <Toggle
            checked={settings.completionSound !== false}
            onChange={(completionSound) => updateSettings({ completionSound })}
            label="Play a sound"
          />
        </FieldRow>
        <ListRow title="Sound" detail={settings.completionSoundName ?? 'Built-in chime'} />
        <ListRow
          title={<span className="text-accent">{busy === 'sound' ? 'Preparing sound…' : 'Choose your own sound…'}</span>}
          onClick={busy ? undefined : () => soundRef.current?.click()}
        />
        <ListRow title={<span className="text-accent">Play it now</span>} onClick={() => void playCompletionSound()} />
        {settings.completionSoundName && (
          <ListRow
            title={<span className="text-accent">Use the built-in chime</span>}
            onClick={async () => {
              await clearCustomSound();
              await updateSettings({ completionSoundName: null });
              toast('Back to the built-in chime');
            }}
          />
        )}
      </ListGroup>
      <input
        ref={soundRef}
        type="file"
        accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.mov,.mp4"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onSoundFile(e.target.files?.[0])}
      />

      <ListGroup
        header="App icon"
        footer="Shows how many of today’s habits are left as a red badge on the Home Screen icon. iOS updates it whenever you open the app. Needs the app installed on your Home Screen and notification permission (no notifications are sent)."
      >
        <FieldRow label="Habits left on app icon">
          <Toggle checked={Boolean(settings.appBadge)} onChange={onBadgeToggle} label="Habits left on app icon" />
        </FieldRow>
      </ListGroup>

      <ListGroup
        header="AI coach"
        footer="Reviews and plans are written by Google Gemini. Only summaries are sent — never your raw history — and nothing is stored by the app’s server."
      >
        <FieldRow label="Daily limit">
          <Stepper
            label="daily AI limit"
            value={settings.aiDailyLimit}
            min={1}
            max={100}
            onChange={(aiDailyLimit) => updateSettings({ aiDailyLimit })}
          />
        </FieldRow>
        <ListRow
          icon={
            <IconTile color="#AF52DE">
              <Bot size={17} aria-hidden />
            </IconTile>
          }
          title="Used today"
          detail={usage ? `${usage.used} of ${usage.limit}` : ''}
        />
        <FieldRow label="Include my notes in AI reviews">
          <Toggle
            checked={settings.includeNotesInAI}
            onChange={(includeNotesInAI) => updateSettings({ includeNotesInAI })}
            label="Include my notes in AI reviews"
          />
        </FieldRow>
        <ListRow
          icon={
            <IconTile color="#5856D6">
              <Eye size={17} aria-hidden />
            </IconTile>
          }
          title="What gets sent"
          chevron
          onClick={() => setPreviewOpen(true)}
        />
      </ListGroup>

      <ListGroup
        header="Data"
        footer={
          <>
            Everything lives only on this device. iOS can clear website data that isn’t used for a while, so export a backup now and then
            {backupAge !== null ? ` — last backup ${backupAge === 0 ? 'today' : `${backupAge} days ago`}` : ' — no backup yet'}.
          </>
        }
      >
        <ListRow
          icon={
            <IconTile color="#34C759">
              <FileDown size={17} aria-hidden />
            </IconTile>
          }
          title={busy === 'export' ? 'Preparing backup…' : 'Export backup'}
          onClick={busy ? undefined : onExport}
        />
        <ListRow
          icon={
            <IconTile color="#30B0C7">
              <FileUp size={17} aria-hidden />
            </IconTile>
          }
          title="Import backup"
          onClick={() => fileRef.current?.click()}
        />
        <ListRow
          icon={
            <IconTile color="#FF9500">
              <Sparkles size={17} aria-hidden />
            </IconTile>
          }
          title={busy === 'demo' ? 'Loading demo data…' : 'Load demo data'}
          subtitle="6 months, 4 sections, 12 habits"
          onClick={busy ? undefined : onLoadDemo}
        />
        <ListRow
          icon={
            <IconTile color="#FF3B30">
              <Trash2 size={17} aria-hidden />
            </IconTile>
          }
          title="Erase all data"
          destructive
          onClick={onErase}
        />
      </ListGroup>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => onImportFile(e.target.files?.[0])}
        aria-hidden
        tabIndex={-1}
      />

      <ListGroup header="About">
        <ListRow
          icon={
            <IconTile color="#007AFF">
              <Download size={17} aria-hidden />
            </IconTile>
          }
          title="Install on your Home Screen"
          chevron
          onClick={() => setInstallOpen(true)}
        />
        <ListRow
          icon={
            <IconTile color="#8E8E93">
              <Database size={17} aria-hidden />
            </IconTile>
          }
          title="Version"
          subtitle={window.location.host}
          detail={`${__APP_VERSION__} · ${formatBuild(__BUILD_TIME__)}`}
        />
        <ListRow
          title={<span className="text-accent">{busy === 'update' ? 'Checking…' : 'Check for updates'}</span>}
          onClick={busy ? undefined : onCheckUpdates}
        />
      </ListGroup>

      <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
      <PayloadPreview open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </Page>
  );
}

/** Shows the exact JSON a "This week" review would send right now. */
function PayloadPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const today = todayFn();
  const payload = useLiveQuery(async () => {
    if (!open) return null;
    const from = weekStartOf(today, settings.weekStart);
    const [habits, sections, entries, notes, goals] = await Promise.all([
      db.habits.toArray(),
      db.sections.toArray(),
      db.entries.where('date').between(shiftDate(from, -430), today, true, true).toArray(),
      db.dailyNotes.where('date').between(from, today, true, true).toArray(),
      db.goals.toArray(),
    ]);
    if (!habits.length) return null;
    return buildReviewPayload({
      habits,
      sections,
      entries,
      notes,
      goals,
      from,
      to: today,
      today,
      weekStart: settings.weekStart,
      includeNotes: settings.includeNotesInAI,
      label: 'This week',
    });
  }, [open, today, settings.weekStart, settings.includeNotesInAI]);

  const text = payload ? JSON.stringify({ task: 'review', payload }, null, 2) : null;

  return (
    <Sheet open={open} onClose={onClose} title="What gets sent">
      <p className="mb-3 text-subhead text-secondary">
        This is exactly what a “This week” review would send right now: summaries per habit, section and goal. Note text is{' '}
        {settings.includeNotesInAI ? 'included because you turned it on' : 'not included'}. Names of habits and goals are sent so the coach can refer
        to them.
      </p>
      {text ? (
        <>
          <p className="mb-2 text-footnote text-secondary">{(new Blob([text]).size / 1024).toFixed(1)} KB · limit 30 KB</p>
          <pre className="max-h-[55dvh] overflow-auto whitespace-pre-wrap break-words rounded-row bg-bg-2 p-3 font-mono text-[11px] leading-[15px]">
            {text}
          </pre>
        </>
      ) : (
        <p className="rounded-row bg-bg-2 p-4 text-subhead text-secondary">Add a habit to see a real example.</p>
      )}
    </Sheet>
  );
}

/** Build stamp in the viewer's local time, e.g. "2 Nov, 22:10". */
function formatBuild(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
