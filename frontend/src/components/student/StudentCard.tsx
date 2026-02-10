import { useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import type { Student } from '../../types/student'

interface StudentCardProps {
  student: Student
  onEdit: (student: Student) => void
  onDelete: (student: Student) => void
}

export function StudentCard({ student, onEdit, onDelete }: StudentCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/students/${student.id}/wrong-answers`)
  }

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
      data-testid={`student-card-${student.id}`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(student)}
          >
            수정
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(student)}
          >
            삭제
          </Button>
        </div>
      </div>

      {(student.grade || student.class_name) && (
        <p className="mt-1 text-sm text-gray-500">
          {[student.grade, student.class_name].filter(Boolean).join(' / ')}
        </p>
      )}

      {student.contact && (
        <p className="mt-1 text-sm text-gray-500">{student.contact}</p>
      )}

      {student.memo && (
        <p className="mt-2 text-sm text-gray-400 truncate">{student.memo}</p>
      )}
    </div>
  )
}
