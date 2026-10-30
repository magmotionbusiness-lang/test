import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface Props<T extends { id: string }> {
  items: T[];
  editing: boolean;
  onReorder: (ids: string[]) => void;
  render: (item: T) => ReactNode;
  className?: string;
  itemClassName?: string;
}

/**
 * List that becomes drag-reorderable in edit mode, with a grip handle on each
 * row (so dragging never fights page scrolling). Commits on drop.
 */
export function ReorderList<T extends { id: string }>({ items, editing, onReorder, render, className, itemClassName }: Props<T>) {
  const [order, setOrder] = useState(items);
  useEffect(() => setOrder(items), [items]);

  return (
    <Reorder.Group axis="y" values={order} onReorder={setOrder} className={className}>
      {order.map((item) => (
        <Item key={item.id} item={item} editing={editing} className={itemClassName} onDrop={() => onReorder(order.map((o) => o.id))}>
          {render(item)}
        </Item>
      ))}
    </Reorder.Group>
  );
}

function Item<T>({ item, editing, children, className, onDrop }: { item: T; editing: boolean; children: ReactNode; className?: string; onDrop: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} onDragEnd={onDrop} className={`relative flex items-center ${className ?? ''}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {editing && (
        <button
          className="flex h-11 w-11 shrink-0 touch-none items-center justify-center text-tertiary"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Drag to reorder"
        >
          <GripVertical size={22} aria-hidden />
        </button>
      )}
    </Reorder.Item>
  );
}
