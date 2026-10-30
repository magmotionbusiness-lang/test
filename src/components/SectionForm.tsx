import { useEffect, useState } from 'react';
import { createSection, nextOrder, updateSection } from '@/db/repo';
import type { HabitColor, Section } from '@/db/types';
import { Sheet } from './Sheet';
import { ColorPicker, EmojiField, FieldRow, FormGroup, TextField } from './form';
import { Toggle } from './ui';
import { toast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  section?: Section;
}

export function SectionForm({ open, onClose, section }: Props) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState<HabitColor>('blue');
  const [description, setDescription] = useState('');
  const [gym, setGym] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(section?.name ?? '');
    setEmoji(section?.emoji ?? '📁');
    setColor(section?.color ?? 'blue');
    setDescription(section?.description ?? '');
    setGym(section?.kind === 'gym');
  }, [open, section]);

  const valid = name.trim() !== '';

  const save = async () => {
    if (!valid) return;
    const data = {
      name: name.trim(),
      emoji: emoji || '📁',
      color,
      description: description.trim(),
      kind: gym ? ('gym' as const) : ('standard' as const),
    };
    if (section) await updateSection(section.id, data);
    else await createSection({ ...data, archived: false, order: await nextOrder('sections') });
    toast(section ? 'Section saved' : `${data.name} added`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={section ? 'Edit Section' : 'New Section'}
      action={
        <button onClick={save} disabled={!valid} className="text-headline text-accent disabled:opacity-30">
          {section ? 'Save' : 'Add'}
        </button>
      }
    >
      <FormGroup>
        <TextField label="Name" value={name} onChange={setName} placeholder="Name, e.g. Gym" autoFocus={!section} />
        <EmojiField value={emoji} onChange={setEmoji} />
        <TextField label="Description" value={description} onChange={setDescription} placeholder="Description (optional)" maxLength={80} />
      </FormGroup>
      <FormGroup header="Color">
        <ColorPicker value={color} onChange={setColor} />
      </FormGroup>
      <FormGroup footer="Gym sections add workout logging, weekly volume and personal records.">
        <FieldRow label="Gym section">
          <Toggle checked={gym} onChange={setGym} label="Gym section" />
        </FieldRow>
      </FormGroup>
    </Sheet>
  );
}
