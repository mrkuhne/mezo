import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@/shared/ui/Icon'

export interface SortableItem {
  id: string
  label?: string
}

interface SortableListProps<T extends SortableItem> {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T, index: number) => ReactNode
  disabled?: boolean
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
}: SortableListProps<T>) {
  const ids = items.map((i) => i.id)

  const sensors = useSensors(
    // delay avoids fighting vertical scroll on touch; tolerance lets a small
    // movement before the delay still count as a tap rather than a drag start.
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="col gap-sm">
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              label={item.label ?? item.id}
              index={index}
              count={items.length}
              disabled={disabled}
              moveUp={() => onReorder(arrayMove(ids, index, index - 1))}
              moveDown={() => onReorder(arrayMove(ids, index, index + 1))}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableRowProps {
  id: string
  label: string
  index: number
  count: number
  disabled: boolean
  children: ReactNode
  moveUp: () => void
  moveDown: () => void
}

function SortableRow({
  id,
  label,
  index,
  count,
  disabled,
  children,
  moveUp,
  moveDown,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const isFirst = index === 0
  const isLast = index === count - 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="row gap-sm"
      data-sortable-row={id}
    >
      {/* Drag handle — only this element starts a pointer/keyboard drag, so the
          ▲▼ buttons and the row content stay independently interactive. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${label} áthelyezése`}
        disabled={disabled}
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          minHeight: 28,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary, currentColor)',
          cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          padding: 0,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
          ⠿
        </span>
      </button>

      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>

      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <button
          type="button"
          aria-label={`${label} feljebb`}
          disabled={disabled || isFirst}
          onClick={moveUp}
          style={reorderBtnStyle(disabled || isFirst)}
        >
          <Icon name="chevron-up" size={18} />
        </button>
        <button
          type="button"
          aria-label={`${label} lejjebb`}
          disabled={disabled || isLast}
          onClick={moveDown}
          style={reorderBtnStyle(disabled || isLast)}
        >
          <Icon name="chevron-down" size={18} />
        </button>
      </div>
    </div>
  )
}

function reorderBtnStyle(isDisabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    minHeight: 28,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary, currentColor)',
    cursor: isDisabled ? 'default' : 'pointer',
    padding: 0,
    opacity: isDisabled ? 0.3 : 1,
  }
}
