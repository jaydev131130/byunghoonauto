import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import Button from '../components/common/Button'
import { api } from '../lib/api'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProblemSetListItem {
  id: number
  name: string
  chapter_count: number
  total_problems: number
  created_at: string
}

interface ChapterInfo {
  id: number
  name: string
  sort_order: number
  problem_count: number
}

interface ProblemSetDetail {
  id: number
  name: string
  chapters: ChapterInfo[]
}

interface StudentItem {
  id: number
  name: string
  grade: string | null
  class_name: string | null
}

interface StudentEntry {
  student_id: number
  entries: { chapter_id: number; problem_numbers: number[] }[]
}

interface HistoryItem {
  id: number
  title: string
  problem_set_id: number
  problem_set_name: string | null
  problem_set_ids?: number[]
  problem_set_names?: string[]
  total_problems: number
  student_count: number
  student_entries?: StudentEntry[]
  // Legacy format fields
  entries?: { chapter_id: number; problem_numbers: number[] }[]
  student_ids?: number[]
  created_at: string
}

interface PdfResponse {
  filename: string
  download_url: string
}

type PagePhase = 'input' | 'success'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseNumbers(input: string): number[] {
  if (!input.trim()) return []
  return [
    ...new Set(
      input
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
    ),
  ].sort((a, b) => a - b)
}

function getRelativeDate(dateStr: string): string {
  const created = new Date(dateStr + 'Z')
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '1일 전'
  return `${diffDays}일 전`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WrongAnswerCreatePage() {
  const navigate = useNavigate()

  /* ---------- data-loading state ---------- */
  const [problemSets, setProblemSets] = useState<ProblemSetListItem[]>([])
  const [loadingPs, setLoadingPs] = useState(false)
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  /* ---------- core input state ---------- */
  const [selectedPsIds, setSelectedPsIds] = useState<number[]>([])
  // psChapters[problemSetId] = { name: "...", chapters: [...] }
  const [psChapters, setPsChapters] = useState<
    Record<number, { name: string; chapters: ChapterInfo[] }>
  >({})
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null)
  // studentInputs[studentId][chapterId] = "1, 3, 5"
  const [studentInputs, setStudentInputs] = useState<
    Record<number, Record<number, string>>
  >({})
  const [title, setTitle] = useState('')

  /* ---------- submission state ---------- */
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  /* ---------- success phase state ---------- */
  const [phase, setPhase] = useState<PagePhase>('input')
  const [createdSetIds, setCreatedSetIds] = useState<number[]>([])
  const [createdCount, setCreatedCount] = useState(0)

  /* ---------- history state ---------- */
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)

  /* ---------- PDF generation state ---------- */
  const [spacerRatio, setSpacerRatio] = useState(1.0)
  const [includeDividers, setIncludeDividers] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfResult, setPdfResult] = useState<PdfResponse | null>(null)
  const [pdfError, setPdfError] = useState('')

  /* ---------------------------------------------------------------- */
  /*  Immutable state updaters                                         */
  /* ---------------------------------------------------------------- */

  const updateStudentChapterInput = useCallback(
    (studentId: number, chapterId: number, value: string) => {
      setStudentInputs((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [chapterId]: value,
        },
      }))
    },
    []
  )

  const copyFromStudent = useCallback(
    (sourceStudentId: number, targetStudentId: number) => {
      setStudentInputs((prev) => ({
        ...prev,
        [targetStudentId]: { ...(prev[sourceStudentId] || {}) },
      }))
    },
    []
  )

  /* ---------------------------------------------------------------- */
  /*  Student selection helpers                                        */
  /* ---------------------------------------------------------------- */

  const handleToggleStudent = useCallback((id: number) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((sid) => sid !== id)
      }
      return [...prev, id]
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedStudentIds(students.map((s) => s.id))
  }, [students])

  const handleDeselectAll = useCallback(() => {
    setSelectedStudentIds([])
    setActiveStudentId(null)
  }, [])

  // Keep activeStudentId in sync with selection
  useEffect(() => {
    if (selectedStudentIds.length === 0) {
      setActiveStudentId(null)
    } else if (
      activeStudentId === null ||
      !selectedStudentIds.includes(activeStudentId)
    ) {
      setActiveStudentId(selectedStudentIds[0])
    }
  }, [selectedStudentIds, activeStudentId])

  /* ---------------------------------------------------------------- */
  /*  Per-student computed helpers                                     */
  /* ---------------------------------------------------------------- */

  const studentName = useCallback(
    (sid: number): string => {
      const s = students.find((st) => st.id === sid)
      return s ? s.name : `학생 ${sid}`
    },
    [students]
  )

  const hasInputs = useCallback(
    (sid: number): boolean => {
      const inputs = studentInputs[sid]
      if (!inputs) return false
      return Object.values(inputs).some(
        (v) => parseNumbers(v).length > 0
      )
    },
    [studentInputs]
  )

  const countProblems = useCallback(
    (sid: number): number => {
      const inputs = studentInputs[sid]
      if (!inputs) return 0
      return Object.values(inputs).reduce(
        (sum, v) => sum + parseNumbers(v).length,
        0
      )
    },
    [studentInputs]
  )

  /* ---------------------------------------------------------------- */
  /*  Data loading effects                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const load = async () => {
      setLoadingPs(true)
      try {
        const data = await api.get<ProblemSetListItem[]>('/problem-sets')
        setProblemSets(data)
      } catch {
        setErrorMessage('문제집 목록을 불러오는데 실패했습니다.')
      } finally {
        setLoadingPs(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoadingStudents(true)
      try {
        const data = await api.get<StudentItem[]>('/students')
        setStudents(data)
      } catch {
        setErrorMessage('학생 목록을 불러오는데 실패했습니다.')
      } finally {
        setLoadingStudents(false)
      }
    }
    load()
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Problem set toggle (multi-select)                                */
  /* ---------------------------------------------------------------- */

  const toggleProblemSet = useCallback(async (psId: number) => {
    if (selectedPsIds.includes(psId)) {
      // Remove
      setSelectedPsIds((prev) => prev.filter((id) => id !== psId))
      setPsChapters((prev) => {
        const next = { ...prev }
        delete next[psId]
        return next
      })
    } else {
      // Add - fetch chapters
      setSelectedPsIds((prev) => [...prev, psId])
      setLoadingChapters(true)
      try {
        const data = await api.get<ProblemSetDetail>(
          `/problem-sets/${psId}`
        )
        setPsChapters((prev) => ({
          ...prev,
          [psId]: { name: data.name, chapters: data.chapters },
        }))
      } catch {
        setErrorMessage('단원 정보를 불러오는데 실패했습니다.')
        // Remove on fetch failure
        setSelectedPsIds((prev) => prev.filter((id) => id !== psId))
      } finally {
        setLoadingChapters(false)
      }
    }
  }, [selectedPsIds])

  /* ---------------------------------------------------------------- */
  /*  History                                                          */
  /* ---------------------------------------------------------------- */

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const data = await api.get<{ history: HistoryItem[] }>(
        '/creation-history'
      )
      setHistoryItems(data.history)
    } catch {
      // silent fail - history is non-critical
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleLoadHistory = useCallback(
    async (item: HistoryItem) => {
      setTitle(item.title)

      // Determine which problem set IDs to load
      const psIdsToLoad: number[] =
        item.problem_set_ids && item.problem_set_ids.length > 0
          ? item.problem_set_ids
          : [item.problem_set_id]

      try {
        // Fetch chapters for all problem sets in parallel
        const results = await Promise.allSettled(
          psIdsToLoad.map((psId) =>
            api.get<ProblemSetDetail>(`/problem-sets/${psId}`)
          )
        )

        const loadedPsIds: number[] = []
        const loadedPsChapters: Record<
          number,
          { name: string; chapters: ChapterInfo[] }
        > = {}

        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          const psId = psIdsToLoad[i]
          if (result.status === 'fulfilled') {
            loadedPsIds.push(psId)
            loadedPsChapters[psId] = {
              name: result.value.name,
              chapters: result.value.chapters,
            }
          }
        }

        setSelectedPsIds(loadedPsIds)
        setPsChapters(loadedPsChapters)

        // New per-student format
        if (item.student_entries && item.student_entries.length > 0) {
          const validStudentIds = new Set(students.map((s) => s.id))
          const restoredInputs: Record<number, Record<number, string>> = {}
          const restoredStudentIds: number[] = []

          for (const se of item.student_entries) {
            if (!validStudentIds.has(se.student_id)) continue

            restoredStudentIds.push(se.student_id)
            const chapterMap: Record<number, string> = {}
            for (const entry of se.entries) {
              chapterMap[entry.chapter_id] = entry.problem_numbers.join(', ')
            }
            restoredInputs[se.student_id] = chapterMap
          }

          setSelectedStudentIds(restoredStudentIds)
          setStudentInputs(restoredInputs)
          if (restoredStudentIds.length > 0) {
            setActiveStudentId(restoredStudentIds[0])
          }
        } else if (item.student_ids && item.entries) {
          // Legacy format: same entries for all students
          const validStudentIds = new Set(students.map((s) => s.id))
          const legacyStudentIds = item.student_ids.filter((id) =>
            validStudentIds.has(id)
          )
          setSelectedStudentIds(legacyStudentIds)

          const chapterMap: Record<number, string> = {}
          for (const entry of item.entries) {
            chapterMap[entry.chapter_id] = entry.problem_numbers.join(', ')
          }

          const restoredInputs: Record<number, Record<number, string>> = {}
          for (const sid of legacyStudentIds) {
            restoredInputs[sid] = { ...chapterMap }
          }
          setStudentInputs(restoredInputs)
          if (legacyStudentIds.length > 0) {
            setActiveStudentId(legacyStudentIds[0])
          }
        }
      } catch {
        setErrorMessage('히스토리 데이터를 불러오는데 실패했습니다.')
      }
    },
    [students]
  )

  const handleDeleteHistory = useCallback(async (historyId: number) => {
    try {
      await api.delete(`/creation-history/${historyId}`)
      setHistoryItems((prev) => prev.filter((h) => h.id !== historyId))
    } catch {
      setErrorMessage('히스토리 삭제에 실패했습니다.')
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Submit                                                           */
  /* ---------------------------------------------------------------- */

  // Flat list of all chapters from all selected problem sets
  const allChapters = useMemo(
    () =>
      selectedPsIds.flatMap(
        (psId) => psChapters[psId]?.chapters || []
      ),
    [selectedPsIds, psChapters]
  )

  const studentEntries = useMemo(() => {
    return selectedStudentIds
      .map((sid) => ({
        student_id: sid,
        entries: allChapters
          .map((ch) => ({
            chapter_id: ch.id,
            problem_numbers: parseNumbers(
              studentInputs[sid]?.[ch.id] || ''
            ),
          }))
          .filter((e) => e.problem_numbers.length > 0),
      }))
      .filter((se) => se.entries.length > 0)
  }, [selectedStudentIds, allChapters, studentInputs])

  const totalStudentsWithInputs = useMemo(
    () => studentEntries.length,
    [studentEntries]
  )

  const canSubmit =
    selectedPsIds.length > 0 &&
    studentEntries.length > 0 &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage('')

    const defaultTitle = `오답노트 ${new Date().toISOString().slice(0, 10)}`
    const finalTitle = title.trim() || defaultTitle

    try {
      const result = await api.post<{
        created_set_ids: number[]
        count: number
      }>('/wrong-answer-sets/bulk-per-student', {
        title: finalTitle,
        student_entries: studentEntries,
      })
      setCreatedSetIds(result.created_set_ids)
      setCreatedCount(result.count)

      // Auto-save to creation history (new per-student multi-ps format)
      try {
        await api.post('/creation-history', {
          title: finalTitle,
          problem_set_id: selectedPsIds[0],
          problem_set_ids: selectedPsIds,
          student_entries: studentEntries,
        })
        fetchHistory()
      } catch {
        // silent fail - saving history is non-critical
      }

      setPhase('success')
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : '오답노트 생성 중 오류가 발생했습니다.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  PDF                                                              */
  /* ---------------------------------------------------------------- */

  const handleGeneratePdf = async () => {
    if (createdSetIds.length === 0) return
    setGeneratingPdf(true)
    setPdfError('')
    setPdfResult(null)

    try {
      if (createdSetIds.length === 1) {
        const data = await api.post<PdfResponse>('/pdf/generate', {
          wrong_answer_set_id: createdSetIds[0],
          spacer_ratio: spacerRatio,
        })
        setPdfResult(data)
      } else {
        const data = await api.post<PdfResponse>('/pdf/batch', {
          wrong_answer_set_ids: createdSetIds,
          spacer_ratio: spacerRatio,
          include_dividers: includeDividers,
        })
        setPdfResult(data)
      }
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'PDF 생성에 실패했습니다.'
      )
    } finally {
      setGeneratingPdf(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  const handleReset = () => {
    setPhase('input')
    setCreatedSetIds([])
    setCreatedCount(0)
    setPdfResult(null)
    setPdfError('')
    setSpacerRatio(1.0)
    setIncludeDividers(true)
    setSelectedPsIds([])
    setPsChapters({})
    setSelectedStudentIds([])
    setActiveStudentId(null)
    setStudentInputs({})
    setTitle('')
    setErrorMessage('')
  }

  /* ================================================================ */
  /*  RENDER: Success Phase                                            */
  /* ================================================================ */

  if (phase === 'success') {
    return (
      <MainLayout>
        <div
          data-testid="wrong-answer-create-page"
          className="max-w-4xl mx-auto space-y-6"
        >
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              오답노트 생성 완료
            </h1>
          </div>

          {/* Success message */}
          <div
            className="rounded-md bg-green-50 p-4 text-sm text-green-700"
            data-testid="success-message"
          >
            {createdCount}명 학생의 오답노트가 생성되었습니다.
          </div>

          {/* PDF generation section */}
          <section
            className="rounded-lg border border-gray-200 bg-white p-5"
            data-testid="section-pdf-generate"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              일괄 PDF 생성
            </h2>

            {/* Spacer ratio slider */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                풀이 공간 비율
              </label>
              <p className="mb-2 text-xs text-gray-400">
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
                <span className="w-12 text-right text-sm font-medium text-gray-700">
                  {spacerRatio.toFixed(1)}x
                </span>
              </div>
            </div>

            {/* Include dividers toggle */}
            {createdSetIds.length > 1 && (
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    학생별 구분 페이지
                  </label>
                  <p className="text-xs text-gray-400">
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
                    includeDividers ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                      includeDividers ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {pdfError && (
              <div
                className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
                data-testid="pdf-error"
              >
                {pdfError}
              </div>
            )}

            {!pdfResult && (
              <Button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                data-testid="generate-pdf-button"
              >
                {generatingPdf ? 'PDF 생성 중...' : 'PDF 생성'}
              </Button>
            )}

            {/* PDF result */}
            {pdfResult && (
              <div
                data-testid="pdf-result"
                className="rounded-lg border border-green-200 bg-green-50 p-4"
              >
                <h4 className="mb-2 text-sm font-semibold text-green-800">
                  PDF 생성 완료
                </h4>
                <p className="mb-3 text-xs text-green-700">
                  {pdfResult.filename}
                </p>
                <div className="flex gap-2">
                  <a
                    data-testid="pdf-download-link"
                    href={pdfResult.download_url}
                    download
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    다운로드
                  </a>
                  <a
                    data-testid="pdf-view-link"
                    href={pdfResult.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
                  >
                    새 탭에서 보기
                  </a>
                </div>
              </div>
            )}
          </section>

          {/* Navigation links */}
          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              onClick={() =>
                navigate(
                  `/batch-print?sets=${createdSetIds.join(',')}`
                )
              }
              data-testid="link-batch-print"
            >
              일괄 인쇄 페이지에서 상세 설정 &rarr;
            </button>

            <div>
              <Button
                variant="secondary"
                onClick={handleReset}
                data-testid="reset-button"
              >
                새 오답노트 만들기
              </Button>
            </div>
          </section>
        </div>
      </MainLayout>
    )
  }

  /* ================================================================ */
  /*  RENDER: Input Phase                                              */
  /* ================================================================ */

  return (
    <MainLayout>
      <div
        data-testid="wrong-answer-create-page"
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">오답노트 생성</h1>
          <p className="text-sm text-gray-500 mt-1">
            문제집을 선택(복수 가능)하고, 학생별로 단원별 오답 번호를 입력합니다.
          </p>
        </div>

        {/* ---- History Panel ---- */}
        {historyItems.length > 0 && (
          <section
            className="rounded-lg border border-gray-200 bg-white"
            data-testid="history-panel"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 text-left"
              onClick={() => setHistoryOpen((prev) => !prev)}
              data-testid="history-toggle"
            >
              <span className="text-base font-semibold text-gray-800">
                최근 생성 히스토리 (10일간 보관)
              </span>
              <span className="text-sm text-gray-400">
                {historyOpen ? '접기 \u25B2' : '펼치기 \u25BC'}
              </span>
            </button>
            {historyOpen && (
              <div
                className="space-y-2 px-5 pb-4"
                data-testid="history-list"
              >
                {loadingHistory ? (
                  <div className="text-sm text-gray-400">
                    불러오는 중...
                  </div>
                ) : (
                  historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
                      data-testid={`history-item-${item.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-800 truncate">
                            {item.title}
                          </span>
                          {item.problem_set_names &&
                          item.problem_set_names.length > 0 ? (
                            <span className="shrink-0 text-gray-400">
                              | {item.problem_set_names.join(', ')}
                            </span>
                          ) : item.problem_set_name ? (
                            <span className="shrink-0 text-gray-400">
                              | {item.problem_set_name}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          문제 {item.total_problems}개 &middot; 학생{' '}
                          {item.student_count}명 &middot;{' '}
                          {getRelativeDate(item.created_at)}
                        </div>
                      </div>
                      <div className="ml-4 flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                          onClick={() => handleLoadHistory(item)}
                          data-testid={`history-load-${item.id}`}
                        >
                          불러오기
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                          onClick={() => handleDeleteHistory(item.id)}
                          data-testid={`history-delete-${item.id}`}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* ---- Error Message ---- */}
        {errorMessage && (
          <div
            className="rounded-md bg-red-50 p-4 text-sm text-red-700"
            data-testid="error-message"
          >
            {errorMessage}
          </div>
        )}

        {/* ---- Step 1: Problem Set Selection (Multi) ---- */}
        <section
          className="rounded-lg border border-gray-200 bg-white p-5"
          data-testid="section-problem-set"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            1. 문제집 선택
            {selectedPsIds.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({selectedPsIds.length}개 선택)
              </span>
            )}
          </h2>
          {loadingPs ? (
            <div className="text-sm text-gray-400">불러오는 중...</div>
          ) : problemSets.length === 0 ? (
            <div className="text-sm text-gray-400">
              등록된 문제집이 없습니다.
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                문제집을 클릭하여 선택/해제하세요
              </h3>
              <div
                className="flex flex-wrap gap-2"
                data-testid="problem-set-chips"
              >
                {problemSets.map((ps) => {
                  const isSelected = selectedPsIds.includes(ps.id)
                  return (
                    <button
                      key={ps.id}
                      type="button"
                      onClick={() => toggleProblemSet(ps.id)}
                      disabled={loadingChapters}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${loadingChapters ? 'opacity-50 cursor-wait' : ''}`}
                      data-testid={`ps-chip-${ps.id}`}
                    >
                      {ps.name}
                      <span
                        className={`ml-1 text-xs ${
                          isSelected
                            ? 'text-indigo-200'
                            : 'text-gray-400'
                        }`}
                      >
                        ({ps.chapter_count}단원, {ps.total_problems}문제)
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* ---- Step 2: Student Selection ---- */}
        <section
          className="rounded-lg border border-gray-200 bg-white p-5"
          data-testid="section-students"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              2. 학생 선택
              {selectedStudentIds.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({selectedStudentIds.length}명 선택)
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={handleSelectAll}
                data-testid="select-all-students"
              >
                전체 선택
              </button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={handleDeselectAll}
                data-testid="deselect-all-students"
              >
                전체 해제
              </button>
            </div>
          </div>
          {loadingStudents ? (
            <div className="text-sm text-gray-400">불러오는 중...</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-gray-400">
              등록된 학생이 없습니다.{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate('/students')}
                data-testid="link-student-register"
              >
                학생 등록하러 가기
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {students.map((s) => {
                const isSelected = selectedStudentIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleStudent(s.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid={`student-chip-${s.id}`}
                  >
                    {s.name}
                    {s.grade && (
                      <span
                        className={`ml-1 text-xs ${
                          isSelected ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {s.grade}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ---- Step 3: Per-Student Wrong Answer Input ---- */}
        {selectedStudentIds.length > 0 && selectedPsIds.length > 0 && (
          <section
            className="rounded-lg border border-gray-200 bg-white p-5"
            data-testid="section-student-inputs"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              3. 학생별 오답 입력
            </h2>

            {/* Student tabs */}
            <div
              className="flex gap-1 overflow-x-auto pb-2 mb-4 border-b border-gray-100"
              data-testid="student-tabs"
            >
              {selectedStudentIds.map((sid) => {
                const isActive = sid === activeStudentId
                const studentHasInputs = hasInputs(sid)
                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => setActiveStudentId(sid)}
                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    data-testid={`student-tab-${sid}`}
                  >
                    {studentName(sid)}
                    {studentHasInputs && (
                      <span
                        className={`ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                          isActive
                            ? 'bg-white text-blue-600'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        V
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Copy from another student */}
            {selectedStudentIds.length > 1 && activeStudentId !== null && (
              <div className="mb-4">
                <select
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value=""
                  onChange={(e) => {
                    const sourceId = Number(e.target.value)
                    if (sourceId && activeStudentId !== null) {
                      copyFromStudent(sourceId, activeStudentId)
                    }
                  }}
                  data-testid="copy-from-student-select"
                >
                  <option value="">다른 학생에서 복사...</option>
                  {selectedStudentIds
                    .filter((sid) => sid !== activeStudentId)
                    .map((sid) => (
                      <option key={sid} value={sid}>
                        {studentName(sid)}
                        {hasInputs(sid)
                          ? ` (${countProblems(sid)}문제)`
                          : ' (입력 없음)'}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Chapter inputs for active student, grouped by problem set */}
            {activeStudentId !== null && (
              <div className="space-y-3" data-testid="chapter-inputs">
                {loadingChapters ? (
                  <div className="text-sm text-gray-400">
                    단원 불러오는 중...
                  </div>
                ) : allChapters.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    단원이 없습니다.
                  </div>
                ) : (
                  selectedPsIds.map((psId) => {
                    const ps = psChapters[psId]
                    if (!ps) return null
                    return (
                      <div
                        key={psId}
                        className="mb-6"
                        data-testid={`ps-section-${psId}`}
                      >
                        <h4 className="text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                          {ps.name}
                        </h4>
                        <div className="space-y-2">
                          {ps.chapters.map((ch) => {
                            const inputVal =
                              studentInputs[activeStudentId]?.[ch.id] || ''
                            const parsed = parseNumbers(inputVal)
                            return (
                              <div
                                key={ch.id}
                                className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
                                data-testid={`chapter-row-${ch.id}`}
                              >
                                <div className="w-48 shrink-0">
                                  <span className="text-sm font-medium text-gray-700">
                                    {ch.name}
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="예: 1, 3, 5, 7"
                                  value={inputVal}
                                  onChange={(e) =>
                                    updateStudentChapterInput(
                                      activeStudentId,
                                      ch.id,
                                      e.target.value
                                    )
                                  }
                                  data-testid={`chapter-input-${activeStudentId}-${ch.id}`}
                                />
                                <span className="shrink-0 text-xs text-gray-400">
                                  / {ch.problem_count}문제
                                </span>
                                {parsed.length > 0 && (
                                  <span
                                    className="shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                    data-testid={`chapter-badge-${activeStudentId}-${ch.id}`}
                                  >
                                    {parsed.length}개
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )}

        {/* ---- Step 4: Title + Summary + Submit ---- */}
        <section
          className="rounded-lg border border-gray-200 bg-white p-5"
          data-testid="section-submit"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            4. 생성
          </h2>
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="wa-title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                제목 (선택)
              </label>
              <input
                id="wa-title"
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder={`오답노트 ${new Date().toISOString().slice(0, 10)}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="title-input"
              />
            </div>

            {/* Per-student summary */}
            <div
              className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-600"
              data-testid="summary-section"
            >
              {totalStudentsWithInputs > 0 ? (
                <div className="space-y-1">
                  <div className="font-medium text-gray-700 mb-2">
                    학생별 오답 현황
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStudentIds.map((sid) => {
                      const problemCount = countProblems(sid)
                      return (
                        <span
                          key={sid}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            problemCount > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                          data-testid={`summary-student-${sid}`}
                        >
                          {studentName(sid)}: {problemCount}문제
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {totalStudentsWithInputs}명 학생에게 오답노트가
                    생성됩니다.
                    {selectedStudentIds.length >
                      totalStudentsWithInputs && (
                      <span className="ml-1 text-amber-500">
                        (입력 없는{' '}
                        {selectedStudentIds.length -
                          totalStudentsWithInputs}
                        명은 제외)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-gray-400" data-testid="summary-text">
                  문제집 선택, 학생 선택, 오답 입력을 완료해주세요.
                </span>
              )}
            </div>

            {/* Submit button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="submit-button"
              >
                {submitting ? '생성 중...' : '오답노트 생성'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}
