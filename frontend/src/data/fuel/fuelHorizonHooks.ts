// ============================================================
// Mezo · useFuelHorizon — a Trendek hosszabb távjának adata (Fuel Titanium S3, mezo-83g0;
// manifeszt C3 „evés × súly egy időtengelyen").
//
// ÚJ BACKEND NINCS, és nem is kell: mindkét sorozat MEGLÉVŐ felületekről jön.
//   • heti kalória-átlag — a heti rollup (`GET /api/me/week/{monday}`) `weekly.avgKcal`-ja, ami
//     „mean over days with logged kcal", tehát már ŐSZINTE: nem naplózott nap nincs benne, és
//     ha a hétben egy sincs, a mező null.
//   • heti súlyátlag — a SÚLYNAPLÓ (`useWeight().weightLog`), ugyanaz a sorozat, amiből az Én
//     a súlyt rajzolja. A csoportosítás itt helyben történik, mert nekünk MINDEN horizont-hétre
//     kell egy sor — a mérés nélküli hétre is, `null` súllyal (valódi szakadás).
//
// Hét darab heti rollup a `useQueries` ház-idiómával megy (a minta: `useWeekMuscleLog` — „≤7
// cache-elt fetch kliensoldali összesítése, amíg ez nem mérhetően fáj"). Mock módban egyik sem
// hálózik: a determinisztikus demo-hét szolgál.
//
// ŐSZINTE-NULL: egyetlen hiányzó minta sincs interpolálva vagy nullázva — ami nincs, az `null`,
// és a grafikon szakadásként rajzolja.
// ============================================================
import { useQueries } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { meWeekApi } from '@/data/me/meWeekApi'
import { mockMeWeek } from '@/data/me/meWeek'
import { useWeight } from '@/data/me/weightHooks'
import { addDays, huMonthDay, mondayOf } from '@/shared/lib/dates'
import type { HorizonWeek } from '@/features/fuel/components/FuelHorizon'

/** Hány hetet nézünk visszafelé, a megnyitott hetet is beleértve (a prototípus 7 hetet rajzol). */
export const HORIZON_WEEKS = 7

/** A horizont hétfői, legöregebbtől a legfrissebbig. */
export function horizonMondays(endMonday: string, count = HORIZON_WEEKS): string[] {
  return Array.from({ length: count }, (_, i) => addDays(endMonday, -7 * (count - 1 - i)))
}

/** A súlynapló heti átlagai ISO hétfő szerint. Nincs kitöltés: amelyik héten nincs mérés, az a
 *  kulcs nem létezik — a hívó `null`-ként olvassa, nem nullaként. */
export function weeklyWeightAverages(log: { date: string; value: number }[]): Record<string, number> {
  const sums = new Map<string, { sum: number; n: number }>()
  for (const entry of log) {
    const key = mondayOf(entry.date)
    const cell = sums.get(key) ?? { sum: 0, n: 0 }
    cell.sum += entry.value
    cell.n += 1
    sums.set(key, cell)
  }
  return Object.fromEntries([...sums].map(([key, { sum, n }]) => [key, sum / n]))
}

export function useFuelHorizon(endMonday: string): { weeks: HorizonWeek[]; pending: boolean } {
  const mock = isMockMode()
  const { weightLog } = useWeight()
  const mondays = horizonMondays(endMonday)

  // Fix hosszú lista (HORIZON_WEEKS), tehát a hook-sorrend rendereléstől függetlenül állandó.
  //
  // A kulcs és a CACHE-ALAK szándékosan azonos a `useMeWeek`-éval (`['meWeek', monday]` →
  // `MeWeekBootstrap`), hogy a két felület EGY cache-bejegyzést osszon: a megnyitott hetet így
  // nem kérjük le kétszer. Ezért nem `useDualQuery`-t hívunk (az egy kulcsra egy hook), hanem
  // ugyanazt a receptet írjuk ki — beleértve a „valós módban SOSEM a seed" szabályt: valós
  // módban nincs `initialData`, és a feloldatlan hét `null` marad, nem mock-hét.
  const queries = useQueries({
    queries: mondays.map((monday) => ({
      queryKey: ['meWeek', monday],
      queryFn: mock
        ? async () => ({ week: mockMeWeek(monday), mode: 'mock' as const })
        : async () => ({ week: await meWeekApi.get(monday), mode: 'live' as const }),
      initialData: mock ? { week: mockMeWeek(monday), mode: 'mock' as const } : undefined,
      staleTime: mock ? Infinity : DEFAULT_QUERY_STALE_TIME_MS,
    })),
  })

  const byWeek = weeklyWeightAverages(weightLog)
  const weeks: HorizonWeek[] = mondays.map((monday, i) => ({
    startIso: monday,
    label: huMonthDay(monday),
    // `?? null`: a még be nem érkezett és a genuinely-null hét EGYFORMÁN hiány — sosem nulla.
    kcal: queries[i].data?.week?.weekly.avgKcal ?? null,
    weightKg: byWeek[monday] ?? null,
  }))

  return { weeks, pending: !mock && queries.some((q) => q.isPending) }
}
