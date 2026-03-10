import { useRef, useEffect } from 'react'
import MainLayout from '../components/layout/MainLayout'
import { FileDropZone } from '../components/problem-set/FileDropZone'
import { ExtractionProgress } from '../components/problem-set/ExtractionProgress'
import { useExtraction } from '../hooks/useExtraction'

export default function ImportPage() {
  const extraction = useExtraction()
  const debugFolderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debugFolderRef.current) {
      debugFolderRef.current.setAttribute('webkitdirectory', '')
      debugFolderRef.current.setAttribute('directory', '')
    }
  }, [])

  // Upload errors (no job started) → keep FileDropZone visible with error feedback
  // Extraction started → show ExtractionProgress
  const isUploadError = extraction.status === 'error' && !extraction.jobId
  const hasJobStarted = extraction.jobId !== null

  // Show drop zone when idle, uploading (to preserve preview state), or upload error
  const showDropZone = !hasJobStarted || isUploadError
  // Show progress only after a job has been created
  const showProgress = hasJobStarted && extraction.status !== 'idle'

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">문제집 가져오기</h1>

        {/* ── DEBUG: 순수 HTML 테스트 (근본 원인 파악용) ──────────────── */}
        <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
          <p className="text-sm font-bold text-yellow-800 mb-3">
            [DEBUG] 아래 3개 버튼을 각각 눌러보세요. 어떤 것이 반응하나요?
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-700 w-20">1. 기본:</span>
              <input type="file" accept=".pdf" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-700 w-20">2. 폴더:</span>
              <input ref={debugFolderRef} type="file" multiple />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-yellow-700 w-20">3. 버튼식:</span>
              <button
                type="button"
                className="px-3 py-1 bg-yellow-200 border border-yellow-500 rounded text-sm"
                onClick={() => debugFolderRef.current?.click()}
              >
                프로그래밍 click() 테스트
              </button>
            </div>
          </div>
        </div>
        {/* ── END DEBUG ────────────────────────────────────────────────── */}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {showDropZone && (
            <FileDropZone
              onSubmit={extraction.startExtraction}
              disabled={extraction.status === 'uploading'}
              errorType={isUploadError ? extraction.errorType : null}
              onErrorClear={extraction.reset}
            />
          )}

          {showProgress && (
            <ExtractionProgress
              status={extraction.status}
              currentChapter={extraction.currentChapter}
              chaptersCompleted={extraction.chaptersCompleted}
              totalChapters={extraction.totalChapters}
              totalProblems={extraction.totalProblems}
              errorMessage={extraction.errorMessage}
              onCancel={extraction.cancelExtraction}
              onReset={extraction.reset}
              problemSetId={extraction.problemSetId}
            />
          )}
        </div>
      </div>
    </MainLayout>
  )
}
