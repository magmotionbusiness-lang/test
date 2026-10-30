import { useEffect, useState } from 'react';
import { Stack } from './Stack';
import { useApplyAccent, useApplyTheme } from './theme';
import { useSettings } from './useSettings';
import { TabBar } from '@/components/TabBar';
import { ToastHost } from '@/components/Toast';
import { InstallGuide, isIosSafari } from '@/components/InstallGuide';
import { updateSettings } from '@/db/repo';
import { db } from '@/db/db';
import { HomeScreen } from '@/screens/HomeScreen';
import { SectionsScreen } from '@/screens/SectionsScreen';
import { GoalsScreen } from '@/screens/GoalsScreen';
import { InsightsScreen } from '@/screens/InsightsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SectionScreen } from '@/screens/SectionScreen';
import { HabitScreen } from '@/screens/HabitScreen';
import { GoalScreen } from '@/screens/GoalScreen';

const ROUTES = [
  { path: '/', element: <HomeScreen /> },
  { path: '/sections', element: <SectionsScreen /> },
  { path: '/sections/:id', element: <SectionScreen /> },
  { path: '/habits/:id', element: <HabitScreen /> },
  { path: '/goals', element: <GoalsScreen /> },
  { path: '/goals/:id', element: <GoalScreen /> },
  { path: '/insights', element: <InsightsScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '*', element: <HomeScreen /> },
];

export function App() {
  const settings = useSettings();
  useApplyTheme(settings.theme);
  useApplyAccent(settings.accent);
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
        <Stack routes={ROUTES} />
      </main>
      <TabBar />
      <ToastHost />
      <InstallGuide open={installOpen} onClose={closeInstall} />
    </div>
  );
}
