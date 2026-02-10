import { useState, useCallback } from 'react'
import { api } from '../lib/api'

interface Problem {
  id: number
  number: number
  image_path: string
  width: number
  height: number
  file_size: number
  page_num: number | null
  column_pos: string | null
}

interface Chapter {
  id: number
  name: string
  problem_set_id: number
}

interface ChapterProblemsResponse {
  chapter: Chapter
  problems: Problem[]
}

export function useProblems(chapterId: number | null) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchProblems = useCallback(async () => {
    if (!chapterId) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<ChapterProblemsResponse>(
        `/chapters/${chapterId}/problems`
      )
      setProblems(data.problems)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  const reorderProblems = useCallback(async (order: number[]) => {
    if (!chapterId) return
    try {
      await api.put(`/chapters/${chapterId}/problems/reorder`, { order })
      await fetchProblems()
    } catch (err) {
      setError(err instanceof Error ? err.message : '순서 변경에 실패했습니다.')
    }
  }, [chapterId, fetchProblems])

  const bulkShift = useCallback(async (fromNumber: number, shift: number) => {
    if (!chapterId) return
    try {
      await api.put(`/chapters/${chapterId}/problems/bulk-shift`, {
        from_number: fromNumber,
        shift,
      })
      await fetchProblems()
    } catch (err) {
      setError(err instanceof Error ? err.message : '일괄 변경에 실패했습니다.')
    }
  }, [chapterId, fetchProblems])

  const updateNumber = useCallback(async (problemId: number, newNumber: number) => {
    try {
      await api.put(`/problems/${problemId}/number`, { number: newNumber })
      await fetchProblems()
    } catch (err) {
      setError(err instanceof Error ? err.message : '번호 변경에 실패했습니다.')
    }
  }, [fetchProblems])

  const deleteProblem = useCallback(async (problemId: number) => {
    try {
      await api.delete(`/problems/${problemId}`)
      setProblems(prev => prev.filter(p => p.id !== problemId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }, [])

  return {
    problems,
    loading,
    error,
    fetchProblems,
    reorderProblems,
    bulkShift,
    updateNumber,
    deleteProblem,
  }
}
