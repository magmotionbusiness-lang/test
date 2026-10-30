import { memo, useEffect, useMemo, useRef } from 'react';
import type { LocalDate } from '@/db/types';
import { daysBetween, formatDay, shiftDate, weekStartOf } from '@/domain/dates';
import type { Tile } from '@/domain/score';

export type GridSize = 'compact' | 'year';

interface Props {
  /** CSS colour of filled tiles. */
  color: string;
  tiles: Map<LocalDate, Tile>;
  start: LocalDate;
  today: LocalDate;
  weekStart: 0 | 1;
  size?: GridSize;
  /** `intensity` draws tile.progress (0…1) in 5 steps, for the global grid. */
  mode?: 'habit' | 'intensity';
  label: string;
  onTap?: (date: LocalDate) => void;
  onLongPress?: (date: LocalDate) => void;
}

const DIM: Record<GridSize, { tile: number; gap: number; labels: boolean }> = {
  compact: { tile: 12, gap: 3, labels: false },
  year: { tile: 17, gap: 3, labels: true },
};
const LABEL_W = 22;
const LABEL_H = 18;
const LONG_PRESS_MS = 450;
const INTENSITY = [0, 0.3, 0.5, 0.75, 1];

interface Cell {
  date: LocalDate;
  col: number;
  row: number;
  tile: Tile;
  isToday: boolean;
  anim?: 'pop' | 'ripple';
}

/**
 * GitHub-style tile calendar: columns are weeks, rows are weekdays. One SVG
 * per grid; tiles are grouped by month and memoised so logging a day only
 * re-renders that month. Taps are hit-tested from coordinates, so there are
 * no per-tile listeners.
 */
export function TileGrid({ color, tiles, start, today, weekStart, size = 'year', mode = 'habit', label, onTap, onLongPress }: Props) {
  const { tile, gap, labels } = DIM[size];
  const step = tile + gap;
  const offX = labels ? LABEL_W : 0;
  const offY = labels ? LABEL_H : 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<LocalDate, Tile> | null>(null);

  const gridStart = weekStartOf(start, weekStart);
  const cols = Math.floor(daysBetween(gridStart, today) / 7) + 1;
  const width = offX + cols * step - gap;
  const height = offY + 7 * step - gap;

  const { months, monthLabels } = useMemo(() => {
    const before = prev.current;
    const cells: Cell[] = [];
    const n = daysBetween(gridStart, today);
    const colDone = new Map<number, boolean>();
    for (let i = 0; i <= n; i++) {
      const date = shiftDate(gridStart, i);
      if (date < start) continue;
      const t = tiles.get(date) ?? { state: 'unscheduled', progress: 0 };
      const col = Math.floor(i / 7);
      const row = i % 7;
      let anim: Cell['anim'];
      if (before && isFilled(t, mode) && !isFilled(before.get(date), mode)) {
        anim = 'pop';
        colDone.set(col, true);
      }
      cells.push({ date, col, row, tile: t, isToday: date === today, anim });
    }
    // Ripple a week's column when the newly filled day completed it.
    for (const col of colDone.keys()) {
      const week = cells.filter((c) => c.col === col);
      const complete = week.every((c) => c.tile.state !== 'missed' && c.tile.state !== 'partial') && week.some((c) => isFilled(c.tile, mode));
      if (complete && mode === 'habit') for (const c of week) if (!c.anim) c.anim = 'ripple';
    }
    const groups = new Map<string, Cell[]>();
    for (const c of cells) {
      const k = c.date.slice(0, 7);
      const g = groups.get(k);
      if (g) g.push(c);
      else groups.set(k, [c]);
    }
    const labelsOut: { x: number; text: string }[] = [];
    let lastCol = -3;
    for (const [k, g] of groups) {
      const first = g.find((c) => c.row === 0) ?? g[0]!;
      if (first.col - lastCol < 3) continue;
      labelsOut.push({ x: offX + first.col * step, text: formatDay(`${k}-01`, 'MMM') });
      lastCol = first.col;
    }
    return { months: [...groups.entries()], monthLabels: labelsOut };
  }, [tiles, gridStart, today, start, mode, offX, step]);

  useEffect(() => {
    prev.current = tiles;
  }, [tiles]);

  // Open scrolled to today.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [cols]);

  // Tap / long-press hit testing.
  const press = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const dateAt = (svg: SVGSVGElement, clientX: number, clientY: number): LocalDate | null => {
    const r = svg.getBoundingClientRect();
    const x = clientX - r.left - offX;
    const y = clientY - r.top - offY;
    if (x < 0 || y < 0) return null;
    const col = Math.floor(x / step);
    const row = Math.floor(y / step);
    if (row > 6 || x % step > tile + 1 || y % step > tile + 1) return null;
    const date = shiftDate(gridStart, col * 7 + row);
    return date < start || date > today ? null : date;
  };
  const interactive = Boolean(onTap || onLongPress);

  const days = [...tiles.values()].filter((t) => t.state !== 'future');
  const filled = days.filter((t) => isFilled(t, mode)).length;

  return (
    <div ref={scrollRef} className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}: ${filled} of ${days.length} days filled.`}
        className="block select-none"
        style={{ touchAction: 'pan-x pan-y', WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={
          interactive
            ? (e) => {
                const svg = e.currentTarget;
                const { clientX, clientY } = e;
                press.current = { x: clientX, y: clientY, fired: false };
                if (onLongPress) {
                  press.current.timer = setTimeout(() => {
                    const d = dateAt(svg, clientX, clientY);
                    if (d && press.current) {
                      press.current.fired = true;
                      onLongPress(d);
                    }
                  }, LONG_PRESS_MS);
                }
              }
            : undefined
        }
        onPointerMove={(e) => {
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
            clearTimeout(p.timer);
            press.current = null;
          }
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          if (!p) return;
          clearTimeout(p.timer);
          if (p.fired || !onTap) return;
          const d = dateAt(e.currentTarget, e.clientX, e.clientY);
          if (d) onTap(d);
        }}
        onPointerCancel={() => {
          clearTimeout(press.current?.timer);
          press.current = null;
        }}
      >
        {labels && (
          <g className="fill-[rgb(var(--label-2)/0.6)] text-[10px]" aria-hidden>
            {monthLabels.map((m) => (
              <text key={m.x} x={m.x} y={11}>
                {m.text}
              </text>
            ))}
            {[1, 3, 5].map((row) => (
              <text key={row} x={0} y={offY + row * step + tile - 4}>
                {formatDay(shiftDate(gridStart, row), 'EEEEE')}
              </text>
            ))}
          </g>
        )}
        {months.map(([k, cells]) => (
          <Month key={k} cells={cells} sig={signature(cells)} color={color} tile={tile} step={step} offX={offX} offY={offY} mode={mode} />
        ))}
      </svg>
    </div>
  );
}

function isFilled(t: Tile | undefined, mode: 'habit' | 'intensity'): boolean {
  if (!t) return false;
  if (mode === 'intensity') return t.progress > 0;
  return t.state === 'done' || t.state === 'minimum';
}

function signature(cells: Cell[]): string {
  return cells.map((c) => `${c.tile.state[0]}${Math.round(c.tile.progress * 20)}${c.isToday ? 't' : ''}${c.anim ? c.anim[0] : ''}`).join('');
}

interface MonthProps {
  cells: Cell[];
  sig: string;
  color: string;
  tile: number;
  step: number;
  offX: number;
  offY: number;
  mode: 'habit' | 'intensity';
}

const Month = memo(
  function Month({ cells, color, tile, step, offX, offY, mode }: MonthProps) {
    const r = tile * 0.25;
    return (
      <g>
        {cells.map((c) => {
          const x = offX + c.col * step;
          const y = offY + c.row * step;
          return <TileShape key={c.date} cell={c} x={x} y={y} s={tile} r={r} color={color} mode={mode} />;
        })}
      </g>
    );
  },
  (a, b) => a.sig === b.sig && a.color === b.color && a.tile === b.tile && a.offX === b.offX && a.mode === b.mode,
);

function TileShape({ cell, x, y, s, r, color, mode }: { cell: Cell; x: number; y: number; s: number; r: number; color: string; mode: 'habit' | 'intensity' }) {
  const { tile, isToday, anim } = cell;
  if (tile.state === 'future') return null;
  const cls = anim === 'pop' ? 'tile-pop' : anim === 'ripple' ? 'tile-ripple' : undefined;
  const style = anim === 'ripple' ? { animationDelay: `${cell.row * 35}ms` } : undefined;
  const ring = isToday ? <rect x={x - 1.5} y={y - 1.5} width={s + 3} height={s + 3} rx={r + 1.5} fill="none" stroke={color} strokeWidth={1.5} /> : null;

  if (mode === 'intensity') {
    const level = tile.progress <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(tile.progress * 4)));
    return (
      <>
        <rect className={cls} x={x} y={y} width={s} height={s} rx={r} fill={level ? color : 'rgb(var(--fill) / 0.12)'} fillOpacity={level ? INTENSITY[level] : 1} />
        {ring}
      </>
    );
  }

  let body;
  switch (tile.state) {
    case 'done':
      body = <rect className={cls} style={style} x={x} y={y} width={s} height={s} rx={r} fill={color} />;
      break;
    case 'partial':
      body = <rect x={x} y={y} width={s} height={s} rx={r} fill={color} fillOpacity={Math.max(0.25, tile.progress * 0.85)} />;
      break;
    case 'minimum':
      body = (
        <g className={cls} style={style}>
          <rect x={x} y={y} width={s} height={s} rx={r} fill={color} fillOpacity={0.5} />
          <circle cx={x + s / 2} cy={y + s / 2} r={Math.max(1.5, s * 0.13)} fill={color} />
        </g>
      );
      break;
    case 'skipped':
      body = (
        <g>
          <rect x={x} y={y} width={s} height={s} rx={r} fill="rgb(var(--fill) / 0.22)" />
          <line x1={x + s * 0.25} y1={y + s * 0.75} x2={x + s * 0.75} y2={y + s * 0.25} stroke="rgb(var(--fill) / 0.9)" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      );
      break;
    case 'missed':
      body = <rect x={x + 0.5} y={y + 0.5} width={s - 1} height={s - 1} rx={r} fill="none" stroke="rgb(var(--fill) / 0.35)" strokeWidth={1} />;
      break;
    default:
      body = <rect x={x} y={y} width={s} height={s} rx={r} fill="rgb(var(--fill) / 0.08)" />;
  }
  return (
    <>
      {body}
      {ring}
    </>
  );
}
