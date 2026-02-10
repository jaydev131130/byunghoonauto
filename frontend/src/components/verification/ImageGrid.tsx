import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { ImageCard } from './ImageCard'

interface Problem {
  id: number
  number: number
  image_path: string
}

interface ImageGridProps {
  problems: Problem[]
  onReorder: (order: number[]) => void
  onNumberChange: (problemId: number, newNumber: number) => void
  onDelete: (problemId: number) => void
}

export function ImageGrid({ problems, onReorder, onNumberChange, onDelete }: ImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = Number(active.id)
    const overId = Number(over.id)

    const oldIndex = problems.findIndex(p => p.id === activeId)
    const newIndex = problems.findIndex(p => p.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(problems, oldIndex, newIndex)
    onReorder(reordered.map(p => p.id))
  }

  if (problems.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        이 단원에 문제가 없습니다.
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={problems.map(p => p.id)} strategy={rectSortingStrategy}>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="image-grid"
        >
          {problems.map(problem => (
            <ImageCard
              key={problem.id}
              id={problem.id}
              number={problem.number}
              imagePath={problem.image_path}
              onNumberChange={(n) => onNumberChange(problem.id, n)}
              onDelete={() => {
                if (window.confirm(`문제 #${problem.number}을 삭제하시겠습니까?`)) {
                  onDelete(problem.id)
                }
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
