import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import { useSettings } from '@/app/useSettings';
import { Page } from '@/components/Page';
import { EmptyState, ListGroup, PrimaryButton, ProgressRing } from '@/components/ui';
import { formatDay, shiftDate, today } from '@/domain/dates';
import { TIME_OF_DAY_LABEL, todayGroups } from '@/domain/today';
import { colorVar } from '@/lib/colors';

export function HomeScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const date = today();

  const data = useLiveQuery(async () => {
    const [habits, sections, entries] = await Promise.all([
      db.habits.filter((h) => !h.archived).toArray(),
      db.sections.toArray(),
      // 31 days covers both weekly and monthly quota windows.
      db.entries.where('date').between(shiftDate(date, -31), date, true, true).toArray(),
    ]);
    return { habits, sections, entries };
  }, [date]);

  const groups = data ? todayGroups(data.habits, data.entries, date, settings.weekStart) : [];
  const all = groups.flatMap((g) => g.items);
  const doneCount = all.filter((i) => i.completed).length;
  const sectionColor = new Map(data?.sections.map((s) => [s.id, s.color]) ?? []);

  return (
    <Page
      title="Today"
      subtitle={formatDay(date, 'EEEE, d MMMM')}
      titleAccessory={
        all.length > 0 && (
          <div className="flex items-center gap-2 pb-1">
            <span className="tabular text-subhead text-secondary">
              {doneCount}/{all.length}
            </span>
            <ProgressRing value={doneCount} total={all.length} size={36} stroke={4.5} label={`${doneCount} of ${all.length} habits done today`} />
          </div>
        )
      }
    >
      {data && data.habits.length === 0 && (
        <EmptyState
          title="Nothing to track yet"
          message="Add your first habit, or load demo data from Settings to explore the app."
          action={<PrimaryButton onClick={() => navigate('/settings')}>Open Settings</PrimaryButton>}
        />
      )}

      {data && data.habits.length > 0 && all.length === 0 && (
        <EmptyState title="A free day" message="No habits are scheduled for today. Enjoy the rest." />
      )}

      {groups.map((g) => (
        <ListGroup key={g.timeOfDay} header={TIME_OF_DAY_LABEL[g.timeOfDay]}>
          {g.items.map(({ habit, completed, entry }) => (
            <div key={habit.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
              <span className="text-[22px] leading-none" aria-hidden>
                {habit.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-body ${completed ? 'text-secondary' : ''}`}>{habit.name}</span>
                <span className="flex items-center gap-1.5 text-footnote text-secondary">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: colorVar(sectionColor.get(habit.sectionId) ?? habit.color) }}
                    aria-hidden
                  />
                  {habit.type === 'check' || habit.type === 'avoid'
                    ? habit.cue || ' '
                    : `${entry?.value ?? 0} / ${habit.target} ${habit.unit}`}
                </span>
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: colorVar(habit.color),
                  background: completed ? colorVar(habit.color) : 'transparent',
                }}
                role="img"
                aria-label={completed ? `${habit.name}: done` : `${habit.name}: not done`}
              >
                {completed && <Check size={18} strokeWidth={3} className="text-white" aria-hidden />}
              </span>
            </div>
          ))}
        </ListGroup>
      ))}
    </Page>
  );
}
