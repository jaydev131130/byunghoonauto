import { useCallback } from 'react'
import { api } from '../lib/api'
import { useProblemSetStore } from '../stores/problemSetStore'
import type { ProblemSet } from '../types/problemSet'

export function useProblemSets() {
  const { problemSets, loading, error, setProblemSets, setLoading, setError } =
    useProblemSetStore()

  const fetchProblemSets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<ProblemSet[]>('/problem-sets')
      setProblemSets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제집 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [setProblemSets, setLoading, setError])

  const deleteProblemSet = useCallback(async (id: number) => {
    try {
      await api.delete(`/problem-sets/${id}`)
      setProblemSets(problemSets.filter(ps => ps.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    }
  }, [problemSets, setProblemSets, setError])

  return {
    problemSets,
    loading,
    error,
    fetchProblemSets,
    deleteProblemSet,
  }
}
