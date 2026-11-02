import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';

export interface Point {
  label: string;
  /** Short axis label; falls back to `label`. */
  tick?: string;
  value: number | null;
}

interface ChartProps {
  data: Point[];
  color: string;
  /** Formats values for tooltips, labels and the data table. */
  format: (v: number) => string;
  /** Upper bound of the y-axis; defaults to the data max. */
  max?: number;
  title: string;
  height?: number;
}

const PAD = { top: 10, right: 6, bottom: 22, left: 34 };

/**
 * Hand-built single-series charts (no chart library): recessive grid, 2px
 * line / 4px-rounded bars, tap-or-hover tooltip, and a visually hidden table
 * so VoiceOver gets the numbers.
 */
export function LineChart({ data, color, format, max, title, height = 170 }: ChartProps) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  const iw = Math.max(1, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / top) * ih;

  // Break the line at nulls.
  const segments: string[] = [];
  let cur = '';
  data.forEach((d, i) => {
    if (d.value === null) {
      if (cur) segments.push(cur);
      cur = '';
    } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !data.length) return;
    const i = Math.round(((clientX - r.left - PAD.left) / iw) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  };
  const a = active !== null ? data[active] : undefined;

  return (
    <figure ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          aria-hidden
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => pick(e.clientX)}
          className="touch-pan-y"
        >
          <Grid width={width} top={top} y={y} format={format} />
          {segments.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          <Ticks data={data} x={x} height={height} />
          {a && a.value !== null && active !== null && (
            <>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + ih} stroke="rgb(var(--fill) / 0.5)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(a.value)} r={5} fill={color} stroke="rgb(var(--bg-2))" strokeWidth={2} />
            </>
          )}
        </svg>
      )}
      {a && active !== null && <Tooltip x={x(active)} width={width} label={a.label} value={a.value === null ? 'No data' : format(a.value)} />}
      <DataTable title={title} data={data} format={format} />
    </figure>
  );
}

export function BarChart({
  data,
  color,
  format,
  max,
  title,
  height = 170,
  highlightExtremes = true,
  tickEvery = 1,
}: ChartProps & { highlightExtremes?: boolean; tickEvery?: number }) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  const iw = Math.max(1, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(36, slot - 4));
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + ih - (v / top) * ih;
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const best = values.length > 1 ? Math.max(...values) : null;
  const worst = values.length > 1 ? Math.min(...values) : null;
  // Label only the first bar at the best and worst value, so ties don't stack labels.
  const bestIndex = best === null ? -1 : data.findIndex((d) => d.value === best);
  const worstIndex = worst === null || worst === best ? -1 : data.findIndex((d) => d.value === worst);

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.floor((clientX - r.left - PAD.left) / slot);
    setActive(i >= 0 && i < data.length ? i : null);
  };
  const a = active !== null ? data[active] : undefined;

  return (
    <figure ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          aria-hidden
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => pick(e.clientX)}
          className="touch-pan-y"
        >
          <Grid width={width} top={top} y={y} format={format} />
          {data.map((d, i) => {
            if (d.value === null || d.value <= 0) return null;
            const h = Math.max(2, PAD.top + ih - y(d.value));
            const r = Math.min(4, bw / 2, h);
            const x0 = x(i) - bw / 2;
            const y0 = PAD.top + ih - h;
            const isExtreme = highlightExtremes && (i === bestIndex || i === worstIndex);
            return (
              <g key={i}>
                <motion.path
                  // Bars grow up from the baseline, staggered left to right.
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i * 0.025, 0.4) }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                  d={`M${x0},${PAD.top + ih}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${PAD.top + ih}Z`}
                  fill={color}
                  fillOpacity={active === null || active === i ? 1 : 0.45}
                />
                {isExtreme && (
                  <text x={x(i)} y={y0 - 4} textAnchor="middle" className="fill-[rgb(var(--label-2)/var(--label-2-alpha))] text-[10px] tabular">
                    {format(d.value)}
                  </text>
                )}
              </g>
            );
          })}
          <Ticks data={data} x={x} height={height} every={tickEvery} />
        </svg>
      )}
      {a && active !== null && <Tooltip x={x(active)} width={width} label={a.label} value={a.value === null ? 'No data' : format(a.value)} />}
      <DataTable title={title} data={data} format={format} />
    </figure>
  );
}

function Grid({ width, top, y, format }: { width: number; top: number; y: (v: number) => number; format: (v: number) => string }) {
  return (
    <g>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(top * f)} y2={y(top * f)} stroke="rgb(var(--separator) / 0.22)" strokeWidth={1} />
          <text
            x={PAD.left - 6}
            y={y(top * f) + 3.5}
            textAnchor="end"
            className="fill-[rgb(var(--label-2)/var(--label-2-alpha))] text-[10px] tabular"
          >
            {format(top * f)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Ticks({ data, x, height, every }: { data: Point[]; x: (i: number) => number; height: number; every?: number }) {
  const step = every ?? Math.max(1, Math.ceil(data.length / 6));
  return (
    <g>
      {data.map((d, i) =>
        i % step === 0 || (every === undefined && i === data.length - 1 && (data.length - 1) % step > step / 2) ? (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={every === undefined && i === 0 ? 'start' : every === undefined && i === data.length - 1 ? 'end' : 'middle'}
            className="fill-[rgb(var(--label-2)/var(--label-2-alpha))] text-[10px]"
          >
            {d.tick ?? d.label}
          </text>
        ) : null,
      )}
    </g>
  );
}

function Tooltip({ x, width, label, value }: { x: number; width: number; label: string; value: string }) {
  const w = 128;
  const left = Math.max(0, Math.min(width - w, x - w / 2));
  return (
    <div
      className="pointer-events-none absolute top-0 rounded-[10px] bg-bg-2 px-2.5 py-1.5 text-caption shadow-[0_4px_16px_rgba(0,0,0,0.14)] ring-1 ring-[rgb(var(--separator)/0.2)]"
      style={{ left, width: w }}
    >
      <div className="text-secondary">{label}</div>
      <div className="tabular text-footnote font-semibold">{value}</div>
    </div>
  );
}

function DataTable({ title, data, format }: { title: string; data: Point[]; format: (v: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>
        {data.map((d, i) => (
          <tr key={i}>
            <th scope="row">{d.label}</th>
            <td>{d.value === null ? 'No data' : format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useWidth() {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const obs = new ResizeObserver(([e]) => e && setWidth(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, width };
}
