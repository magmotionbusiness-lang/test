import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  title: string;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}

export function NoteSheet({ open, title, initial, onClose, onSave }: Props) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      action={
        <button
          className="text-headline text-accent"
          onClick={() => {
            onSave(text.trim());
            onClose();
          }}
        >
          Save
        </button>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={5}
        placeholder="How did it go?"
        aria-label="Note"
        className="w-full resize-none rounded-row bg-bg-2 p-4 text-body outline-none"
      />
    </Sheet>
  );
}
