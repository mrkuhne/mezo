// ============================================================
// Mezo · MedalsPage (Medálok) — the medal cabinet (mezo-wp6n, spec
// 2026-07-30-medal-collection-design.md §9.2/§9.3). The full dated history of
// every medal the user has earned, RECORD and TARGET_HIT alike. The server
// replays the entire existing set history to build this (§3/§13), so the
// cabinet can already be full of medals on first open — the honest-backfill
// line below the counter chip says so, rather than letting it read as if every
// row happened live.
//
// Grouped by date, newest first. Within a date the incoming (server) order is
// kept — unlike WorkoutSummary's medal block, which sorts RECORD-first for a
// single session's recap, the cabinet is a chronological record and must not
// re-sort by tier.
//
// Row idiom + tier copy mirror WorkoutSummary's "Medálok" block (Task 9):
// RECORD reads as the achievement (amber, 🏅); TARGET_HIT stays quiet (sage,
// ✓) — the two-tier split holds here too. A RECORD row additionally names what
// it beat (previousValue), the way MedalToast does; TARGET_HIT never carries a
// previousValue (nothing was beaten), so it gets no such slot.
// ============================================================
import { useMedals } from '@/data/hooks'
import type { Medal } from '@/data/train/medalTypes'
import {
  MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel,
} from '@/features/train/logic/medalLabels'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

// Same two-tier split as WorkoutSummary's medal block (mezo-wp6n).
const MEDAL_TIER_COPY: Record<Medal['tier'], { glyph: string; color: string }> = {
  RECORD: { glyph: '🏅', color: 'var(--amber-deep)' },
  TARGET: { glyph: '✓', color: 'var(--sage-deep)' },
}

interface DateGroup { date: string; medals: Medal[] }

// Newest date group first; medals within a date keep the incoming order (no
// tier re-sort — see the module note above).
function groupByDate(medals: Medal[]): DateGroup[] {
  const byDate = new Map<string, Medal[]>()
  for (const m of medals) {
    const list = byDate.get(m.date)
    if (list) list.push(m)
    else byDate.set(m.date, [m])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, ms]) => ({ date, medals: ms }))
}

function MedalRow({ medal }: { medal: Medal }) {
  const tierCopy = MEDAL_TIER_COPY[medal.tier]
  const typeLabel = MEDAL_TYPE_LABEL[medal.type] ?? medal.type
  return (
    <div className="card row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
      <span aria-hidden="true" style={{ color: tierCopy.color, fontSize: 14, width: 20, textAlign: 'center' }}>
        {tierCopy.glyph}
      </span>
      <span className="col flex-1" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{medal.exerciseName}</span>
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {typeLabel}
        </span>
        {/* RECORD only — TARGET_HIT never carries a previousValue (nothing beaten).
            previousDate can be null (mock-mode medalEvaluator shape) — drop the
            "…óta állt" clause cleanly rather than render a dangling date. */}
        {medal.tier === 'RECORD' && medal.previousValue != null && (
          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {`Előző: ${formatMedalNumber(medal.previousValue)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trim()}
            {medal.previousDate ? ` · ${huMonthDay(medal.previousDate)} óta állt` : ''}
          </span>
        )}
      </span>
      <span className="label-mono" style={{ fontSize: 9, color: tierCopy.color, flexShrink: 0 }}>
        {medalValueLabel(medal)}
      </span>
    </div>
  )
}

// Simple, layout-aware loading placeholder (mezo-f2z idiom) — never the seed
// while the real-mode query is unresolved.
function MedalsLoadingSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="pghead-np">
        <div className="col gap-xs"><Skeleton width={90} height={11} /><Skeleton width={110} height={20} /></div>
      </div>
      <div style={{ padding: '0 24px 16px' }}>
        <Skeleton width={78} height={24} radius={999} />
      </div>
      <div style={{ padding: '0 24px 32px' }}>
        <Skeleton width={90} height={9} style={{ marginBottom: 8 }} />
        <div className="col gap-sm">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 12 }}>
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <Skeleton variant="circle" width={20} height={20} />
                <div className="col gap-xs flex-1">
                  <Skeleton width="55%" height={13} />
                  <Skeleton width="35%" height={9} />
                </div>
                <Skeleton width={40} height={9} />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MedalsPage() {
  const { data: medals, isPending } = useMedals()

  if (isPending) return <MedalsLoadingSkeleton />

  const groups = groupByDate(medals)

  return (
    <>
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Medálok</div>
          <h1>Medálok</h1>
        </div>
      </div>

      {medals.length === 0 ? (
        <div style={{ padding: '0 24px 32px' }}>
          <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>
            Még nincs medálod — az első megdöntött rekord ide kerül.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: '0 24px 16px' }}>
            <span className="chip">{medals.length} medál</span>
            {/* Honest backfill note (spec §13 "Backfill surprise"): the server replays
                the whole existing set history, so the cabinet can already be full on
                first open — this says so instead of implying every row was live. */}
            <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>
              A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted.
            </p>
          </div>
          <div style={{ padding: '0 24px 32px' }}>
            <div className="col gap-md">
              {groups.map((g) => (
                <div key={g.date}>
                  <div className="label-mono text-tertiary" style={{ fontSize: 9, marginBottom: 8 }}>
                    {huMonthDayDow(g.date)}
                  </div>
                  <div className="col gap-sm">
                    {g.medals.map((m, i) => (
                      <MedalRow key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} medal={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
