import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

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
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) {
            const ps = problemSets.find((p) => p.id === Number(v))
            onChange(Number(v), ps?.name ?? '')
          } else {
            onChange(null, '')
          }
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={loading}
        data-testid="problem-set-picker"
      >
        <option value="">
          {loading ? '불러오는 중...' : '문제집을 선택하세요'}
        </option>
        {problemSets.map((ps) => (
          <option key={ps.id} value={ps.id}>
            {ps.name}
          </option>
        ))}
      </select>
    </div>
  )
}
