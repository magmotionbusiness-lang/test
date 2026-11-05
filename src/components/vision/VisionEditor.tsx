import { motion } from 'framer-motion';
import { ImagePlus, Move, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteVisionSection, removeVisionPhoto, setVisionPhoto, updateVisionSection } from '@/db/repo';
import type { VisionSection } from '@/db/types';
import { coverOverflow, dragFocus } from '@/domain/vision';
import { colorVar } from '@/lib/colors';
import { confirmAction } from '@/lib/confirm';
import { preparePhoto } from '@/lib/image';
import { useBlobUrl } from '@/lib/useBlobUrl';
import { ColorPicker, EmojiField, FormGroup, TextField } from '../form';
import { Sheet } from '../Sheet';
import { toast } from '../Toast';

interface Props {
  section: VisionSection | null;
  onClose: () => void;
  /** Called after the tile was deleted. */
  onDeleted?: () => void;
}

/** Edit a vision tile: its photo (and which part of it shows), name, emoji, colour and words. */
export function VisionEditor({ section, onClose, onDeleted }: Props) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState<VisionSection['color']>('blue');
  const [description, setDescription] = useState('');
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoUrl = useBlobUrl(section?.photoId);

  useEffect(() => {
    if (!section) return;
    setTitle(section.title);
    setEmoji(section.emoji);
    setColor(section.color);
    setDescription(section.description);
    setFocus({ x: section.focusX, y: section.focusY });
    // Reset only when a different tile opens, not on every save.
  }, [section?.id]);

  // A new photo always starts centred.
  useEffect(() => {
    if (section) setFocus({ x: section.focusX, y: section.focusY });
  }, [section?.photoId, section?.photoAspect]);

  const save = async () => {
    if (!section) return;
    await updateVisionSection(section.id, {
      title: title.trim() || section.title,
      emoji: emoji || section.emoji,
      color,
      description: description.trim(),
      focusX: focus.x,
      focusY: focus.y,
    });
    onClose();
  };

  const pick = async (file: File | undefined) => {
    if (!file || !section) return;
    setBusy(true);
    try {
      await setVisionPhoto(section.id, await preparePhoto(file));
      setFocus({ x: 50, y: 50 });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That photo couldn’t be added.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!section || !confirmAction(`Delete “${section.title}” from your vision board?`)) return;
    onClose();
    await deleteVisionSection(section.id);
    onDeleted?.();
  };

  return (
    <Sheet
      open={section !== null}
      onClose={onClose}
      title={section ? `Edit ${section.title}` : undefined}
      action={
        <button onClick={save} className="text-headline text-accent">
          Save
        </button>
      }
    >
      {section && (
        <>
          <div className="mb-6 flex flex-col items-center">
            <FocusFrame
              url={photoUrl}
              aspect={section.photoAspect}
              focus={focus}
              onFocus={setFocus}
              color={colorVar(color)}
              emoji={emoji || section.emoji}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex h-10 items-center gap-1.5 rounded-full bg-accent-fill px-4 text-subhead font-semibold text-white disabled:opacity-50"
              >
                <ImagePlus size={17} aria-hidden /> {busy ? 'Adding…' : photoUrl ? 'Replace photo' : 'Choose a photo'}
              </button>
              {photoUrl && (
                <button
                  onClick={() => void removeVisionPhoto(section.id)}
                  className="h-10 rounded-full bg-[rgb(var(--fill)/0.14)] px-4 text-subhead font-semibold text-danger-text"
                >
                  Remove
                </button>
              )}
            </div>
            {photoUrl && (
              <p className="mt-2 flex items-center gap-1 text-footnote text-secondary">
                <Move size={13} aria-hidden /> Drag the photo to choose what shows
              </p>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          </div>

          <FormGroup>
            <TextField label="Name" value={title} onChange={setTitle} placeholder="Name, e.g. Travel" maxLength={40} />
          </FormGroup>
          <FormGroup header="Icon and colour">
            <EmojiField value={emoji} onChange={setEmoji} />
            <ColorPicker value={color} onChange={setColor} />
          </FormGroup>
          <FormGroup header="Your vision" footer="Write it as if it’s already true. You’ll read this every time you open the tile.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="I wake up in my own place by the sea…"
              aria-label="Your vision"
              className="block w-full resize-none bg-transparent px-4 py-3 font-serif text-[18px] leading-relaxed outline-none placeholder:text-[rgb(var(--label-3)/0.3)]"
            />
          </FormGroup>

          <button onClick={remove} className="mx-auto mt-2 flex h-11 items-center gap-1.5 px-4 text-body text-danger-text">
            <Trash2 size={17} aria-hidden /> Delete tile
          </button>
        </>
      )}
    </Sheet>
  );
}

/** The photo in its 4:5 frame; drag it to choose which part shows. */
function FocusFrame({
  url,
  aspect,
  focus,
  onFocus,
  color,
  emoji,
}: {
  url: string | null;
  aspect: number | null;
  focus: { x: number; y: number };
  onFocus: (f: { x: number; y: number }) => void;
  color: string;
  emoji: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onMove = (e: React.PointerEvent) => {
    if (!last.current || !ref.current || !aspect) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const delta = { dx: e.clientX - last.current.x, dy: e.clientY - last.current.y };
    last.current = { x: e.clientX, y: e.clientY };
    onFocus(dragFocus(focus, delta, coverOverflow(aspect, width, height)));
  };

  return (
    <motion.div
      ref={ref}
      animate={{ scale: dragging ? 1.02 : 1 }}
      className="relative w-[56%] max-w-[230px] touch-none overflow-hidden rounded-[6px] shadow-[0_10px_30px_rgb(0_0_0/0.25)]"
      style={{ aspectRatio: '4 / 5', cursor: url ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      onPointerDown={(e) => {
        if (!url) return;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
        setDragging(true);
      }}
      onPointerMove={onMove}
      onPointerUp={() => {
        last.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        last.current = null;
        setDragging(false);
      }}
    >
      {url ? (
        <img
          src={url}
          alt="Your photo"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-[56px]"
          style={{
            background: `radial-gradient(120% 90% at 30% 15%, color-mix(in srgb, ${color} 55%, white), color-mix(in srgb, ${color} 80%, black))`,
          }}
          aria-hidden
        >
          {emoji}
        </div>
      )}
      {/* Rule-of-thirds guides while dragging. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[1, 2].map((i) => (
            <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${(i * 100) / 3}%` }} />
          ))}
          {[1, 2].map((i) => (
            <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/50" style={{ top: `${(i * 100) / 3}%` }} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
