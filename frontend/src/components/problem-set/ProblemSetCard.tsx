interface ProblemSetCardProps {
  id: number
  name: string
  chapterCount: number
  totalProblems: number
  createdAt: string
  onDelete: (id: number) => void
}

export function ProblemSetCard({ id, name, chapterCount, totalProblems, createdAt, onDelete }: ProblemSetCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
      data-testid={`problem-set-card-${id}`}
    >
      <div className="flex items-start justify-between">
        <a href={`/problem-sets/${id}/verify`} className="flex-1 block">
          <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            {name}
          </h3>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <span>{chapterCount}개 단원 · {totalProblems}문제</span>
            <span>{formattedDate}</span>
          </div>
        </a>
        <button
          onClick={(e) => {
            e.preventDefault()
            if (window.confirm(`"${name}" 문제집을 삭제하시겠습니까?`)) {
              onDelete(id)
            }
          }}
          className="ml-3 p-2 text-gray-400 hover:text-red-500 transition-colors"
          data-testid={`delete-problem-set-${id}`}
          title="삭제"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
