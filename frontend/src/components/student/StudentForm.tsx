import { useState } from 'react'
import { z } from 'zod'
import Modal from '../common/Modal'
import Button from '../common/Button'
import type { Student } from '../../types/student'

const studentSchema = z.object({
  name: z.string().min(1, '이름은 필수 항목입니다.'),
  grade: z.string().optional(),
  class_name: z.string().optional(),
  contact: z.string().optional(),
  memo: z.string().optional(),
})

type StudentFormData = z.infer<typeof studentSchema>

interface StudentFormProps {
  student?: Student | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: StudentFormData) => Promise<void>
}

export function StudentForm({ student, isOpen, onClose, onSave }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    name: student?.name ?? '',
    grade: student?.grade ?? '',
    class_name: student?.class_name ?? '',
    contact: student?.contact ?? '',
    memo: student?.memo ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleChange = (field: keyof StudentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async () => {
    const result = studentSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    try {
      await onSave(result.data)
      onClose()
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : '저장에 실패했습니다.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={student ? '학생 수정' : '학생 추가'}
    >
      <div className="space-y-4">
        {errors._form && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {errors._form}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="학생 이름"
            data-testid="student-name-input"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
            <input
              type="text"
              value={formData.grade}
              onChange={(e) => handleChange('grade', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 중3"
              data-testid="student-grade-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
            <input
              type="text"
              value={formData.class_name}
              onChange={(e) => handleChange('class_name', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 2반"
              data-testid="student-class-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
          <input
            type="text"
            value={formData.contact}
            onChange={(e) => handleChange('contact', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="연락처"
            data-testid="student-contact-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <textarea
            value={formData.memo}
            onChange={(e) => handleChange('memo', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메모"
            data-testid="student-memo-input"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
