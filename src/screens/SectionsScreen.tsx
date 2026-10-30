import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Page } from '@/components/Page';
import { Card, EmptyState } from '@/components/ui';
import { colorVar } from '@/lib/colors';

export function SectionsScreen() {
  const data = useLiveQuery(async () => {
    const [sections, habits] = await Promise.all([
      db.sections.orderBy('order').filter((s) => !s.archived).toArray(),
      db.habits.filter((h) => !h.archived).toArray(),
    ]);
    return { sections, habits };
  }, []);

  return (
    <Page title="Sections">
      {data && data.sections.length === 0 && (
        <EmptyState title="No sections yet" message="Sections group your habits — Gym, Study, Mindset, or anything you like." />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.sections.map((s) => {
          const count = data.habits.filter((h) => h.sectionId === s.id).length;
          return (
            <Card key={s.id}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-[12px] text-[24px]"
                  style={{ background: `color-mix(in srgb, ${colorVar(s.color)} 18%, transparent)` }}
                  aria-hidden
                >
                  {s.emoji}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-headline">{s.name}</h2>
                  <p className="text-footnote text-secondary">
                    {count} {count === 1 ? 'habit' : 'habits'}
                    {s.description ? ` · ${s.description}` : ''}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
