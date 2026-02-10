import { create } from 'zustand'
import type { Student } from '../types/student'

interface StudentState {
  students: Student[]
  loading: boolean
  error: string | null
  setStudents: (students: Student[]) => void
  addStudent: (student: Student) => void
  updateStudent: (id: number, student: Student) => void
  removeStudent: (id: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useStudentStore = create<StudentState>((set) => ({
  students: [],
  loading: false,
  error: null,
  setStudents: (students) => set({ students }),
  addStudent: (student) =>
    set((state) => ({ students: [...state.students, student] })),
  updateStudent: (id, student) =>
    set((state) => ({
      students: state.students.map((s) => (s.id === id ? student : s)),
    })),
  removeStudent: (id) =>
    set((state) => ({
      students: state.students.filter((s) => s.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
