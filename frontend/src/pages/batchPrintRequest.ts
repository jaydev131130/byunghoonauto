export type BatchPrintMode = 'recent' | 'students'

export function shouldUseBatchPdfRequest(
  setCount: number,
  includeDividers: boolean,
): boolean {
  if (setCount <= 0) return false
  if (includeDividers) return true
  return setCount > 1
}

export function toggleSelectedId(currentIds: number[], targetId: number): number[] {
  if (currentIds.includes(targetId)) {
    return currentIds.filter((id) => id !== targetId)
  }
  return [...currentIds, targetId]
}

export function getDefaultStudentSetIds(setIds: number[]): number[] {
  if (setIds.length === 0) return []
  return [setIds[0]]
}

export function getActiveBatchSetIds(
  mode: BatchPrintMode,
  selectedRecentIds: number[],
  selectedStudentSetIds: Record<number, number[]>,
): number[] {
  if (mode === 'recent') {
    return [...new Set(selectedRecentIds)]
  }

  const studentSetIds = Object.values(selectedStudentSetIds).flat()
  return [...new Set(studentSetIds)]
}
