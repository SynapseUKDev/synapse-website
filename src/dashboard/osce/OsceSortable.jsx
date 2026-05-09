import React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { LuGripVertical } from 'react-icons/lu'

/**
 * A generic sortable list wrapper.
 * items: Array of objects with an 'id' property.
 * onReorder: Callback function(newOrderedItems)
 * renderItem: Function(item, dragHandleProps)
 */
export function SortableList({ items, onReorder, renderItem, className, strategy = verticalListSortingStrategy }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Avoid accidental drags when clicking
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      onReorder(arrayMove(items, oldIndex, newIndex))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
    >
      <SortableContext items={items.map(i => i.id)} strategy={strategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {(dragHandleProps) => renderItem(item, dragHandleProps)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
  }

  const dragHandleProps = {
    ...attributes,
    ...listeners,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  )
}

export function DragHandle({ props, className, style }) {
  return (
    <div
      {...props}
      className={`osce-drag-handle ${className || ''}`}
      style={{ cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', color: 'var(--syn-muted)', ...style }}
    >
      <LuGripVertical size={16} />
    </div>
  )
}
