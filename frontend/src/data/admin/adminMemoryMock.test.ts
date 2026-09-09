import { describe, expect, it } from 'vitest'
import {
  ADMIN_MEMORY_GLOBAL_HEALTH_MOCK,
  ADMIN_MEMORY_HEALTH_ANNA_MOCK,
  ADMIN_MEMORY_HEALTH_BELA_MOCK,
  ADMIN_MEMORY_HEALTH_OWNER_MOCK,
} from '@/data/admin/adminMemoryMock'
import type { AdminMemoryCountBucket, AdminMemoryHealthResponse } from '@/data/admin/adminMemoryApi'

// Fix round (F2) — the install-wide health seed must be internally consistent with the per-user
// seeds it is supposed to summarize (the reviewer's own arithmetic: 952 vectors / 2496 items),
// never an independent fiction copy-shaped from something else. This test recomputes the sums
// directly from the three per-user mocks, so it fails the moment either side drifts again.

function countOf(buckets: AdminMemoryCountBucket[], key: string): number {
  return buckets.find((b) => b.key === key)?.count ?? 0
}

function sumOf(buckets: AdminMemoryCountBucket[]): number {
  return buckets.reduce((acc, b) => acc + b.count, 0)
}

function totalVectors(h: AdminMemoryHealthResponse): number {
  return sumOf(h.vectorsByStatus)
}

describe('adminMemoryMock — install-wide seed matches the per-user seeds (F2)', () => {
  const perUser = [ADMIN_MEMORY_HEALTH_ANNA_MOCK, ADMIN_MEMORY_HEALTH_OWNER_MOCK, ADMIN_MEMORY_HEALTH_BELA_MOCK]

  it('the total vector count across every known mock user is 952', () => {
    const total = perUser.reduce((acc, h) => acc + totalVectors(h), 0)
    expect(total).toBe(952)
  })

  it('the total item count across every known mock user is 2496', () => {
    const total = perUser.reduce((acc, h) => acc + sumOf(h.itemsByState), 0)
    expect(total).toBe(2496)
  })

  it('ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsReady/vectorsFailed/vectorsStale/itemsTotal are the SUM of the per-user seeds', () => {
    const readySum = perUser.reduce((acc, h) => acc + countOf(h.vectorsByStatus, 'ready'), 0)
    const failedSum = perUser.reduce((acc, h) => acc + countOf(h.vectorsByStatus, 'failed'), 0)
    const staleSum = perUser.reduce((acc, h) => acc + h.staleVectorCount, 0)
    const itemsSum = perUser.reduce((acc, h) => acc + sumOf(h.itemsByState), 0)

    expect(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsReady).toBe(readySum)
    expect(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsFailed).toBe(failedSum)
    expect(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.vectorsStale).toBe(staleSum)
    expect(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.itemsTotal).toBe(itemsSum)
  })

  // F3 — a hardcoded absolute date drifts further into the past (and eventually past the entry
  // page's own >26h warn threshold) every day the fixture goes unedited; this must stay relative.
  it('newestDailySummaryAt is relative to "now" (within the last day), not a hardcoded date', () => {
    const at = new Date(ADMIN_MEMORY_GLOBAL_HEALTH_MOCK.newestDailySummaryAt!).getTime()
    const hoursAgo = (Date.now() - at) / 3_600_000
    expect(hoursAgo).toBeGreaterThanOrEqual(0)
    expect(hoursAgo).toBeLessThan(24)
  })
})
