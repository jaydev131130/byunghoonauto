import { useState, useCallback, useRef } from 'react'

interface ExtractionProgress {
  type: 'chapter_start' | 'problem' | 'chapter_done' | 'done' | 'error' | 'cancelled'
  chapter?: string
  total_chapters?: number
  total_so_far?: number
  total_problems?: number
  message?: string
}

type ExtractionStatus = 'idle' | 'extracting' | 'done' | 'error' | 'cancelled'

interface ExtractionState {
  status: ExtractionStatus
  jobId: string | null
  problemSetId: number | null
  currentChapter: string
  chaptersCompleted: number
  totalChapters: number
  totalProblems: number
  errorMessage: string
}

const initialState: ExtractionState = {
  status: 'idle',
  jobId: null,
  problemSetId: null,
  currentChapter: '',
  chaptersCompleted: 0,
  totalChapters: 0,
  totalProblems: 0,
  errorMessage: '',
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>(initialState)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startExtraction = useCallback(async (folderPath: string) => {
    setState({ ...initialState, status: 'extracting' })

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath }),
      })

      if (!res.ok) {
        const err = await res.json()
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: err.detail || '추출 시작에 실패했습니다.',
        }))
        return
      }

      const data = await res.json()
      const { job_id, problem_set_id } = data

      setState(prev => ({
        ...prev,
        jobId: job_id,
        problemSetId: problem_set_id,
      }))

      const es = new EventSource(`/api/extract/progress/${job_id}`)
      eventSourceRef.current = es

      es.addEventListener('progress', (event) => {
        const progress: ExtractionProgress = JSON.parse(event.data)

        setState(prev => {
          switch (progress.type) {
            case 'chapter_start':
              return {
                ...prev,
                currentChapter: progress.chapter ?? '',
                totalChapters: progress.total_chapters ?? prev.totalChapters,
              }
            case 'problem':
              return {
                ...prev,
                totalProblems: progress.total_so_far ?? prev.totalProblems,
              }
            case 'chapter_done':
              return {
                ...prev,
                chaptersCompleted: prev.chaptersCompleted + 1,
              }
            case 'done':
              es.close()
              return {
                ...prev,
                status: 'done',
                totalProblems: progress.total_problems ?? prev.totalProblems,
                totalChapters: progress.total_chapters ?? prev.totalChapters,
                chaptersCompleted: progress.total_chapters ?? prev.chaptersCompleted,
              }
            case 'error':
              es.close()
              return {
                ...prev,
                status: 'error',
                errorMessage: progress.message ?? '알 수 없는 오류',
              }
            case 'cancelled':
              es.close()
              return {
                ...prev,
                status: 'cancelled',
              }
            default:
              return prev
          }
        })
      })

      es.onerror = () => {
        es.close()
        setState(prev => {
          if (prev.status === 'extracting') {
            return { ...prev, status: 'error', errorMessage: 'SSE 연결이 끊어졌습니다.' }
          }
          return prev
        })
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : '추출에 실패했습니다.',
      }))
    }
  }, [])

  const cancelExtraction = useCallback(async () => {
    if (state.jobId) {
      await fetch(`/api/extract/cancel/${state.jobId}`, { method: 'POST' })
      eventSourceRef.current?.close()
    }
  }, [state.jobId])

  const reset = useCallback(() => {
    eventSourceRef.current?.close()
    setState(initialState)
  }, [])

  return {
    ...state,
    startExtraction,
    cancelExtraction,
    reset,
  }
}
