import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import ProblemSetSearchDropdown from './ProblemSetSearchDropdown'

interface ProblemSet {
  id: number
  name: string
}

interface ProblemSetPickerProps {
  value: number | null
  onChange: (id: number | null, name: string) => void
}

export function ProblemSetPicker({ value, onChange }: ProblemSetPickerProps) {
  const [problemSets, setProblemSets] = useState<ProblemSet[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.get<ProblemSet[]>('/problem-sets')
        setProblemSets(data)
      } catch {
        setProblemSets([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        문제집 선택
      </label>
      <div
        className="rounded-md"
        data-testid="problem-set-picker"
      >
        <ProblemSetSearchDropdown
          problemSets={problemSets}
          selectedId={value}
          onSelect={onChange}
          disabled={loading}
          loading={loading}
          placeholder="문제집을 선택하세요"
          searchPlaceholder="문제집 이름으로 검색"
          dataTestId="problem-set-picker-dropdown"
        />
      </div>
    </div>
  )
}
