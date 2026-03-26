import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import Button from '../components/common/Button'
import { api } from '../lib/api'
import {
  type BatchPrintMode,
  getActiveBatchSetIds,
  getDefaultStudentSetIds,
  shouldUseBatchPdfRequest,
  toggleSelectedId,
} from './batchPrintRequest'

interface Student {
  id: number
  name: string
  grade: string | null
  class_name: string | null
}

interface WrongAnswerSet {
  id: number
  student_id: number
  title: string | null
  created_at: string
}

interface RecentSet {
  id: number
  student_id: number
  title: string | null
  created_at: string
  student_name: string
  grade: string | null
  class_name: string | null
}

interface PdfResponse {
  filename: string
  download_url: string
}

export default function BatchPrintPage() {
  const [searchParams] = useSearchParams()

  const [students, setStudents] = useState<Student[]>([])
  const [studentSets, setStudentSets] = useState<Record<number, WrongAnswerSet[]>>({})
  const [activeMode, setActiveMode] = useState<BatchPrintMode>('recent')
  const [selectedStudentSetIds, setSelectedStudentSetIds] = useState<Record<number, number[]>>({})
  const [spacerRatio, setSpacerRatio] = useState(1.0)
  const [includeDividers, setIncludeDividers] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<PdfResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)

  // Recent sets state
  const [recentSets, setRecentSets] = useState<RecentSet[]>([])
  const [selectedRecentIds, setSelectedRecentIds] = useState<number[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  // URL param set IDs
  const urlSetIds = useMemo(() => {
    const setsParam = searchParams.get('sets')
    if (!setsParam) return []
    return setsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
  }, [searchParams])

  // Load recent sets
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<RecentSet[]>('/wrong-answer-sets/recent')
        setRecentSets(data)

        // If URL params provided, auto-select matching recent sets
        if (urlSetIds.length > 0) {
          const urlIdSet = new Set(urlSetIds)
          const matchingIds = data
            .filter((rs) => urlIdSet.has(rs.id))
            .map((rs) => rs.id)
          if (matchingIds.length > 0) {
            setActiveMode('recent')
          }
          setSelectedRecentIds(matchingIds)
        }
      } catch {
        // silently fail - recent section is supplementary
      } finally {
        setLoadingRecent(false)
      }
    }
    load()
  }, [urlSetIds])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Student[]>('/students')
        setStudents(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '학생 목록을 불러오지 못했습니다.')
      } finally {
        setLoadingStudents(false)
      }
    }
    load()
  }, [])

  const fetchSetsForStudent = useCallback(async (studentId: number) => {
    const cached = studentSets[studentId]
    if (cached) return cached

    try {
      const data = await api.get<WrongAnswerSet[]>(`/students/${studentId}/wrong-answer-sets`)
      setStudentSets((prev) => {
        if (prev[studentId]) return prev
        return { ...prev, [studentId]: data }
      })
      return data
    } catch {
      // silently fail - student simply won't have sets to pick from
      return []
    }
  }, [studentSets])

  const isStudentSelected = useCallback(
    (studentId: number) => Object.prototype.hasOwnProperty.call(selectedStudentSetIds, studentId),
    [selectedStudentSetIds],
  )

  const toggleStudent = useCallback(
    async (studentId: number) => {
      if (isStudentSelected(studentId)) {
        setSelectedStudentSetIds((prev) => {
          const next = { ...prev }
          delete next[studentId]
          return next
        })
        setResult(null)
        return
      } else {
        const sets = await fetchSetsForStudent(studentId)
        setSelectedStudentSetIds((prev) => {
          if (Object.prototype.hasOwnProperty.call(prev, studentId)) return prev
          return {
            ...prev,
            [studentId]: getDefaultStudentSetIds(sets.map((set) => set.id)),
          }
        })
      }
      setResult(null)
    },
    [isStudentSelected, fetchSetsForStudent],
  )

  const toggleStudentSet = useCallback((studentId: number, setId: number) => {
    setSelectedStudentSetIds((prev) => ({
      ...prev,
      [studentId]: toggleSelectedId(prev[studentId] ?? [], setId),
    }))
    setResult(null)
  }, [])

  const selectAll = useCallback(() => {
    void Promise.all(
      students.map(async (student) => {
        const sets = await fetchSetsForStudent(student.id)
        return [student.id, getDefaultStudentSetIds(sets.map((set) => set.id))] as const
      }),
    ).then((entries) => {
      setSelectedStudentSetIds(Object.fromEntries(entries))
    })
    setResult(null)
  }, [students, fetchSetsForStudent])

  const deselectAll = useCallback(() => {
    setSelectedStudentSetIds({})
    setResult(null)
  }, [])

  const toggleRecentSet = useCallback((setId: number) => {
    setSelectedRecentIds((prev) => toggleSelectedId(prev, setId))
    setResult(null)
  }, [])

  const selectAllRecent = useCallback(() => {
    setSelectedRecentIds(recentSets.map((rs) => rs.id))
    setResult(null)
  }, [recentSets])

  const deselectAllRecent = useCallback(() => {
    setSelectedRecentIds([])
    setResult(null)
  }, [])

  const selectedStudentCount = useMemo(
    () => Object.keys(selectedStudentSetIds).length,
    [selectedStudentSetIds],
  )
  const activeSetIds = useMemo(
    () => getActiveBatchSetIds(activeMode, selectedRecentIds, selectedStudentSetIds),
    [activeMode, selectedRecentIds, selectedStudentSetIds],
  )

  const handleGenerate = async () => {
    if (activeSetIds.length === 0) return

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      if (shouldUseBatchPdfRequest(activeSetIds.length, includeDividers)) {
        const data = await api.post<PdfResponse>('/pdf/batch', {
          wrong_answer_set_ids: activeSetIds,
          spacer_ratio: spacerRatio,
          include_dividers: includeDividers,
        })
        setResult(data)
      } else {
        const data = await api.post<PdfResponse>('/pdf/generate', {
          wrong_answer_set_id: activeSetIds[0],
          spacer_ratio: spacerRatio,
        })
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return dateStr.slice(0, 16).replace('T', ' ')
    } catch {
      return dateStr
    }
  }

  return (
    <MainLayout>
      <div data-testid="batch-print-page">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">일괄 인쇄</h2>
          <p className="mt-2 text-sm text-slate-500">
            여러 학생의 오답노트를 한꺼번에 PDF로 생성합니다.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-2">
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              data-testid="mode-tab-recent"
              onClick={() => setActiveMode('recent')}
              className={`rounded-lg px-4 py-3 text-left transition-colors ${
                activeMode === 'recent'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="text-sm font-semibold">최근 생성된 오답노트</div>
              <div className={`mt-1 text-xs ${activeMode === 'recent' ? 'text-slate-200' : 'text-slate-500'}`}>
                최근 만든 오답노트를 빠르게 골라 바로 인쇄합니다.
              </div>
            </button>
            <button
              type="button"
              data-testid="mode-tab-students"
              onClick={() => setActiveMode('students')}
              className={`rounded-lg px-4 py-3 text-left transition-colors ${
                activeMode === 'students'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="text-sm font-semibold">학생별 선택</div>
              <div className={`mt-1 text-xs ${activeMode === 'students' ? 'text-slate-200' : 'text-slate-500'}`}>
                학생별로 오답노트를 1개 이상 골라 묶어서 인쇄합니다.
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div
            data-testid="batch-print-error"
            className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activeMode === 'recent' ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="recent-sets-section">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">최근 생성된 오답노트</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      최근 생성한 오답노트만 빠르게 골라 바로 PDF로 만듭니다.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={selectAllRecent}>
                      전체 선택
                    </Button>
                    <Button size="sm" variant="secondary" onClick={deselectAllRecent}>
                      전체 해제
                    </Button>
                  </div>
                </div>

                {loadingRecent && (
                  <div className="py-8 text-center text-sm text-slate-400">불러오는 중...</div>
                )}

                {!loadingRecent && recentSets.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm text-slate-500">최근 생성된 오답노트가 없습니다.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {recentSets.map((rs) => {
                    const selected = selectedRecentIds.includes(rs.id)
                    return (
                      <label
                        key={rs.id}
                        data-testid={`recent-set-${rs.id}`}
                        className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                          selected
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRecentSet(rs.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {rs.student_name}
                            </span>
                            {(rs.grade || rs.class_name) && (
                              <span className="text-xs text-slate-400">
                                {[rs.grade, rs.class_name].filter(Boolean).join(' ')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {rs.title ?? `오답노트 ${rs.id}`}
                            <span className="ml-2 text-slate-400">
                              {formatDate(rs.created_at)}
                            </span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">학생별 선택</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      학생을 고른 뒤 오답노트를 여러 개까지 체크해서 함께 인쇄합니다.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={selectAll}>
                      전체 선택
                    </Button>
                    <Button size="sm" variant="secondary" onClick={deselectAll}>
                      전체 해제
                    </Button>
                  </div>
                </div>

                {loadingStudents && (
                  <div className="py-8 text-center text-sm text-slate-400">불러오는 중...</div>
                )}

                {!loadingStudents && students.length === 0 && (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-sm">등록된 학생이 없습니다.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {students.map((student) => {
                    const selected = isStudentSelected(student.id)
                    const sets = studentSets[student.id] ?? []
                    const selectedSetIds = selectedStudentSetIds[student.id] ?? []

                    return (
                      <div
                        key={student.id}
                        data-testid={`student-row-${student.id}`}
                        className={`rounded-lg border p-3 transition-colors ${
                          selected
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            data-testid={`student-checkbox-${student.id}`}
                            checked={selected}
                            onChange={() => {
                              void toggleStudent(student.id)
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">
                                {student.name}
                              </span>
                              {(student.grade || student.class_name) && (
                                <span className="text-xs text-slate-400">
                                  {[student.grade, student.class_name].filter(Boolean).join(' ')}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {selected
                                ? `선택된 오답노트 ${selectedSetIds.length}개`
                                : '학생을 선택하면 최신 오답노트가 기본 선택됩니다.'}
                            </p>
                          </div>
                        </div>

                        {selected && (
                          <div className="mt-3 space-y-2 border-t border-blue-100 pt-3">
                            {sets.length === 0 ? (
                              <div className="rounded-md bg-white px-3 py-2 text-xs text-orange-600">
                                선택 가능한 오답노트가 없습니다.
                              </div>
                            ) : (
                              sets.map((set) => {
                                const setSelected = selectedSetIds.includes(set.id)
                                return (
                                  <label
                                    key={set.id}
                                    className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                                      setSelected
                                        ? 'border-blue-300 bg-white'
                                        : 'border-slate-200 bg-white/70 hover:bg-white'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      data-testid={`student-set-checkbox-${student.id}-${set.id}`}
                                      checked={setSelected}
                                      onChange={() => toggleStudentSet(student.id, set.id)}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-medium text-slate-700">
                                        {set.title ?? `오답노트 ${set.id}`}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {formatDate(set.created_at)}
                                      </div>
                                    </div>
                                  </label>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">설정</h3>

                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    풀이 공간 비율
                  </label>
                  <p className="mb-2 text-xs text-slate-400">
                    문제 이미지 높이 대비 풀이 공간의 비율입니다.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      data-testid="spacer-ratio-slider"
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={spacerRatio}
                      onChange={(e) => setSpacerRatio(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-medium text-slate-700">
                      {spacerRatio.toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      학생별 구분 페이지
                    </label>
                    <p className="text-xs text-slate-400">
                      학생 사이에 이름 표시 페이지를 삽입합니다.
                    </p>
                  </div>
                  <button
                    data-testid="divider-toggle"
                    type="button"
                    role="switch"
                    aria-checked={includeDividers}
                    onClick={() => setIncludeDividers((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      includeDividers ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                        includeDividers ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 rounded-lg bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    현재 모드
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {activeMode === 'recent' ? '최근 생성된 오답노트' : '학생별 선택'}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    선택된 오답노트{' '}
                    <span className="font-semibold text-slate-800">{activeSetIds.length}개</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {activeMode === 'recent'
                      ? `최근 목록에서 ${selectedRecentIds.length}개를 선택했습니다.`
                      : `${selectedStudentCount}명의 학생에서 선택한 오답노트를 인쇄합니다.`}
                  </div>
                </div>

                <Button
                  data-testid="generate-pdf-button"
                  size="lg"
                  className="w-full"
                  disabled={generating || activeSetIds.length === 0}
                  onClick={handleGenerate}
                >
                  {generating ? 'PDF 생성 중...' : 'PDF 생성'}
                </Button>
              </div>

              {result && (
                <div
                  data-testid="pdf-result"
                  className="rounded-lg border border-green-200 bg-green-50 p-4"
                >
                  <h4 className="mb-2 text-sm font-semibold text-green-800">
                    PDF 생성 완료
                  </h4>
                  <p className="mb-3 text-xs text-green-700">{result.filename}</p>
                  <div className="flex flex-col gap-2">
                    <a
                      data-testid="pdf-download-link"
                      href={result.download_url}
                      download
                      className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                      다운로드
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
