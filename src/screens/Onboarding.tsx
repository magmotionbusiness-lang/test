import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { pageSpring } from '@/app/motion';
import { createHabit, createSection, updateSettings } from '@/db/repo';
import type { HabitColor, Schedule, Section, TimeOfDay } from '@/db/types';
import { today } from '@/domain/dates';
import { colorVar } from '@/lib/colors';
import { PrimaryButton } from '@/components/ui';

interface Preset {
  name: string;
  emoji: string;
  color: HabitColor;
  kind: Section['kind'];
  description: string;
  starter: { name: string; emoji: string; schedule: Schedule; timeOfDay: TimeOfDay; minimumVersion: string; cue: string };
}

const PRESETS: Preset[] = [
  {
    name: 'Gym',
    emoji: '🏋️',
    color: 'orange',
    kind: 'gym',
    description: 'Strength and conditioning',
    starter: {
      name: 'Work out',
      emoji: '💪',
      schedule: { kind: 'timesPerWeek', times: 3 },
      timeOfDay: 'evening',
      minimumVersion: '10 push-ups',
      cue: 'After work',
    },
  },
  {
    name: 'Study',
    emoji: '📚',
    color: 'blue',
    kind: 'standard',
    description: 'Learning and deep work',
    starter: {
      name: 'Focused study',
      emoji: '🎯',
      schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] },
      timeOfDay: 'morning',
      minimumVersion: '10 minutes',
      cue: 'After my morning coffee',
    },
  },
  {
    name: 'Mindset',
    emoji: '🧠',
    color: 'purple',
    kind: 'standard',
    description: 'Calm, focus and reflection',
    starter: {
      name: 'Meditate',
      emoji: '🌿',
      schedule: { kind: 'daily' },
      timeOfDay: 'morning',
      minimumVersion: '3 deep breaths',
      cue: 'Right after waking up',
    },
  },
  {
    name: 'Health',
    emoji: '❤️',
    color: 'green',
    kind: 'standard',
    description: 'Food, water and movement',
    starter: {
      name: 'Drink water',
      emoji: '💧',
      schedule: { kind: 'daily' },
      timeOfDay: 'anytime',
      minimumVersion: '4 glasses',
      cue: 'A glass with every meal',
    },
  },
  {
    name: 'Sleep',
    emoji: '🌙',
    color: 'indigo',
    kind: 'standard',
    description: 'Rest and recovery',
    starter: {
      name: 'In bed by 23:00',
      emoji: '🛏️',
      schedule: { kind: 'daily' },
      timeOfDay: 'evening',
      minimumVersion: 'Screens off by 23:00',
      cue: 'Alarm at 22:30',
    },
  },
];

/** First launch: what it is → pick sections → first habit or AI goal. */
export function Onboarding({ onFinish }: { onFinish: (next?: 'goal') => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(['Mindset', 'Health']);
  const [starters, setStarters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const chosen = PRESETS.filter((p) => picked.includes(p.name));

  const finish = async (next?: 'goal') => {
    setBusy(true);
    const t = today();
    for (const [i, p] of chosen.entries()) {
      const s = await createSection({
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        kind: p.kind,
        description: p.description,
        order: i,
        archived: false,
      });
      if (starters.includes(p.name)) {
        await createHabit({
          ...p.starter,
          sectionId: s.id,
          color: p.color,
          type: p.starter.name === 'Drink water' ? 'count' : 'check',
          target: p.starter.name === 'Drink water' ? 8 : 1,
          unit: p.starter.name === 'Drink water' ? 'glasses' : '',
          why: '',
          reminderTime: null,
          goalIds: [],
          startDate: t,
          archived: false,
          order: 0,
        });
      }
    }
    await updateSettings({ onboardingDone: true });
    onFinish(next);
  };

  return (
    <div className="fixed inset-0 z-[48] flex flex-col bg-bg pt-safe pb-safe" role="dialog" aria-modal="true" aria-label="Welcome to Habit Hub">
      <div className="flex justify-center gap-1.5 pt-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-1.5 bg-[rgb(var(--fill)/0.3)]'}`} />
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={step}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-30%', opacity: 0 }}
            transition={pageSpring}
            className="absolute inset-0 mx-auto flex max-w-content flex-col overflow-y-auto px-6 pb-6 pt-8"
          >
            {step === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <WelcomeGrid />
                <h1 className="mt-8 text-large-title">Habit Hub</h1>
                <p className="mt-3 max-w-xs text-body text-secondary">
                  Group habits into sections, check them off with one tap and watch your tiles fill in.
                </p>
                <ul className="mt-6 grid gap-2 text-left text-subhead">
                  <li>✅ One tap to log, swipe to skip</li>
                  <li>🟩 A tile calendar for every habit</li>
                  <li>✨ A calm AI coach for reviews and goals</li>
                  <li>🔒 Your data stays on this device</li>
                </ul>
              </div>
            )}
            {step === 1 && (
              <>
                <h1 className="text-title">Pick your sections</h1>
                <p className="mt-1 text-subhead text-secondary">You can add, rename or remove them any time.</p>
                <div className="mt-6 grid gap-2.5">
                  {PRESETS.map((p) => {
                    const on = picked.includes(p.name);
                    return (
                      <button
                        key={p.name}
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setPicked((x) => (on ? x.filter((n) => n !== p.name) : [...x, p.name]))}
                        className="flex min-h-[60px] items-center gap-3 rounded-card bg-bg-2 px-4 text-left shadow-card"
                        style={{ boxShadow: on ? `inset 0 0 0 2px ${colorVar(p.color)}` : undefined }}
                      >
                        <span className="text-[26px]" aria-hidden>
                          {p.emoji}
                        </span>
                        <span className="flex-1">
                          <span className="block text-headline">{p.name}</span>
                          <span className="block text-footnote text-secondary">{p.description}</span>
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? '' : 'border-2 border-[rgb(var(--fill)/0.4)]'}`}
                          style={{ background: on ? colorVar(p.color) : undefined }}
                        >
                          {on && <Check size={14} strokeWidth={3} className="text-white" aria-hidden />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="text-title">Your first habit</h1>
                <p className="mt-1 text-subhead text-secondary">Tap one or two to start small. You can check them off right away.</p>
                <div className="mt-6 grid gap-2.5">
                  {chosen.map((p) => {
                    const on = starters.includes(p.name);
                    return (
                      <button
                        key={p.name}
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setStarters((x) => (on ? x.filter((n) => n !== p.name) : [...x, p.name]))}
                        className="flex min-h-[60px] items-center gap-3 rounded-card bg-bg-2 px-4 text-left shadow-card"
                        style={{ boxShadow: on ? `inset 0 0 0 2px ${colorVar(p.color)}` : undefined }}
                      >
                        <span className="text-[26px]" aria-hidden>
                          {p.starter.emoji}
                        </span>
                        <span className="flex-1">
                          <span className="block text-headline">{p.starter.name}</span>
                          <span className="block text-footnote text-secondary">
                            {p.name} · minimum: {p.starter.minimumVersion}
                          </span>
                        </span>
                        {on && <Check size={20} style={{ color: colorVar(p.color) }} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
                <div className="my-6 flex items-center gap-3 text-footnote text-secondary">
                  <span className="h-px flex-1 bg-[rgb(var(--separator)/0.3)]" /> or <span className="h-px flex-1 bg-[rgb(var(--separator)/0.3)]" />
                </div>
                <button
                  disabled={busy}
                  onClick={() => finish('goal')}
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-card px-4 text-headline text-white"
                  style={{ background: 'linear-gradient(135deg, var(--c-indigo), var(--c-purple))' }}
                >
                  <Sparkles size={18} aria-hidden /> Start from a goal with AI
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mx-auto flex w-full max-w-content flex-col items-center gap-2 px-6 pb-4">
        {step < 2 ? (
          <PrimaryButton onClick={() => setStep((s) => s + 1)} disabled={step === 1 && picked.length === 0}>
            <span className="inline-block min-w-[200px]">Continue</span>
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => finish()} disabled={busy}>
            <span className="inline-block min-w-[200px]">{starters.length ? 'Start tracking' : 'Skip for now'}</span>
          </PrimaryButton>
        )}
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="h-11 text-body text-accent">
            Back
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { loadDemoData } = await import('@/db/demo');
              await loadDemoData();
              onFinish();
            }}
            className="h-11 text-body text-accent"
          >
            Explore with demo data
          </button>
        )}
      </div>
    </div>
  );
}

/** A small tile grid that fills itself in, as the welcome illustration. */
function WelcomeGrid() {
  const colors: HabitColor[] = ['green', 'blue', 'orange', 'purple'];
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="h-6 w-6 rounded-[6px]"
          initial={{ scale: 0.4, opacity: 0.15 }}
          animate={{ scale: 1, opacity: (i * 7) % 5 === 0 ? 0.25 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 + i * 0.03 }}
          style={{ background: colorVar(colors[Math.floor(i / 7)]!) }}
        />
      ))}
    </div>
  );
}
