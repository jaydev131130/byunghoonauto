interface WrongAnswerEntry {
  id: number
  chapter_id: number
  chapter_name: string
  problem_set_name: string
  problem_numbers: number[]
}

interface WrongAnswerListProps {
  entries: WrongAnswerEntry[]
  onRemoveEntry: (chapterId: number) => void
  onRemoveNumber: (chapterId: number, number: number) => void
}

export function WrongAnswerList({
  entries,
  onRemoveEntry,
  onRemoveNumber,
}: WrongAnswerListProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400" data-testid="wrong-answer-empty">
        <p>아직 추가된 오답이 없습니다.</p>
        <p className="text-sm mt-1">위에서 문제집, 단원을 선택하고 오답 번호를 입력하세요.</p>
      </div>
    )
  }

  const grouped = new Map<string, WrongAnswerEntry[]>()
  for (const entry of entries) {
    const key = entry.problem_set_name || '미분류'
    const existing = grouped.get(key) ?? []
    grouped.set(key, [...existing, entry])
  }

  const totalCount = entries.reduce((sum, e) => sum + e.problem_numbers.length, 0)

  return (
    <div className="space-y-4" data-testid="wrong-answer-list">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">오답 목록</h3>
        <span className="text-sm text-gray-500">
          총 {totalCount}문제
        </span>
      </div>

      {Array.from(grouped.entries()).map(([psName, psEntries]) => (
        <div key={psName} className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2">
            <h4 className="text-sm font-semibold text-gray-700">{psName}</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {psEntries.map((entry) => (
              <div
                key={entry.chapter_id}
                className="flex items-center justify-between px-4 py-3"
                data-testid={`entry-chapter-${entry.chapter_id}`}
              >
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-600">
                    {entry.chapter_name}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.problem_numbers.map((num) => (
                      <span
                        key={num}
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                      >
                        {num}번
                        <button
                          onClick={() => onRemoveNumber(entry.chapter_id, num)}
                          className="ml-0.5 text-red-400 hover:text-red-600"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveEntry(entry.chapter_id)}
                  className="ml-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="단원 전체 삭제"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
