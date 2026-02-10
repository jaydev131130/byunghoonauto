import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import Button from '../components/common/Button'
import { api } from '../lib/api'

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

interface StudentSelection {
  studentId: number
  setId: number | null
}

export default function BatchPrintPage() {
  const [searchParams] = useSearchParams()

  const [students, setStudents] = useState<Student[]>([])
  const [studentSets, setStudentSets] = useState<Record<number, WrongAnswerSet[]>>({})
  const [selections, setSelections] = useState<StudentSelection[]>([])
  const [spacerRatio, setSpacerRatio] = useState(1.0)
  const [includeDividers, setIncludeDividers] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<PdfResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)

  // Recent sets state
  const [recentSets, setRecentSets] = useState<RecentSet[]>([])
  const [selectedRecentIds, setSelectedRecentIds] = useState<Set<number>>(new Set())
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
          const matchingIds = new Set(
            data.filter((rs) => urlIdSet.has(rs.id)).map((rs) => rs.id)
          )
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
    if (studentSets[studentId]) return
    try {
      const data = await api.get<WrongAnswerSet[]>(`/students/${studentId}/wrong-answer-sets`)
      setStudentSets((prev) => ({ ...prev, [studentId]: data }))
    } catch {
      // silently fail - student simply won't have sets to pick from
    }
  }, [studentSets])

  const isStudentSelected = useCallback(
    (studentId: number) => selections.some((s) => s.studentId === studentId),
    [selections],
  )

  const toggleStudent = useCallback(
    (studentId: number) => {
      if (isStudentSelected(studentId)) {
        setSelections((prev) => prev.filter((s) => s.studentId !== studentId))
      } else {
        fetchSetsForStudent(studentId)
        const sets = studentSets[studentId]
        const defaultSetId = sets && sets.length > 0 ? sets[0].id : null
        setSelections((prev) => [...prev, { studentId, setId: defaultSetId }])
      }
      setResult(null)
    },
    [isStudentSelected, fetchSetsForStudent, studentSets],
  )

  const updateSelectedSet = useCallback((studentId: number, setId: number) => {
    setSelections((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, setId } : s)),
    )
    setResult(null)
  }, [])

  const selectAll = useCallback(() => {
    const allSelections = students.map((st) => {
      fetchSetsForStudent(st.id)
      const sets = studentSets[st.id]
      const defaultSetId = sets && sets.length > 0 ? sets[0].id : null
      return { studentId: st.id, setId: defaultSetId }
    })
    setSelections(allSelections)
    setResult(null)
  }, [students, studentSets, fetchSetsForStudent])

  const deselectAll = useCallback(() => {
    setSelections([])
    setResult(null)
  }, [])

  const toggleRecentSet = useCallback((setId: number) => {
    setSelectedRecentIds((prev) => {
      const next = new Set(prev)
      if (next.has(setId)) {
        next.delete(setId)
      } else {
        next.add(setId)
      }
      return next
    })
    setResult(null)
  }, [])

  const selectAllRecent = useCallback(() => {
    setSelectedRecentIds(new Set(recentSets.map((rs) => rs.id)))
    setResult(null)
  }, [recentSets])

  const deselectAllRecent = useCallback(() => {
    setSelectedRecentIds(new Set())
    setResult(null)
  }, [])

  // Combine student selections + recent set selections for PDF generation
  const validSelections = selections.filter((s) => s.setId !== null)
  const allSetIds = useMemo(() => {
    const fromStudents = validSelections.map((s) => s.setId).filter((id): id is number => id !== null)
    const fromRecent = [...selectedRecentIds]
    const unique = [...new Set([...fromStudents, ...fromRecent])]
    return unique
  }, [validSelections, selectedRecentIds])

  const handleGenerate = async () => {
    if (allSetIds.length === 0) return

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      if (allSetIds.length === 1) {
        const data = await api.post<PdfResponse>('/pdf/generate', {
          wrong_answer_set_id: allSetIds[0],
          spacer_ratio: spacerRatio,
        })
        setResult(data)
      } else {
        const data = await api.post<PdfResponse>('/pdf/batch', {
          wrong_answer_set_ids: allSetIds,
          spacer_ratio: spacerRatio,
          include_dividers: includeDividers,
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

        {error && (
          <div
            data-testid="batch-print-error"
            className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Recent sets section */}
        {!loadingRecent && recentSets.length > 0 && (
          <div className="mb-6" data-testid="recent-sets-section">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  최근 생성된 오답노트
                  {selectedRecentIds.size > 0 && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({selectedRecentIds.size}개 선택)
                    </span>
                  )}
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={selectAllRecent}>
                    전체 선택
                  </Button>
                  <Button size="sm" variant="secondary" onClick={deselectAllRecent}>
                    전체 해제
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {recentSets.map((rs) => {
                  const selected = selectedRecentIds.has(rs.id)
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
                      <div className="flex-1 min-w-0">
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
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left panel: student selection */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">학생별 선택</h3>
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
                <div className="py-8 text-center text-sm text-slate-400">
                  불러오는 중...
                </div>
              )}

              {!loadingStudents && students.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-sm">등록된 학생이 없습니다.</p>
                </div>
              )}

              <div className="space-y-2">
                {students.map((student) => {
                  const selected = isStudentSelected(student.id)
                  const sets = studentSets[student.id] ?? []
                  const selection = selections.find((s) => s.studentId === student.id)

                  return (
                    <div
                      key={student.id}
                      data-testid={`student-row-${student.id}`}
                      className={`rounded-md border p-3 transition-colors ${
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
                          onChange={() => toggleStudent(student.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-800">
                            {student.name}
                          </span>
                          {student.grade && (
                            <span className="ml-2 text-xs text-slate-400">
                              {student.grade}
                            </span>
                          )}
                          {student.class_name && (
                            <span className="ml-1 text-xs text-slate-400">
                              {student.class_name}
                            </span>
                          )}
                        </div>

                        {selected && (
                          <div className="flex items-center gap-2">
                            {sets.length === 0 ? (
                              <span className="text-xs text-orange-500">
                                오답노트 없음
                              </span>
                            ) : (
                              <select
                                data-testid={`set-select-${student.id}`}
                                value={selection?.setId ?? ''}
                                onChange={(e) =>
                                  updateSelectedSet(student.id, Number(e.target.value))
                                }
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              >
                                {sets.map((set) => (
                                  <option key={set.id} value={set.id}>
                                    {set.title ?? `오답노트 ${set.id}`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right panel: settings + generate */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* Settings card */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">설정</h3>

                {/* Spacer ratio slider */}
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

                {/* Include dividers toggle */}
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

              {/* Generate button card */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm text-slate-600">
                  선택된 오답노트:{' '}
                  <span className="font-semibold text-slate-800">
                    {allSetIds.length}개
                  </span>
                  {selectedRecentIds.size > 0 && validSelections.length > 0 && (
                    <span className="ml-1 text-xs text-slate-400">
                      (최근 {selectedRecentIds.size}개 + 학생별 {validSelections.length}개, 중복 제거)
                    </span>
                  )}
                </div>

                <Button
                  data-testid="generate-pdf-button"
                  size="lg"
                  className="w-full"
                  disabled={generating || allSetIds.length === 0}
                  onClick={handleGenerate}
                >
                  {generating ? 'PDF 생성 중...' : 'PDF 생성'}
                </Button>
              </div>

              {/* Result card */}
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
                    <a
                      data-testid="pdf-view-link"
                      href={result.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
                    >
                      새 탭에서 보기
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
