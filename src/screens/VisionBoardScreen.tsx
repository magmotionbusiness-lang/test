import { inJsLoop } from '@/app/motion';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/db/db';
import { createVisionSection, deleteVisionSection, ensureVisionBoard } from '@/db/repo';
import type { VisionSection } from '@/db/types';
import { boardProgress, tiltFor } from '@/domain/vision';
import { haptic } from '@/lib/feedback';
import { formatPercent } from '@/lib/format';
import { useBlobUrl } from '@/lib/useBlobUrl';
import { NavButton, Page } from '@/components/Page';
import { OrbitStar } from '@/components/vision/Decor';
import { Polaroid } from '@/components/vision/Polaroid';
import { VisionDetail, type Origin } from '@/components/vision/VisionDetail';
import { VisionEditor } from '@/components/vision/VisionEditor';

const NEW_TITLE = 'New dream';

/**
 * The vision board: a wall of polaroids, one per area of life, each with a
 * photo, a few words and four "progression" dots. Tap one to open it.
 */
export function VisionBoardScreen() {
  const tiles = useLiveQuery(() => db.vision.orderBy('order').toArray(), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    void ensureVisionBoard();
  }, []);

  const open = tiles?.find((t) => t.id === openId) ?? null;
  const editing = tiles?.find((t) => t.id === editId) ?? null;
  const openIndex = tiles && open ? tiles.indexOf(open) : 0;

  const origin = (id: string) => (): Origin | null => {
    const el = tileRefs.current.get(id);
    if (!el) return null;
    // Rotation doesn't move the centre; offsetWidth is the unrotated width.
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: el.offsetWidth };
  };

  const addTile = async () => {
    haptic();
    const t = await createVisionSection({ title: NEW_TITLE, emoji: '✨', color: 'purple' });
    setNewId(t.id);
    setEditId(t.id);
  };

  const closeEditor = async () => {
    setEditId(null);
    // A tile that was added and then left untouched goes away again.
    if (!newId) return;
    const t = await db.vision.get(newId);
    setNewId(null);
    if (t && t.title === NEW_TITLE && !t.photoId && !t.description) await deleteVisionSection(t.id);
  };

  return (
    <Page
      title="Vision Board"
      backLabel="Goals"
      heading={<span className="font-serif font-semibold italic tracking-tight">Vision Board</span>}
      backdrop={
        <>
          <div className="vision-backdrop absolute inset-0" />
          <div className="film-grain absolute inset-0" />
        </>
      }
      actions={
        <NavButton label="Add a tile" onClick={addTile}>
          <Plus size={26} aria-hidden />
        </NavButton>
      }
    >
      <div className="mb-7 flex items-center justify-center gap-2 text-label">
        <OrbitStar size={30} className="opacity-80" />
        <span className="rounded-full border border-current px-5 py-2 text-[12px] font-bold uppercase tracking-[0.42em]">Make it happen</span>
        <OrbitStar size={30} className="opacity-80" />
      </div>

      {tiles && tiles.length > 0 && <BoardMeter tiles={tiles} />}

      <div className="grid grid-cols-2 gap-x-5 gap-y-7 px-1 pb-4 sm:grid-cols-3">
        {tiles?.map((t, i) => (
          <Tile
            key={t.id}
            tile={t}
            tilt={tiltFor(i)}
            index={i}
            hidden={t.id === openId}
            refFn={(el) => (el ? tileRefs.current.set(t.id, el) : tileRefs.current.delete(t.id))}
            onOpen={() => setOpenId(t.id)}
          />
        ))}
        {tiles && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            onUpdate={inJsLoop}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + tiles.length * 0.05, duration: 0.5 }}
            whileTap={{ scale: 0.96 }}
            onClick={addTile}
            className="flex flex-col items-center justify-center gap-2 rounded-[6px] border-2 border-dashed border-[rgb(var(--label)/0.2)] text-subhead font-semibold text-secondary"
            // Same proportions as a polaroid: paper border + 4:5 photo + caption strip.
            style={{ aspectRatio: '1 / 1.3525' }}
          >
            <Plus size={26} aria-hidden /> Add a dream
          </motion.button>
        )}
      </div>

      {open && (
        <VisionDetail
          key={open.id}
          section={open}
          tilt={tiltFor(openIndex)}
          getOrigin={origin(open.id)}
          onEdit={() => setEditId(open.id)}
          onClosed={() => setOpenId(null)}
        />
      )}
      <VisionEditor section={editing} onClose={() => void closeEditor()} onDeleted={() => setOpenId(null)} />
    </Page>
  );
}

function BoardMeter({ tiles }: { tiles: VisionSection[] }) {
  const p = boardProgress(tiles);
  const withPhoto = tiles.filter((t) => t.photoId).length;
  return (
    <div className="mb-7 px-1">
      <div className="mb-1.5 flex items-baseline justify-between text-footnote text-secondary">
        <span>
          {withPhoto} of {tiles.length} pictured
        </span>
        <span className="font-semibold text-label">{formatPercent(p)} of the way</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--label)/0.1)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #ff9f43, #ff5fa2, #7c5cff)' }}
          initial={{ width: 0 }}
          animate={{ width: `${p * 100}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function Tile({
  tile,
  tilt,
  index,
  hidden,
  refFn,
  onOpen,
}: {
  tile: VisionSection;
  tilt: number;
  index: number;
  hidden: boolean;
  refFn: (el: HTMLElement | null) => void;
  onOpen: () => void;
}) {
  const url = useBlobUrl(tile.photoId);
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, rotate: 0 }}
      onUpdate={inJsLoop}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.button
        ref={refFn}
        onClick={onOpen}
        whileTap={{ scale: 0.95, rotate: -tilt * 0.5 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        // While its photo is open it's "lifted off" the board; it reappears exactly as the photo lands back.
        style={{ opacity: hidden ? 0 : 1 }}
        className="block w-full text-left"
        aria-label={`${tile.title}${tile.description ? `: ${tile.description.slice(0, 80)}` : ''}. Progress ${tile.progress} of 4`}
      >
        <Polaroid section={tile} photoUrl={url} />
      </motion.button>
    </motion.div>
  );
}
