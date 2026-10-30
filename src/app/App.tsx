import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useApplyTheme } from './theme';
import { useSettings } from './useSettings';
import { TabBar } from '@/components/TabBar';
import { InstallGuide, isIosSafari } from '@/components/InstallGuide';
import { updateSettings } from '@/db/repo';
import { db } from '@/db/db';
import { HomeScreen } from '@/screens/HomeScreen';
import { SectionsScreen } from '@/screens/SectionsScreen';
import { GoalsScreen } from '@/screens/GoalsScreen';
import { InsightsScreen } from '@/screens/InsightsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

export function App() {
  const settings = useSettings();
  useApplyTheme(settings.theme);
  const [installOpen, setInstallOpen] = useState(false);

  // First launch in Safari (not yet installed): show the install guide once.
  useEffect(() => {
    let cancelled = false;
    void db.settings.get('settings').then((s) => {
      if (!cancelled && !s?.installGuideSeen && isIosSafari()) setInstallOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeInstall = () => {
    setInstallOpen(false);
    void updateSettings({ installGuideSeen: true });
  };

  return (
    <div className="relative h-full overflow-hidden">
      <main className="absolute inset-0">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/sections" element={<SectionsScreen />} />
          <Route path="/goals" element={<GoalsScreen />} />
          <Route path="/insights" element={<InsightsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </main>
      <TabBar />
      <InstallGuide open={installOpen} onClose={closeInstall} />
    </div>
  );
}
