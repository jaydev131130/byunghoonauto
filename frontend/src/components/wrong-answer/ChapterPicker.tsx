import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

interface Chapter {
  id: number
  name: string
}

interface ProblemSetDetail {
  id: number
  name: string
  chapters: Chapter[]
}

interface ChapterPickerProps {
  problemSetId: number | null
  value: number | null
  onChange: (id: number | null, name: string) => void
}

export function ChapterPicker({ problemSetId, value, onChange }: ChapterPickerProps) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!problemSetId) {
      setChapters([])
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const data = await api.get<ProblemSetDetail>(
          `/problem-sets/${problemSetId}`
        )
        setChapters(data.chapters ?? [])
      } catch {
        setChapters([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [problemSetId])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        단원 선택
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) {
            const chapter = chapters.find((c) => c.id === Number(v))
            onChange(Number(v), chapter?.name ?? '')
          } else {
            onChange(null, '')
          }
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={!problemSetId || loading}
        data-testid="chapter-picker"
      >
        <option value="">
          {!problemSetId
            ? '문제집을 먼저 선택하세요'
            : loading
              ? '불러오는 중...'
              : '단원을 선택하세요'}
        </option>
        {chapters.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {ch.name}
          </option>
        ))}
      </select>
    </div>
  )
}
