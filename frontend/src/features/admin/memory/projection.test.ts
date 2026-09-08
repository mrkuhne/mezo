import { describe, expect, it } from 'vitest'
import { decodeProjection, l2Normalise } from '@/features/admin/memory/projection'

// A hand-built little-endian Float32 block for [[1,2,3],[4,5,6]] (2 rows x 3 dims), generated
// once via `Buffer.from(new Float32Array([1,2,3,4,5,6]).buffer).toString('base64')` — a
// hand-typed base64 of the wrong length breaks the decode (see adminMemoryMock.ts's own note on
// this trap).
const BLOCK_2X3 = 'AACAPwAAAEAAAEBAAACAQAAAoEAAAMBA'

describe('decodeProjection', () => {
  it('round-trips a hand-built 2x3 block', () => {
    const rows = decodeProjection(BLOCK_2X3, 2, 3)
    expect(rows).toHaveLength(2)
    expect(Array.from(rows[0])).toEqual([1, 2, 3])
    expect(Array.from(rows[1])).toEqual([4, 5, 6])
  })

  it('returns an empty array for count 0 without decoding', () => {
    expect(decodeProjection('', 0, 50)).toEqual([])
  })

  it('throws a clear error when the byte length does not match count * dims * 4', () => {
    expect(() => decodeProjection(BLOCK_2X3, 3, 3)).toThrow(/expected count\(3\) \* dims\(3\) \* 4/)
  })
})

describe('l2Normalise', () => {
  it('makes every row norm 1', () => {
    const rows = decodeProjection(BLOCK_2X3, 2, 3)
    const normalised = l2Normalise(rows)
    for (const row of normalised) {
      const norm = Math.sqrt(row.reduce((sum, v) => sum + v * v, 0))
      expect(norm).toBeCloseTo(1, 6)
    }
  })

  it('leaves a zero row untouched, never NaN', () => {
    const normalised = l2Normalise([[0, 0, 0]])
    expect(normalised).toEqual([[0, 0, 0]])
    expect(normalised[0].some((v) => Number.isNaN(v))).toBe(false)
  })
})
