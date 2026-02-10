import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import { ImageGrid } from '../components/verification/ImageGrid'
import { BulkShiftModal } from '../components/verification/BulkShiftModal'
import { useProblems } from '../hooks/useProblems'
import { api } from '../lib/api'

interface ChapterInfo {
  id: number
  name: string
  sort_order: number
  problem_count: number
  image_count: number
}

interface ProblemSetDetail {
  id: number
  name: string
  chapters: ChapterInfo[]
}

interface RepairResult {
  chapter_id: number
  deleted_records: number
  extracted_count: number
  image_files: number
}

interface HealthResult {
  problem_set_id: number
  chapters: Array<{
    chapter_id: number
    name: string
    healthy: boolean
    missing_files: number[]
    orphan_files: string[]
    problem_count: number
    image_count: number
  }>
  all_healthy: boolean
}

export default function VerificationPage() {
  const { id } = useParams<{ id: string }>()
  const problemSetId = Number(id)

  const [problemSet, setProblemSet] = useState<ProblemSetDetail | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [showBulkShift, setShowBulkShift] = useState(false)
  const [loadingProblemSet, setLoadingProblemSet] = useState(true)
  const [repairingChapterId, setRepairingChapterId] = useState<number | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [repairMessage, setRepairMessage] = useState<string | null>(null)

  const {
    problems,
    loading: loadingProblems,
    error,
    fetchProblems,
    reorderProblems,
    bulkShift,
    updateNumber,
    deleteProblem,
  } = useProblems(selectedChapterId)

  const refreshProblemSet = useCallback(async () => {
    try {
      const data = await api.get<ProblemSetDetail>(`/problem-sets/${problemSetId}`)
      setProblemSet(data)
      return data
    } catch {
      return null
    }
  }, [problemSetId])

  const repairChapter = useCallback(async (chapterId: number) => {
    setRepairingChapterId(chapterId)
    setRepairMessage(null)
    try {
      const result = await api.post<RepairResult>(`/chapters/${chapterId}/repair`)
      await refreshProblemSet()
      if (selectedChapterId === chapterId) {
        fetchProblems()
      }
      setRepairMessage(
        `복구 완료: ${result.extracted_count}개 문제 재추출 (기존 ${result.deleted_records}건 삭제)`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '복구 실패'
      setRepairMessage(`복구 실패: ${message}`)
    } finally {
      setRepairingChapterId(null)
    }
  }, [refreshProblemSet, selectedChapterId, fetchProblems])

  const verifyAll = useCallback(async () => {
    setVerifying(true)
    setRepairMessage(null)
    try {
      const health = await api.get<HealthResult>(`/problem-sets/${problemSetId}/health`)
      if (health.all_healthy) {
        setRepairMessage('전체 검증 완료: 모든 단원이 정상입니다.')
      } else {
        const unhealthy = health.chapters.filter(ch => !ch.healthy)
        setRepairMessage(
          `검증 완료: ${unhealthy.length}개 단원에 불일치 발견 (${unhealthy.map(ch => ch.name).join(', ')})`
        )
      }
      await refreshProblemSet()
    } catch {
      setRepairMessage('전체 검증 중 오류가 발생했습니다.')
    } finally {
      setVerifying(false)
    }
  }, [problemSetId, refreshProblemSet])

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<ProblemSetDetail>(`/problem-sets/${problemSetId}`)
        setProblemSet(data)
        if (data.chapters.length > 0) {
          setSelectedChapterId(data.chapters[0].id)
        }
      } catch {
        setProblemSet(null)
      } finally {
        setLoadingProblemSet(false)
      }
    })()
  }, [problemSetId])

  useEffect(() => {
    if (selectedChapterId) {
      fetchProblems()
    }
  }, [selectedChapterId, fetchProblems])

  const summary = useMemo(() => {
    if (!problemSet) return { totalChapters: 0, totalProblems: 0, totalImages: 0, percentage: 0, hasAnyMismatch: false }
    const totalChapters = problemSet.chapters.length
    const totalProblems = problemSet.chapters.reduce((sum, ch) => sum + ch.problem_count, 0)
    const totalImages = problemSet.chapters.reduce((sum, ch) => sum + ch.image_count, 0)
    const percentage = totalProblems > 0 ? Math.round((totalImages / totalProblems) * 100) : 0
    const hasAnyMismatch = problemSet.chapters.some(ch => ch.image_count !== ch.problem_count)
    return { totalChapters, totalProblems, totalImages, percentage, hasAnyMismatch }
  }, [problemSet])

  if (loadingProblemSet) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      </MainLayout>
    )
  }

  if (!problemSet) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-red-500">문제집을 찾을 수 없습니다.</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{problemSet.name}</h1>
            <p className="text-sm text-gray-500 mt-1">검증 및 순서 조정</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={verifyAll}
              disabled={verifying}
              className="px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg
                         hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="verify-all-btn"
            >
              {verifying ? '검증 중...' : '전체 검증'}
            </button>
            <button
              onClick={() => setShowBulkShift(true)}
              disabled={!selectedChapterId || problems.length === 0}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg
                         hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              일괄 변경
            </button>
            <a
              href="/"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              목록으로
            </a>
          </div>
        </div>

        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
            summary.percentage === 100 && !summary.hasAnyMismatch
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}
          data-testid="extraction-summary"
        >
          <span>
            전체: {summary.totalChapters}개 단원 | {summary.totalImages}/{summary.totalProblems}문제
            이미지 추출 ({summary.percentage}%)
            {summary.hasAnyMismatch && (
              <span className="ml-2 text-red-600 font-semibold">| 불일치 감지</span>
            )}
          </span>
        </div>

        {repairMessage && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
              repairMessage.includes('실패') || repairMessage.includes('불일치')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}
            data-testid="repair-message"
          >
            {repairMessage}
            <button
              onClick={() => setRepairMessage(null)}
              className="ml-2 text-xs underline opacity-70 hover:opacity-100"
            >
              닫기
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2" data-testid="chapter-tabs">
          {problemSet.chapters.map(ch => {
            const isComplete = ch.image_count === ch.problem_count && ch.problem_count > 0
            const hasMismatch = ch.image_count !== ch.problem_count
            const isRepairing = repairingChapterId === ch.id
            return (
              <div key={ch.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedChapterId(ch.id)}
                  className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                    selectedChapterId === ch.id
                      ? 'bg-blue-600 text-white'
                      : isComplete
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : hasMismatch
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  data-testid={`chapter-tab-${ch.id}`}
                >
                  {isComplete
                    ? `${ch.name} (${ch.problem_count}문제) \u2713`
                    : `${ch.name} (${ch.image_count}/${ch.problem_count})`}
                  {hasMismatch && (
                    <span className="ml-1 inline-block w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
                {hasMismatch && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      repairChapter(ch.id)
                    }}
                    disabled={isRepairing || repairingChapterId !== null}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded
                               hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed
                               whitespace-nowrap"
                    data-testid={`repair-btn-${ch.id}`}
                  >
                    {isRepairing ? '복구 중...' : '복구'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        {loadingProblems ? (
          <div className="text-center py-12 text-gray-500">문제 불러오는 중...</div>
        ) : (
          <ImageGrid
            problems={problems}
            onReorder={reorderProblems}
            onNumberChange={updateNumber}
            onDelete={deleteProblem}
          />
        )}

        <BulkShiftModal
          open={showBulkShift}
          onClose={() => setShowBulkShift(false)}
          onApply={bulkShift}
          totalProblems={problems.length}
        />
      </div>
    </MainLayout>
  )
}
