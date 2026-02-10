import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import { api } from '../lib/api'
import { useWrongAnswers } from '../hooks/useWrongAnswers'
import { ProblemSetPicker } from '../components/wrong-answer/ProblemSetPicker'
import { ChapterPicker } from '../components/wrong-answer/ChapterPicker'
import { NumberInput } from '../components/wrong-answer/NumberInput'
import { WrongAnswerList } from '../components/wrong-answer/WrongAnswerList'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'

interface Student {
  id: number
  name: string
}

interface WrongAnswerEntry {
  id: number
  chapter_id: number
  chapter_name: string
  problem_set_name: string
  problem_numbers: number[]
}

export default function WrongAnswerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = Number(id)

  const [student, setStudent] = useState<Student | null>(null)
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const [deletingSetId, setDeletingSetId] = useState<number | null>(null)

  const [selectedProblemSetId, setSelectedProblemSetId] = useState<number | null>(null)
  const [selectedProblemSetName, setSelectedProblemSetName] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [selectedChapterName, setSelectedChapterName] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const {
    sets,
    entries,
    setEntries,
    loading,
    error,
    fetchSets,
    createSet,
    deleteSet,
    fetchEntries,
    saveEntries,
  } = useWrongAnswers()

  useEffect(() => {
    if (!studentId) return
    const load = async () => {
      try {
        const students = await api.get<Student[]>('/students')
        const found = students.find((s) => s.id === studentId)
        if (found) {
          setStudent(found)
        } else {
          navigate('/students')
        }
      } catch {
        navigate('/students')
      }
    }
    load()
  }, [studentId, navigate])

  useEffect(() => {
    if (studentId) {
      fetchSets(studentId)
    }
  }, [studentId, fetchSets])

  useEffect(() => {
    if (selectedSetId) {
      fetchEntries(selectedSetId)
      setHasUnsavedChanges(false)
    }
  }, [selectedSetId, fetchEntries])

  const handleCreateSet = async () => {
    const newSet = await createSet(studentId)
    setSelectedSetId(newSet.id)
  }

  const handleDeleteSet = async () => {
    if (deletingSetId === null) return
    await deleteSet(deletingSetId)
    if (selectedSetId === deletingSetId) {
      setSelectedSetId(null)
      setEntries([])
    }
    setDeletingSetId(null)
  }

  const handleAddNumbers = useCallback(
    (numbers: number[]) => {
      if (!selectedChapterId || !selectedChapterName) return

      setEntries((prev: WrongAnswerEntry[]) => {
        const existing = prev.find((e) => e.chapter_id === selectedChapterId)
        if (existing) {
          const merged = [...new Set([...existing.problem_numbers, ...numbers])].sort(
            (a, b) => a - b
          )
          return prev.map((e) =>
            e.chapter_id === selectedChapterId
              ? { ...e, problem_numbers: merged }
              : e
          )
        }

        const newEntry: WrongAnswerEntry = {
          id: 0,
          chapter_id: selectedChapterId,
          chapter_name: selectedChapterName,
          problem_set_name: selectedProblemSetName,
          problem_numbers: numbers,
        }
        return [...prev, newEntry]
      })
      setHasUnsavedChanges(true)
    },
    [selectedChapterId, selectedChapterName, selectedProblemSetName, setEntries]
  )

  const handleRemoveEntry = useCallback(
    (chapterId: number) => {
      setEntries((prev: WrongAnswerEntry[]) =>
        prev.filter((e) => e.chapter_id !== chapterId)
      )
      setHasUnsavedChanges(true)
    },
    [setEntries]
  )

  const handleRemoveNumber = useCallback(
    (chapterId: number, num: number) => {
      setEntries((prev: WrongAnswerEntry[]) => {
        return prev
          .map((e) =>
            e.chapter_id === chapterId
              ? { ...e, problem_numbers: e.problem_numbers.filter((n) => n !== num) }
              : e
          )
          .filter((e) => e.problem_numbers.length > 0)
      })
      setHasUnsavedChanges(true)
    },
    [setEntries]
  )

  const handleSave = async () => {
    if (!selectedSetId) return
    setSaving(true)
    try {
      await saveEntries(
        selectedSetId,
        entries.map((e) => ({
          chapter_id: e.chapter_id,
          problem_numbers: e.problem_numbers,
        }))
      )
      setHasUnsavedChanges(false)
    } finally {
      setSaving(false)
    }
  }

  if (!student) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12 text-gray-500">불러오는 중...</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div data-testid="wrong-answer-page">
        <div className="mb-6">
          <button
            onClick={() => navigate('/students')}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; 학생 목록으로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {student.name} - 오답노트 관리
          </h1>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">오답노트 목록</h2>
                <Button size="sm" onClick={handleCreateSet}>
                  새 오답노트
                </Button>
              </div>

              {loading && sets.length === 0 && (
                <div className="py-4 text-center text-gray-400 text-sm">불러오는 중...</div>
              )}

              {!loading && sets.length === 0 && (
                <div className="py-8 text-center text-gray-400">
                  <p className="text-sm">오답노트가 없습니다.</p>
                  <p className="text-xs mt-1">새 오답노트를 만들어보세요.</p>
                </div>
              )}

              <div className="space-y-2">
                {sets.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${
                      selectedSetId === s.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedSetId(s.id)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingSetId(s.id)
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selectedSetId ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400">
                <p>오답노트를 선택하거나 새로 만들어주세요.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  오답 입력
                  {hasUnsavedChanges && (
                    <span className="ml-2 text-xs text-orange-500 font-normal">
                      (저장되지 않은 변경사항)
                    </span>
                  )}
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProblemSetPicker
                    value={selectedProblemSetId}
                    onChange={(psId, name) => {
                      setSelectedProblemSetId(psId)
                      setSelectedProblemSetName(name)
                      setSelectedChapterId(null)
                      setSelectedChapterName('')
                    }}
                  />
                  <ChapterPicker
                    problemSetId={selectedProblemSetId}
                    value={selectedChapterId}
                    onChange={(chId, name) => {
                      setSelectedChapterId(chId)
                      setSelectedChapterName(name)
                    }}
                  />
                </div>

                <NumberInput
                  onAdd={handleAddNumbers}
                  disabled={!selectedChapterId}
                />

                <hr className="border-gray-200" />

                <WrongAnswerList
                  entries={entries}
                  onRemoveEntry={handleRemoveEntry}
                  onRemoveNumber={handleRemoveNumber}
                />

                {entries.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving || !hasUnsavedChanges}
                    >
                      {saving ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {deletingSetId !== null && (
          <ConfirmDialog
            open={true}
            onClose={() => setDeletingSetId(null)}
            onConfirm={handleDeleteSet}
            title="오답노트 삭제"
            message="이 오답노트를 삭제하시겠습니까? 포함된 모든 오답 항목도 함께 삭제됩니다."
            confirmLabel="삭제"
          />
        )}
      </div>
    </MainLayout>
  )
}
