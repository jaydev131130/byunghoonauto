import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ProblemSetListItem,
  ChapterInfo,
  ProblemSetDetail,
  StudentItem,
  StudentEntry,
} from "../../types/wrong-answer";
import { parseNumbers } from "../../utils/wrong-answer-helpers";
import { api } from "../../lib/api";
import Button from "../common/Button";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StudentCenteredModeProps {
  problemSets: ProblemSetListItem[];
  students: StudentItem[];
  loadingPs: boolean;
  loadingStudents: boolean;
  onSubmit: (data: {
    title: string;
    studentEntries: StudentEntry[];
    selectedPsIds: number[];
  }) => Promise<void>;
  submitting: boolean;
  errorMessage: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StudentCenteredMode({
  problemSets,
  students,
  loadingPs,
  loadingStudents,
  onSubmit,
  submitting,
  errorMessage,
}: StudentCenteredModeProps) {
  /* ---------- Step 1: Student selection ---------- */
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);

  /* ---------- Step 2: Per-student problem set selection ---------- */
  const [perStudentPsIds, setPerStudentPsIds] = useState<
    Record<number, number[]>
  >({});

  /* ---------- Shared chapter cache ---------- */
  const [psChaptersCache, setPsChaptersCache] = useState<
    Record<number, { name: string; chapters: ChapterInfo[] }>
  >({});

  /* ---------- Per-student wrong answer inputs ---------- */
  const [studentInputs, setStudentInputs] = useState<
    Record<number, Record<number, string>>
  >({});

  /* ---------- Title ---------- */
  const [title, setTitle] = useState("");

  /* ---------- Loading ---------- */
  const [loadingChapters, setLoadingChapters] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Student selection helpers                                        */
  /* ---------------------------------------------------------------- */

  const handleToggleStudent = useCallback((id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAllStudents = useCallback(() => {
    setSelectedStudentIds(students.map((s) => s.id));
  }, [students]);

  const handleDeselectAllStudents = useCallback(() => {
    setSelectedStudentIds([]);
    setActiveStudentId(null);
  }, []);

  // Keep activeStudentId in sync
  useEffect(() => {
    if (selectedStudentIds.length === 0) {
      setActiveStudentId(null);
    } else if (
      activeStudentId === null ||
      !selectedStudentIds.includes(activeStudentId)
    ) {
      setActiveStudentId(selectedStudentIds[0]);
    }
  }, [selectedStudentIds, activeStudentId]);

  /* ---------------------------------------------------------------- */
  /*  Per-student problem set toggle                                   */
  /* ---------------------------------------------------------------- */

  const toggleProblemSetForStudent = useCallback(
    async (studentId: number, psId: number) => {
      const currentIds = perStudentPsIds[studentId] || [];
      if (currentIds.includes(psId)) {
        // Remove
        setPerStudentPsIds((prev) => ({
          ...prev,
          [studentId]: (prev[studentId] || []).filter((id) => id !== psId),
        }));
      } else {
        // Add
        setPerStudentPsIds((prev) => ({
          ...prev,
          [studentId]: [...(prev[studentId] || []), psId],
        }));

        // Fetch chapters if not cached
        if (!psChaptersCache[psId]) {
          setLoadingChapters(true);
          try {
            const data = await api.get<ProblemSetDetail>(
              `/problem-sets/${psId}`,
            );
            setPsChaptersCache((prev) => ({
              ...prev,
              [psId]: { name: data.name, chapters: data.chapters },
            }));
          } catch {
            // Revert on failure
            setPerStudentPsIds((prev) => ({
              ...prev,
              [studentId]: (prev[studentId] || []).filter((id) => id !== psId),
            }));
          } finally {
            setLoadingChapters(false);
          }
        }
      }
    },
    [perStudentPsIds, psChaptersCache],
  );

  /* ---------------------------------------------------------------- */
  /*  Input helpers                                                    */
  /* ---------------------------------------------------------------- */

  const updateStudentChapterInput = useCallback(
    (studentId: number, chapterId: number, value: string) => {
      setStudentInputs((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [chapterId]: value,
        },
      }));
    },
    [],
  );

  const copyFromStudent = useCallback(
    (sourceStudentId: number, targetStudentId: number) => {
      // Copy both problem set selection AND inputs
      setPerStudentPsIds((prev) => ({
        ...prev,
        [targetStudentId]: [...(prev[sourceStudentId] || [])],
      }));
      setStudentInputs((prev) => ({
        ...prev,
        [targetStudentId]: { ...(prev[sourceStudentId] || {}) },
      }));
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Computed helpers                                                  */
  /* ---------------------------------------------------------------- */

  const studentName = useCallback(
    (sid: number): string => {
      const s = students.find((st) => st.id === sid);
      return s ? s.name : `학생 ${sid}`;
    },
    [students],
  );

  const countProblems = useCallback(
    (sid: number): number => {
      const inputs = studentInputs[sid];
      if (!inputs) return 0;
      return Object.values(inputs).reduce(
        (sum, v) => sum + parseNumbers(v).length,
        0,
      );
    },
    [studentInputs],
  );

  const hasInputs = useCallback(
    (sid: number): boolean => countProblems(sid) > 0,
    [countProblems],
  );

  // Chapters for active student based on their selected problem sets
  const activeStudentChapters = useMemo(() => {
    if (activeStudentId === null) return [];
    const psIds = perStudentPsIds[activeStudentId] || [];
    return psIds.flatMap((psId) => psChaptersCache[psId]?.chapters || []);
  }, [activeStudentId, perStudentPsIds, psChaptersCache]);

  // Active student's selected problem set ids
  const activeStudentPsIds = useMemo(() => {
    if (activeStudentId === null) return [];
    return perStudentPsIds[activeStudentId] || [];
  }, [activeStudentId, perStudentPsIds]);

  /* ---------------------------------------------------------------- */
  /*  Submit                                                           */
  /* ---------------------------------------------------------------- */

  const studentEntries = useMemo(() => {
    return selectedStudentIds
      .map((sid) => {
        const psIds = perStudentPsIds[sid] || [];
        const chapters = psIds.flatMap(
          (psId) => psChaptersCache[psId]?.chapters || [],
        );
        return {
          student_id: sid,
          entries: chapters
            .map((ch) => ({
              chapter_id: ch.id,
              problem_numbers: parseNumbers(studentInputs[sid]?.[ch.id] || ""),
            }))
            .filter((e) => e.problem_numbers.length > 0),
        };
      })
      .filter((se) => se.entries.length > 0);
  }, [selectedStudentIds, perStudentPsIds, psChaptersCache, studentInputs]);

  const totalStudentsWithInputs = useMemo(
    () => studentEntries.length,
    [studentEntries],
  );

  const allSelectedPsIds = useMemo(
    () => [
      ...new Set(
        selectedStudentIds.flatMap((sid) => perStudentPsIds[sid] || []),
      ),
    ],
    [selectedStudentIds, perStudentPsIds],
  );

  const canSubmit =
    selectedStudentIds.length > 0 && studentEntries.length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const defaultTitle = `오답노트 ${new Date().toISOString().slice(0, 10)}`;
    const finalTitle = title.trim() || defaultTitle;
    await onSubmit({
      title: finalTitle,
      studentEntries,
      selectedPsIds: allSelectedPsIds,
    });
  }, [canSubmit, title, studentEntries, allSelectedPsIds, onSubmit]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6" data-testid="student-centered-mode">
      {/* ---- Error ---- */}
      {errorMessage && (
        <div
          className="rounded-md bg-red-50 p-4 text-sm text-red-700"
          data-testid="sc-error-message"
        >
          {errorMessage}
        </div>
      )}

      {/* ---- Step 1: Student Selection ---- */}
      <section
        className="rounded-lg border border-gray-200 bg-white p-5"
        data-testid="sc-section-students"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            1. 학생 선택
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
              onClick={handleSelectAllStudents}
              data-testid="sc-select-all-students"
            >
              전체 선택
            </button>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={handleDeselectAllStudents}
              data-testid="sc-deselect-all-students"
            >
              전체 해제
            </button>
          </div>
        </div>

        {loadingStudents ? (
          <div className="text-sm text-gray-400">불러오는 중...</div>
        ) : students.length === 0 ? (
          <div className="text-sm text-gray-400">등록된 학생이 없습니다.</div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="sc-student-chips">
            {students.map((s) => {
              const isSelected = selectedStudentIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleToggleStudent(s.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  data-testid={`sc-student-chip-${s.id}`}
                >
                  {s.name}
                  {s.grade && (
                    <span
                      className={`ml-1 text-xs ${
                        isSelected ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      {s.grade}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Student tabs */}
        {selectedStudentIds.length > 0 && (
          <div
            className="flex gap-1 overflow-x-auto pt-4 mt-4 border-t border-gray-100"
            data-testid="sc-student-tabs"
          >
            {selectedStudentIds.map((sid) => {
              const isActive = sid === activeStudentId;
              const problemCount = countProblems(sid);
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => setActiveStudentId(sid)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  data-testid={`sc-student-tab-${sid}`}
                >
                  {studentName(sid)}
                  {problemCount > 0 && (
                    <span
                      className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        isActive
                          ? "bg-white text-blue-600"
                          : "bg-green-100 text-green-700"
                      }`}
                      data-testid={`sc-student-tab-badge-${sid}`}
                    >
                      {problemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Step 2: Problem Set Selection (per-student) ---- */}
      {activeStudentId !== null && (
        <section
          className="rounded-lg border border-gray-200 bg-white p-5"
          data-testid="sc-section-problem-set"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            2. 문제집 선택
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({studentName(activeStudentId)})
            </span>
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            학생마다 서로 다른 문제집을 선택할 수 있습니다.
          </p>

          {loadingPs ? (
            <div className="text-sm text-gray-400">불러오는 중...</div>
          ) : problemSets.length === 0 ? (
            <div className="text-sm text-gray-400">
              등록된 문제집이 없습니다.
            </div>
          ) : (
            <div
              className="flex flex-wrap gap-2"
              data-testid="sc-problem-set-chips"
            >
              {problemSets.map((ps) => {
                const isSelected = activeStudentPsIds.includes(ps.id);
                return (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() =>
                      toggleProblemSetForStudent(activeStudentId, ps.id)
                    }
                    disabled={loadingChapters}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    } ${loadingChapters ? "opacity-50 cursor-wait" : ""}`}
                    data-testid={`sc-ps-chip-${activeStudentId}-${ps.id}`}
                  >
                    {ps.name}
                    <span
                      className={`ml-1 text-xs ${
                        isSelected ? "text-indigo-200" : "text-gray-400"
                      }`}
                    >
                      ({ps.chapter_count}단원, {ps.total_problems}문제)
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ---- Step 3: Wrong Answer Inputs ---- */}
      {activeStudentId !== null && activeStudentPsIds.length > 0 && (
        <section
          className="rounded-lg border border-gray-200 bg-white p-5"
          data-testid="sc-section-inputs"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            3. 오답 입력
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({studentName(activeStudentId)})
            </span>
          </h2>

          {/* Copy from another student */}
          {selectedStudentIds.length > 1 && (
            <div className="mb-4">
              <select
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value=""
                onChange={(e) => {
                  const sourceId = Number(e.target.value);
                  if (sourceId && activeStudentId !== null) {
                    copyFromStudent(sourceId, activeStudentId);
                  }
                }}
                data-testid="sc-copy-from-student-select"
              >
                <option value="">
                  다른 학생에서 복사 (문제집 선택 + 오답)...
                </option>
                {selectedStudentIds
                  .filter((sid) => sid !== activeStudentId)
                  .map((sid) => (
                    <option key={sid} value={sid}>
                      {studentName(sid)}
                      {hasInputs(sid)
                        ? ` (${countProblems(sid)}문제)`
                        : " (입력 없음)"}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Chapter inputs grouped by problem set */}
          <div className="space-y-3" data-testid="sc-chapter-inputs">
            {loadingChapters ? (
              <div className="text-sm text-gray-400">단원 불러오는 중...</div>
            ) : activeStudentChapters.length === 0 ? (
              <div className="text-sm text-gray-400">단원이 없습니다.</div>
            ) : (
              activeStudentPsIds.map((psId) => {
                const ps = psChaptersCache[psId];
                if (!ps) return null;
                return (
                  <div
                    key={psId}
                    className="mb-6"
                    data-testid={`sc-ps-section-${psId}`}
                  >
                    <h4 className="text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                      {ps.name}
                    </h4>
                    <div className="space-y-2">
                      {ps.chapters.map((ch) => {
                        const inputVal =
                          studentInputs[activeStudentId]?.[ch.id] || "";
                        const parsed = parseNumbers(inputVal);
                        return (
                          <div
                            key={ch.id}
                            className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
                            data-testid={`sc-chapter-row-${ch.id}`}
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
                                  e.target.value,
                                )
                              }
                              data-testid={`sc-chapter-input-${activeStudentId}-${ch.id}`}
                            />
                            <span className="shrink-0 text-xs text-gray-400">
                              / {ch.problem_count}문제
                            </span>
                            {parsed.length > 0 && (
                              <span
                                className="shrink-0 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                data-testid={`sc-chapter-badge-${activeStudentId}-${ch.id}`}
                              >
                                {parsed.length}개
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ---- Step 4: Title + Summary + Submit ---- */}
      <section
        className="rounded-lg border border-gray-200 bg-white p-5"
        data-testid="sc-section-submit"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">4. 생성</h2>
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="sc-wa-title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              제목 (선택)
            </label>
            <input
              id="sc-wa-title"
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder={`오답노트 ${new Date().toISOString().slice(0, 10)}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="sc-title-input"
            />
          </div>

          {/* Per-student summary */}
          <div
            className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-600"
            data-testid="sc-summary-section"
          >
            {totalStudentsWithInputs > 0 ? (
              <div className="space-y-1">
                <div className="font-medium text-gray-700 mb-2">
                  학생별 오답 현황
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedStudentIds.map((sid) => {
                    const problemCount = countProblems(sid);
                    const psCount = (perStudentPsIds[sid] || []).length;
                    return (
                      <span
                        key={sid}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          problemCount > 0
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-200 text-gray-500"
                        }`}
                        data-testid={`sc-summary-student-${sid}`}
                      >
                        {studentName(sid)}: {problemCount}문제
                        {psCount > 0 && (
                          <span className="ml-1 opacity-60">
                            ({psCount}개 문제집)
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {totalStudentsWithInputs}명 학생에게 오답노트가 생성됩니다.
                  {selectedStudentIds.length > totalStudentsWithInputs && (
                    <span className="ml-1 text-amber-500">
                      (입력 없는{" "}
                      {selectedStudentIds.length - totalStudentsWithInputs}
                      명은 제외)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-400" data-testid="sc-summary-text">
                학생 선택, 문제집 선택, 오답 입력을 완료해주세요.
              </span>
            )}
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              data-testid="sc-submit-button"
            >
              {submitting ? "생성 중..." : "오답노트 생성"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
