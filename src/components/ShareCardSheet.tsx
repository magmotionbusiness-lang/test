import { useEffect, useState } from 'react';
import { useSettings } from '@/app/useSettings';
import type { Entry, Habit, Section } from '@/db/types';
import { daysBetween, shiftDate, today as todayFn, weekStartOf } from '@/domain/dates';
import { buildTiles, consistencyWindow, type Tile } from '@/domain/score';
import { computeStreak } from '@/domain/streaks';
import { dailyShare } from '@/domain/aggregate';
import { colorHex } from '@/lib/colors';
import { formatPercent } from '@/lib/format';
import { Sheet } from './Sheet';
import { PrimaryButton } from './ui';
import { toast } from './Toast';

export type ShareSubject =
  | { kind: 'habit'; habit: Habit; entries: Entry[] }
  | { kind: 'section'; section: Section; habits: Habit[]; entries: Entry[] };

const W = 1080;
const H = 1350;
const WEEKS = 18;

/** Renders a 1080×1350 progress card and hands it to the iOS share sheet. */
export function ShareCardSheet({ open, onClose, subject }: { open: boolean; onClose: () => void; subject: ShareSubject }) {
  const settings = useSettings();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let revoked: string | null = null;
    void renderCard(subject, settings.weekStart).then((b) => {
      setBlob(b);
      revoked = URL.createObjectURL(b);
      setUrl(revoked);
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      setUrl(null);
      setBlob(null);
    };
    // Render once per opening.
  }, [open]);

  const name = subject.kind === 'habit' ? subject.habit.name : subject.section.name;
  const file = blob ? new File([blob], `habit-hub-${name.toLowerCase().replace(/\W+/g, '-')}.png`, { type: 'image/png' }) : null;

  const share = async () => {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${name} — Habit Hub` });
      } catch {
        /* user cancelled */
      }
    } else if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      toast('Image saved');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Share progress">
      <div className="flex flex-col items-center gap-5 pb-4">
        <div className="aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-[18px] bg-bg-2 shadow-card">
          {url && <img src={url} alt={`Progress card for ${name}`} className="h-full w-full" />}
        </div>
        <PrimaryButton onClick={share} disabled={!file}>
          Share image
        </PrimaryButton>
        <p className="text-center text-footnote text-secondary">Post it to Instagram or TikTok, or save it to Photos.</p>
      </div>
    </Sheet>
  );
}

async function renderCard(subject: ShareSubject, weekStart: 0 | 1): Promise<Blob> {
  const today = todayFn();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

  const color = colorHex(subject.kind === 'habit' ? subject.habit.color : subject.section.color, false);
  const emoji = subject.kind === 'habit' ? subject.habit.emoji : subject.section.emoji;
  const title = subject.kind === 'habit' ? subject.habit.name : subject.section.name;

  // Background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#F2F2F7');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(W - 80, 120, 360, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textBaseline = 'alphabetic';
  ctx.font = `120px ${font}`;
  ctx.fillText(emoji, 90, 230);
  ctx.fillStyle = '#000';
  ctx.font = `bold 84px ${font}`;
  ctx.fillText(truncate(ctx, title, W - 180), 90, 350);
  ctx.fillStyle = '#6C6C70';
  ctx.font = `40px ${font}`;
  ctx.fillText(subject.kind === 'habit' ? 'Last 18 weeks' : 'Section · last 18 weeks', 90, 410);

  // Grid
  const start = weekStartOf(shiftDate(today, -(WEEKS * 7 - 1)), weekStart);
  let tiles: Map<string, Tile>;
  let stats: { label: string; value: string }[];
  if (subject.kind === 'habit') {
    const { habit, entries } = subject;
    tiles = buildTiles(habit, entries, start, today);
    const s = computeStreak(habit, entries, today, weekStart);
    const c = consistencyWindow(habit, entries, today, weekStart, 30);
    const u = s.unit === 'day' ? 'days' : s.unit === 'week' ? 'weeks' : 'months';
    stats = [
      { label: `streak (${u})`, value: String(s.current) },
      { label: `best (${u})`, value: String(s.best) },
      { label: '30-day consistency', value: c.score === null ? '—' : formatPercent(c.score) },
    ];
  } else {
    const { habits, entries } = subject;
    tiles = dailyShare(habits, entries, start, today, weekStart);
    const best = Math.max(
      0,
      ...habits.map(
        (h) =>
          computeStreak(
            h,
            entries.filter((e) => e.habitId === h.id),
            today,
            weekStart,
          ).current,
      ),
    );
    const scores = habits
      .map(
        (h) =>
          consistencyWindow(
            h,
            entries.filter((e) => e.habitId === h.id),
            today,
            weekStart,
            30,
          ).score,
      )
      .filter((x): x is number => x !== null);
    stats = [
      { label: 'habits', value: String(habits.length) },
      { label: 'best active streak', value: String(best) },
      { label: '30-day consistency', value: scores.length ? formatPercent(scores.reduce((a, b) => a + b, 0) / scores.length) : '—' },
    ];
  }

  const cols = Math.floor(daysBetween(start, today) / 7) + 1;
  const gap = 8;
  const size = Math.floor((W - 180 - gap * (cols - 1)) / cols);
  const gx = 90;
  const gy = 500;
  for (let i = 0; i <= daysBetween(start, today); i++) {
    const d = shiftDate(start, i);
    const t = tiles.get(d) ?? { state: 'unscheduled' as const, progress: 0 };
    const x = gx + Math.floor(i / 7) * (size + gap);
    const y = gy + (i % 7) * (size + gap);
    const filled =
      subject.kind === 'section'
        ? t.progress
        : t.state === 'done'
          ? 1
          : t.state === 'minimum'
            ? 0.5
            : t.state === 'partial'
              ? Math.max(0.25, t.progress * 0.85)
              : 0;
    ctx.fillStyle = filled > 0 ? color : t.state === 'missed' ? 'rgba(120,120,128,0.10)' : 'rgba(120,120,128,0.16)';
    ctx.globalAlpha = filled > 0 ? (subject.kind === 'section' ? [0.3, 0.5, 0.75, 1][Math.min(3, Math.ceil(filled * 4) - 1)]! : filled) : 1;
    roundRect(ctx, x, y, size, size, size * 0.25);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Stats
  const sy = gy + 7 * (size + gap) + 150;
  const colW = (W - 180) / 3;
  stats.forEach((s, i) => {
    const x = 90 + i * colW;
    ctx.fillStyle = i === 0 ? color : '#000';
    ctx.font = `bold 96px ${font}`;
    ctx.fillText(s.value, x, sy);
    ctx.fillStyle = '#6C6C70';
    ctx.font = `34px ${font}`;
    ctx.fillText(s.label, x, sy + 52);
  });

  // Footer
  ctx.fillStyle = '#8E8E93';
  ctx.font = `600 36px ${font}`;
  ctx.fillText('Habit Hub', 90, H - 80);
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, W - 90 - 3 * 34 + i * 34, H - 108, 26, 26, 7);
    ctx.globalAlpha = [0.35, 0.65, 1][i]!;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
