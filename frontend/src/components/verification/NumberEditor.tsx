import { useState, useRef, useEffect } from 'react'

interface NumberEditorProps {
  number: number
  onSave: (newNumber: number) => void
}

export function NumberEditor({ number, onSave }: NumberEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(number))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    setValue(String(number))
  }, [number])

  const handleSave = () => {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > 0 && parsed !== number) {
      onSave(parsed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setValue(String(number))
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-14 px-1 py-0.5 text-center text-sm border border-blue-400 rounded
                   focus:outline-none focus:ring-1 focus:ring-blue-500"
        data-testid="number-editor-input"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="px-2 py-0.5 text-sm font-medium text-gray-700 bg-gray-100 rounded
                 hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer"
      title="클릭하여 번호 수정"
      data-testid="number-editor-display"
    >
      #{number}
    </button>
  )
}
