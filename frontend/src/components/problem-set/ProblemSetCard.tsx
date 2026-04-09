import { useEffect, useState } from 'react'

interface ProblemSetCardProps {
  id: number
  name: string
  chapterCount: number
  totalProblems: number
  createdAt: string
  onRename: (id: number, name: string) => Promise<unknown>
  onDelete: (id: number) => void
}

export function ProblemSetCard({
  id,
  name,
  chapterCount,
  totalProblems,
  createdAt,
  onRename,
  onDelete,
}: ProblemSetCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    setDraftName(name)
  }, [name])

  const handleRename = async () => {
    const trimmedName = draftName.trim()
    if (!trimmedName) {
      setEditError('문제집 이름을 입력해주세요.')
      return
    }
    if (trimmedName === name) {
      setIsEditing(false)
      setEditError('')
      return
    }

    setIsSaving(true)
    setEditError('')
    try {
      await onRename(id, trimmedName)
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '문제집 이름 수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
      data-testid={`problem-set-card-${id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleRename()
                  }
                  if (e.key === 'Escape') {
                    setDraftName(name)
                    setEditError('')
                    setIsEditing(false)
                  }
                }}
                autoFocus
                data-testid={`edit-problem-set-name-${id}`}
              />
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => void handleRename()}
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(name)
                    setEditError('')
                    setIsEditing(false)
                  }}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
              </div>
              {editError && (
                <p className="text-sm text-red-500">{editError}</p>
              )}
            </div>
          ) : (
            <a href={`/problem-sets/${id}/verify`} className="block">
              <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                {name}
              </h3>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span>{chapterCount}개 단원 · {totalProblems}문제</span>
                <span>{formattedDate}</span>
              </div>
            </a>
          )}
        </div>
        {!isEditing && (
          <div className="ml-3 flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setDraftName(name)
                setEditError('')
                setIsEditing(true)
              }}
              className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
              data-testid={`edit-problem-set-${id}`}
              title="이름 수정"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L12 15l-4 1 1-4 9.586-9.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                if (window.confirm(`"${name}" 문제집을 삭제하시겠습니까?`)) {
                  onDelete(id)
                }
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              data-testid={`delete-problem-set-${id}`}
              title="삭제"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
