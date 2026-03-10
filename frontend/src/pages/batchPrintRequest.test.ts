import { describe, expect, it } from 'vitest'

import {
  getActiveBatchSetIds,
  getDefaultStudentSetIds,
  shouldUseBatchPdfRequest,
  toggleSelectedId,
} from './batchPrintRequest'

describe('shouldUseBatchPdfRequest', () => {
  it('uses batch request when dividers are enabled for a single set', () => {
    expect(shouldUseBatchPdfRequest(1, true)).toBe(true)
  })

  it('uses single request when only one set is selected and dividers are disabled', () => {
    expect(shouldUseBatchPdfRequest(1, false)).toBe(false)
  })

  it('uses batch request when multiple sets are selected', () => {
    expect(shouldUseBatchPdfRequest(2, false)).toBe(true)
  })
})

describe('toggleSelectedId', () => {
  it('adds a set id when it is not selected yet', () => {
    expect(toggleSelectedId([11], 12)).toEqual([11, 12])
  })

  it('removes a set id when it is already selected', () => {
    expect(toggleSelectedId([11, 12], 12)).toEqual([11])
  })
})

describe('getDefaultStudentSetIds', () => {
  it('defaults to the latest available set for a student', () => {
    expect(getDefaultStudentSetIds([101, 88, 77])).toEqual([101])
  })

  it('returns an empty selection when the student has no sets', () => {
    expect(getDefaultStudentSetIds([])).toEqual([])
  })
})

describe('getActiveBatchSetIds', () => {
  it('uses only recent selections in recent mode', () => {
    expect(
      getActiveBatchSetIds('recent', [8, 9, 8], {
        1: [101],
        2: [202],
      }),
    ).toEqual([8, 9])
  })

  it('uses flattened student selections in student mode', () => {
    expect(
      getActiveBatchSetIds('students', [8, 9], {
        1: [101, 102],
        2: [102, 202],
      }),
    ).toEqual([101, 102, 202])
  })
})
