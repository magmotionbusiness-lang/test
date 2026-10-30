import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Ellipsis, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/db';
import { deleteSection, reorder, updateHabit, updateSection } from '@/db/repo';
import { ActionSheet } from '@/components/ActionSheet';
import { HabitForm } from '@/components/HabitForm';
import { NavButton, Page } from '@/components/Page';
import { ReorderList } from '@/components/ReorderList';
import { SectionForm } from '@/components/SectionForm';
import { toast } from '@/components/Toast';
import { EmptyState, ListGroup, ListRow, PrimaryButton } from '@/components/ui';
import { describeSchedule } from '@/domain/schedule';
import { useSettings } from '@/app/useSettings';

export function SectionScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const [menu, setMenu] = useState(false);
  const [editSection, setEditSection] = useState(false);
  const [habitForm, setHabitForm] = useState(false);
  const [reordering, setReordering] = useState(false);

  const data = useLiveQuery(async () => {
    const section = await db.sections.get(id);
    const habits = await db.habits.where('sectionId').equals(id).sortBy('order');
    return { section, habits };
  }, [id]);

  if (data && !data.section) {
    return (
      <Page title="Section" backLabel="Sections">
        <EmptyState title="Section not found" message="It may have been deleted." />
      </Page>
    );
  }

  const section = data?.section;
  const active = data?.habits.filter((h) => !h.archived) ?? [];
  const archived = data?.habits.filter((h) => h.archived) ?? [];

  const onArchive = async () => {
    if (!section) return;
    await updateSection(section.id, { archived: true });
    navigate(-1);
    toast(`${section.name} archived`, () => updateSection(section.id, { archived: false }));
  };

  const onDelete = async () => {
    if (!section) return;
    if (!window.confirm(`Delete “${section.name}” and all ${data?.habits.length ?? 0} of its habits, including their history? This can’t be undone.`)) return;
    await deleteSection(section.id);
    navigate(-1);
  };

  return (
    <Page
      title={section ? `${section.emoji} ${section.name}` : ''}
      subtitle={section?.description}
      backLabel="Sections"
      actions={
        <>
          <NavButton label="New habit in this section" onClick={() => setHabitForm(true)}>
            <Plus size={26} aria-hidden />
          </NavButton>
          <NavButton label="Section options" onClick={() => setMenu(true)}>
            <Ellipsis size={24} aria-hidden />
          </NavButton>
        </>
      }
    >
      {data && active.length === 0 && (
        <EmptyState title="No habits here yet" message="Add the first habit to this section." action={<PrimaryButton onClick={() => setHabitForm(true)}>Add a habit</PrimaryButton>} />
      )}

      {active.length > 0 && (
        <section className="mb-8">
          <div className="mb-1.5 flex items-end justify-between px-4">
            <h2 className="text-footnote uppercase text-secondary">Habits</h2>
            {active.length > 1 && (
              <button onClick={() => setReordering((r) => !r)} className="-my-2 h-9 text-footnote font-medium text-accent">
                {reordering ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>
          <ReorderList
            items={active}
            editing={reordering}
            onReorder={(ids) => reorder('habits', ids)}
            className="overflow-hidden rounded-row bg-bg-2 shadow-card [&>*+*]:border-t [&>*+*]:border-[rgb(var(--separator)/0.29)]"
            itemClassName="bg-bg-2"
            render={(h) => (
              <button onClick={() => !reordering && navigate(`/habits/${h.id}`)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left">
                <span className="text-[24px] leading-none" aria-hidden>
                  {h.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">{h.name}</span>
                  <span className="block truncate text-footnote text-secondary">
                    {describeSchedule(h.schedule, settings.weekStart)}
                    {h.type !== 'check' && h.type !== 'avoid' ? ` · ${h.target} ${h.unit}` : h.type === 'avoid' ? ' · Avoid' : ''}
                  </span>
                </span>
                {!reordering && <ChevronRight size={18} className="shrink-0 text-tertiary" aria-hidden />}
              </button>
            )}
          />
        </section>
      )}

      {archived.length > 0 && (
        <ListGroup header="Archived">
          {archived.map((h) => (
            <ListRow
              key={h.id}
              icon={<span className="text-[22px] opacity-50">{h.emoji}</span>}
              title={<span className="text-secondary">{h.name}</span>}
              detail={<span className="text-accent">Restore</span>}
              onClick={() => updateHabit(h.id, { archived: false })}
            />
          ))}
        </ListGroup>
      )}

      <p className="px-4 text-center text-footnote text-secondary">Section charts and analytics arrive in a later update.</p>

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={section?.name}
        actions={[
          { label: 'Edit section', onSelect: () => setEditSection(true) },
          { label: 'Archive section', onSelect: onArchive },
          { label: 'Delete section', destructive: true, onSelect: onDelete },
        ]}
      />
      <SectionForm open={editSection} onClose={() => setEditSection(false)} section={section} />
      <HabitForm open={habitForm} onClose={() => setHabitForm(false)} sectionId={id} />
    </Page>
  );
}
