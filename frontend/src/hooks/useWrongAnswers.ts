import { useState, useCallback } from 'react'
import { api } from '../lib/api'

interface WrongAnswerSet {
  id: number
  student_id: number
  title: string
  created_at: string
}

interface WrongAnswerEntry {
  id: number
  chapter_id: number
  chapter_name: string
  problem_set_name: string
  problem_numbers: number[]
}

interface EntryInput {
  chapter_id: number
  problem_numbers: number[]
}

export function useWrongAnswers() {
  const [sets, setSets] = useState<WrongAnswerSet[]>([])
  const [entries, setEntries] = useState<WrongAnswerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSets = useCallback(async (studentId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<WrongAnswerSet[]>(
        `/students/${studentId}/wrong-answer-sets`
      )
      setSets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오답노트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const createSet = useCallback(
    async (studentId: number, title?: string) => {
      const newSet = await api.post<WrongAnswerSet>('/wrong-answer-sets', {
        student_id: studentId,
        title,
      })
      setSets((prev) => [newSet, ...prev])
      return newSet
    },
    []
  )

  const deleteSet = useCallback(async (setId: number) => {
    await api.delete(`/wrong-answer-sets/${setId}`)
    setSets((prev) => prev.filter((s) => s.id !== setId))
  }, [])

  const fetchEntries = useCallback(async (setId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<WrongAnswerEntry[]>(
        `/wrong-answer-sets/${setId}/entries`
      )
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오답 항목을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveEntries = useCallback(
    async (setId: number, entryInputs: EntryInput[]) => {
      const data = await api.put<WrongAnswerEntry[]>(
        `/wrong-answer-sets/${setId}/entries`,
        { entries: entryInputs }
      )
      setEntries(data)
      return data
    },
    []
  )

  return {
    sets,
    entries,
    setEntries,
    loading,
    error,
    fetchSets,
    createSet,
    deleteSet,
    fetchEntries,
    saveEntries,
  }
}
