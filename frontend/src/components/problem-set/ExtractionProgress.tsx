interface ExtractionProgressProps {
  status: 'idle' | 'extracting' | 'done' | 'error' | 'cancelled'
  currentChapter: string
  chaptersCompleted: number
  totalChapters: number
  totalProblems: number
  errorMessage: string
  onCancel: () => void
  onReset: () => void
  problemSetId: number | null
}

export function ExtractionProgress({
  status,
  currentChapter,
  chaptersCompleted,
  totalChapters,
  totalProblems,
  errorMessage,
  onCancel,
  onReset,
  problemSetId,
}: ExtractionProgressProps) {
  if (status === 'idle') return null

  const progressPercent = totalChapters > 0
    ? Math.round((chaptersCompleted / totalChapters) * 100)
    : 0

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200" data-testid="extraction-progress">
      {status === 'extracting' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">추출 중...</span>
            <button
              onClick={onCancel}
              className="text-sm text-red-600 hover:text-red-700"
              data-testid="cancel-button"
            >
              취소
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              data-testid="progress-bar"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {currentChapter && `현재: ${currentChapter}`}
            </span>
            <span>
              {chaptersCompleted}/{totalChapters} 단원 ({totalProblems}문제)
            </span>
          </div>
        </>
      )}

      {status === 'done' && (
        <div className="text-center space-y-3">
          <p className="text-green-600 font-medium" data-testid="done-message">
            추출 완료 - {totalChapters}개 단원, {totalProblems}개 문제
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href={`/problem-sets/${problemSetId}/verify`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              검증하기
            </a>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              새로 가져오기
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium" data-testid="error-message">
            오류: {errorMessage}
          </p>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === 'cancelled' && (
        <div className="text-center space-y-3">
          <p className="text-yellow-600 font-medium">추출이 취소되었습니다.</p>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
