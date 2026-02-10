import { useEffect, useState } from 'react'
import MainLayout from '../components/layout/MainLayout'
import { useStudents } from '../hooks/useStudents'
import { useStudentStore } from '../stores/studentStore'
import { StudentCard } from '../components/student/StudentCard'
import { StudentForm } from '../components/student/StudentForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Button from '../components/common/Button'
import type { Student } from '../types/student'

export default function StudentListPage() {
  const { students, loading, error } = useStudentStore()
  const { fetchStudents, createStudent, editStudent, deleteStudent } = useStudents()

  const [showForm, setShowForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const handleCreate = () => {
    setEditingStudent(null)
    setShowForm(true)
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setShowForm(true)
  }

  const handleSave = async (data: {
    name: string
    grade?: string
    class_name?: string
    contact?: string
    memo?: string
  }) => {
    if (editingStudent) {
      await editStudent(editingStudent.id, data)
    } else {
      await createStudent(data)
    }
  }

  const handleDeleteConfirm = async () => {
    if (deletingStudent) {
      await deleteStudent(deletingStudent.id)
      setDeletingStudent(null)
    }
  }

  return (
    <MainLayout>
      <div data-testid="student-list-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
          <Button onClick={handleCreate}>
            학생 추가
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">불러오는 중...</div>
          </div>
        )}

        {!loading && students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-lg">등록된 학생이 없습니다.</p>
            <p className="mt-1 text-sm">학생을 추가해주세요.</p>
          </div>
        )}

        {!loading && students.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onEdit={handleEdit}
                onDelete={setDeletingStudent}
              />
            ))}
          </div>
        )}

        {showForm && (
          <StudentForm
            key={editingStudent?.id ?? 'new'}
            student={editingStudent}
            isOpen={showForm}
            onClose={() => setShowForm(false)}
            onSave={handleSave}
          />
        )}

        {deletingStudent && (
          <ConfirmDialog
            open={!!deletingStudent}
            onClose={() => setDeletingStudent(null)}
            onConfirm={handleDeleteConfirm}
            title="학생 삭제"
            message={`"${deletingStudent.name}" 학생을 삭제하시겠습니까? 해당 학생의 오답노트도 모두 삭제됩니다.`}
            confirmLabel="삭제"
          />
        )}
      </div>
    </MainLayout>
  )
}
