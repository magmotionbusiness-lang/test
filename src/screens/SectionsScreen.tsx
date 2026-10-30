import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import { reorder } from '@/db/repo';
import { NavButton, Page } from '@/components/Page';
import { ReorderList } from '@/components/ReorderList';
import { SectionForm } from '@/components/SectionForm';
import { EmptyState, PrimaryButton } from '@/components/ui';
import { colorVar } from '@/lib/colors';
import { formatPercent } from '@/lib/format';
import { useSettings } from '@/app/useSettings';
import { TileGrid } from '@/components/TileGrid';
import { dailyShare } from '@/domain/aggregate';
import { weekOverWeek } from '@/domain/analytics';
import { shiftDate, today as todayFn } from '@/domain/dates';

export function SectionsScreen() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const settings = useSettings();
  const today = todayFn();

  const data = useLiveQuery(async () => {
    const [sections, habits, entries] = await Promise.all([
      db.sections
        .orderBy('order')
        .filter((s) => !s.archived)
        .toArray(),
      db.habits.filter((h) => !h.archived).toArray(),
      db.entries.where('date').between(shiftDate(today, -90), today, true, true).toArray(),
    ]);
    return { sections, habits, entries };
  }, [today]);

  return (
    <Page
      title="Sections"
      actions={
        <>
          {data && data.sections.length > 1 && (
            <button onClick={() => setEditing((e) => !e)} className={`h-11 px-2 text-body text-accent ${editing ? 'font-semibold' : ''}`}>
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          <NavButton label="New section" onClick={() => setFormOpen(true)}>
            <Plus size={26} aria-hidden />
          </NavButton>
        </>
      }
    >
      {data && data.sections.length === 0 && (
        <EmptyState
          title="No sections yet"
          message="Sections group your habits: Gym, Study, Mindset, or anything you like."
          action={<PrimaryButton onClick={() => setFormOpen(true)}>Add a section</PrimaryButton>}
        />
      )}
      {data && (
        <ReorderList
          items={data.sections}
          editing={editing}
          onReorder={(ids) => reorder('sections', ids)}
          className="grid gap-3"
          itemClassName="rounded-card bg-bg-2 shadow-card"
          render={(s) => {
            const habits = data.habits.filter((h) => h.sectionId === s.id);
            const count = habits.length;
            const week = weekOverWeek(habits, data.entries, today, settings.weekStart).thisWeek;
            return (
              <div className="p-4">
                <button
                  onClick={() => !editing && navigate(`/sections/${s.id}`)}
                  className="flex w-full items-center gap-3 text-left"
                  aria-label={`${s.name}, ${count} habits`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[24px]"
                    style={{ background: `color-mix(in srgb, ${colorVar(s.color)} 18%, transparent)` }}
                    aria-hidden
                  >
                    {s.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline">{s.name}</span>
                    <span className="block truncate text-footnote text-secondary">
                      {count} {count === 1 ? 'habit' : 'habits'}
                      {s.description ? ` · ${s.description}` : ''}
                    </span>
                  </span>
                  {week !== null && (
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-headline">{formatPercent(week)}</span>
                      <span className="block text-caption text-secondary">this week</span>
                    </span>
                  )}
                  {!editing && <ChevronRight size={18} className="shrink-0 text-tertiary" aria-hidden />}
                </button>
                {!editing && habits.length > 0 && (
                  <div className="mt-3">
                    <TileGrid
                      color={colorVar(s.color)}
                      tiles={dailyShare(habits, data.entries, shiftDate(today, -83), today, settings.weekStart)}
                      start={shiftDate(today, -83)}
                      today={today}
                      weekStart={settings.weekStart}
                      size="compact"
                      mode="intensity"
                      label={`${s.name}, last 12 weeks`}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
      <SectionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Page>
  );
}
