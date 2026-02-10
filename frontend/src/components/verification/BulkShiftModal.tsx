import { useState } from 'react'

interface BulkShiftModalProps {
  open: boolean
  onClose: () => void
  onApply: (fromNumber: number, shift: number) => void
  totalProblems: number
}

export function BulkShiftModal({ open, onClose, onApply, totalProblems }: BulkShiftModalProps) {
  const [fromNumber, setFromNumber] = useState(1)
  const [shift, setShift] = useState(1)

  if (!open) return null

  const handleApply = () => {
    if (fromNumber >= 1 && shift !== 0) {
      onApply(fromNumber, shift)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="bulk-shift-modal">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">일괄 번호 변경</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 번호</label>
            <input
              type="number"
              min={1}
              max={totalProblems}
              value={fromNumber}
              onChange={e => setFromNumber(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="bulk-shift-from"
            />
            <p className="text-xs text-gray-500 mt-1">이 번호 이상의 문제들이 변경됩니다</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이동할 값</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShift(s => s - 1)}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                -
              </button>
              <input
                type="number"
                value={shift}
                onChange={e => setShift(parseInt(e.target.value, 10) || 0)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="bulk-shift-value"
              />
              <button
                onClick={() => setShift(s => s + 1)}
                className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {shift > 0 ? `+${shift} (뒤로 밀기)` : shift < 0 ? `${shift} (앞으로 당기기)` : '변경 없음'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={shift === 0}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700
                       disabled:bg-gray-400 disabled:cursor-not-allowed"
            data-testid="bulk-shift-apply"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
