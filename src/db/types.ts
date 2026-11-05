/** Local calendar day, always `YYYY-MM-DD`. Never a UTC timestamp. */
export type LocalDate = string;
export type ISODateTime = string;
export type UUID = string;

export interface BaseRecord {
  id: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type HabitColor = 'red' | 'orange' | 'yellow' | 'green' | 'mint' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'purple' | 'pink' | 'brown';

export interface Section extends BaseRecord {
  name: string;
  emoji: string;
  color: HabitColor;
  order: number;
  description: string;
  /** Section-level kind; `gym` unlocks workout analytics. */
  kind: 'standard' | 'gym';
  archived: boolean;
}

export type HabitType = 'check' | 'count' | 'duration' | 'numeric' | 'avoid';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, like Date#getDay

export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'timesPerWeek'; times: number }
  | { kind: 'timesPerMonth'; times: number };

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit extends BaseRecord {
  sectionId: UUID;
  name: string;
  emoji: string;
  color: HabitColor;
  type: HabitType;
  /** Daily target for count/duration/numeric. 1 for check/avoid. */
  target: number;
  unit: string;
  schedule: Schedule;
  timeOfDay: TimeOfDay;
  minimumVersion: string;
  cue: string;
  why: string;
  /** `HH:mm`, informational in v1 (iOS web push is out of scope). */
  reminderTime: string | null;
  goalIds: UUID[];
  startDate: LocalDate;
  archived: boolean;
  order: number;
}

export type EntryStatus = 'done' | 'partial' | 'minimum' | 'skipped' | 'missed';

export interface WorkoutSet {
  reps: number;
  weight: number;
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

export interface Entry extends BaseRecord {
  habitId: UUID;
  date: LocalDate;
  value: number;
  status: EntryStatus;
  note: string;
  /** True when a streak freeze was spent to cover an unplanned miss. */
  freeze?: boolean;
  workout?: WorkoutExercise[];
}

export interface DailyNote extends BaseRecord {
  date: LocalDate;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  energy: 1 | 2 | 3 | 4 | 5 | null;
  text: string;
}

export interface Milestone {
  id: UUID;
  title: string;
  done: boolean;
}

export interface Goal extends BaseRecord {
  title: string;
  why: string;
  deadline: LocalDate | null;
  metric: string;
  targetValue: number | null;
  currentValue: number | null;
  status: 'active' | 'achieved' | 'abandoned';
  milestones: Milestone[];
  habitIds: UUID[];
  /** The AI plan JSON that created this goal, if any. */
  plan?: unknown;
}

export type ReviewScope = 'day' | 'week' | 'month' | 'custom' | 'section' | 'goal';

export interface AIReview extends BaseRecord {
  scope: ReviewScope;
  rangeStart: LocalDate;
  rangeEnd: LocalDate;
  /** Optional subject (section or goal id) for scoped reviews. */
  subjectId?: UUID;
  inputHash: string;
  result: unknown;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  weekStart: 0 | 1;
  accent: HabitColor;
  aiDailyLimit: number;
  aiCallsToday: number;
  aiCallsDate: LocalDate | null;
  includeNotesInAI: boolean;
  onboardingDone: boolean;
  installGuideSeen: boolean;
  /** Show today's remaining habit count on the Home Screen icon. */
  appBadge?: boolean;
  /** Name used in the Home greeting; unset means the default name, '' means no name. */
  userName?: string;
  /** 'full' (default) always animates; 'system' follows iOS Reduce Motion. */
  motion?: 'full' | 'system';
  /** When the user's own sound plays: when everything is done (default) or on every completed habit. */
  customSoundOn?: 'all' | 'each';
  /** Short pop when tapping Done (default on). */
  tapSound?: boolean;
  /** Play a sound when every habit due today is done (default on). */
  completionSound?: boolean;
  /** Display name of the user's own completion sound, if they chose one. */
  completionSoundName?: string | null;
  /** The vision board's starter sections were created once (so deleting them all keeps them deleted). */
  visionSeeded?: boolean;
  lastBackupAt: ISODateTime | null;
  updatedAt: ISODateTime;
}

/** One tile of the vision board: a dream, its photo and the words that keep it alive. */
export interface VisionSection extends BaseRecord {
  title: string;
  emoji: string;
  color: HabitColor;
  description: string;
  /** Id of the photo in `blobs`, or null. */
  photoId: string | null;
  /** The photo's width ÷ height, used to place it in the frame. */
  photoAspect: number | null;
  /** Which part of the photo shows in the 4:5 frame, 0–100 on each axis. */
  focusX: number;
  focusY: number;
  /** "Progression" dots, 0–4. */
  progress: number;
  goalId: UUID | null;
  order: number;
  /** The latest AI breakdown of what moves this forward. */
  breakdown?: unknown;
}

export interface StoredBlob {
  id: string;
  blob: Blob;
  updatedAt: ISODateTime;
}
