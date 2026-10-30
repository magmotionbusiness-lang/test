import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AIError, callAI } from '@/ai/client';
import type { GoalPlanResult, GoalQuestionsResult, PlanHabit } from '@/ai/schemas';
import { useOnline } from '@/app/useOnline';
import { db } from '@/db/db';
import { createGoal, createHabit, createSection, nextOrder, setHabitGoalLink } from '@/db/repo';
import type { HabitColor, Schedule } from '@/db/types';
import { today as todayFn } from '@/domain/dates';
import { describeSchedule } from '@/domain/schedule';
import { COLOR_NAMES } from '@/lib/colors';
import { uuid } from '@/lib/id';
import { FormGroup, TextField } from './form';
import { ErrorCard, SkeletonCards } from './ReviewCards';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { Card, PrimaryButton } from './ui';

type Step = 'input' | 'questions' | 'plan';
const MAX_NEW = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onCreated: (goalId: string) => void;
}

/** Goal → clarifying questions → plan of habits the user accepts one by one. */
export function GoalPlanner({ open, onClose, onManual, onCreated }: Props) {
  const online = useOnline();
  const today = todayFn();
  const existing = useLiveQuery(async () => {
    const [habits, sections] = await Promise.all([db.habits.filter((h) => !h.archived).toArray(), db.sections.filter((s) => !s.archived).toArray()]);
    return { habits, sections };
  }, []);

  const [step, setStep] = useState<Step>('input');
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [why, setWhy] = useState('');
  const [questions, setQuestions] = useState<GoalQuestionsResult['questions']>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<GoalPlanResult | null>(null);
  const [accepted, setAccepted] = useState<boolean[]>([]);
  const [edits, setEdits] = useState<Partial<PlanHabit>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; offline: boolean; retry: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('input');
    setGoal('');
    setDeadline('');
    setWhy('');
    setQuestions([]);
    setAnswers({});
    setPlan(null);
    setError(null);
  }, [open]);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError('Something went wrong. Please try again.', 'failed');
      setError({ message: err.message, offline: err.kind === 'offline', retry: () => void run(fn) });
    } finally {
      setLoading(false);
    }
  };

  const askQuestions = () =>
    run(async () => {
      const r = await callAI('goalQuestions', { goal: goal.trim(), deadline: deadline || null, why: why.trim(), today });
      setQuestions(r.questions);
      setStep(r.questions.length ? 'questions' : 'plan');
      if (!r.questions.length) await makePlan([]);
    });

  const makePlan = (qs = questions) =>
    run(async () => {
      const sectionName = new Map(existing?.sections.map((s) => [s.id, s.name]));
      const r = await callAI('goalPlan', {
        goal: goal.trim(),
        deadline: deadline || null,
        why: why.trim(),
        today,
        answers: qs.map((q) => ({ question: q.question, answer: answers[q.id]?.trim() || 'not answered' })),
        existingHabits: (existing?.habits ?? []).slice(0, 60).map((h) => ({
          id: h.id,
          name: h.name,
          section: sectionName.get(h.sectionId) ?? '',
          schedule: describeSchedule(h.schedule),
          ...(h.type !== 'check' && h.type !== 'avoid' ? { target: `${h.target} ${h.unit}` } : {}),
        })),
        sections: (existing?.sections ?? []).map((s) => s.name),
      });
      const validIds = new Set(existing?.habits.map((h) => h.id));
      const habits = r.habits.map((h) => ({ ...h, reuseHabitId: h.reuseHabitId && validIds.has(h.reuseHabitId) ? h.reuseHabitId : null }));
      setPlan({ ...r, habits });
      // Accept reused habits and the first three new ones by default.
      let n = 0;
      setAccepted(habits.map((h) => (h.reuseHabitId ? true : n++ < MAX_NEW)));
      setEdits(habits.map(() => ({})));
      setStep('plan');
    });

  const newAccepted = plan ? plan.habits.filter((h, i) => accepted[i] && !h.reuseHabitId).length : 0;

  const create = async () => {
    if (!plan) return;
    const g = await createGoal({
      title: plan.goal.title || goal.trim(),
      why: why.trim(),
      deadline: deadline || null,
      metric: plan.goal.metric,
      targetValue: plan.goal.targetValue,
      currentValue: plan.goal.currentValue,
      status: 'active',
      milestones: plan.milestones.map((t) => ({ id: uuid(), title: t, done: false })),
      habitIds: [],
      plan: { summary: plan.summary, request: { goal, deadline, why, answers } },
    });
    const sections = [...(existing?.sections ?? [])];
    let added = 0;
    for (let i = 0; i < plan.habits.length; i++) {
      if (!accepted[i]) continue;
      const h = { ...plan.habits[i]!, ...edits[i] };
      if (h.reuseHabitId) {
        await setHabitGoalLink(h.reuseHabitId, g.id, true);
        continue;
      }
      let section = sections.find((s) => s.name.toLowerCase() === h.sectionName.toLowerCase());
      if (!section) {
        const color: HabitColor = COLOR_NAMES[(sections.length * 5) % COLOR_NAMES.length]!;
        section = await createSection({
          name: h.sectionName,
          emoji: h.emoji,
          color,
          description: '',
          kind: /gym|lift|strength/i.test(h.sectionName) ? 'gym' : 'standard',
          order: await nextOrder('sections'),
          archived: false,
        });
        sections.push(section);
      }
      const habit = await createHabit({
        sectionId: section.id,
        name: h.name,
        emoji: h.emoji,
        color: section.color,
        type: h.type,
        target: h.type === 'check' || h.type === 'avoid' ? 1 : h.target,
        unit: h.type === 'check' || h.type === 'avoid' ? '' : h.unit,
        schedule: h.schedule as Schedule,
        timeOfDay: h.timeOfDay,
        minimumVersion: h.minimumVersion,
        cue: h.cue,
        why: h.why,
        reminderTime: null,
        goalIds: [],
        startDate: today,
        archived: false,
        order: await nextOrder('habits', section.id),
      });
      await setHabitGoalLink(habit.id, g.id, true);
      added++;
    }
    toast(`Goal created${added ? ` with ${added} new habit${added > 1 ? 's' : ''}` : ''}`);
    onCreated(g.id);
    onClose();
  };

  const title = step === 'input' ? 'New Goal' : step === 'questions' ? 'A few questions' : 'Your plan';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      action={
        step === 'plan' && plan && !loading ? (
          <button onClick={create} disabled={!accepted.some(Boolean)} className="text-headline text-accent disabled:opacity-30">
            Create
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <>
          <p className="mb-3 text-center text-subhead text-secondary">{step === 'input' ? 'Thinking about your goal…' : 'Building your plan…'}</p>
          <SkeletonCards />
        </>
      ) : error ? (
        <ErrorCard message={error.message} offline={error.offline} onRetry={error.retry} />
      ) : step === 'input' ? (
        <>
          <FormGroup footer="Be specific: a number and a date work best, e.g. “Bench 100 kg by June”.">
            <TextField label="Goal" value={goal} onChange={setGoal} placeholder="What do you want to achieve?" maxLength={200} autoFocus />
            <label className="flex min-h-[44px] items-center gap-3 px-4">
              <span className="flex-1 text-body">Deadline</span>
              <input
                type="date"
                value={deadline}
                min={today}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-transparent text-body text-secondary outline-none"
              />
            </label>
            <TextField label="Why" value={why} onChange={setWhy} placeholder="Why it matters (optional)" maxLength={300} />
          </FormGroup>
          <div className="flex flex-col items-center gap-3">
            <PrimaryButton onClick={askQuestions} disabled={!goal.trim() || !online}>
              <span className="flex items-center gap-2">
                <Sparkles size={18} aria-hidden /> Plan it with AI
              </span>
            </PrimaryButton>
            {!online && <p className="text-footnote text-secondary">You’re offline — the AI planner needs a connection.</p>}
            <button onClick={onManual} className="h-11 text-body text-accent">
              Create without AI
            </button>
          </div>
        </>
      ) : step === 'questions' ? (
        <>
          {questions.map((q) => (
            <section key={q.id} className="mb-5">
              <h3 className="mb-2 px-1 text-headline">{q.question}</h3>
              <div className="mb-2 flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const on = answers[q.id] === o;
                  return (
                    <button
                      key={o}
                      aria-pressed={on}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                      className={`min-h-[36px] rounded-full px-3.5 text-subhead ${on ? 'bg-accent text-white' : 'bg-bg-2'}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              <input
                value={q.options.includes(answers[q.id] ?? '') ? '' : (answers[q.id] ?? '')}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Or type your own answer"
                aria-label={`Your answer: ${q.question}`}
                className="h-11 w-full rounded-row bg-bg-2 px-4 text-body outline-none"
              />
            </section>
          ))}
          <div className="flex justify-center">
            <PrimaryButton onClick={() => makePlan()}>Make my plan</PrimaryButton>
          </div>
        </>
      ) : plan ? (
        <>
          <Card className="mb-4">
            <h3 className="text-title3">{plan.goal.title}</h3>
            {plan.goal.metric && (
              <p className="text-footnote text-secondary">
                {plan.goal.metric}
                {plan.goal.targetValue !== null
                  ? plan.goal.currentValue !== null
                    ? ` · ${plan.goal.currentValue} → ${plan.goal.targetValue}`
                    : ` · target ${plan.goal.targetValue}`
                  : ''}
              </p>
            )}
            <p className="mt-2 text-subhead">{plan.summary}</p>
            <ol className="mt-3 grid gap-1">
              {plan.milestones.map((m, i) => (
                <li key={i} className="flex gap-2 text-subhead">
                  <span className="tabular text-secondary">{i + 1}.</span>
                  {m}
                </li>
              ))}
            </ol>
          </Card>
          <h3 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Suggested habits · up to {MAX_NEW} new</h3>
          <div className="grid gap-3">
            {plan.habits.map((h, i) => {
              const reused = existing?.habits.find((x) => x.id === h.reuseHabitId);
              const on = accepted[i] ?? false;
              const blocked = !on && !h.reuseHabitId && newAccepted >= MAX_NEW;
              const e = { ...h, ...edits[i] };
              return (
                <Card key={i} className={on ? '' : 'opacity-60'}>
                  <div className="flex items-start gap-3">
                    <span className="text-[26px] leading-none" aria-hidden>
                      {reused?.emoji ?? h.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      {reused ? (
                        <>
                          <div className="text-headline">{reused.name}</div>
                          <div className="text-footnote text-secondary">Your existing habit — link it to this goal</div>
                        </>
                      ) : (
                        <>
                          <input
                            value={e.name}
                            onChange={(ev) => setEdits((all) => all.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                            aria-label="Habit name"
                            className="w-full bg-transparent text-headline outline-none"
                          />
                          <div className="text-footnote text-secondary">
                            {h.sectionName} · {describeSchedule(h.schedule as Schedule)}
                            {h.type !== 'check' && h.type !== 'avoid' ? ` · ${e.target} ${h.unit}` : ''}
                          </div>
                          {h.minimumVersion && <div className="mt-1 text-subhead">Minimum: {h.minimumVersion}</div>}
                          {h.cue && <div className="text-subhead text-secondary">{h.cue}</div>}
                        </>
                      )}
                      <p className="mt-1 text-footnote text-secondary">{h.why}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={blocked}
                      onClick={() => setAccepted((a) => a.map((x, j) => (j === i ? !x : x)))}
                      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-subhead font-semibold disabled:opacity-40 ${on ? 'bg-success text-white' : 'bg-bg text-accent'}`}
                    >
                      {on ? (
                        <>
                          <Check size={16} aria-hidden /> {reused ? 'Linked' : 'Added'}
                        </>
                      ) : reused ? (
                        'Link'
                      ) : (
                        'Add'
                      )}
                    </button>
                    {on && (
                      <button
                        onClick={() => setAccepted((a) => a.map((x, j) => (j === i ? false : x)))}
                        className="h-9 rounded-full px-4 text-subhead text-secondary"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                  {blocked && <p className="mt-1 text-center text-caption text-secondary">Skip another new habit first — max {MAX_NEW} at once.</p>}
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
