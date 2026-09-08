import { describe, it, expect } from 'vitest'
import { MOCK_ANNA_ID, MOCK_BELA_ID, MOCK_OWNER_ID } from '@/data/admin/adminMock'
import { ADMIN_ROWS_MOCK, adminRowsMockFor, sliceRows } from '@/data/admin/adminDataMock'

// Task 18: mock rows used to ignore page/sort/userId/includeDeleted entirely — this file proves
// the shared `sliceRows` helper (also used by the MSW handler in test/msw/handlers.ts) actually
// honors every param that rides in ADMIN_ROWS_KEY.
describe('sliceRows', () => {
  const base = ADMIN_ROWS_MOCK.food_log

  it('defaults to page 0 at the base size when no params given', () => {
    const result = sliceRows(base, { table: 'food_log' })
    expect(result.page).toBe(0)
    expect(result.size).toBe(base.size)
    expect(result.rows).toHaveLength(base.size)
    expect(result.rows[0].id).toBe(base.rows[0].id)
  })

  it('slices a later page using the requested size', () => {
    // includeDeleted so the raw fixture order maps 1:1 to filtered indices.
    const result = sliceRows(base, { table: 'food_log', page: 1, size: 10, includeDeleted: true })
    expect(result.page).toBe(1)
    expect(result.size).toBe(10)
    expect(result.rows).toHaveLength(10)
    // The 25-row fixture's rows[10..19] land on page 1 at size 10.
    expect(result.rows[0].id).toBe(base.rows[10].id)
  })

  it('returns an empty page past the end without erroring', () => {
    const result = sliceRows(base, { table: 'food_log', page: 99, size: 5 })
    expect(result.rows).toHaveLength(0)
  })

  it('filters is_deleted rows out by default and recomputes total off the filtered set', () => {
    const deletedCount = base.rows.filter((r) => r.is_deleted).length
    expect(deletedCount).toBeGreaterThan(0)
    const result = sliceRows(base, { table: 'food_log', size: base.rows.length })
    expect(result.total).toBe(base.rows.length - deletedCount)
    expect(result.rows.every((r) => !r.is_deleted)).toBe(true)
  })

  it('includes soft-deleted rows when includeDeleted is set', () => {
    const result = sliceRows(base, { table: 'food_log', size: base.rows.length, includeDeleted: true })
    expect(result.total).toBe(base.rows.length)
  })

  it('filters by userId and recomputes total accordingly', () => {
    const annaCount = base.rows.filter((r) => r.created_by === MOCK_ANNA_ID && !r.is_deleted).length
    const result = sliceRows(base, { table: 'food_log', userId: MOCK_ANNA_ID, size: base.rows.length })
    expect(result.total).toBe(annaCount)
    expect(result.rows.every((r) => r.created_by === MOCK_ANNA_ID)).toBe(true)
  })

  it('sorts ascending and descending by an arbitrary column', () => {
    const asc = sliceRows(base, { table: 'food_log', sort: 'kcal', dir: 'asc', size: base.rows.length })
    const desc = sliceRows(base, { table: 'food_log', sort: 'kcal', dir: 'desc', size: base.rows.length })
    const ascKcals = asc.rows.map((r) => r.kcal as number)
    const descKcals = desc.rows.map((r) => r.kcal as number)
    expect(ascKcals).toEqual([...ascKcals].sort((a, b) => a - b))
    expect(descKcals).toEqual([...ascKcals].reverse())
  })

  it('combines userId + sort + paging together', () => {
    const bela = base.rows.filter((r) => r.created_by === MOCK_BELA_ID && !r.is_deleted)
    const result = sliceRows(base, {
      table: 'food_log', userId: MOCK_BELA_ID, sort: 'created_at', dir: 'asc', page: 0, size: 2,
    })
    expect(result.total).toBe(bela.length)
    expect(result.rows).toHaveLength(Math.min(2, bela.length))
    expect(result.rows.every((r) => r.created_by === MOCK_BELA_ID)).toBe(true)
  })
})

describe('adminRowsMockFor', () => {
  it('falls back to the food_log fixture for an unknown table', () => {
    const result = adminRowsMockFor({ table: 'no_such_table' })
    expect(result.rows[0].id).toBe(ADMIN_ROWS_MOCK.food_log.rows[0].id)
  })

  it('threads params through to sliceRows for a known table', () => {
    const result = adminRowsMockFor({ table: 'train_session', userId: MOCK_OWNER_ID })
    expect(result.rows).toHaveLength(0)
    const belaResult = adminRowsMockFor({ table: 'train_session', userId: MOCK_BELA_ID })
    expect(belaResult.rows).toHaveLength(1)
    expect(belaResult.rows[0].created_by).toBe(MOCK_BELA_ID)
  })
})
