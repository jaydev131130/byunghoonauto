import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import { api } from "../../lib/api";
import { parseNumbers } from "../../utils/wrong-answer-helpers";
import type {
  ProblemSetListItem,
  ChapterInfo,
  ProblemSetDetail,
  StudentItem,
  StudentEntry,
} from "../../types/wrong-answer";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SubmitPayload {
  title: string;
  studentEntries: StudentEntry[];
  selectedPsIds: number[];
}

interface InitialData {
  title: string;
  selectedPsIds: number[];
  psChapters: Record<number, { name: string; chapters: ChapterInfo[] }>;
  selectedStudentIds: number[];
  studentInputs: Record<number, Record<number, string>>;
}

interface ProblemSetCenteredModeProps {
  problemSets: ProblemSetListItem[];
  students: StudentItem[];
  loadingPs: boolean;
  loadingStudents: boolean;
  onSubmit: (data: SubmitPayload) => Promise<void>;
  submitting: boolean;
  errorMessage: string;
  initialData?: InitialData;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProblemSetCenteredMode({
  problemSets,
  students,
  loadingPs,
  loadingStudents,
  onSubmit,
  submitting,
  errorMessage,
  initialData,
}: ProblemSetCenteredModeProps) {
  const navigate = useNavigate();

  /* ---------- core input state ---------- */
  const [selectedPsIds, setSelectedPsIds] = useState<number[]>([]);
  const [psChapters, setPsChapters] = useState<
    Record<number, { name: string; chapters: ChapterInfo[] }>
  >({});
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [studentInputs, setStudentInputs] = useState<
    Record<number, Record<number, string>>
  >({});
  const [title, setTitle] = useState("");

  /* ---------- restore initialData ---------- */
  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title);
    setSelectedPsIds(initialData.selectedPsIds);
    setPsChapters(initialData.psChapters);
    setSelectedStudentIds(initialData.selectedStudentIds);
    setStudentInputs(initialData.studentInputs);
    if (initialData.selectedStudentIds.length > 0) {
      setActiveStudentId(initialData.selectedStudentIds[0]);
    }
  }, [initialData]);

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
      }));
    },
    [],
  );

  const copyFromStudent = useCallback(
    (sourceStudentId: number, targetStudentId: number) => {
      setStudentInputs((prev) => ({
        ...prev,
        [targetStudentId]: { ...(prev[sourceStudentId] || {}) },
      }));
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Student selection helpers                                        */
  /* ---------------------------------------------------------------- */

  const handleToggleStudent = useCallback((id: number) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((sid) => sid !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedStudentIds(students.map((s) => s.id));
  }, [students]);

  const handleDeselectAll = useCallback(() => {
    setSelectedStudentIds([]);
    setActiveStudentId(null);
  }, []);

  // Keep activeStudentId in sync with selection
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
  /*  Per-student computed helpers                                     */
  /* ---------------------------------------------------------------- */

  const studentName = useCallback(
    (sid: number): string => {
      const s = students.find((st) => st.id === sid);
      return s ? s.name : `학생 ${sid}`;
    },
    [students],
  );

  const hasInputs = useCallback(
    (sid: number): boolean => {
      const inputs = studentInputs[sid];
      if (!inputs) return false;
      return Object.values(inputs).some((v) => parseNumbers(v).length > 0);
    },
    [studentInputs],
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

  /* ---------------------------------------------------------------- */
  /*  Problem set toggle (multi-select)                                */
  /* ---------------------------------------------------------------- */

  const toggleProblemSet = useCallback(
    async (psId: number) => {
      if (selectedPsIds.includes(psId)) {
        setSelectedPsIds((prev) => prev.filter((id) => id !== psId));
        setPsChapters((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([key]) => key !== String(psId)),
          ),
        );
      } else {
        setSelectedPsIds((prev) => [...prev, psId]);
        setLoadingChapters(true);
        try {
          const data = await api.get<ProblemSetDetail>(`/problem-sets/${psId}`);
          setPsChapters((prev) => ({
            ...prev,
            [psId]: { name: data.name, chapters: data.chapters },
          }));
        } catch {
          // Remove on fetch failure
          setSelectedPsIds((prev) => prev.filter((id) => id !== psId));
        } finally {
          setLoadingChapters(false);
        }
      }
    },
    [selectedPsIds],
  );

  /* ---------------------------------------------------------------- */
  /*  Submit                                                           */
  /* ---------------------------------------------------------------- */

  const allChapters = useMemo(
    () => selectedPsIds.flatMap((psId) => psChapters[psId]?.chapters || []),
    [selectedPsIds, psChapters],
  );

  const studentEntries = useMemo(() => {
    return selectedStudentIds
      .map((sid) => ({
        student_id: sid,
        entries: allChapters
          .map((ch) => ({
            chapter_id: ch.id,
            problem_numbers: parseNumbers(studentInputs[sid]?.[ch.id] || ""),
          }))
          .filter((e) => e.problem_numbers.length > 0),
      }))
      .filter((se) => se.entries.length > 0);
  }, [selectedStudentIds, allChapters, studentInputs]);

  const totalStudentsWithInputs = useMemo(
    () => studentEntries.length,
    [studentEntries],
  );

  const canSubmit =
    selectedPsIds.length > 0 && studentEntries.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      title:
        title.trim() || `오답노트 ${new Date().toISOString().slice(0, 10)}`,
      studentEntries,
      selectedPsIds,
    });
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <>
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
          <div className="text-sm text-gray-400">등록된 문제집이 없습니다.</div>
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
                const isSelected = selectedPsIds.includes(ps.id);
                return (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() => toggleProblemSet(ps.id)}
                    disabled={loadingChapters}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    } ${loadingChapters ? "opacity-50 cursor-wait" : ""}`}
                    data-testid={`ps-chip-${ps.id}`}
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
            등록된 학생이 없습니다.{" "}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => navigate("/students")}
              data-testid="link-student-register"
            >
              학생 등록하러 가기
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
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
                  data-testid={`student-chip-${s.id}`}
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
              const isActive = sid === activeStudentId;
              const studentHasInputs = hasInputs(sid);
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
                  data-testid={`student-tab-${sid}`}
                >
                  {studentName(sid)}
                  {studentHasInputs && (
                    <span
                      className={`ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        isActive
                          ? "bg-white text-blue-600"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      V
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Copy from another student */}
          {selectedStudentIds.length > 1 && activeStudentId !== null && (
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
                        : " (입력 없음)"}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Chapter inputs for active student, grouped by problem set */}
          {activeStudentId !== null && (
            <div className="space-y-3" data-testid="chapter-inputs">
              {loadingChapters ? (
                <div className="text-sm text-gray-400">단원 불러오는 중...</div>
              ) : allChapters.length === 0 ? (
                <div className="text-sm text-gray-400">단원이 없습니다.</div>
              ) : (
                selectedPsIds.map((psId) => {
                  const ps = psChapters[psId];
                  if (!ps) return null;
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
                            studentInputs[activeStudentId]?.[ch.id] || "";
                          const parsed = parseNumbers(inputVal);
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
                                    e.target.value,
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
                          );
                        })}
                      </div>
                    </div>
                  );
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">4. 생성</h2>
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
                    const problemCount = countProblems(sid);
                    return (
                      <span
                        key={sid}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          problemCount > 0
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-200 text-gray-500"
                        }`}
                        data-testid={`summary-student-${sid}`}
                      >
                        {studentName(sid)}: {problemCount}문제
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
              {submitting ? "생성 중..." : "오답노트 생성"}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
