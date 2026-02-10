import { useCallback } from 'react'
import { api } from '../lib/api'
import { useStudentStore } from '../stores/studentStore'
import type { Student } from '../types/student'

interface StudentCreateInput {
  name: string
  grade?: string
  class_name?: string
  contact?: string
  memo?: string
}

export function useStudents() {
  const { setStudents, addStudent, updateStudent, removeStudent, setLoading, setError } =
    useStudentStore()

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Student[]>('/students')
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '학생 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [setStudents, setLoading, setError])

  const createStudent = useCallback(
    async (input: StudentCreateInput) => {
      const student = await api.post<Student>('/students', input)
      addStudent(student)
      return student
    },
    [addStudent]
  )

  const editStudent = useCallback(
    async (id: number, input: Partial<StudentCreateInput>) => {
      const student = await api.put<Student>(`/students/${id}`, input)
      updateStudent(id, student)
      return student
    },
    [updateStudent]
  )

  const deleteStudent = useCallback(
    async (id: number) => {
      await api.delete(`/students/${id}`)
      removeStudent(id)
    },
    [removeStudent]
  )

  return { fetchStudents, createStudent, editStudent, deleteStudent }
}
