import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NumberEditor } from './NumberEditor'

interface ImageCardProps {
  id: number
  number: number
  imagePath: string
  onNumberChange: (newNumber: number) => void
  onDelete: () => void
}

export function ImageCard({ id, number, imagePath, onNumberChange, onDelete }: ImageCardProps) {
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
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm
                 hover:shadow-md transition-shadow group"
      data-testid={`image-card-${id}`}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
        <NumberEditor number={number} onSave={onNumberChange} />
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          title="드래그하여 순서 변경"
          data-testid={`drag-handle-${id}`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <img
          src={`/images/${imagePath}`}
          alt={`문제 ${number}`}
          loading="lazy"
          className="w-full h-auto object-contain bg-gray-50"
          style={{ maxHeight: '400px' }}
        />
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full
                     opacity-0 group-hover:opacity-100 transition-opacity"
          title="삭제"
          data-testid={`delete-problem-${id}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
