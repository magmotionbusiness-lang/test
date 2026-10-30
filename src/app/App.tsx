import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack } from './Stack';
import { useApplyAccent, useApplyTheme } from './theme';
import { useSettings } from './useSettings';
import { TabBar } from '@/components/TabBar';
import { ToastHost } from '@/components/Toast';
import { InstallGuide, isIosSafari } from '@/components/InstallGuide';
import { updateSettings } from '@/db/repo';
import { db } from '@/db/db';
import { HomeScreen } from '@/screens/HomeScreen';

// Home ships in the main bundle; every other screen loads on first visit.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));
const SectionsScreen = named(() => import('@/screens/SectionsScreen'), 'SectionsScreen');
const SectionScreen = named(() => import('@/screens/SectionScreen'), 'SectionScreen');
const HabitScreen = named(() => import('@/screens/HabitScreen'), 'HabitScreen');
const GoalsScreen = named(() => import('@/screens/GoalsScreen'), 'GoalsScreen');
const GoalScreen = named(() => import('@/screens/GoalScreen'), 'GoalScreen');
const InsightsScreen = named(() => import('@/screens/InsightsScreen'), 'InsightsScreen');
const SettingsScreen = named(() => import('@/screens/SettingsScreen'), 'SettingsScreen');
const Onboarding = lazy(() => import('@/screens/Onboarding').then((m) => ({ default: m.Onboarding })));

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
  const navigate = useNavigate();
  // undefined while loading, so returning users never see onboarding flash.
  const firstRun = useLiveQuery(async () => {
    const s = await db.settings.get('settings');
    return !s?.onboardingDone && (await db.habits.count()) === 0;
  }, []);

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
      {firstRun && (
        <Suspense fallback={null}>
          <Onboarding onFinish={(next) => (next === 'goal' ? navigate('/goals', { state: { newGoal: true } }) : navigate('/'))} />
        </Suspense>
      )}
      <ToastHost />
      <InstallGuide open={installOpen} onClose={closeInstall} />
    </div>
  );
}
