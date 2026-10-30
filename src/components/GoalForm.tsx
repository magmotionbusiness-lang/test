import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/db/db';
import { createGoal, setHabitGoalLink, updateGoal } from '@/db/repo';
import type { Goal, Milestone } from '@/db/types';
import { today } from '@/domain/dates';
import { uuid } from '@/lib/id';
import { FormGroup, TextField } from './form';
import { Sheet } from './Sheet';
import { toast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
  onCreated?: (id: string) => void;
}

/** Manual goal creation and editing (the AI planner is the default path). */
export function GoalForm({ open, onClose, goal, onCreated }: Props) {
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).sortBy('name'), []) ?? [];
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [deadline, setDeadline] = useState('');
  const [metric, setMetric] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestone, setNewMilestone] = useState('');
  const [linked, setLinked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setWhy(goal?.why ?? '');
    setDeadline(goal?.deadline ?? '');
    setMetric(goal?.metric ?? '');
    setTarget(goal?.targetValue != null ? String(goal.targetValue) : '');
    setCurrent(goal?.currentValue != null ? String(goal.currentValue) : '');
    setMilestones(goal?.milestones ?? []);
    setLinked(goal?.habitIds ?? []);
    setNewMilestone('');
  }, [open, goal]);

  const num = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s.replace(',', '.'))) ? null : Number(s.replace(',', '.')));
  const valid = title.trim() !== '';

  const save = async () => {
    if (!valid) return;
    const extra = newMilestone.trim() ? [{ id: uuid(), title: newMilestone.trim(), done: false }] : [];
    const data = {
      title: title.trim(),
      why: why.trim(),
      deadline: deadline || null,
      metric: metric.trim(),
      targetValue: num(target),
      currentValue: num(current),
      milestones: [...milestones, ...extra],
    };
    if (goal) {
      await updateGoal(goal.id, data);
      for (const id of new Set([...goal.habitIds, ...linked])) await setHabitGoalLink(id, goal.id, linked.includes(id));
      toast('Goal saved');
    } else {
      const g = await createGoal({ ...data, status: 'active', habitIds: [] });
      for (const id of linked) await setHabitGoalLink(id, g.id, true);
      toast(`${g.title} added`);
      onCreated?.(g.id);
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? 'Edit Goal' : 'New Goal'}
      action={
        <button onClick={save} disabled={!valid} className="text-headline text-accent disabled:opacity-30">
          {goal ? 'Save' : 'Add'}
        </button>
      }
    >
      <FormGroup>
        <TextField label="Goal" value={title} onChange={setTitle} placeholder="Goal, e.g. Bench 100 kg" autoFocus={!goal} />
        <TextField label="Why" value={why} onChange={setWhy} placeholder="Why it matters" maxLength={200} />
        <label className="flex min-h-[44px] items-center gap-3 px-4">
          <span className="flex-1 text-body">Deadline</span>
          <input
            type="date"
            value={deadline}
            min={today()}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-transparent text-body text-secondary outline-none"
          />
        </label>
      </FormGroup>

      <FormGroup header="Measure" footer="Optional. Progress is current ÷ target; without a target, milestones show progress.">
        <TextField label="Metric" value={metric} onChange={setMetric} placeholder="Metric, e.g. Bench 1RM (kg)" />
        <NumberRow label="Current" value={current} onChange={setCurrent} />
        <NumberRow label="Target" value={target} onChange={setTarget} />
      </FormGroup>

      <FormGroup header="Milestones">
        {milestones.map((m) => (
          <div key={m.id} className="flex min-h-[44px] items-center gap-2 px-4">
            <input
              value={m.title}
              onChange={(e) => setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
              aria-label="Milestone"
              className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none"
            />
            <button
              onClick={() => setMilestones((ms) => ms.filter((x) => x.id !== m.id))}
              className="flex h-11 w-9 items-center justify-center text-tertiary"
              aria-label={`Remove ${m.title}`}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div className="flex min-h-[44px] items-center gap-2 px-4">
          <input
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newMilestone.trim()) {
                setMilestones((ms) => [...ms, { id: uuid(), title: newMilestone.trim(), done: false }]);
                setNewMilestone('');
              }
            }}
            placeholder="Add a milestone"
            className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none"
          />
          <button
            disabled={!newMilestone.trim()}
            onClick={() => {
              setMilestones((ms) => [...ms, { id: uuid(), title: newMilestone.trim(), done: false }]);
              setNewMilestone('');
            }}
            className="flex h-11 w-9 items-center justify-center text-accent disabled:opacity-30"
            aria-label="Add milestone"
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </FormGroup>

      {habits.length > 0 && (
        <FormGroup header="Linked habits">
          {habits.map((h) => {
            const on = linked.includes(h.id);
            return (
              <button
                key={h.id}
                role="checkbox"
                aria-checked={on}
                onClick={() => setLinked((l) => (on ? l.filter((x) => x !== h.id) : [...l, h.id]))}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left"
              >
                <span aria-hidden>{h.emoji}</span>
                <span className="flex-1 text-body">{h.name}</span>
                {on && <Check size={18} className="text-accent" aria-hidden />}
              </button>
            );
          })}
        </FormGroup>
      )}
    </Sheet>
  );
}

function NumberRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4">
      <span className="flex-1 text-body">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
        placeholder="—"
        className="tabular w-28 bg-transparent text-right text-body text-secondary outline-none"
      />
    </label>
  );
}
