import { useState } from 'react'
import Button from '../common/Button'

interface NumberInputProps {
  onAdd: (numbers: number[]) => void
  disabled?: boolean
}

export function NumberInput({ onAdd, disabled }: NumberInputProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    setError(null)

    const raw = value.trim()
    if (!raw) {
      setError('오답 번호를 입력하세요.')
      return
    }

    const parts = raw.split(/[\s,]+/).filter(Boolean)
    const numbers: number[] = []

    for (const part of parts) {
      const n = Number(part)
      if (!Number.isInteger(n) || n <= 0) {
        setError(`"${part}"는 유효한 문제 번호가 아닙니다. 양의 정수만 입력하세요.`)
        return
      }
      numbers.push(n)
    }

    if (numbers.length === 0) {
      setError('유효한 문제 번호를 입력하세요.')
      return
    }

    const unique = [...new Set(numbers)].sort((a, b) => a - b)
    onAdd(unique)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        오답 번호 입력
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="예: 3, 7, 12 또는 3 7 12"
          className={`flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={disabled}
          data-testid="number-input"
        />
        <Button onClick={handleAdd} disabled={disabled}>
          추가
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
