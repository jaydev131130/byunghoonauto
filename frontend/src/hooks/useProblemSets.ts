import { useCallback } from 'react'
import { api } from '../lib/api'
import { useProblemSetStore } from '../stores/problemSetStore'
import type { ProblemSet } from '../types/problemSet'

function sortProblemSets(sets: ProblemSet[]) {
  return [...sets].sort((a, b) =>
    a.name.localeCompare(b.name, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

export function useProblemSets() {
  const { problemSets, loading, error, setProblemSets, setLoading, setError } =
    useProblemSetStore()

  const fetchProblemSets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<ProblemSet[]>('/problem-sets')
      setProblemSets(sortProblemSets(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제집 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [setProblemSets, setLoading, setError])

  const updateProblemSet = useCallback(async (id: number, name: string) => {
    const updated = await api.put<ProblemSet>(`/problem-sets/${id}`, { name })
    setProblemSets(sortProblemSets(problemSets.map(ps => (
      ps.id === id
        ? { ...ps, ...updated, chapter_count: ps.chapter_count, total_problems: ps.total_problems }
        : ps
    ))))
    return updated
  }, [problemSets, setProblemSets])

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
    updateProblemSet,
    deleteProblemSet,
  }
}
