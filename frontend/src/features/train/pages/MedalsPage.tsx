// ============================================================
// Mezo · MedalsPage (Medálok) — Mozaik 2.0 re-face (mezo-d20.3.2).
// Source of truth: docs/design_2.0/prototypes/src/edzes-body.html #page-medal
// (p-gold tone, ×1.18): compact-subpage-hero (s-medal spot + total count, "ebből
// N e hónapban" sub) → date-grouped `.mz-facttile` cabinet rows (REKORD/CÉL
// chip mirrors the prototype's qxp pill) → the honest backfill line. The
// server replays the entire existing set history to build this (spec
// 2026-07-30-medal-collection-design.md §3/§13), so the cabinet can already be
// full of medals on first open — the backfill line says so rather than
// letting it read as if every row happened live.
//
// Grouped by date, newest first. Within a date the incoming (server) order is
// kept — unlike WorkoutSummary's medal block, which sorts RECORD-first for a
// single session's recap, the cabinet is a chronological record and must not
// re-sort by tier. Every data hook + the grouping/labels are verbatim from
// before this slice — only the face changed.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { useMedals } from '@/data/hooks'
import type { Medal } from '@/data/train/medalTypes'
import {
  MEDAL_TIER_COPY, MEDAL_TYPE_LABEL, MEDAL_UNIT_LABEL, formatMedalNumber, medalValueLabel,
} from '@/features/train/logic/medalLabels'
import { huMonthDay, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { ClaySpot } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'

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
    <div className="mz-facttile mz-w-gold">
      <span className="mz-fic" aria-hidden="true" style={{ fontSize: 15, color: tierCopy.color }}>{tierCopy.glyph}</span>
      <span className="mz-fact-grow">
        <span className="mz-fact-tx" style={{ display: 'block', fontWeight: 700 }}>{medal.exerciseName}</span>
        <span className="label-mono" style={{ display: 'block', fontSize: 9, color: 'var(--mz-ink-mut)', marginTop: 2 }}>
          {typeLabel}
        </span>
        {/* RECORD only — TARGET_HIT never carries a previousValue (nothing beaten).
            previousDate can be null (mock-mode medalEvaluator shape) — drop the
            "…óta állt" clause cleanly rather than render a dangling date. */}
        {medal.tier === 'RECORD' && medal.previousValue != null && (
          <span className="mz-fact-sb" style={{ display: 'block' }}>
            {`Előző: ${formatMedalNumber(medal.previousValue)} ${MEDAL_UNIT_LABEL[medal.unit] ?? ''}`.trim()}
            {medal.previousDate ? ` · ${huMonthDay(medal.previousDate)} óta állt` : ''}
          </span>
        )}
      </span>
      <span
        className="mz-qxp"
        style={medal.tier === 'RECORD' ? undefined : { color: 'var(--mz-cell-sage-ink)', background: 'var(--mz-cell-sage-bg)' }}
      >
        {medal.tier === 'RECORD' ? 'REKORD' : 'CÉL'}
      </span>
      <span className="label-mono" style={{ fontSize: 9, color: tierCopy.color, flexShrink: 0, marginLeft: 6 }}>
        {medalValueLabel(medal)}
      </span>
    </div>
  )
}

function MedalsLoadingSkeleton() {
  return (
    <div role="status" aria-label="Betöltés…">
      <div className="mz-page-head"><Skeleton width={60} height={16} /></div>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '9px 17px 14px' }}>
        <Skeleton width={110} height={18} />
        <Skeleton variant="circle" width={58} height={58} />
        <Skeleton width={70} height={40} />
      </div>
      <div style={{ padding: '2px 17px 19px' }}>
        <div className="col gap-sm">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} style={{ padding: 13 }}>
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
  const navigate = useNavigate()
  const { data: medals, isPending } = useMedals()

  if (isPending) return <MedalsLoadingSkeleton />

  const groups = groupByDate(medals)
  const thisMonth = localDateString().slice(0, 7)
  const monthCount = medals.filter((m) => m.date.startsWith(thisMonth)).length

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/train')} label="‹ Edzés" />
      <EntranceGroup>
        {/* PageHero's `icon` is a ClayIconName (small tile icons) — the hero here
            wants the bigger clay SPOT the prototype uses (`s-medal`, 58px), so the
            anatomy is hand-rolled with the same mz-page-hero/-hero-row/-bignum/-sb
            classes rather than stretching the shared primitive's icon prop. */}
        <div className="mz-page-hero" data-kalauz-anchor="medals-hero">
          <div className="mz-hero-nm">Medálok</div>
          <div className="mz-hero-row">
            <ClaySpot name="s-medal" size={58} />
            <span className="mz-bignum">{medals.length}</span>
          </div>
          {medals.length > 0 && <div className="mz-hero-sb">{`ebből ${monthCount} e hónapban`}</div>}
        </div>
        <PageBody>
          {medals.length === 0 ? (
            <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>
              Még nincs medálod — az első megdöntött rekord ide kerül.
            </p>
          ) : (
            <>
              <span className="chip">{medals.length} medál</span>
              {/* Honest backfill note (spec §13 "Backfill surprise"): the server replays
                  the whole existing set history, so the cabinet can already be full on
                  first open — this says so instead of implying every row was live. */}
              <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, margin: '10px 0 16px' }}>
                A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted.
              </p>
              {/* The prototype's #page-medal stagger: each date group's eyebrow +
                  its cards ride one running 60ms cadence (40 · 100 · 160 …). The
                  armed EntranceGroup above was shipping with nothing to animate. */}
              <div className="col gap-md">
                {(() => {
                  let d = 40
                  const nextD = () => { const v = d; d += 60; return v }
                  return groups.map((g) => (
                    <div key={g.date}>
                      <span
                        className="mz-eyebrow rise"
                        style={{ display: 'block', marginBottom: 8, '--d': `${nextD()}ms` } as React.CSSProperties}
                      >
                        {huMonthDayDow(g.date)}
                      </span>
                      <div className="col gap-sm">
                        {g.medals.map((m, i) => (
                          <div
                            key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`}
                            className="rise"
                            style={{ '--d': `${nextD()}ms` } as React.CSSProperties}
                          >
                            <MedalRow medal={m} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </>
          )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
