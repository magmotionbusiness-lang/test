import { useState } from 'react';
import { Database, Download, Moon, Sparkles, Trash2 } from 'lucide-react';
import { useSettings } from '@/app/useSettings';
import { Page } from '@/components/Page';
import { InstallGuide } from '@/components/InstallGuide';
import { IconTile, ListGroup, ListRow, Segmented } from '@/components/ui';
import { loadDemoData } from '@/db/demo';
import { eraseAll, hasAnyData, updateSettings } from '@/db/repo';
import type { ThemePref } from '@/db/types';

export function SettingsScreen() {
  const settings = useSettings();
  const [installOpen, setInstallOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLoadDemo = async () => {
    if ((await hasAnyData()) && !window.confirm('Replace everything on this device with demo data? Your current habits and history will be erased.'))
      return;
    setBusy(true);
    try {
      await loadDemoData();
    } finally {
      setBusy(false);
    }
  };

  const onErase = async () => {
    if (!window.confirm('Erase all data on this device? This can’t be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Every habit, entry, goal and note will be deleted.')) return;
    await eraseAll();
  };

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
      </ListGroup>

      <ListGroup header="Data" footer="Everything is stored only on this device. Demo data adds 6 months of history across 4 sections and 12 habits.">
        <ListRow
          icon={
            <IconTile color="#FF9500">
              <Sparkles size={17} aria-hidden />
            </IconTile>
          }
          title={busy ? 'Loading demo data…' : 'Load demo data'}
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
          detail={__APP_VERSION__}
        />
      </ListGroup>

      <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
    </Page>
  );
}
