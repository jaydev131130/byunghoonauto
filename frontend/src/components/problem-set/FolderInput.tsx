import { useState } from 'react'

interface FolderInputProps {
  onSubmit: (path: string) => void
  disabled?: boolean
}

export function FolderInput({ onSubmit, disabled }: FolderInputProps) {
  const [path, setPath] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = path.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        폴더 경로
      </label>
      <input
        type="text"
        value={path}
        onChange={e => setPath(e.target.value)}
        placeholder="/Users/.../samples/쎈B 1-1"
        disabled={disabled}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   disabled:bg-gray-100 disabled:cursor-not-allowed"
        data-testid="folder-input"
      />
      <p className="text-xs text-gray-500">
        문제집이 들어있는 폴더의 전체 경로를 입력하세요
      </p>
      <button
        type="submit"
        disabled={disabled || !path.trim()}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
                   hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors"
        data-testid="import-button"
      >
        가져오기
      </button>
    </form>
  )
}
