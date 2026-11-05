import { inJsLoop } from '@/app/motion';
import { motion } from 'framer-motion';
import { ImagePlus } from 'lucide-react';
import type { VisionSection } from '@/db/types';
import { colorVar } from '@/lib/colors';

/** Instant-photo paper: the same warm white in light and dark. */
export const PAPER = '#FBF9F5';
const INK = '#1C1C1E';

interface Props {
  section: Pick<VisionSection, 'title' | 'emoji' | 'color' | 'progress' | 'focusX' | 'focusY'>;
  photoUrl: string | null;
  /** Plays the "developing" effect on the photo (used when a tile opens). */
  develop?: boolean;
  /** Hide the caption hint on empty tiles (e.g. the tiny ones on the Goals card). */
  compact?: boolean;
  /** Interactive progression dots: called with the new 0–4 value. */
  onProgress?: (n: number) => void;
}

/**
 * A polaroid: square-cornered paper, a 4:5 photo window and a caption strip
 * with the area's name and its four "progression" dots. Every size inside is
 * a share of the polaroid's own width (container units), so it reads the same
 * at any size, and the open/close flight can be a pure scale.
 */
export function Polaroid({ section, photoUrl, develop = false, compact = false, onProgress }: Props) {
  const color = colorVar(section.color);
  return (
    <div className="w-full" style={{ containerType: 'inline-size' }}>
      <div
        style={{
          background: PAPER,
          padding: '4.5cqw 4.5cqw 0',
          borderRadius: '1.6cqw',
          boxShadow: '0 2.5cqw 7cqw rgb(0 0 0 / 0.22), 0 0.4cqw 1cqw rgb(0 0 0 / 0.14)',
        }}
      >
        <div className="relative overflow-hidden" style={{ aspectRatio: '4 / 5', borderRadius: '0.6cqw', background: '#2a2826' }}>
          {photoUrl ? (
            <DevelopingPhoto src={photoUrl} focus={`${section.focusX}% ${section.focusY}%`} develop={develop} />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: `radial-gradient(120% 90% at 30% 15%, color-mix(in srgb, ${color} 55%, white), color-mix(in srgb, ${color} 80%, black))`,
              }}
            >
              <span style={{ fontSize: '17cqw', lineHeight: 1, filter: 'drop-shadow(0 1cqw 2cqw rgb(0 0 0 / 0.25))' }} aria-hidden>
                {section.emoji}
              </span>
              {!compact && (
                <span
                  className="mt-[3cqw] flex items-center font-semibold text-white/90"
                  style={{ fontSize: '4.4cqw', gap: '1.4cqw', letterSpacing: '0.02em' }}
                >
                  <ImagePlus style={{ width: '5cqw', height: '5cqw' }} aria-hidden /> Add a photo
                </span>
              )}
            </div>
          )}
          {/* A soft gloss, like light catching the print. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgb(255 255 255 / 0.16), transparent 38%, transparent 70%, rgb(0 0 0 / 0.08))' }}
            aria-hidden
          />
        </div>
        <div className="flex items-center justify-between" style={{ height: '17cqw', gap: '3cqw' }}>
          <span className="min-w-0 truncate font-bold uppercase" style={{ color: INK, fontSize: '5cqw', letterSpacing: '0.2em' }}>
            {section.title}
          </span>
          <Dots value={section.progress} color={color} onChange={onProgress} />
        </div>
      </div>
    </div>
  );
}

function Dots({ value, color, onChange }: { value: number; color: string; onChange?: (n: number) => void }) {
  return (
    <span className="flex shrink-0" style={{ gap: '1.3cqw' }} role={onChange ? 'radiogroup' : 'img'} aria-label={`Progression ${value} of 4`}>
      {[1, 2, 3, 4].map((n) => {
        const on = n <= value;
        const dot = (
          <motion.span
            className="block rounded-full"
            style={{ width: '3.8cqw', height: '3.8cqw', border: `0.45cqw solid ${INK}` }}
            initial={false}
            animate={{ background: on ? color : 'rgba(0,0,0,0)', scale: on ? 1 : 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22, delay: on ? (n - 1) * 0.04 : 0 }}
          />
        );
        if (!onChange) return <span key={n}>{dot}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 4`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value === n ? n - 1 : n);
            }}
            // A generous invisible hit area around each small dot.
            className="relative before:absolute before:-inset-[2.2cqw]"
          >
            {dot}
          </button>
        );
      })}
    </span>
  );
}

/**
 * The photo itself. When `develop` is on it starts as a pale, milky, low-contrast
 * print and slowly comes up to full colour, like an instant photo developing.
 */
function DevelopingPhoto({ src, focus, develop }: { src: string; focus: string; develop: boolean }) {
  return (
    <>
      <motion.img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
        style={{ objectPosition: focus }}
        initial={develop ? { filter: 'sepia(0.55) saturate(0.25) brightness(1.75) contrast(0.55) blur(3px)' } : false}
        onUpdate={inJsLoop}
        animate={{ filter: 'sepia(0) saturate(1) brightness(1) contrast(1) blur(0px)' }}
        transition={{ duration: 2.2, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      />
      {develop && (
        <>
          {/* The chemical haze lifting off. */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(180deg, #8b8a78, #6f7468)' }}
            initial={{ opacity: 0.85 }}
            onUpdate={inJsLoop}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.7, delay: 0.25, ease: 'easeOut' }}
            aria-hidden
          />
          {/* A soft flash as it lands. */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            onUpdate={inJsLoop}
            animate={{ opacity: [0, 0.75, 0] }}
            transition={{ duration: 0.7, delay: 0.55, times: [0, 0.2, 1], ease: 'easeOut' }}
            aria-hidden
          />
        </>
      )}
    </>
  );
}
