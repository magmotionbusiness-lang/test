import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import type { VisionSection } from '@/db/types';
import { boardProgress, STARTER_SECTIONS } from '@/domain/vision';
import { haptic } from '@/lib/feedback';
import { formatPercent } from '@/lib/format';
import { useBlobUrl } from '@/lib/useBlobUrl';
import { Sparkle } from './Decor';
import { Polaroid } from './Polaroid';

const FAN = [
  { rotate: -13, x: -34, y: 8, delay: '0s' },
  { rotate: 3, x: 0, y: -4, delay: '-1.6s' },
  { rotate: 15, x: 36, y: 10, delay: '-3.2s' },
];

/**
 * The way into the vision board from the Goals tab: a glowing aurora card
 * with your polaroids fanned out and floating, a shimmer passing over and
 * sparkles twinkling. Made to be tapped.
 */
export function VisionEntryCard() {
  const navigate = useNavigate();
  const tiles = useLiveQuery(() => db.vision.orderBy('order').toArray(), []);

  // Show tiles with photos first; before the board exists, preview the starter areas.
  const shown: Pick<VisionSection, 'id' | 'title' | 'emoji' | 'color' | 'progress' | 'focusX' | 'focusY' | 'photoId'>[] = tiles?.length
    ? [...tiles].sort((a, b) => Number(Boolean(b.photoId)) - Number(Boolean(a.photoId))).slice(0, 3)
    : STARTER_SECTIONS.slice(0, 3).map((s, i) => ({ ...s, id: String(i), progress: 0, focusX: 50, focusY: 50, photoId: null }));
  const subtitle = tiles?.length
    ? `${tiles.length} ${tiles.length === 1 ? 'dream' : 'dreams'} · ${formatPercent(boardProgress(tiles))} of the way`
    : 'Picture the life you’re building';

  return (
    <motion.button
      onClick={() => {
        haptic();
        navigate('/vision');
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className="relative mb-6 block h-[164px] w-full overflow-hidden rounded-[24px] text-left shadow-[0_12px_32px_rgb(124_92_255/0.35)]"
      aria-label={`Vision Board. ${subtitle}`}
    >
      <div className="aurora absolute -inset-1/4" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_100%,rgb(0_0_0/0.35),transparent_60%)]" aria-hidden />
      <div className="shimmer-sweep absolute inset-0" aria-hidden />
      {[
        { top: '14%', left: '46%', size: 12, delay: '0s' },
        { top: '70%', left: '54%', size: 9, delay: '-0.9s' },
        { top: '22%', left: '90%', size: 10, delay: '-1.7s' },
        { top: '80%', left: '8%', size: 8, delay: '-1.2s' },
      ].map((s, i) => (
        <Sparkle key={i} size={s.size} className="twinkle absolute text-white" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}

      <div className="relative flex h-full flex-col justify-between p-5 pr-[44%]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/75">Make it happen</div>
          <div className="mt-1 font-serif text-[30px] font-semibold italic leading-none text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.2)]">
            Vision Board
          </div>
          <div className="mt-2 text-footnote text-white/85">{subtitle}</div>
        </div>
        <span className="inline-flex w-fit items-center gap-0.5 rounded-full bg-white/20 py-1.5 pl-3.5 pr-2.5 text-footnote font-semibold text-white backdrop-blur-md">
          Open <ChevronRight size={15} aria-hidden />
        </span>
      </div>

      <div className="pointer-events-none absolute right-[13%] top-1/2 -translate-y-1/2" aria-hidden>
        {shown.map((t, i) => (
          <MiniPolaroid key={t.id} tile={t} {...FAN[i]!} />
        ))}
      </div>
    </motion.button>
  );
}

function MiniPolaroid({
  tile,
  rotate,
  x,
  y,
  delay,
}: {
  tile: Pick<VisionSection, 'title' | 'emoji' | 'color' | 'progress' | 'focusX' | 'focusY' | 'photoId'>;
  rotate: number;
  x: number;
  y: number;
  delay: string;
}) {
  const url = useBlobUrl(tile.photoId);
  return (
    <div className="absolute left-0 top-0" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotate}deg)` }}>
      <div className="float-y w-[68px]" style={{ animationDelay: delay }}>
        <Polaroid section={tile} photoUrl={url} compact />
      </div>
    </div>
  );
}
