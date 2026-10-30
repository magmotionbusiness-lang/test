import { db } from './db';
import { eraseAll, updateSettings } from './repo';
import type { DailyNote, Entry, Goal, Habit, HabitColor, Schedule, Section, TimeOfDay, WorkoutExercise } from './types';
import { eachDay, shiftDate, today as todayFn, weekdayOf } from '@/domain/dates';
import { isScheduledOn } from '@/domain/schedule';
import { nowIso, uuid } from '@/lib/id';

/** Small deterministic PRNG so demo data looks the same on every device. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface HabitSpec {
  name: string;
  emoji: string;
  color: HabitColor;
  type: Habit['type'];
  target: number;
  unit: string;
  schedule: Schedule;
  timeOfDay: TimeOfDay;
  minimumVersion: string;
  cue: string;
  why: string;
  /** Base completion probability; rises over time to show improvement. */
  p: number;
  /** Extra probability on weekends (can be negative). */
  weekend?: number;
  workout?: boolean;
}

const SECTIONS: { name: string; emoji: string; color: HabitColor; kind: Section['kind']; description: string; habits: HabitSpec[] }[] = [
  {
    name: 'Gym',
    emoji: '🏋️',
    color: 'orange',
    kind: 'gym',
    description: 'Strength and conditioning',
    habits: [
      {
        name: 'Strength training',
        emoji: '💪',
        color: 'orange',
        type: 'check',
        target: 1,
        unit: '',
        schedule: { kind: 'weekdays', days: [1, 3, 5] },
        timeOfDay: 'evening',
        minimumVersion: '10 minutes of mobility',
        cue: 'After work, before dinner',
        why: 'Bench 100 kg and feel strong',
        p: 0.78,
        workout: true,
      },
      {
        name: 'Steps',
        emoji: '🚶',
        color: 'green',
        type: 'count',
        target: 8000,
        unit: 'steps',
        schedule: { kind: 'daily' },
        timeOfDay: 'anytime',
        minimumVersion: 'A 10-minute walk',
        cue: 'Walk during phone calls',
        why: 'Keep moving on rest days',
        p: 0.7,
        weekend: 0.08,
      },
      {
        name: 'Stretching',
        emoji: '🧘',
        color: 'mint',
        type: 'duration',
        target: 10,
        unit: 'min',
        schedule: { kind: 'timesPerWeek', times: 3 },
        timeOfDay: 'evening',
        minimumVersion: '2 minutes of hip openers',
        cue: 'After brushing teeth',
        why: 'Fewer aches, better lifts',
        p: 0.5,
      },
    ],
  },
  {
    name: 'Study',
    emoji: '📚',
    color: 'blue',
    kind: 'standard',
    description: 'Learning and deep work',
    habits: [
      {
        name: 'Deep work block',
        emoji: '🎯',
        color: 'blue',
        type: 'duration',
        target: 90,
        unit: 'min',
        schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] },
        timeOfDay: 'morning',
        minimumVersion: '25-minute focus sprint',
        cue: 'After my morning coffee',
        why: 'Finish the thesis by spring',
        p: 0.72,
      },
      {
        name: 'Read',
        emoji: '📖',
        color: 'indigo',
        type: 'numeric',
        target: 20,
        unit: 'pages',
        schedule: { kind: 'daily' },
        timeOfDay: 'evening',
        minimumVersion: 'One page',
        cue: 'When I get into bed',
        why: 'Read 24 books this year',
        p: 0.68,
        weekend: 0.1,
      },
      {
        name: 'Spanish practice',
        emoji: '🇪🇸',
        color: 'red',
        type: 'check',
        target: 1,
        unit: '',
        schedule: { kind: 'daily' },
        timeOfDay: 'anytime',
        minimumVersion: 'One lesson',
        cue: 'On the train',
        why: 'Conversational before the trip',
        p: 0.62,
        weekend: -0.15,
      },
    ],
  },
  {
    name: 'Mindset',
    emoji: '🧠',
    color: 'purple',
    kind: 'standard',
    description: 'Calm, focus and reflection',
    habits: [
      {
        name: 'Meditate',
        emoji: '🌿',
        color: 'teal',
        type: 'duration',
        target: 10,
        unit: 'min',
        schedule: { kind: 'daily' },
        timeOfDay: 'morning',
        minimumVersion: '3 deep breaths',
        cue: 'Right after waking up',
        why: 'Less reactive, more present',
        p: 0.65,
      },
      {
        name: 'Journal',
        emoji: '✍️',
        color: 'purple',
        type: 'check',
        target: 1,
        unit: '',
        schedule: { kind: 'timesPerWeek', times: 4 },
        timeOfDay: 'evening',
        minimumVersion: 'One sentence',
        cue: 'After dinner',
        why: 'Notice patterns in my days',
        p: 0.55,
      },
      {
        name: 'No social media before noon',
        emoji: '📵',
        color: 'pink',
        type: 'avoid',
        target: 1,
        unit: '',
        schedule: { kind: 'daily' },
        timeOfDay: 'morning',
        minimumVersion: 'Not in bed, at least',
        cue: 'Phone stays in the kitchen',
        why: 'Protect my best hours',
        p: 0.6,
        weekend: -0.2,
      },
    ],
  },
  {
    name: 'Health',
    emoji: '❤️',
    color: 'green',
    kind: 'standard',
    description: 'Sleep, food and water',
    habits: [
      {
        name: 'Water',
        emoji: '💧',
        color: 'cyan',
        type: 'count',
        target: 8,
        unit: 'glasses',
        schedule: { kind: 'daily' },
        timeOfDay: 'anytime',
        minimumVersion: '4 glasses',
        cue: 'A glass with every meal',
        why: 'Fewer afternoon headaches',
        p: 0.74,
      },
      {
        name: 'In bed by 23:00',
        emoji: '🌙',
        color: 'indigo',
        type: 'check',
        target: 1,
        unit: '',
        schedule: { kind: 'weekdays', days: [0, 1, 2, 3, 4] },
        timeOfDay: 'evening',
        minimumVersion: 'Screens off by 23:00',
        cue: 'Alarm at 22:30',
        why: 'Mornings feel easier',
        p: 0.6,
      },
      {
        name: 'Vegetables',
        emoji: '🥦',
        color: 'green',
        type: 'count',
        target: 3,
        unit: 'servings',
        schedule: { kind: 'daily' },
        timeOfDay: 'anytime',
        minimumVersion: 'One serving',
        cue: 'Veg first on the plate',
        why: 'More energy',
        p: 0.66,
        weekend: -0.1,
      },
    ],
  },
];

const EXERCISES = [
  { name: 'Bench press', base: 70, step: 2.5 },
  { name: 'Squat', base: 90, step: 2.5 },
  { name: 'Deadlift', base: 110, step: 5 },
  { name: 'Overhead press', base: 42.5, step: 1.25 },
  { name: 'Barbell row', base: 60, step: 2.5 },
];

export interface DemoData {
  sections: Section[];
  habits: Habit[];
  entries: Entry[];
  dailyNotes: DailyNote[];
  goals: Goal[];
}

/** Pure generator — `today` is injectable for tests. */
export function generateDemoData(todayDate = todayFn(), days = 182): DemoData {
  const rand = mulberry32(42);
  const start = shiftDate(todayDate, -days);
  const now = nowIso();
  const base = { createdAt: now, updatedAt: now };

  const sections: Section[] = [];
  const habits: Habit[] = [];
  const entries: Entry[] = [];
  const specs: { habit: Habit; spec: HabitSpec }[] = [];

  SECTIONS.forEach((s, si) => {
    const section: Section = {
      ...base,
      id: uuid(),
      name: s.name,
      emoji: s.emoji,
      color: s.color,
      kind: s.kind,
      description: s.description,
      order: si,
      archived: false,
    };
    sections.push(section);
    s.habits.forEach((h, hi) => {
      const habit: Habit = {
        ...base,
        id: uuid(),
        sectionId: section.id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        type: h.type,
        target: h.target,
        unit: h.unit,
        schedule: h.schedule,
        timeOfDay: h.timeOfDay,
        minimumVersion: h.minimumVersion,
        cue: h.cue,
        why: h.why,
        reminderTime: null,
        goalIds: [],
        startDate: start,
        archived: false,
        order: hi,
      };
      habits.push(habit);
      specs.push({ habit, spec: h });
    });
  });

  const days_ = eachDay(start, shiftDate(todayDate, -1));
  // A "rough patch" two months ago makes the charts and AI reviews interesting.
  const roughStart = shiftDate(todayDate, -70);
  const roughEnd = shiftDate(todayDate, -60);

  let sessionIndex = 0;
  for (const { habit, spec } of specs) {
    days_.forEach((date, i) => {
      if (!isScheduledOn(habit.schedule, date)) return;
      const wd = weekdayOf(date);
      const isWeekend = wd === 0 || wd === 6;
      const progress = i / days_.length; // 0 → 1 over the period
      let p = spec.p + progress * 0.15 + (isWeekend ? (spec.weekend ?? 0) : 0);
      if (date >= roughStart && date <= roughEnd) p -= 0.35;
      if (habit.schedule.kind === 'timesPerWeek') p *= habit.schedule.times / 7 + 0.15;

      const r = rand();
      const entry = (status: Entry['status'], value: number, extra: Partial<Entry> = {}): Entry => ({
        ...base,
        id: uuid(),
        habitId: habit.id,
        date,
        status,
        value,
        note: '',
        ...extra,
      });

      if (r < p) {
        const value = habit.type === 'check' || habit.type === 'avoid' ? 1 : Math.round(habit.target * (1 + rand() * 0.3));
        const extra: Partial<Entry> = {};
        if (spec.workout) {
          sessionIndex++;
          const picks = [EXERCISES[sessionIndex % 2 === 0 ? 0 : 1]!, EXERCISES[2 + (sessionIndex % 3)]!];
          extra.workout = picks.map((ex): WorkoutExercise => {
            const weight = ex.base + Math.floor(sessionIndex / 6) * ex.step;
            return { name: ex.name, sets: [5, 5, 5].map((reps) => ({ reps, weight })) };
          });
        }
        if (rand() < 0.06) extra.note = pickNote(rand);
        entries.push(entry('done', value, extra));
      } else if (r < p + 0.06 && habit.minimumVersion) {
        entries.push(entry('minimum', habit.type === 'check' || habit.type === 'avoid' ? 1 : Math.max(1, Math.round(habit.target * 0.3))));
      } else if (r < p + 0.12 && habit.type !== 'check' && habit.type !== 'avoid') {
        entries.push(entry('partial', Math.max(1, Math.round(habit.target * (0.3 + rand() * 0.5)))));
      } else if (r < p + 0.16) {
        entries.push(entry('skipped', 0));
      }
      // Otherwise: no entry → missed.
    });
  }

  const dailyNotes: DailyNote[] = days_
    .filter(() => rand() < 0.55)
    .map((date) => {
      const rough = date >= roughStart && date <= roughEnd;
      const mood = clamp5(Math.round(3.4 + (rand() - 0.5) * 2.2 - (rough ? 1.2 : 0)));
      const energy = clamp5(Math.round(3.2 + (rand() - 0.5) * 2.4 - (rough ? 1 : 0)));
      return { ...base, id: uuid(), date, mood, energy, text: rand() < 0.5 ? pickNote(rand) : '' };
    });

  const gym = habits.find((h) => h.name === 'Strength training')!;
  const deep = habits.find((h) => h.name === 'Deep work block')!;
  const read = habits.find((h) => h.name === 'Read')!;
  const goals: Goal[] = [
    {
      ...base,
      id: uuid(),
      title: 'Bench 100 kg',
      why: 'Prove to myself I can stick with a program',
      deadline: shiftDate(todayDate, 220),
      metric: 'Bench press 1RM (kg)',
      targetValue: 100,
      currentValue: 85,
      status: 'active',
      milestones: [
        { id: uuid(), title: 'Bench 80 kg', done: true },
        { id: uuid(), title: 'Bench 90 kg', done: false },
        { id: uuid(), title: 'Bench 100 kg', done: false },
      ],
      habitIds: [gym.id],
    },
    {
      ...base,
      id: uuid(),
      title: 'Finish thesis draft',
      why: 'Graduate on time',
      deadline: shiftDate(todayDate, 120),
      metric: 'Chapters drafted',
      targetValue: 6,
      currentValue: 3,
      status: 'active',
      milestones: [
        { id: uuid(), title: 'Literature review', done: true },
        { id: uuid(), title: 'Methods chapter', done: true },
        { id: uuid(), title: 'Results chapter', done: false },
      ],
      habitIds: [deep.id, read.id],
    },
  ];
  for (const g of goals) for (const hid of g.habitIds) habits.find((h) => h.id === hid)!.goalIds.push(g.id);

  return { sections, habits, entries, dailyNotes, goals };
}

const NOTES = [
  'Slept badly, still showed up.',
  'Felt great today.',
  'Busy day at work.',
  'Low energy after lunch.',
  'Good focus in the morning.',
  'Travel day, kept it light.',
  'Friends over, late night.',
  'Proud of this one.',
];

function pickNote(rand: () => number): string {
  return NOTES[Math.floor(rand() * NOTES.length)]!;
}

function clamp5(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5;
}

/** Replaces everything on the device with demo data. */
export async function loadDemoData(): Promise<void> {
  const data = generateDemoData();
  await eraseAll();
  await db.transaction('rw', [db.sections, db.habits, db.entries, db.dailyNotes, db.goals], async () => {
    await db.sections.bulkAdd(data.sections);
    await db.habits.bulkAdd(data.habits);
    await db.entries.bulkAdd(data.entries);
    await db.dailyNotes.bulkAdd(data.dailyNotes);
    await db.goals.bulkAdd(data.goals);
  });
  await updateSettings({ onboardingDone: true });
}
