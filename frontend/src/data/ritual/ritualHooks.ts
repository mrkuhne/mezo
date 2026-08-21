import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { completeMockDerivedHabit } from '@/data/habit/habitHooks'
import { applyMockNeedsClose, NEEDS_SUMMARY_KEY } from '@/data/needs/needsHooks'
import { needsApi, type NeedsRingsWire } from '@/data/needs/needsApi'
import { EMPTY_RITUAL_DAY, mockRitualDay } from '@/data/ritual/ritualMock'
import { ritualApi } from '@/data/ritual/ritualApi'
import type { RitualDay } from '@/data/types'
import { useDualQuery } from '@/data/useDualQuery'

export function useRitualDay(date: string): { data: RitualDay; isPending: boolean } {
  return useDualQuery<RitualDay>({
    queryKey: ['ritualDay', date],
    mockData: mockRitualDay(date),
    realFetch: () => ritualApi.day(date),
    realEmpty: EMPTY_RITUAL_DAY(date),
  })
}

export function useRitualActions(
  date: string,
): {
  close: (rings?: NeedsRingsWire) => Promise<RitualDay>
  saveReflection: (text: string) => Promise<RitualDay>
  pending: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (rings?: NeedsRingsWire): Promise<RitualDay> => {
      if (mock) {
        const prev = qc.getQueryData<RitualDay>(['ritualDay', date]) ?? mockRitualDay(date)
        if (prev.closed) return prev // idempotent: no second award
        const next = { ...prev, closed: true, closedAt: new Date().toISOString() }
        qc.setQueryData(['ritualDay', date], next)
        // Mock mirror of the server-side ritual_closed derivation (real mode refetches
        // habitDay below): the close also ticks the DERIVED evening_ritual chain row.
        completeMockDerivedHabit(qc, date, 'evening_ritual')
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 }) // the evening_ritual catalog XP
        // Placed AFTER the ritual award, inside the not-yet-closed path only — the early
        // return above already makes a re-close idempotent for the ritual itself, so putting
        // the needs award here means it too can never double-fire on re-close (it also
        // carries its own lastCloseDate guard, applyMockNeedsClose, belt-and-braces).
        if (rings) applyMockNeedsClose(qc, date, rings)
        return next
      }
      const day = await ritualApi.close(date)
      // needs award must never block the napzárás — best-effort, real close still proceeds
      // even if this fails (network hiccup, backend down, etc).
      if (rings) {
        try {
          await needsApi.close(date, rings)
        } catch {
          // swallow — see comment above
        }
      }
      // mezo-ywz1: the derived evening_ritual completion (+10 XP + level_up) is persisted ONLY by
      // the GET /api/habit/day the server gates it on. RitualPage mounts useHabitDay so this
      // invalidation refetches; await it so the +10 lands in level_up_event BEFORE the harvest reads.
      await qc.invalidateQueries({ queryKey: ['habitDay', date] })
      // Now the +10 exists → re-read the harvest aggregate + account rollup (they must NOT run
      // concurrently with the habitDay refetch, or they race the award persistence).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['gamificationDay', date] }),
        qc.invalidateQueries({ queryKey: ['gamification'] }),
        qc.invalidateQueries({ queryKey: ['progressionProfile'] }),
      ])
      qc.invalidateQueries({ queryKey: ['dailyQuests', date] }) // not harvest-critical — fire-and-forget
      qc.invalidateQueries({ queryKey: ['ritualDay', date] })
      qc.invalidateQueries({ queryKey: NEEDS_SUMMARY_KEY }) // not harvest-critical — fire-and-forget
      return day
    },
  })
  // W1.2 (mezo-b3pp.2): the prose reflection upserts BEFORE the close — the one write the ritual
  // performs before act 5. Mock mode patches the ritualDay cache directly (no server round trip);
  // real mode PUTs and lets the response reseed the cache. Blank/whitespace text is a CLEAR, not a
  // create — mirrors the backend's strip()-then-null-if-blank semantics so modes don't diverge.
  const reflectionMutation = useMutation({
    mutationFn: async (text: string): Promise<RitualDay> => {
      if (mock) {
        const prev = qc.getQueryData<RitualDay>(['ritualDay', date]) ?? mockRitualDay(date)
        const next = { ...prev, reflectionText: text.trim() || null }
        qc.setQueryData(['ritualDay', date], next)
        return next
      }
      const day = await ritualApi.saveReflection(date, text)
      qc.setQueryData(['ritualDay', date], day)
      return day
    },
  })
  return {
    close: (rings?: NeedsRingsWire) => mutation.mutateAsync(rings),
    saveReflection: (text: string) => reflectionMutation.mutateAsync(text),
    pending: mutation.isPending || reflectionMutation.isPending,
  }
}
