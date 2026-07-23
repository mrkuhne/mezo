import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'
import { SPORT_KINDS, SPORT_EMOJI, sportOf, type SportKind } from '@/features/train/logic/sportKinds'

/** Weekly load summary tiles (spec §4.3 — "GYM 5×·75p / RÖPLABDA 4×·6,5h / FUTÁS 2×"). */
export type LoadTile = { kind: 'gym' | 'sport' | 'run'; label: string; icon: string; value: string }

const SPORT_TILE_LABELS: Record<SportKind, string> = { volleyball: 'Röplabda', cross: 'Cross', trx: 'TRX' }

/** 390 → "6,5h" (hu decimal comma), 120 → "2h". */
function hoursHu(mins: number): string {
  const rounded = Math.round((mins / 60) * 10) / 10
  const s = rounded.toString().replace('.', ',')
  return `${s}h`
}

export function weeklyLoad(agenda: Pick<WeeklyAgendaDay, 'gym' | 'sport' | 'running' | 'custom'>[]): LoadTile[] {
  const tiles: LoadTile[] = []

  const gymDays = agenda.filter((a) => a.gym)
  // Completed custom (saját) sessions are real gym load — they add to the count (mezo-ws2x).
  const customCount = agenda.reduce((n, a) => n + (a.custom?.length ?? 0), 0)
  const gymCount = gymDays.length + customCount
  if (gymCount) {
    const durs = gymDays.map((a) => a.gym!.duration).filter((d): d is number => d != null)
    const avg = durs.length ? Math.round(durs.reduce((x, y) => x + y, 0) / durs.length) : null
    tiles.push({ kind: 'gym', label: 'Gym', icon: '🏋️', value: avg ? `${gymCount}× · ${avg}p` : `${gymCount}×` })
  }

  for (const k of SPORT_KINDS) {
    const slots = agenda.flatMap((a) => a.sport).filter((s) => sportOf(s) === k)
    if (!slots.length) continue
    const total = slots.reduce((x, s) => x + (s.duration ?? 0), 0)
    tiles.push({
      kind: 'sport', label: SPORT_TILE_LABELS[k], icon: SPORT_EMOJI[k],
      value: total ? `${slots.length}× · ${hoursHu(total)}` : `${slots.length}×`,
    })
  }

  const runs = agenda.flatMap((a) => a.running)
  if (runs.length) {
    // Headline the week's dominant running style by intensity (sprint > pyramid > steady).
    // steady is a real API kind — map it to 'tempó' instead of collapsing it into 'piramis'.
    const kinds = new Set(runs.map((r) => r.kind))
    const kindLabel = kinds.has('sprint') ? 'sprint' : kinds.has('pyramid') ? 'piramis' : 'tempó'
    tiles.push({ kind: 'run', label: 'Futás', icon: '🏃', value: `${runs.length}× · ${kindLabel}` })
  }

  return tiles
}
