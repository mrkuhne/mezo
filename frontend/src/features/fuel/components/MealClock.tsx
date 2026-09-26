// ============================================================
// Mezo · MealClock — a blokk MINDIG kint levő órája (mezo-6g52f, owner 2026-09-26: „A · beszédes óra").
// A Titanium óra ikon köré 12 órás számlap-gyűrű: logolás előtt az AJÁNLOTT ív (+ most-pötty és
// halk lüktetés, ha nyitva), logolás után az ív + a LOG pöttye (bent: a blokk színe, kint:
// borostyán — soha piros). A kártyán nincs idő-szöveg a logolt blokkon; a részletek az óra-dobozban.
// Referencia: docs/design_2.0/prototypes/fuel-ora-ablak.html `ring12`.
// ============================================================
import type { ReactNode } from 'react'
import { ContentIcon } from '@/shared/ui/clay'
import { toMin } from '@/data/fuel/fuelConfig'
import { hitOf, hitLabel } from '@/features/fuel/logic/mealWindow'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import { judgedWindow } from '@/features/fuel/components/mealClockWindow'

const L = 720, R = 20.5, C = 22
const pt = (min: number): [number, number] => {
  const a = ((min % L) / L) * 2 * Math.PI - Math.PI / 2
  return [C + R * Math.cos(a), C + R * Math.sin(a)]
}

export function MealClock({ tile, row, nowHHmm, onOpen }: {
  tile: WindowTileVM; row: DoneMealRow | null
  /** Null a múltbéli napokon (mezo-6g52f R4) — nincs „most", nincs most-pötty. */
  nowHHmm: string | null
  onOpen: () => void
}) {
  const w = judgedWindow(tile, row)
  const open = !row && w != null && nowHHmm != null && toMin(nowHHmm) >= toMin(w.from) && toMin(nowHHmm) <= toMin(w.to)
  const hit = row && w ? hitOf(w.from, w.to, row.time) : null
  const aria = row
    ? `${tile.label} · logolva ${row.time}${hit ? ` · ${hitLabel(hit)}` : ''}`
    : w ? `${tile.label} · ajánlott ablak ${w.from}–${w.to}` : `${tile.label} · étkezési idő`
  let marker: ReactNode = null
  if (row) {
    const [x, y] = pt(toMin(row.time))
    marker = <circle className="fmx-mclock-dot" cx={x} cy={y} r={4}
      style={{ fill: hit && hit.kind !== 'in' ? 'var(--amber)' : 'var(--block-color)' }} />
  } else if (open) {
    const [x, y] = pt(toMin(nowHHmm))
    marker = <circle className="fmx-mclock-now" cx={x} cy={y} r={2.6} />
  }
  const start = w ? toMin(w.from) % L : 0
  const len = w ? toMin(w.to) - toMin(w.from) : 0
  return (
    <button type="button" className={`fmx-mclock${open ? ' is-open' : ''}`} onClick={onOpen} aria-label={aria}>
      <svg className="fmx-mclock-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="tr" cx={C} cy={C} r={R} />
        {w && <circle className="win" cx={C} cy={C} r={R} pathLength={L}
          strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-start} transform={`rotate(-90 ${C} ${C})`} />}
        {marker}
      </svg>
      <ContentIcon name="i-idozito" size={25} />
      {open && <i className="fmx-mclock-live" aria-hidden="true" />}
    </button>
  )
}
