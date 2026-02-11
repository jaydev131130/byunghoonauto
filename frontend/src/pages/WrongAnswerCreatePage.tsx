import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import Button from "../components/common/Button";
import { api } from "../lib/api";
import type {
  ProblemSetListItem,
  ProblemSetDetail,
  ChapterInfo,
  StudentItem,
  StudentEntry,
  HistoryItem,
  PdfResponse,
  PagePhase,
} from "../types/wrong-answer";
import { HistoryPanel } from "../components/wrong-answer/HistoryPanel";
import ProblemSetCenteredMode from "../components/wrong-answer/ProblemSetCenteredMode";
import StudentCenteredMode from "../components/wrong-answer/StudentCenteredMode";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WrongAnswerCreatePage() {
  const navigate = useNavigate();

  /* ---------- mode ---------- */
  const [mode, setMode] = useState<"student" | "problem-set">("student");

  /* ---------- shared data ---------- */
  const [problemSets, setProblemSets] = useState<ProblemSetListItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingPs, setLoadingPs] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  /* ---------- submission ---------- */
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /* ---------- success phase ---------- */
  const [phase, setPhase] = useState<PagePhase>("input");
  const [createdSetIds, setCreatedSetIds] = useState<number[]>([]);
  const [createdCount, setCreatedCount] = useState(0);

  /* ---------- PDF ---------- */
  const [spacerRatio, setSpacerRatio] = useState(1.0);
  const [includeDividers, setIncludeDividers] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfResult, setPdfResult] = useState<PdfResponse | null>(null);
  const [pdfError, setPdfError] = useState("");

  /* ---------- history ---------- */
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ---------- history restore (problem-set mode only) ---------- */
  const [initialData, setInitialData] = useState<{
    title: string;
    selectedPsIds: number[];
    psChapters: Record<number, { name: string; chapters: ChapterInfo[] }>;
    selectedStudentIds: number[];
    studentInputs: Record<number, Record<number, string>>;
  } | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const load = async () => {
      setLoadingPs(true);
      try {
        const data = await api.get<ProblemSetListItem[]>("/problem-sets");
        setProblemSets(data);
      } catch {
        setErrorMessage("문제집 목록을 불러오는데 실패했습니다.");
      } finally {
        setLoadingPs(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingStudents(true);
      try {
        const data = await api.get<StudentItem[]>("/students");
        setStudents(data);
      } catch {
        setErrorMessage("학생 목록을 불러오는데 실패했습니다.");
      } finally {
        setLoadingStudents(false);
      }
    };
    load();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  History                                                          */
  /* ---------------------------------------------------------------- */

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await api.get<{ history: HistoryItem[] }>(
        "/creation-history",
      );
      setHistoryItems(data.history);
    } catch {
      // silent fail - history is non-critical
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLoadHistory = useCallback(
    async (item: HistoryItem) => {
      // Determine which problem set IDs to load
      const psIdsToLoad: number[] =
        item.problem_set_ids && item.problem_set_ids.length > 0
          ? item.problem_set_ids
          : [item.problem_set_id];

      try {
        // Fetch chapters for all problem sets in parallel
        const results = await Promise.allSettled(
          psIdsToLoad.map((psId) =>
            api.get<ProblemSetDetail>(`/problem-sets/${psId}`),
          ),
        );

        const loadedPsIds: number[] = [];
        const loadedPsChapters: Record<
          number,
          { name: string; chapters: ChapterInfo[] }
        > = {};

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const psId = psIdsToLoad[i];
          if (result.status === "fulfilled") {
            loadedPsIds.push(psId);
            loadedPsChapters[psId] = {
              name: result.value.name,
              chapters: result.value.chapters,
            };
          }
        }

        // Determine if history has per-student format
        if (item.student_entries && item.student_entries.length > 0) {
          const validStudentIds = new Set(students.map((s) => s.id));
          const restoredInputs: Record<number, Record<number, string>> = {};
          const restoredStudentIds: number[] = [];

          for (const se of item.student_entries) {
            if (!validStudentIds.has(se.student_id)) continue;
            restoredStudentIds.push(se.student_id);
            const chapterMap: Record<number, string> = {};
            for (const entry of se.entries) {
              chapterMap[entry.chapter_id] = entry.problem_numbers.join(", ");
            }
            restoredInputs[se.student_id] = chapterMap;
          }

          // Switch to problem-set mode and pass initialData
          setMode("problem-set");
          setInitialData({
            title: item.title,
            selectedPsIds: loadedPsIds,
            psChapters: loadedPsChapters,
            selectedStudentIds: restoredStudentIds,
            studentInputs: restoredInputs,
          });
        } else if (item.student_ids && item.entries) {
          // Legacy format: same entries for all students
          const validStudentIds = new Set(students.map((s) => s.id));
          const legacyStudentIds = item.student_ids.filter((id) =>
            validStudentIds.has(id),
          );

          const chapterMap: Record<number, string> = {};
          for (const entry of item.entries) {
            chapterMap[entry.chapter_id] = entry.problem_numbers.join(", ");
          }

          const restoredInputs: Record<number, Record<number, string>> = {};
          for (const sid of legacyStudentIds) {
            restoredInputs[sid] = { ...chapterMap };
          }

          setMode("problem-set");
          setInitialData({
            title: item.title,
            selectedPsIds: loadedPsIds,
            psChapters: loadedPsChapters,
            selectedStudentIds: legacyStudentIds,
            studentInputs: restoredInputs,
          });
        }
      } catch {
        setErrorMessage("히스토리 데이터를 불러오는데 실패했습니다.");
      }
    },
    [students],
  );

  const handleDeleteHistory = useCallback(async (historyId: number) => {
    try {
      await api.delete(`/creation-history/${historyId}`);
      setHistoryItems((prev) => prev.filter((h) => h.id !== historyId));
    } catch {
      setErrorMessage("히스토리 삭제에 실패했습니다.");
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Submit (shared across modes)                                     */
  /* ---------------------------------------------------------------- */

  const handleSubmit = useCallback(
    async (data: {
      title: string;
      studentEntries: StudentEntry[];
      selectedPsIds: number[];
    }) => {
      setSubmitting(true);
      setErrorMessage("");

      try {
        const result = await api.post<{
          created_set_ids: number[];
          count: number;
        }>("/wrong-answer-sets/bulk-per-student", {
          title: data.title,
          student_entries: data.studentEntries,
        });
        setCreatedSetIds(result.created_set_ids);
        setCreatedCount(result.count);

        // Auto-save to creation history
        try {
          await api.post("/creation-history", {
            title: data.title,
            problem_set_id: data.selectedPsIds[0],
            problem_set_ids: data.selectedPsIds,
            student_entries: data.studentEntries,
          });
          fetchHistory();
        } catch {
          // silent fail - saving history is non-critical
        }

        setPhase("success");
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "오답노트 생성 중 오류가 발생했습니다.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [fetchHistory],
  );

  /* ---------------------------------------------------------------- */
  /*  PDF                                                              */
  /* ---------------------------------------------------------------- */

  const handleGeneratePdf = async () => {
    if (createdSetIds.length === 0) return;
    setGeneratingPdf(true);
    setPdfError("");
    setPdfResult(null);

    try {
      if (createdSetIds.length === 1) {
        const data = await api.post<PdfResponse>("/pdf/generate", {
          wrong_answer_set_id: createdSetIds[0],
          spacer_ratio: spacerRatio,
        });
        setPdfResult(data);
      } else {
        const data = await api.post<PdfResponse>("/pdf/batch", {
          wrong_answer_set_ids: createdSetIds,
          spacer_ratio: spacerRatio,
          include_dividers: includeDividers,
        });
        setPdfResult(data);
      }
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : "PDF 생성에 실패했습니다.",
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  const handleReset = () => {
    setPhase("input");
    setCreatedSetIds([]);
    setCreatedCount(0);
    setPdfResult(null);
    setPdfError("");
    setSpacerRatio(1.0);
    setIncludeDividers(true);
    setErrorMessage("");
    setInitialData(null);
  };

  /* ================================================================ */
  /*  RENDER: Success Phase (full-width, no sidebar)                   */
  /* ================================================================ */

  if (phase === "success") {
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
                    includeDividers ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                      includeDividers ? "translate-x-5" : "translate-x-0"
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
                {generatingPdf ? "PDF 생성 중..." : "PDF 생성"}
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
                navigate(`/batch-print?sets=${createdSetIds.join(",")}`)
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
    );
  }

  /* ================================================================ */
  /*  RENDER: Input Phase (2-column layout with sidebar)               */
  /* ================================================================ */

  const modeDescription =
    mode === "student"
      ? "학생을 선택하고 문제집별 오답 번호를 입력합니다."
      : "문제집을 선택(복수 가능)하고, 학생별로 단원별 오답 번호를 입력합니다.";

  return (
    <MainLayout>
      <div data-testid="wrong-answer-create-page" className="mx-auto max-w-7xl">
        <div className="flex gap-6">
          {/* ---- Main content ---- */}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                오답노트 생성
              </h1>
              <p className="text-sm text-gray-500 mt-1">{modeDescription}</p>
            </div>

            {/* Mode tabs */}
            <div
              className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6"
              data-testid="mode-tabs"
            >
              <button
                onClick={() => {
                  setMode("student");
                  setInitialData(null);
                  setErrorMessage("");
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "student"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid="mode-tab-student"
              >
                학생 중심
              </button>
              <button
                onClick={() => {
                  setMode("problem-set");
                  setInitialData(null);
                  setErrorMessage("");
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "problem-set"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid="mode-tab-problem-set"
              >
                문제집 중심
              </button>
            </div>

            {/* Mode content */}
            {mode === "student" ? (
              <StudentCenteredMode
                problemSets={problemSets}
                students={students}
                loadingPs={loadingPs}
                loadingStudents={loadingStudents}
                onSubmit={handleSubmit}
                submitting={submitting}
                errorMessage={errorMessage}
              />
            ) : (
              <ProblemSetCenteredMode
                problemSets={problemSets}
                students={students}
                loadingPs={loadingPs}
                loadingStudents={loadingStudents}
                onSubmit={handleSubmit}
                submitting={submitting}
                errorMessage={errorMessage}
                initialData={initialData ?? undefined}
              />
            )}
          </div>

          {/* ---- History sidebar (lg+ only) ---- */}
          <div className="hidden lg:block w-80 shrink-0">
            <HistoryPanel
              historyItems={historyItems}
              loadingHistory={loadingHistory}
              onLoad={handleLoadHistory}
              onDelete={handleDeleteHistory}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
