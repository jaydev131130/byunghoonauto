// ─────────────────────────────────────────────────
// Interface Contract: POST /api/extract/upload
// Backend + Frontend 모두 이 타입을 참조
// ─────────────────────────────────────────────────

/** FormData field names (must match exactly between frontend/backend) */
export const UPLOAD_FIELD_NAME = 'name' as const
export const UPLOAD_FIELD_FILES = 'files' as const

/** POST /api/extract/upload — Success Response */
export interface ExtractUploadResponse {
  job_id: string
  problem_set_id: number
}

/** POST /api/extract/upload — Error types */
export type ExtractionErrorType = 'conflict' | 'validation' | 'server' | 'network'

export interface ExtractionError {
  type: ExtractionErrorType
  message: string
}

/** Map HTTP status codes to error types */
export function mapHttpStatusToErrorType(status: number): ExtractionErrorType {
  if (status === 409) return 'conflict'
  if (status === 400) return 'validation'
  return 'server'
}

/** Extraction hook status (includes new 'uploading' state) */
export type ExtractionStatus =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'done'
  | 'error'
  | 'cancelled'

/** SSE progress event types (unchanged from existing) */
export interface ExtractionProgress {
  type: 'chapter_start' | 'problem' | 'chapter_done' | 'done' | 'error' | 'cancelled'
  chapter?: string
  index?: number
  total_chapters?: number
  number?: number
  total_so_far?: number
  total_problems?: number
  problems?: number
  message?: string
}

/** Full extraction state */
export interface ExtractionState {
  status: ExtractionStatus
  jobId: string | null
  problemSetId: number | null
  currentChapter: string
  chaptersCompleted: number
  totalChapters: number
  totalProblems: number
  errorMessage: string
  errorType: ExtractionErrorType | null
}

// ─────────────────────────────────────────────────
// Backend constraints (replicated for frontend validation)
// ─────────────────────────────────────────────────
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,       // 100MB per file
  MAX_TOTAL_SIZE_BYTES: 500 * 1024 * 1024,       // 500MB total
  MAX_FILE_COUNT: 50,
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 1,
} as const
