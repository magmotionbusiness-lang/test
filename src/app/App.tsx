import { useLiveQuery } from 'dexie-react-hooks';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack } from './Stack';
import { useApplyAccent, useApplyTheme } from './theme';
import { useAppBadge, useTodayProgress } from './useAppBadge';
import { Celebration } from '@/components/Celebration';
import { setFeedbackPrefs } from '@/lib/feedback';
import { useSettings } from './useSettings';
import { TabBar } from '@/components/TabBar';
import { ToastHost } from '@/components/Toast';
import { Intro } from '@/components/Intro';
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
const VisionBoardScreen = named(() => import('@/screens/VisionBoardScreen'), 'VisionBoardScreen');
const SettingsScreen = named(() => import('@/screens/SettingsScreen'), 'SettingsScreen');
const Onboarding = lazy(() => import('@/screens/Onboarding').then((m) => ({ default: m.Onboarding })));

const ROUTES = [
  { path: '/', element: <HomeScreen /> },
  { path: '/sections', element: <SectionsScreen /> },
  { path: '/sections/:id', element: <SectionScreen /> },
  { path: '/habits/:id', element: <HabitScreen /> },
  { path: '/goals', element: <GoalsScreen /> },
  { path: '/goals/:id', element: <GoalScreen /> },
  { path: '/vision', element: <VisionBoardScreen /> },
  { path: '/insights', element: <InsightsScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '*', element: <HomeScreen /> },
];

export function App() {
  const settings = useSettings();
  useApplyTheme(settings.theme);
  useApplyAccent(settings.accent);
  useAppBadge(settings);
  useEffect(
    () =>
      setFeedbackPrefs({
        tapSound: settings.tapSound !== false,
        ownSoundEachDone: settings.customSoundOn === 'each' && Boolean(settings.completionSoundName),
      }),
    [settings.tapSound, settings.customSoundOn, settings.completionSoundName],
  );
  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion ?? 'full';
  }, [settings.motion]);

  // Celebrate the moment the last habit due today is done, wherever that happened.
  // Only real transitions count: opening the app with everything already done stays quiet.
  const progress = useTodayProgress(settings.weekStart);
  const prevOpen = useRef<number | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  useEffect(() => {
    if (!progress) return;
    if (progress.due > 0 && progress.open === 0 && prevOpen.current !== null && prevOpen.current > 0) setCelebrate((n) => n + 1);
    prevOpen.current = progress.open;
  }, [progress]);
  const [installOpen, setInstallOpen] = useState(false);
  const navigate = useNavigate();
  // undefined while loading, so returning users never see onboarding flash.
  const firstRun = useLiveQuery(async () => {
    const s = await db.settings.get('settings');
    return !s?.onboardingDone && (await db.habits.count()) === 0;
  }, []);

  // Warm up every screen's code shortly after launch, so the first tap into any
  // screen slides in immediately instead of waiting for a download.
  useEffect(() => {
    const t = setTimeout(() => {
      void import('@/screens/SectionsScreen');
      void import('@/screens/SectionScreen');
      void import('@/screens/HabitScreen');
      void import('@/screens/GoalsScreen');
      void import('@/screens/GoalScreen');
      void import('@/screens/InsightsScreen');
      void import('@/screens/VisionBoardScreen');
      void import('@/screens/SettingsScreen');
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // First launch in Safari (not yet installed): show the install guide once.
  useEffect(() => {
    let cancelled = false;
    void db.settings.get('settings').then((s) => {
      if (!cancelled && !s?.installGuideSeen && isIosSafari() && import.meta.env.VITE_PREVIEW !== 'true') setInstallOpen(true);
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
    // Animations are on by default; "Follow iOS" in Settings honours Reduce Motion instead.
    <MotionConfig reducedMotion={settings.motion === 'system' ? 'user' : 'never'}>
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
        <Celebration fire={celebrate} sound={settings.completionSound !== false && settings.customSoundOn !== 'each'} />
        {import.meta.env.VITE_PREVIEW !== 'true' && <Intro />}
      </div>
    </MotionConfig>
  );
}
