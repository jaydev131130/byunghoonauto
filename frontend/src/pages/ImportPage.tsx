import MainLayout from '../components/layout/MainLayout'
import { FileDropZone } from '../components/problem-set/FileDropZone'
import { ExtractionProgress } from '../components/problem-set/ExtractionProgress'
import { useExtraction } from '../hooks/useExtraction'

export default function ImportPage() {
  const extraction = useExtraction()

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
