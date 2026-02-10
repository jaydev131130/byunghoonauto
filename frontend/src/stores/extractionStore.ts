import { create } from 'zustand'

interface ExtractionState {
  status: string
  currentFile: string
  currentPage: number
  totalPages: number
  problemsFound: number
  message: string
  setProgress: (progress: Partial<ExtractionState>) => void
  reset: () => void
}

const initialState = {
  status: 'idle',
  currentFile: '',
  currentPage: 0,
  totalPages: 0,
  problemsFound: 0,
  message: '',
}

export const useExtractionStore = create<ExtractionState>((set) => ({
  ...initialState,
  setProgress: (progress) => set((state) => ({ ...state, ...progress })),
  reset: () => set(initialState),
}))
