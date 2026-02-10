import { create } from 'zustand'
import type { ProblemSet } from '../types/problemSet'

interface ProblemSetState {
  problemSets: ProblemSet[]
  loading: boolean
  error: string | null
  setProblemSets: (sets: ProblemSet[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useProblemSetStore = create<ProblemSetState>((set) => ({
  problemSets: [],
  loading: false,
  error: null,
  setProblemSets: (problemSets) => set({ problemSets }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
