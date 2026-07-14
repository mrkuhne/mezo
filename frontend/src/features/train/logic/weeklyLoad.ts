import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

/** Weekly load summary tiles (spec §4.3 — "GYM 5×·75p / RÖPLABDA 4×·6,5h / FUTÁS 2×"). */
export type LoadTile = { kind: 'gym' | 'sport' | 'run'; label: string; icon: string; value: string }

/** 390 → "6,5h" (hu decimal comma), 120 → "2h". */
function hoursHu(mins: number): string {
  const rounded = Math.round((mins / 60) * 10) / 10
  const s = rounded.toString().replace('.', ',')
  return `${s}h`
}

export function weeklyLoad(agenda: Pick<WeeklyAgendaDay, 'gym' | 'volleyball' | 'running'>[]): LoadTile[] {
  const tiles: LoadTile[] = []

  const gymDays = agenda.filter((a) => a.gym)
  if (gymDays.length) {
    const durs = gymDays.map((a) => a.gym!.duration).filter((d): d is number => d != null)
    const avg = durs.length ? Math.round(durs.reduce((x, y) => x + y, 0) / durs.length) : null
    tiles.push({ kind: 'gym', label: 'Gym', icon: '🏋️', value: avg ? `${gymDays.length}× · ${avg}p` : `${gymDays.length}×` })
  }

  const vbDays = agenda.filter((a) => a.volleyball)
  if (vbDays.length) {
    const total = vbDays.reduce((x, a) => x + (a.volleyball!.duration ?? 0), 0)
    tiles.push({ kind: 'sport', label: 'Röplabda', icon: '🏐', value: total ? `${vbDays.length}× · ${hoursHu(total)}` : `${vbDays.length}×` })
  }

  const runs = agenda.flatMap((a) => a.running)
  if (runs.length) {
    const kind = runs.some((r) => r.kind === 'sprint') ? 'sprint' : 'piramis'
    tiles.push({ kind: 'run', label: 'Futás', icon: '🏃', value: `${runs.length}× · ${kind}` })
  }

  return tiles
}
