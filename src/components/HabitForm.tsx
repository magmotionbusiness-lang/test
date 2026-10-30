import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import { createHabit, nextOrder, updateHabit } from '@/db/repo';
import type { Habit, HabitColor, HabitType, Schedule, TimeOfDay, Weekday } from '@/db/types';
import { today } from '@/domain/dates';
import { Segmented } from './ui';
import { Sheet } from './Sheet';
import { ColorPicker, EmojiField, FieldRow, FormGroup, SelectRow, Stepper, TextField, WeekdayPicker } from './form';
import { toast } from './Toast';

type Draft = Pick<
  Habit,
  | 'name'
  | 'emoji'
  | 'color'
  | 'type'
  | 'target'
  | 'unit'
  | 'schedule'
  | 'timeOfDay'
  | 'minimumVersion'
  | 'cue'
  | 'why'
  | 'sectionId'
  | 'startDate'
  | 'reminderTime'
>;

const TYPE_OPTIONS: { value: HabitType; label: string }[] = [
  { value: 'check', label: 'Check' },
  { value: 'count', label: 'Count' },
  { value: 'duration', label: 'Time' },
  { value: 'numeric', label: 'Number' },
  { value: 'avoid', label: 'Avoid' },
];

const TYPE_HELP: Record<HabitType, string> = {
  check: 'Done or not done. One tap.',
  count: 'Tap to add one (e.g. glasses of water). Hold for an exact number.',
  duration: 'Minutes spent. Tap logs your target; tap the row for an exact time.',
  numeric: 'Any number with a unit, like pages or kilometres.',
  avoid: 'A habit to break. Tap means “stayed clean today”.',
};

const DEFAULT_UNIT: Record<HabitType, string> = { check: '', count: 'times', duration: 'min', numeric: 'units', avoid: '' };
const DEFAULT_TARGET: Record<HabitType, number> = { check: 1, count: 8, duration: 15, numeric: 10, avoid: 1 };

type ScheduleKind = Schedule['kind'];

function blankDraft(sectionId: string, color: HabitColor): Draft {
  return {
    name: '',
    emoji: '✨',
    color,
    type: 'check',
    target: 1,
    unit: '',
    schedule: { kind: 'daily' },
    timeOfDay: 'anytime',
    minimumVersion: '',
    cue: '',
    why: '',
    sectionId,
    startDate: today(),
    reminderTime: null,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this habit; omit to create a new one. */
  habit?: Habit;
  /** Preselected section when creating. */
  sectionId?: string;
}

export function HabitForm({ open, onClose, habit, sectionId }: Props) {
  const settings = useSettings();
  const sections =
    useLiveQuery(
      () =>
        db.sections
          .orderBy('order')
          .filter((s) => !s.archived)
          .toArray(),
      [],
    ) ?? [];
  const [d, setD] = useState<Draft>(() => blankDraft(sectionId ?? '', 'blue'));

  useEffect(() => {
    if (!open) return;
    if (habit) setD({ ...habit });
    else {
      const sec = sections.find((s) => s.id === sectionId) ?? sections[0];
      setD(blankDraft(sec?.id ?? '', sec?.color ?? 'blue'));
    }
    // Only reset when the sheet opens (or a different habit is edited).
  }, [open, habit?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const quantity = d.type === 'count' || d.type === 'duration' || d.type === 'numeric';
  const scheduleOk = d.schedule.kind !== 'weekdays' || d.schedule.days.length > 0;
  const valid = d.name.trim() !== '' && d.sectionId !== '' && scheduleOk && (!quantity || d.target > 0);

  const setType = (type: HabitType) =>
    setD((p) => ({ ...p, type, target: p.type === type ? p.target : DEFAULT_TARGET[type], unit: p.type === type ? p.unit : DEFAULT_UNIT[type] }));

  const setScheduleKind = (kind: ScheduleKind) => {
    const s: Schedule =
      kind === 'daily'
        ? { kind }
        : kind === 'weekdays'
          ? { kind, days: [1, 2, 3, 4, 5] }
          : kind === 'timesPerWeek'
            ? { kind, times: 3 }
            : { kind, times: 8 };
    set('schedule', s);
  };

  const save = async () => {
    if (!valid) return;
    const data = { ...d, name: d.name.trim(), emoji: d.emoji || '✨' };
    if (habit) {
      await updateHabit(habit.id, data);
      toast('Habit saved');
    } else {
      await createHabit({ ...data, goalIds: [], archived: false, order: await nextOrder('habits', d.sectionId) });
      toast(`${data.name} added`);
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? 'Edit Habit' : 'New Habit'}
      action={
        <button onClick={save} disabled={!valid} className="text-headline text-accent disabled:opacity-30">
          {habit ? 'Save' : 'Add'}
        </button>
      }
    >
      <FormGroup>
        <TextField label="Name" value={d.name} onChange={(v) => set('name', v)} placeholder="Name, e.g. Read" autoFocus={!habit} />
        <EmojiField value={d.emoji} onChange={(v) => set('emoji', v)} />
      </FormGroup>

      <FormGroup header="Section">
        {sections.length > 0 ? (
          <SelectRow
            label="Section"
            value={d.sectionId}
            onChange={(v) => set('sectionId', v)}
            options={sections.map((s) => ({ value: s.id, label: `${s.emoji} ${s.name}` }))}
          />
        ) : (
          <p className="px-4 py-3 text-subhead text-secondary">Create a section first.</p>
        )}
      </FormGroup>

      <FormGroup header="Color">
        <ColorPicker value={d.color} onChange={(c) => set('color', c)} />
      </FormGroup>

      <FormGroup header="Type" footer={TYPE_HELP[d.type]}>
        <div className="px-3 py-3">
          <Segmented label="Habit type" value={d.type} onChange={setType} options={TYPE_OPTIONS} />
        </div>
        {quantity && (
          <>
            <FieldRow label="Daily target">
              <Stepper
                label="target"
                value={d.target}
                onChange={(v) => set('target', v)}
                step={d.target >= 100 ? 50 : d.target >= 20 ? 5 : 1}
                max={100000}
              />
            </FieldRow>
            <TextField label="Unit" value={d.unit} onChange={(v) => set('unit', v)} placeholder="Unit, e.g. pages" maxLength={16} />
          </>
        )}
      </FormGroup>

      <FormGroup header="Schedule">
        <div className="px-3 py-3">
          <Segmented<ScheduleKind>
            label="Schedule"
            value={d.schedule.kind}
            onChange={setScheduleKind}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekdays', label: 'Days' },
              { value: 'timesPerWeek', label: 'Weekly' },
              { value: 'timesPerMonth', label: 'Monthly' },
            ]}
          />
        </div>
        {d.schedule.kind === 'weekdays' && (
          <WeekdayPicker
            weekStart={settings.weekStart}
            value={d.schedule.days}
            onChange={(days: Weekday[]) => set('schedule', { kind: 'weekdays', days })}
          />
        )}
        {(d.schedule.kind === 'timesPerWeek' || d.schedule.kind === 'timesPerMonth') && (
          <FieldRow label={d.schedule.kind === 'timesPerWeek' ? 'Times per week' : 'Times per month'}>
            <Stepper
              label="times"
              value={d.schedule.times}
              max={d.schedule.kind === 'timesPerWeek' ? 7 : 31}
              onChange={(times) => set('schedule', { kind: d.schedule.kind as 'timesPerWeek' | 'timesPerMonth', times })}
            />
          </FieldRow>
        )}
        <SelectRow<TimeOfDay>
          label="Time of day"
          value={d.timeOfDay}
          onChange={(v) => set('timeOfDay', v)}
          options={[
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
            { value: 'evening', label: 'Evening' },
            { value: 'anytime', label: 'Anytime' },
          ]}
        />
        <label className="flex min-h-[44px] items-center gap-3 px-4">
          <span className="flex-1 text-body">Start date</span>
          <input
            type="date"
            value={d.startDate}
            max={today()}
            onChange={(e) => e.target.value && set('startDate', e.target.value)}
            className="bg-transparent text-body text-secondary outline-none"
          />
        </label>
      </FormGroup>

      <FormGroup header="Make it stick" footer="A minimum version still counts on a bad day. A cue ties the habit to something you already do.">
        <TextField
          label="Minimum version"
          value={d.minimumVersion}
          onChange={(v) => set('minimumVersion', v)}
          placeholder="Minimum version, e.g. 1 page"
        />
        <TextField label="Cue" value={d.cue} onChange={(v) => set('cue', v)} placeholder="Cue, e.g. After my morning coffee" />
        <TextField label="Why" value={d.why} onChange={(v) => set('why', v)} placeholder="Why it matters to you" maxLength={140} />
      </FormGroup>
    </Sheet>
  );
}
