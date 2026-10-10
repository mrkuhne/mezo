// ============================================================
// Mezo · WeeklyBandsCard — „Heti szettek · izmonként" in the day editor (mezo-d20.14;
// Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `napszerk()` section 3).
// One row per muscle group of the WEEK: the tier as a status pill (Hangsúly · Építés ·
// Tartás), the weekly step, „now → the top value" and a level showing how far the week is
// from that top. A held (Tartás) group has no level: it says „n szett · tart".
// No percentages anywhere — `pct` only sets the level.
// ============================================================
import type { BandRow } from '@/features/train/logic/weeklyBands'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { Card, Level, Note, Row, St } from '@/shared/ui/folyadek'

const TIER_LABEL = { emphasize: 'Hangsúly', grow: 'Építés', maintain: 'Tartás' } as const
const TIER_TONE = { emphasize: 'ok', grow: 'plan', maintain: 'q' } as const

interface WeeklyBandsCardProps {
  rows: BandRow[]
  /** The card's accessible name (the visible heading is the section title above it). */
  eyebrow?: string
  note?: string
}

export function WeeklyBandsCard({ rows, eyebrow = 'Heti szettek · izmonként', note }: WeeklyBandsCardProps) {
  if (!rows.length) return null
  return (
    <Card className="ee-bands" role="group" aria-label={eyebrow}>
      {rows.map((r) => {
        const held = r.tier === 'maintain'
        return (
          <Row key={r.group} role="group" aria-label={`${r.label} · ${TIER_LABEL[r.tier]}`}
            left={<Mchp muscle={r.group} sm />}
            title={<>{r.label} <St tone={TIER_TONE[r.tier]}>{TIER_LABEL[r.tier]}</St></>}
            sub={held ? undefined : r.step === '+2' ? '▲ +2 / hét' : 'a felső értéken'}
            more={!held && <Level pct={Math.min(100, r.pct)} color={deepMuscle(r.group)} height={10} />}
            value={held ? `${r.planned} szett · tart` : `${r.planned} → ${r.ceiling}`} />
        )
      })}
      {note && <Note>{note}</Note>}
    </Card>
  )
}
