import { useState, useCallback, useRef } from 'react'
import type {
  ExtractionState,
  ExtractionProgress,
  ExtractionStatus,
  ExtractionErrorType,
  ExtractUploadResponse,
} from '../types/extraction'
import {
  UPLOAD_FIELD_NAME,
  UPLOAD_FIELD_FILES,
  mapHttpStatusToErrorType,
} from '../types/extraction'

// Re-export for consumers who import ExtractionStatus from here
export type { ExtractionStatus, ExtractionErrorType }

const initialState: ExtractionState = {
  status: 'idle',
  jobId: null,
  problemSetId: null,
  currentChapter: '',
  chaptersCompleted: 0,
  totalChapters: 0,
  totalProblems: 0,
  errorMessage: '',
  errorType: null,
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>(initialState)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startExtraction = useCallback(
    async (files: File[], problemSetName: string) => {
      setState({ ...initialState, status: 'uploading' })

      try {
        const formData = new FormData()
        formData.append(UPLOAD_FIELD_NAME, problemSetName)
        files.forEach(f => formData.append(UPLOAD_FIELD_FILES, f))

        // No Content-Type header — browser sets it with the correct boundary
        const res = await fetch('/api/extract/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: (err as { detail?: string }).detail || '업로드에 실패했습니다.',
            errorType: mapHttpStatusToErrorType(res.status),
          }))
          return
        }

        const data: ExtractUploadResponse = await res.json()
        const { job_id, problem_set_id } = data

        setState(prev => ({
          ...prev,
          status: 'extracting',
          jobId: job_id,
          problemSetId: problem_set_id,
        }))

        const es = new EventSource(`/api/extract/progress/${job_id}`)
        eventSourceRef.current = es

        es.addEventListener('progress', (event: MessageEvent) => {
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
              const hint = prev.problemSetId
                ? ' 문제집 목록에서 확인해보세요.'
                : ''
              return {
                ...prev,
                status: 'error',
                errorMessage: `SSE 연결이 끊어졌습니다.${hint}`,
              }
            }
            return prev
          })
        }
      } catch (err) {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage:
            err instanceof Error ? err.message : '추출에 실패했습니다.',
          errorType: 'network',
        }))
      }
    },
    [],
  )

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
